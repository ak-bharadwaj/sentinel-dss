# SENTINEL DSS — Frontend Research & Upgrade Notes
> Temp working document. Research complete. Do NOT implement until full plan is locked.
> Sources: ESRI ArcGIS, Motorola PremierOne CAD, Tyler New World CAD, Hexagon HxGN, FEMA NAPSG, NIMS/ICS, NATO APP-6/MIL-STD-2525, milsymbol.js, OCHA Humanitarian Icons, Leaflet.js ecosystem.

---

## Area 1: Unit / Agent Markers

### Industry Standard (CAD / ESRI ArcGIS Mission / Hexagon HxGN OnCall)
- Primary icon style: **directional chevron/arrow** that rotates to heading direction — NOT a static circle
- Arrow rotates smoothly with GPS/AVL heading; when speed = 0, converts to circle/dot
- When GPS data is stale (> 90s), icon **desaturates to gray** — critical staleness indicator
- **Callsign label** always visible above/beside marker at zoom ≥ 14 (white text, dark bg pill)
- Hide labels at zoom < 12 to reduce clutter
- **Status corner dot**: small 6–8px colored dot in bottom-right corner of marker (see colors below)
- Emergency/panic → marker **flashes red** with `@keyframes blink` + map **auto-centers**
- Multiple units at same node → **dynamic offset jitter** (5–15px stagger) at zoom 14+; switch to **`Leaflet.markercluster` spiderfy** at zoom < 13
- Size: **28–36px** at zoom 14–16; **16–20px** at zoom < 12
- Always use **inline SVG** (not raster PNG) for crisp rendering at any DPR

### Unit Type Color Standards (Cross-agency consensus)
| Unit Type | Fill Color | Hex |
|---|---|---|
| Rescue / USAR | Orange | `#E65100` |
| Scout / Recon | Cyan-Blue | `#0288D1` |
| Medical / EMS | Green | `#2E7D32` |
| Fire / Engine | Red | `#C62828` |
| Command / IC | Gold | `#F9A825` |
| HAZMAT | Purple | `#6A1B9A` |
| Unknown | Gray | `#546E7A` |

### Status Color Standards (Universal CAD/EOC)
| Status | Color | Hex | Animation |
|---|---|---|---|
| AVAILABLE | Green | `#4CAF50` | None |
| MOVING / EN_ROUTE | Blue | `#2196F3` | Gentle pulse |
| ON_SCENE / RESCUING | Red | `#F44336` | None |
| RETURNING | Teal | `#00BCD4` | None |
| STANDBY | Gray | `#9E9E9E` | None |
| EMERGENCY | Red | `#FF0000` | Flash/blink |

### Our App Gaps
| Feature | Standard | Ours | Fix |
|---|---|---|---|
| Heading arrow | ✅ Rotates to bearing | ❌ Static circle | CSS `transform: rotate(Xdeg)` on divIcon |
| Permanent callsign | ✅ Always visible ≥ z14 | ❌ Popup only | `bindTooltip(id, {permanent:true, direction:'top'})` |
| Status corner dot | ✅ 6-8px colored dot | ❌ Pulsing ring | Small dot overlay bottom-right |
| Stale data | ✅ Desaturate > 90s | ❌ Missing | Track `last_updated`, apply grayscale filter |
| Emergency flash | ✅ Blink red | ❌ Missing | `@keyframes blink` on EMERGENCY |
| Stack handling | ✅ Jitter + cluster | ❌ Overlapping | Offset lat/lon by index; add markercluster |
| Icon shape | Chevron/arrow | Circle | Redesign SVG to chevron shape |
| Size | 28–36px | 18–28px | Increase base size |

---

## Area 2: Route / Path Visualization

