const fs = require('fs');

let css = fs.readFileSync('frontend/app/globals.css', 'utf8');

css += `\n
/* ========================================= */
/* ULTIMATE SHADOW AND GLOW REMOVER FOR SIDEBAR */
/* ========================================= */

.sidebar, 
.sidebar-right, 
.sidebar-panel, 
.glass-panel,
aside,
.dashboard-sidebar,
div[class*="sidebar"] {
  box-shadow: none !important;
  -webkit-box-shadow: none !important;
  -moz-box-shadow: none !important;
  filter: none !important;
  drop-shadow: none !important;
  background: rgba(10, 15, 28, 1) !important; /* Fully opaque so no blur shadow */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-right: 1px solid rgba(255,255,255,0.2) !important;
}

.map-container, 
.map-viewport,
.leaflet-container {
  box-shadow: none !important;
  filter: none !important;
}
`;

fs.writeFileSync('frontend/app/globals.css', css);
console.log("Ultimate shadow remover applied.");
