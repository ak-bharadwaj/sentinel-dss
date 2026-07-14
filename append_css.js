const fs = require('fs');
const css = `
/* TACTICAL MAP UI FIXES */
.sidebar, .glass-panel, .control-group-sidebar, .card {
  box-shadow: none !important;
}

div[style*="top: 16px"][style*="right: 16px"][style*="zIndex: 1000"] {
  top: 16px !important;
  right: auto !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
}

.leaflet-popup-content-wrapper {
  background: #0f172a !important;
  color: #f8fafc !important;
  border: 1px solid #334155 !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8) !important;
}
.leaflet-popup-tip {
  background: #0f172a !important;
}
.leaflet-popup-content-wrapper * {
  color: #f8fafc !important;
}
.leaflet-popup-content-wrapper span[style*="color:#ef4444"],
.leaflet-popup-content-wrapper span[style*="color: #ef4444"] {
  color: #fca5a5 !important;
}
.leaflet-popup-content-wrapper span[style*="color:#10b981"],
.leaflet-popup-content-wrapper span[style*="color: #10b981"] {
  color: #6ee7b7 !important;
}

.leaflet-top.leaflet-left .leaflet-control-zoom {
  display: none !important;
}

.leaflet-container .leaflet-control-container .leaflet-top.leaflet-right,
.leaflet-container .leaflet-control-container .leaflet-bottom.leaflet-left,
.leaflet-container .leaflet-control-container .leaflet-top.leaflet-left {
  display: none !important;
}
`;
fs.appendFileSync('frontend/app/globals.css', css);