### Industry Color Convention (Google Maps / ESRI / Military / NAPSG)
| Route State | Color | Hex | Weight | Style |
|---|---|---|---|---|
| Planned / future | Amber/Yellow | `#FFC107` | 3–4px | Dashed `5,5`, NO animation |
| Active / traversing | Bright Blue | `#0288D1` | 5–7px | Solid + **animated marching ants** |
| Completed | Green | `#388E3C` | 3px | Solid, **40–60% opacity** (faded) |
| Blocked / impassable | Red | `#D32F2F` | 6–8px | Bold solid + ⊗ markers at ends |
| Alternate / detour | Purple | `#7B1FA2` | 3px | Long dash `10,5` |

### "Casing" Technique (Google Maps / ESRI Style)
Every route line is rendered as **two stacked polylines**:
1. Bottom: same path, +2px wider, dark color (e.g., `rgba(0,0,0,0.4)`) — acts as shadow/outline
2. Top: colored route line at intended weight
This creates the 3D depth effect seen in Google Maps directions.

### Animation Techniques (Industry Standard)
- **Active route**: CSS `stroke-dashoffset` animation = "marching ants" (dashes appear to flow in direction of travel)
- **Planned route**: Static dashed, no animation — animation would be distracting
- **Moving dot**: Small pulsing circle marker that traverses the active path — used in military briefing tools
- **Progressive draw**: `stroke-dashoffset` decreasing = route draws itself as unit moves (dramatic reveal)
- Waypoints at key junctions: small 6–8px filled circles with white border; numbered sequentially (WP1, WP2…)
- Hide waypoint labels at zoom < 13

### Our App Gaps
| Feature | Standard | Ours | Fix |
|---|---|---|---|
| Active route animation | Marching ants (CSS/plugin) | Static dashes | CSS `stroke-dashoffset` animation |
| Completed opacity | 40–60% faded | 95% (too bright) | Reduce to `opacity: 0.55` |
| Casing (shadow) | ✅ Two-layer polyline | ❌ Single layer | Add dark underlay polyline |
| Moving dot | ✅ Pulsing dot on path | ❌ Missing | Small `L.circleMarker` animated along route |
| Waypoint markers | ✅ Numbered circles | ❌ Missing | `L.circleMarker` at each node |
| Color convention | Blue=active, amber=planned | Cyan=planned | Align to `#0288D1` / `#FFC107` |

---

## Area 3: Hazard / Blockage Overlays

### FEMA NAPSG / NIMS / OCHA Standard Colors
| Hazard Type | Fill Color | Hex | Opacity | Pattern |
|---|---|---|---|---|
| Flood / Water Inundation | Blue | `#1565C0` | 40% | 45° diagonal hatch |
| Fire Hazard Zone | Red-Orange | `#E64A19` | 45% | 135° diagonal hatch |
| Structural Collapse | Dark Gray | `#37474F` | 50% | Crosshatch |
| HAZMAT | Purple | `#6A1B9A` | 40% | Diagonal hatch |
| Evacuation (Mandatory) | Red | `#B71C1C` | 35% | Solid |
| Evacuation (Warning) | Orange | `#F57C00` | 35% | Solid |
| Cleared / Safe Zone | Green | `#1B5E20` | 30% | Solid |
| Unknown / Unassessed | Gray | `#78909C` | 30% | Dotted border |

### Zone Boundary Rules
- Active hazard: **3px solid** border in zone's primary color
- Proposed/unconfirmed: **2px dashed**
- Expired/lifted: **1px dotted** gray, 10–15% opacity fill

### NAPSG Frame / Icon Shape Standard
| Shape | Usage |
|---|---|
| **Diamond** | Active hazard incidents |
| **Circle** | Operational resources |
| **Rectangle** | Assets and facilities |
| **Triangle** | Caution / warning zones |

### Fill Pattern Standard
- **Always use SVG `<pattern>` hatching** over polygon fills — NOT solid fill
- Solid fill obscures base map; hatch allows roads/buildings to remain readable underneath
- Rule: **80%+ base map readability** through any hazard overlay
- Road closures: thick red line + **⊗ icon** at each endpoint (like real closure sign)
- Safe corridors: green lines with **directional arrows** pointing toward safety

