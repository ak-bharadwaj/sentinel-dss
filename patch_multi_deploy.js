const fs = require('fs');
let file = fs.readFileSync('frontend/app/page.js', 'utf8');
file = file.replace(/setActiveDeployUnit\(null\);\s*fetchState\(\);/g, 'fetchState();');
fs.writeFileSync('frontend/app/page.js', file);
console.log('Multi-deploy patch applied.');
