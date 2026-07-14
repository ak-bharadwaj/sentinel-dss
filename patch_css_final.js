const fs = require('fs');

let css = fs.readFileSync('frontend/app/globals.css', 'utf8');

// 1. Remove all dark shadows from the sidebars and modals to comply with the user's request.
css = css.replace(/box-shadow: 0 0 40px rgba\(0,0,0,0.5\);/g, 'box-shadow: none !important;');
css = css.replace(/box-shadow: 0 8px 32px rgba\(0,0,0,0.5\);/g, 'box-shadow: none !important;');
css = css.replace(/box-shadow: 0 0 60px rgba\(0,0,0,0.5\);/g, 'box-shadow: none !important;');

// 2. Fix the tactical map metadata issue (Leaflet top-right controls)
// Instead of hacking the div style, let's just move the leaflet-right container away from the sidebar
css += `
/* Fix tactical map metadata overlapping with right sidebar */
.leaflet-right {
  right: 360px !important;
}

/* Force popup styling aggressively to fix the white-on-white text bug */
.leaflet-container .leaflet-popup-content-wrapper, 
.leaflet-container .leaflet-popup-tip {
  background-color: #0f172a !important;
  color: #f8fafc !important;
  box-shadow: 0 4px 15px rgba(0,0,0,0.8) !important;
  border: 1px solid #334155 !important;
}

.leaflet-container .leaflet-popup-content,
.leaflet-container .leaflet-popup-content * {
  color: #f8fafc !important;
}
`;

fs.writeFileSync('frontend/app/globals.css', css);
console.log("CSS patched.");