### Our App Gaps
| Feature | Standard | Ours | Fix |
|---|---|---|---|
| Flood zone polygon | ✅ Blue hatch polygon | ❌ Only road lines | Add polygon flood zone layer |
| Road closure end markers | ✅ ⊗ at endpoints | ❌ Line only | `L.divIcon` ⊗ at both endpoints |
| Hatch fill | ✅ SVG `<pattern>` | ❌ Solid | `<defs><pattern>` inline SVG |
| Safe corridor arrows | ✅ Green directional | ❌ Missing | Arrowhead polyline |
| Hazard type colors | NAPSG standard | Mixed | Align to table above |

---

## Area 4: Status Panel / Sidebar (EOC Standard)

### Unit Card Structure (CAD Standard)
```
┌─────────────────────────────────────────┐
│ 🚒  RESCUE-01              [● MOVING]  │
├─────────────────────────────────────────┤
│ Location:  Mission St & 16th St         │
│ Objective: Evacuate Zone C              │
│ ETA:       4 min                        │
│ Progress:  ████████░░  80%             │
│ Survivors: 3 onboard                   │
├─────────────────────────────────────────┤
│ [📍 Track]  [📡 Contact]  [↗ Dispatch] │
└─────────────────────────────────────────┘
```

### Per-Unit Information (Required Fields)
1. **Unit callsign / ID** — large, bold, high contrast
2. **Unit type icon** — SVG icon matching unit type
3. **Status badge pill** — color-coded (never color-only, always text + color)
4. **Current assignment / objective name**
5. **Current location** (street address or node name)
6. **ETA** — if en route, shows countdown (compute from remaining nodes × avg speed)
7. **Progress bar** — % of route complete `(currentNodeIdx / totalRouteNodes) * 100`
8. **Survivors / Cargo onboard** — if applicable
9. **Last updated timestamp** — grays out if > 90s stale

### Sidebar Header Summary Bar (Required)
```
DEPLOYED: 5/5  |  OBJECTIVES: 2/4  |  RESCUED: 12  |  T+00:42:15
```

### Mission Objective Tracking
- **Vertical stepper**: Phase indicators (Dispatch → En Route → On Scene → Treating → Clear)
- **Active phase glows/pulses**
- **Kanban option**: Available | Dispatched | On Scene | Returning column board

### Bidirectional Map ↔ Sidebar Linking (Non-Negotiable)
- Click marker on map → sidebar **scrolls + highlights** that unit card
- Click unit card → map **pans + zooms** to that unit's position
- Implemented via: `selectedAgentId` state prop propagated both ways

### Dark Theme Color Tokens (IBM Carbon / Red Hat PatternFly Inspired)
```
Background:        #0D1117
Card surface:      #1E2329
Card border:       #30363D
Primary text:      #E6EDF3
Secondary text:    #8B949E
Accent/focus:      #58A6FF
Success:           #3FB950
Warning:           #D29922
Danger:            #F85149
```

### Our App Gaps
| Feature | Standard | Ours | Fix |
|---|---|---|---|
| Status badge pills | ✅ color + text + icon | ❌ text only | Styled `<span>` pill per status |
| ETA per unit | ✅ | ❌ | Remaining nodes × avg speed |
| Progress bar | ✅ % complete | ❌ step count | `(idx/total)*100` width bar |
| Map↔Sidebar link | ✅ bidirectional | ❌ | `selectedAgentId` prop both ways |
| Summary stats bar | ✅ | ⚠️ partial | Add full stats row |
| Stale data indicator | ✅ gray > 90s | ❌ | Track `last_updated` timestamp |
| Search / filter | ✅ by type, status | ❌ | Filter `<input>` + dropdown |
| Quick action buttons | ✅ Track, Contact | ❌ | Add per-card action buttons |

---

## Area 5: Leaflet.js — Industry Plugin Stack

