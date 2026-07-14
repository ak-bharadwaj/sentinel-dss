const fs = require('fs');

let file = fs.readFileSync('frontend/components/MapView.js', 'utf8');

// Replace the color logic
const oldColorLogic = `      let color = "#10b981";
      if (node.node_type === "HOSPITAL") color = "#3b82f6";
      if (node.node_type === "SHELTER") color = "#10b981";
      if (isCompromised || node.p_danger > 0.5) color = "#ef4444";

      const marker = L.circleMarker(coord, {
        radius: (node.node_type === "HOSPITAL" || node.node_type === "SHELTER") ? 8 : (node.population > 0 ? 5 : 3),
        color: "#ffffff", weight: 1, fillColor: color, fillOpacity: 0.8
      });`;

const newColorLogic = `      let color = "#10b981";
      if (node.node_type === "HOSPITAL") color = "#3b82f6";
      if (node.node_type === "SHELTER") color = "#f59e0b"; // Amber for shelter so it is distinctly not a road
      
      let isDanger = isCompromised || node.p_danger > 0.5;
      if (isDanger && node.node_type !== "HOSPITAL" && node.node_type !== "SHELTER") {
        color = "#ef4444"; // Red for generic danger zones
      }

      const marker = L.circleMarker(coord, {
        radius: (node.node_type === "HOSPITAL" || node.node_type === "SHELTER") ? 8 : (node.population > 0 ? 5 : 3),
        color: isDanger ? "#ef4444" : "#ffffff", 
        weight: isDanger ? 3 : 1, 
        fillColor: color, 
        fillOpacity: 0.9
      });`;

file = file.replace(oldColorLogic, newColorLogic);

fs.writeFileSync('frontend/components/MapView.js', file);
console.log("MapView.js colors patched.");
