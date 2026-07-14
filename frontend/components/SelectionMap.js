import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export default function SelectionMap({
  centerLat = 19.0760,
  centerLon = 72.8777,
  span = 0.06,
  onChange,
  mapHeight = "160px"
}) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const cornerMarkerRef = useRef(null);
  const rectangleRef = useRef(null);
  const [currentSpan, setCurrentSpan] = useState(span);
  // ── KEY FIX: keep a ref so closures always see the latest span ──
  const spanRef = useRef(span);
  const onChangeRef = useRef(onChange);

  // Keep refs current on every render
  useEffect(() => { spanRef.current = currentSpan; }, [currentSpan]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const updateRectangle = (lat, lon, s) => {
    if (rectangleRef.current) {
      rectangleRef.current.setBounds([
        [lat - s, lon - s],
        [lat + s, lon + s]
      ]);
    }
  };

  // ── Initialise map once ───────────────────────────────────────────────────
  useEffect(() => {
    const L = require("leaflet");

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });

    if (leafletMap.current) return; // already initialised

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([centerLat, centerLon], 12);

    // Google Maps style tile (CartoDB Voyager)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;

    const initSpan = spanRef.current;

    // ── Crosshair center marker ──────────────────────────────────────────
    const crosshairIcon = L.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(79,70,229,0.85);border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:move;font-size:14px;">✛</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([centerLat, centerLon], {
      draggable: true,
      title: "Drag to move box",
      icon: crosshairIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    markerRef.current = marker;

    // ── Bounding box rectangle ──────────────────────────────────────────
    const rectangle = L.rectangle(
      [[centerLat - initSpan, centerLon - initSpan], [centerLat + initSpan, centerLon + initSpan]],
      { color: "#4f46e5", weight: 2, fill: false, dashArray: "6,4", interactive: true }
    ).addTo(map);
    rectangleRef.current = rectangle;

    // ── Corner resize handle ─────────────────────────────────────────────
    const cornerMarker = L.marker([centerLat - initSpan, centerLon + initSpan], {
      draggable: true,
      title: "Drag to resize",
      icon: L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#4f46e5;border:2.5px solid #fff;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.4);cursor:se-resize;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map);
    cornerMarkerRef.current = cornerMarker;

    // ── Drag rectangle to MOVE entire box ──────────────────────────────
    let isDragging = false;
    let dragStartLatLng = null;
    let dragStartCenter = null;

    rectangle.on("mousedown", (e) => {
      // Stop map from receiving the event
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
      isDragging = true;
      dragStartLatLng = e.latlng;
      dragStartCenter = marker.getLatLng();
      map.dragging.disable();
      map.getContainer().style.cursor = "grabbing";
    });

    map.on("mousemove", (e) => {
      if (!isDragging) return;
      const s = spanRef.current;
      const dLat = e.latlng.lat - dragStartLatLng.lat;
      const dLng = e.latlng.lng - dragStartLatLng.lng;
      const newLat = dragStartCenter.lat + dLat;
      const newLng = dragStartCenter.lng + dLng;
      marker.setLatLng([newLat, newLng]);
      rectangle.setBounds([[newLat - s, newLng - s], [newLat + s, newLng + s]]);
      cornerMarker.setLatLng([newLat - s, newLng + s]);
    });

    map.on("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      map.dragging.enable();
      map.getContainer().style.cursor = "";
      const pos = marker.getLatLng();
      if (onChangeRef.current) onChangeRef.current(pos.lat, pos.lng, spanRef.current);
    });

    rectangle.on("mouseover", () => { if (!isDragging) map.getContainer().style.cursor = "grab"; });
    rectangle.on("mouseout", () => { if (!isDragging) map.getContainer().style.cursor = ""; });

    // ── Center marker drag → moves box ─────────────────────────────────
    marker.on("drag", () => {
      const pos = marker.getLatLng();
      const s = spanRef.current;
      rectangle.setBounds([[pos.lat - s, pos.lng - s], [pos.lat + s, pos.lng + s]]);
      cornerMarker.setLatLng([pos.lat - s, pos.lng + s]);
    });

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      if (onChangeRef.current) onChangeRef.current(pos.lat, pos.lng, spanRef.current);
    });

    // ── Corner marker drag → resizes box ────────────────────────────────
    cornerMarker.on("drag", () => {
      const cPos = cornerMarker.getLatLng();
      const mPos = marker.getLatLng();
      const newSpan = Math.max(0.015, Math.min(0.12, Math.max(
        Math.abs(cPos.lat - mPos.lat),
        Math.abs(cPos.lng - mPos.lng)
      )));
      cornerMarker.setLatLng([mPos.lat - newSpan, mPos.lng + newSpan]);
      rectangle.setBounds([[mPos.lat - newSpan, mPos.lng - newSpan], [mPos.lat + newSpan, mPos.lng + newSpan]]);
      spanRef.current = newSpan;
      setCurrentSpan(newSpan);
    });

    cornerMarker.on("dragend", () => {
      const mPos = marker.getLatLng();
      const s = spanRef.current;
      if (onChangeRef.current) onChangeRef.current(mPos.lat, mPos.lng, s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only ONCE on mount

  // ── Respond to external centerLat/centerLon changes (Quick Jump) ────────
  useEffect(() => {
    if (!leafletMap.current || !markerRef.current) return;
    const pos = markerRef.current.getLatLng();
    if (Math.abs(pos.lat - centerLat) > 0.001 || Math.abs(pos.lng - centerLon) > 0.001) {
      const s = spanRef.current;
      markerRef.current.setLatLng([centerLat, centerLon]);
      leafletMap.current.setView([centerLat, centerLon], 12);
      updateRectangle(centerLat, centerLon, s);
      if (cornerMarkerRef.current) {
        cornerMarkerRef.current.setLatLng([centerLat - s, centerLon + s]);
      }
    }
  }, [centerLat, centerLon]);

  // ── Respond to external span changes (slider in parent) ─────────────────
  useEffect(() => {
    if (!leafletMap.current || !markerRef.current) return;
    spanRef.current = span;
    setCurrentSpan(span);
    const pos = markerRef.current.getLatLng();
    updateRectangle(pos.lat, pos.lng, span);
    if (cornerMarkerRef.current) {
      cornerMarkerRef.current.setLatLng([pos.lat - span, pos.lng + span]);
    }
  }, [span]);

  // ── Slider ───────────────────────────────────────────────────────────────
  const handleSliderChange = (e) => {
    const newSpan = parseFloat(e.target.value);
    spanRef.current = newSpan;
    setCurrentSpan(newSpan);
    if (markerRef.current) {
      const pos = markerRef.current.getLatLng();
      updateRectangle(pos.lat, pos.lng, newSpan);
      if (cornerMarkerRef.current) {
        cornerMarkerRef.current.setLatLng([pos.lat - newSpan, pos.lng + newSpan]);
      }
      if (onChangeRef.current) onChangeRef.current(pos.lat, pos.lng, newSpan);
    }
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const s = spanRef.current;
        leafletMap.current.setView([lat, lon], 12);
        markerRef.current.setLatLng([lat, lon]);
        updateRectangle(lat, lon, s);
        if (cornerMarkerRef.current) cornerMarkerRef.current.setLatLng([lat - s, lon + s]);
        if (onChangeRef.current) onChangeRef.current(lat, lon, s);
      } else {
        alert("Location not found. Please try a different query.");
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const spanInKm = Math.round(currentSpan * 111 * 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          placeholder="🔍 Search city (e.g. Paris, Tokyo, Mumbai)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="select-input-sidebar"
          style={{ flex: 1, padding: "5px 10px", fontSize: "0.7rem" }}
          disabled={searching}
        />
        <button
          type="submit"
          className="btn"
          style={{ padding: "5px 10px", fontSize: "0.68rem", background: "rgba(99,102,241,0.15)", borderColor: "#6366f1" }}
          disabled={searching}
        >
          {searching ? "Searching..." : "Go"}
        </button>
      </form>

      <div
        ref={mapRef}
        style={{
          height: mapHeight,
          width: "100%",
          borderRadius: mapHeight === "100%" ? "0" : "8px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)"
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem" }}>
          <span style={{ color: "var(--text-secondary)", fontWeight: "600" }}>TACTICAL AREA DIAMETER</span>
          <span style={{ color: "#6366f1", fontWeight: "700" }}>~{spanInKm} km ({currentSpan.toFixed(3)}°)</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Narrow</span>
          <input
            type="range"
            min="0.015"
            max="0.12"
            step="0.005"
            value={currentSpan}
            onChange={handleSliderChange}
            style={{ flex: 1, accentColor: "#6366f1", height: "4px" }}
          />
          <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Metropolitan</span>
        </div>
      </div>
    </div>
  );
}