### Recommended Plugins
| Plugin | Purpose | npm Package |
|---|---|---|
| `Leaflet.markercluster` | Cluster + spiderfy | `leaflet.markercluster` |
| `Leaflet.RotatedMarker` | Rotate markers to heading | `leaflet-rotatedmarker` |
| `Leaflet-providers` | Easy tile provider switching | `leaflet-providers` |
| `esri-leaflet` | ESRI ArcGIS integration | `esri-leaflet` |
| `Leaflet.heat` | Incident heatmap | `leaflet.heat` |
| `Leaflet.Draw` | Draw zones/polygons | `leaflet-draw` |
| `Leaflet.GestureHandling` | Prevent scroll hijack | `leaflet-gesture-handling` |

### Tile Provider Comparison
| Provider | Use Case | Notes |
|---|---|---|
| **ESRI World Street Map** | Primary operational basemap | Best road data; free dev |
| **ESRI World Imagery** | Satellite view toggle | Excellent quality |
| **Carto Dark Matter** | Dark tactical basemap | `{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |
| **Stadia Alidade Dark** | High contrast dark | `tiles.stadiamaps.com/tiles/alidade_dark/{z}/{x}/{y}{r}.png` |
| **MapTiler + PMTiles** | Offline-capable | Best for offline-first deployments |

### Scale Performance Strategy
| Units | Strategy |
|---|---|
| < 500 | Standard `L.divIcon` SVG markers (our case) |
| 500–10,000 | Canvas renderer + `L.circleMarker` |
| 10,000+ | Supercluster + WebGL (deck.gl / MapLibre GL) |

### Performance Best Practices
- `preferCanvas: true` already enabled ✅
- Use **named panes** (`map.createPane()`) for z-index control without DOM hacks
- Debounce marker updates to **1–2 second intervals** (don't re-render every GPS tick)
- Conditional rendering by zoom: hide labels < z12, show full detail > z14
- Use `requestAnimationFrame` for any custom animation loops
- `map.invalidateSize()` only on container resize, never in render loops

---

## Area 6: Military / Emergency Symbology

### NATO APP-6 / MIL-STD-2525 Summary
- Frame shapes: **square** = ground, **circle** = sea/air, **diamond** = unknown
- Fill: **blue** = friendly/own, **red** = hostile/hazard, **yellow** = unknown, **green** = neutral/safe
- **`milsymbol.js`** renders full MIL-STD-2525D/E as SVG in browser — drop-in Leaflet integration

### milsymbol.js Integration Pattern
```javascript
import ms from 'milsymbol';

const symbol = new ms.Symbol('SFGPUCI----K', {
  size: 35,
  uniqueDesignation: 'RESCUE-01',
  direction: 145  // heading in degrees — auto-renders arrow
});

const icon = L.divIcon({
  html: symbol.asSVG(),
  iconSize: [symbol.getSize().width, symbol.getSize().height],
  iconAnchor: [symbol.getAnchor().x, symbol.getAnchor().y]
});
```

### NAPSG Civilian Symbology Colors (ICS function-based)
| ICS Function | Color |
|---|---|
| Search & Rescue | Orange |
| Medical / EMS | Blue |
| Recon / Scout | Cyan |
| Logistics | Yellow |
| Command (ICP) | Red |
| Public Works | Gray |

---

## Recommended Final Tech Stack
```
Next.js 14 (App Router)
└── Leaflet.js (core mapping)
    ├── esri-leaflet             (ESRI tile integration)
    ├── leaflet.markercluster    (clustering + spiderfy)
    ├── leaflet-rotatedmarker    (heading arrows)
    ├── leaflet-draw             (zone drawing for EOC)
    └── leaflet.heat             (incident density heatmap)
