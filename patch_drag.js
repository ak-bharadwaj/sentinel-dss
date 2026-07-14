const fs = require('fs');

// Patch MapView.js
let mapView = fs.readFileSync('frontend/components/MapView.js', 'utf8');

// Replace circleMarker for agents with draggable L.marker
const oldAgentMarker = `      const marker = L.circleMarker(coord, {
        radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1
      });`;

const newAgentMarker = `      const iconHtml = \`<div style="width:14px; height:14px; background:\${color}; border:2px solid #fff; border-radius:50%; box-shadow:0 0 10px \${color};"></div>\`;
      const customIcon = L.divIcon({ html: iconHtml, className: "", iconSize: [14,14], iconAnchor: [7,7] });
      const marker = L.marker(coord, { icon: customIcon, draggable: true });
      
      marker.on('dragend', (e) => {
        const newLat = e.target.getLatLng().lat;
        const newLng = e.target.getLatLng().lng;
        if (window.onUnitMoveCb) {
          window.onUnitMoveCb(agent.id, "agent", newLat, newLng);
        }
      });`;

mapView = mapView.replace(oldAgentMarker, newAgentMarker);
fs.writeFileSync('frontend/components/MapView.js', mapView);

// Patch page.js
let page = fs.readFileSync('frontend/app/page.js', 'utf8');

const moveLogic = `
  const handleUnitMove = (id, type, lat, lon) => {
    fetch("http://127.0.0.1:8000/api/simulation/move_unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type, lat, lon })
    }).then(res => {
      if(res.ok) {
         setEventLog(prev => [...prev, \`[System] Unit \${id} manually repositioned.\`]);
         fetchState();
      }
    });
  };

  useEffect(() => {
    window.onUnitMoveCb = handleUnitMove;
    return () => { window.onUnitMoveCb = null; };
  }, [fetchState]);
`;

// Insert the moveLogic right before the map click handler
page = page.replace('  // Map Click Handler overlay', moveLogic + '\n  // Map Click Handler overlay');
fs.writeFileSync('frontend/app/page.js', page);

console.log('Drag and Drop patch applied.');
