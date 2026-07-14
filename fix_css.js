const fs = require('fs');

let css = fs.readFileSync('frontend/app/globals.css', 'utf8');

// Remove .leaflet-tile filter rule
css = css.replace(/\.leaflet-tile\s*\{\s*filter:.*?!\s*important;\s*\}/g, '');

// Adjust banner top
css = css.replace(/top: 60px;/g, 'top: 80px;');

fs.writeFileSync('frontend/app/globals.css', css);
console.log('CSS fixed.');
