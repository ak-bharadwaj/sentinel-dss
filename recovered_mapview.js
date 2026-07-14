Created At: 2026-06-12T16:06:12Z
Completed At: 2026-06-12T16:06:13Z
File Path: `file:///c:/Users/dorni/OneDrive/Desktop/project/frontend/components/MapView.js`
Total Lines: 369
Total Bytes: 13746
Showing lines 1 to 369
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import { useEffect, useRef } from "react";
2: import "leaflet/dist/leaflet.css";
3: 
4: export default function MapView({ nodes, edges, agents, simulationTime = 0 }) {
5:   const mapRef = useRef(null);
6:   const leafletMap = useRef(null);
7:   const hasZoomed = useRef(false);
8:   const layersRef = useRef({
9:     nodes: null,
10:     edges: null,
11:     agents: null,
12:     routes: null
13:   });
14: 
15:   if (simulationTime === 0) {
16:     hasZoomed.current = false;
17:   }
18: 
19:   useEffect(() => {
20:     // Dynamically load Leaflet on client side
21:     const L = require("leaflet");
22:     
23:     // Fix default marker icon assets
24:     delete L.Icon.Default.prototype._getIconUrl;
25:     L.Icon.Default.mergeOptions({
26:       iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
27:       iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
28:       shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
29:     });
30: 
31:     if (!leafletMap.current) {
32:       // Bounding box center of SF
33:       const map = L.map(mapRef.current, {
34:         zoomControl: true,
35:         attributionControl: false
36:       }).setView([37.7749, -122.4194], 14);
37: 
38:       // Add modern premium dark mode map tiles
39:       L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
40:         maxZoom: 20
41:       }).addTo(map);
42: 
43:       leafletMap.current = map;
44:       
45:       // Initialize Layer G
<truncated 11931 bytes>
onSvg = isScout 
331:           ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 17 10-10 10 10"/></svg>` 
332:           : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
333: 
334:         const agentIcon = L.divIcon({
335:           className: "custom-agent-icon",
336:           html: `<div style="
337:             background-color: ${color}; 
338:             color: white; 
339:             width: 24px; 
340:             height: 24px; 
341:             border-radius: 50%; 
342:             display: flex; 
343:             align-items: center; 
344:             justify-content: center;
345:             border: 2px solid #ffffff;
346:             box-shadow: 0 0 12px ${color};
347:             transform: scale(1.1);
348:           ">${iconSvg}</div>`,
349:           iconSize: [24, 24],
350:           iconAnchor: [12, 12]
351:         });
352: 
353:         const marker = L.marker(coord, { icon: agentIcon });
354:         marker.bindPopup(`
355:           <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">
356:             <b>Agent:</b> ${agent.id} (${agent.agent_type})<br/>
357:             <b>Operational state:</b> <span style="font-weight: 700; color: ${color};">${agent.status}</span><br/>
358:             <b>Survivors Onboard:</b> <span style="font-weight: 700; color: #f59e0b;">${agent.survivors_onboard || 0}</span>
359:           </div>
360:         `);
361:         agentLayer.addLayer(marker);
362:       }
363:     });
364: 
365:   }, [nodes, edges, agents]);
366: 
367:   return <div ref={mapRef} className="map-container" />;
368: }
369: 
The above content shows the entire, complete file contents of the requested file.
