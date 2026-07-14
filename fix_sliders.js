const fs = require('fs');
let code = fs.readFileSync('frontend/app/page.js', 'utf8');
code = code.replace(/max="20"/g, 'max="250"');
code = code.replace(/max="10"/g, 'max="250"');
code = code.replace(/height: "44px"/g, 'height: "8px", borderRadius: "4px", margin: "10px 0"');
fs.writeFileSync('frontend/app/page.js', code);
console.log("Replaced sliders successfully.");