├── milsymbol                   (optional NATO-standard icons)
└── CSS animations              (marching ants route, pulse, blink)
```

---

## Implementation Phases (Once Plan Locked)

### 🔴 Phase A — Map Core (Highest Visual Impact)
1. Permanent unit callsign tooltips (`bindTooltip` permanent)
2. Heading/bearing arrows on moving units (CSS rotate + `leaflet-rotatedmarker`)
3. Animated active route (CSS `stroke-dashoffset` marching ants)
4. Route color realignment (amber=planned, blue=active, faded green=done)
5. Casing technique on all route polylines (dark shadow underlay)
6. ⊗ end markers on blocked road segments

### 🟡 Phase B — Sidebar & Linking
7. Status badge pills (color + text + icon)
8. Progress bar per unit (% of route complete)
9. ETA computation + display per unit
10. Map ↔ Sidebar bidirectional linking
11. Summary stats bar (deployed, objectives, rescued, elapsed time)
12. Search/filter bar in sidebar

### 🟢 Phase C — Polish & Advanced Standards
13. SVG `<pattern>` hatch fill for hazard zone polygons
14. Stale data desaturation (> 90s without update)
15. Emergency blink animation for EMERGENCY status units
16. Dynamic jitter / `Leaflet.markercluster` for co-located units
17. Carto Dark Matter tile toggle
18. `milsymbol` NATO-standard unit icon option
19. Waypoint dot markers along routes (numbered WP1, WP2…)
20. Mission clock / operational timeline display

---

## Area 7: EOC Dashboard Layout Architecture

### Standard Layout Split (ESRI ArcGIS Operations Dashboard / Palantir Gotham)
- **Map: 65–75%** of total viewport width (always the dominant element)
- **Right sidebar: 25–35%** — unit list, objective status, log feed
- **Top header bar: 48–56px** — mission title, operational clock, global KPI indicators
- **Bottom status ribbon: 32–40px** — system health, comms status, alert counts
- EOCs designed for **large wall monitors** (55"–80") use slightly larger fonts and more whitespace
- EOCs for **desktop workstations** optimize for information density

### Panel Management Pattern
- **Tabs** for switching between Unit List / Objectives / Event Log / Metrics — NOT separate panels
- **Collapsible sections** within sidebar (click header to collapse) — preserves map space
- **Drag-to-resize** divider between map and sidebar — professional systems always have this
- **Dark theme is mandatory** for EOC displays — reduces eye strain during long shifts

### Information Hierarchy (Top → Bottom priority)
1. **Header**: Operation name, clock (`T+HH:MM:SS`), total active units, alerts count
2. **Map**: Primary situational picture — always maximized
3. **Sidebar**: Unit cards with status, progress, ETA
4. **Bottom ribbon**: System health, last data update timestamp

### Typography Standards (Mission-Critical)
- **Primary UI font**: `Inter` — gold standard for C2/EOC dashboards (high x-height, open apertures, excellent at small sizes)
- **Data / IDs / numbers**: `IBM Plex Mono` — designed for corporate clarity, tabular numerals, distinct `0` vs `O`, `1` vs `l`
- **Alternative mono**: `JetBrains Mono` — slightly more developer-aesthetic but excellent eye-strain reduction
- **Minimum font sizes**: 11px for secondary data, 13px for primary labels, 16px+ for critical alerts
- **Font weights**: Use `500` (medium) or `600` (semi-bold) — avoid thin weights on dark backgrounds (they bleed/fade)
- **Tabular lining figures**: Ensure numeric columns align perfectly — critical for monitoring tables

---

## Area 8: CSS Animation Techniques

### Marching Ants (Active Route Animation) — Two Approaches

#### Option A: `leaflet-ant-path` plugin (Recommended — drop-in)
```bash
npm install leaflet-ant-path
```
```javascript
import { antPath } from 'leaflet-ant-path';

const route = antPath(coordinateArray, {
  delay: 400,           // Speed of animation (ms per cycle)
  dashArray: [10, 20],  // [dash length, gap length]
  weight: 5,
  color: '#0288D1',     // Blue = active route
  pulseColor: '#FFFFFF',
  hardwareAccelerated: true  // GPU acceleration
});
route.addTo(map);
```

#### Option B: Pure CSS `stroke-dashoffset` (No plugin, full control)
```css
/* Apply to the SVG path element rendered by Leaflet */
.active-route-path {
  stroke-dasharray: 10px 10px;
  animation: march 0.8s linear infinite;
}

