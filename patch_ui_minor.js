const fs = require('fs');

// 1. Fix globals.css box-shadows
let css = fs.readFileSync('frontend/app/globals.css', 'utf8');
css = css.replace(/box-shadow:\s*0\s+4px\s+15px\s+rgba\(0,\s*0,\s*0,\s*0\.5\);/g, 'box-shadow: none;');
css = css.replace(/box-shadow:\s*0\s+4px\s+20px\s+rgba\(0,0,0,0\.5\);/g, 'box-shadow: none;');
css = css.replace(/box-shadow:\s*0\s+2px\s+10px\s+rgba\(0,0,0,0\.2\);/g, 'box-shadow: none;');
fs.writeFileSync('frontend/app/globals.css', css);

// 2. Fix MapView.js
let mapview = fs.readFileSync('frontend/components/MapView.js', 'utf8');

// Move Tactical Layers panel to bottom
mapview = mapview.replace(
  '        top: "16px",\n        right: "16px",',
  '        bottom: "16px",\n        right: "400px",' // 400px to avoid right sidebar
);

// Disable default zoom control and add it to bottomright
if (!mapview.includes('zoomControl: false')) {
  mapview = mapview.replace(
    'const map = L.map(mapRef.current, {',
    'const map = L.map(mapRef.current, {\n        zoomControl: false,'
  );
  mapview = mapview.replace(
    '      if (!map.hasLayer(L.tileLayer)) {',
    '      L.control.zoom({ position: "bottomright" }).addTo(map);\n      if (!map.hasLayer(L.tileLayer)) {'
  );
}

// Map layer URL for darker roads and no hotels
mapview = mapview.replace(
  '"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off"',
  '"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off,s.t:poi.lodging|p.v:off,s.t:road|s.e:geometry.fill|p.c:%23666666"'
);
fs.writeFileSync('frontend/components/MapView.js', mapview);

console.log('UI fixes applied.');