@keyframes march {
  to {
    stroke-dashoffset: -20px;  /* Must equal dash + gap = 10 + 10 */
  }
}
```
> **Note**: To access the Leaflet SVG path element, use `polyline.getElement()` after adding to map.

### Smooth Marker Movement (Bearing + Interpolation)
```javascript
// 1. Calculate bearing to next waypoint
function getBearing(from, to) {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat  * Math.PI / 180;
  const dLon = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// 2. Smooth interpolation using requestAnimationFrame
function slideMarker(marker, from, to, durationMs) {
  const startTime = performance.now();
  const bearing = getBearing(from, to);
  if (marker.setRotationAngle) marker.setRotationAngle(bearing);

  function step(now) {
    const t = Math.min((now - startTime) / durationMs, 1);
    marker.setLatLng([
      from.lat + (to.lat - from.lat) * t,
      from.lng + (to.lng - from.lng) * t
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

### Plugin: `leaflet-rotatedmarker`
```bash
npm install leaflet-rotatedmarker
```
```javascript
import 'leaflet-rotatedmarker';
// Adds .setRotationAngle(degrees) to L.Marker
marker.setRotationAngle(145); // North = 0, East = 90, South = 180, West = 270
marker.setRotationOrigin('center'); // Rotate around center of icon
```
> Does NOT conflict with `preferCanvas: true` — canvas mode only affects CircleMarkers, not DivIcon markers.

---

## Area 9: Dark Mode Color System

### IBM Carbon Design System — Gray 100 Dark Theme (Exact Tokens)
| Token | Hex | Usage |
|---|---|---|
| `$background` | `#161616` | Page / app background |
| `$layer-01` | `#262626` | Card / panel surface |
| `$layer-02` | `#393939` | Nested card / hover state |
| `$border-subtle` | `#393939` | Card borders |
| `$border-strong` | `#525252` | Active/focus borders |
| `$text-primary` | `#f4f4f4` | Headlines, key labels |
| `$text-secondary` | `#c6c6c6` | Supporting text |
| `$text-placeholder` | `#6f6f6f` | Placeholder / disabled |
| `$interactive` | `#4589ff` | Links, focus rings, CTAs |
| `$support-success` | `#42be65` | Success / available status |
| `$support-warning` | `#f1c21b` | Warning / caution status |
| `$support-error` | `#ff8389` | Error / danger status |
| `$support-info` | `#4589ff` | Info / informational |

### Status Badge / Pill CSS (Industry Standard)
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;        /* Perfect pill shape */
  padding: 0.2rem 0.65rem;     /* 3.2px top/bottom, 10.4px left/right */
  font-size: 0.7rem;           /* 11.2px */
  font-weight: 600;            /* Semi-bold — never thin on dark bg */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Status variants */
.badge-available  { background: rgba(66,190,101,0.18); color: #42be65; border: 1px solid rgba(66,190,101,0.3); }
.badge-moving     { background: rgba(69,137,255,0.18); color: #4589ff; border: 1px solid rgba(69,137,255,0.3); }
.badge-rescuing   { background: rgba(255,131,137,0.18); color: #ff8389; border: 1px solid rgba(255,131,137,0.3); }
.badge-returning  { background: rgba(0,188,212,0.18);  color: #00bcd4; border: 1px solid rgba(0,188,212,0.3); }
.badge-emergency  { background: #ff0000; color: #fff; animation: blink 0.5s step-end infinite; }

@keyframes blink {
  50% { opacity: 0; }
}
```

---

## Area 10: Accessibility & Map Label Readability

### WCAG 2.1 AA Requirements
- Normal text: **4.5:1 contrast ratio** minimum against background
- Large text (≥ 18pt or ≥ 14pt bold): **3:1 contrast ratio** minimum
- Graphical objects / UI components: **3:1 minimum**
- **NEVER rely on color alone** — always pair color with text label AND/OR icon shape

### Map Label Halo Technique (SVG `paint-order`)
```svg
<text
  fill="white"
  stroke="rgba(0,0,0,0.8)"
  stroke-width="3"
  paint-order="stroke"   <!-- stroke drawn first, fill on top → clean halo -->
  font-family="IBM Plex Mono"
  font-size="11"
>RESCUE-01</text>
```
For Leaflet `L.tooltip` / `bindTooltip`:
```css
.leaflet-tooltip {
  background: rgba(10,15,30,0.85);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: #f4f4f4;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  text-shadow: 0 0 3px rgba(0,0,0,0.9);  /* Software halo fallback */
}
.leaflet-tooltip::before { display: none; }  /* Remove arrow */
```

### Colorblind-Safe Dual Encoding
- Never use red/green as the ONLY differentiator — add shape and text
- Use patterns (solid vs dashed vs dotted) as a second encoding axis
- Add icon glyphs (⚠️ ✅ ⛔) alongside color badges in sidebar

---

## Area 11: Next.js Performance Patterns

### Correct Leaflet Import (App Router)
```javascript
// page.tsx — disable SSR for the whole MapView
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

// MapView.js — keep 'use client' + require() pattern (already correct ✅)
"use client";
const L = require('leaflet'); // Inside useEffect only
```

### Prevent Unnecessary Re-renders
```javascript
// Memoize expensive props before passing to MapView
const memoizedAgents  = useMemo(() => agents,  [agents]);
const memoizedEdges   = useMemo(() => edges,   [edges]);
const memoizedNodes   = useMemo(() => nodes,   [nodes]);

// Stable callbacks
const handleMapClick  = useCallback((lat, lon) => { ... }, [deps]);

// Wrap MapView itself
export default React.memo(MapView);
```

### Polling Architecture (Recommended: SWR)
```javascript
import useSWR from 'swr';

const { data: simState } = useSWR(
  '/api/simulation/state',
  fetcher,
  {
    refreshInterval: 2000,    // Poll every 2 seconds
    revalidateOnFocus: false, // Don't re-fetch on tab switch
    dedupingInterval: 1000,   // Deduplicate requests within 1s
  }
);
```

### State Sharing (Zustand recommended for map↔sidebar)
```javascript
// store/mapStore.js
import { create } from 'zustand';
const useMapStore = create((set) => ({
  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  mapInstance: null,
  setMapInstance: (map) => set({ mapInstance: map }),
}));
// Use in MapView: const { setSelectedAgent } = useMapStore()
// Use in Sidebar: const { selectedAgentId, setSelectedAgent } = useMapStore()
```

---

## Final Complete Implementation Plan

### 🔴 Phase A — Map Core (Do First, Highest Impact)
1. Install `leaflet-rotatedmarker` — heading arrows on units
2. Install `leaflet-ant-path` — animated active route
3. Permanent callsign tooltips (`bindTooltip` permanent, styled CSS)
4. Bearing calculation + `requestAnimationFrame` smooth slide
5. Route color correction: `#FFC107` planned, `#0288D1` active, `#388E3C`@55% done
6. Casing polylines (dark shadow underlay on all routes)
7. ⊗ DivIcon markers at blocked road endpoints

### 🟡 Phase B — Sidebar & Data (Do Second)
8. Status badge pills (Carbon token colors, CSS above)
9. Progress bar per unit (`(idx/total)*100`)
10. ETA field per unit (remaining nodes × estimated speed)
11. Map ↔ Sidebar bidirectional linking via Zustand store
12. Summary stats bar header
13. Search/filter input

### 🟢 Phase C — Polish (Do Last)
14. SVG `<pattern>` hatch fills for flood/hazard polygons
15. Stale marker desaturation (> 90s → `filter: grayscale(80%)`)
16. EMERGENCY blink animation
17. Co-located unit jitter offset
18. Carto Dark Matter tile option in layer toggle
19. Waypoint dot markers along routes
20. Mission elapsed clock in header
