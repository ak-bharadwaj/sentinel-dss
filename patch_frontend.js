const fs = require('fs');

let page = fs.readFileSync('frontend/app/page.js', 'utf8');

const targetPhase3End = `              <div className="control-group-sidebar">
                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>
              </div>`;

const newPhase3End = `              <div className="control-group-sidebar">
                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>
              </div>
              
              <button 
                className="btn" 
                onClick={() => setIsDeployingUnits(!isDeployingUnits)}
                style={{ 
                  width: "100%", marginTop: "12px", 
                  background: isDeployingUnits ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.2)", 
                  borderColor: isDeployingUnits ? "#ef4444" : "#10b981", 
                  color: isDeployingUnits ? "#fca5a5" : "#6ee7b7" 
                }}>
                {isDeployingUnits ? "?? CLICK MAP TO DROP UNITS" : "?? AUTHORIZE & DEPLOY UNITS"}
              </button>`;

if (page.includes(targetPhase3End)) {
    page = page.replace(targetPhase3End, newPhase3End);
}

const targetPhase1End = `                  <div className="control-group-sidebar">
                    <label className="sidebar-label">Cars: {numCars}</label>
                    <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
                  </div>
                </div>
              </div>
              </div>`;

const newPhase1End = `                  <div className="control-group-sidebar">
                    <label className="sidebar-label">Cars: {numCars}</label>
                    <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
                  </div>
                </div>
              </div>
              </div>
              
              <button 
                className="btn" 
                onClick={() => setIsDeployingUnits(!isDeployingUnits)}
                style={{ 
                  width: "100%", marginTop: "12px", 
                  background: isDeployingUnits ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.2)", 
                  borderColor: isDeployingUnits ? "#ef4444" : "#10b981", 
                  color: isDeployingUnits ? "#fca5a5" : "#6ee7b7" 
                }}>
                {isDeployingUnits ? "?? CLICK MAP TO DROP UNITS" : "?? AUTHORIZE & DEPLOY UNITS"}
              </button>`;

if (page.includes(targetPhase1End)) {
    page = page.replace(targetPhase1End, newPhase1End);
}

// Add handleRemoveUnit function
const removeUnitFunc = `
  const handleRemoveUnit = async (unitId, unitType) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/simulation/remove_unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unitId, type: unitType })
      });
      if (res.ok) {
        setEventLog(prev => [...prev, \`[System] \${unitType} \${unitId} removed from operation.\`]);
      }
    } catch(e) {
      console.error("Remove unit error", e);
    }
  };
`;
if (!page.includes("handleRemoveUnit")) {
    page = page.replace("const airdropResources = async () => {", removeUnitFunc + "\n  const airdropResources = async () => {");
}
fs.writeFileSync('frontend/app/page.js', page);


// MapView.js - pass handleRemoveUnit
let mapview = fs.readFileSync('frontend/components/MapView.js', 'utf8');

// Agent marker
mapview = mapview.replace(
  `        marker.bindPopup('');`,
  `        marker.bindPopup('<div style="min-width:120px;font-family:monospace;font-size:12px;"><b>Unit: ' + agent.type + '</b><br/>' + agent.id + '<br/><button class="btn btn-primary" style="margin-top:8px;width:100%;background:rgba(220,38,38,0.2);color:#ef4444;border-color:#ef4444;" onclick="window.dispatchEvent(new CustomEvent(\\'removeUnit\\', {detail:{id:\\''+agent.id+'\\',type:\\'agent\\'}}))">REMOVE UNIT</button></div>');`
);

// Node marker (Havens)
mapview = mapview.replace(
  `              marker.bindPopup(popupContent);
              nodeLayer.addLayer(marker);
              return; // Early exit`,
  `              marker.bindPopup(popupContent + '<button class="btn btn-primary" style="margin-top:8px;width:100%;background:rgba(220,38,38,0.2);color:#ef4444;border-color:#ef4444;" onclick="window.dispatchEvent(new CustomEvent(\\'removeUnit\\', {detail:{id:\\''+id+'\\',type:\\'node\\'}}))">REMOVE HAVEN</button>');
              nodeLayer.addLayer(marker);
              return; // Early exit`
);
// contextmenu for agent
mapview = mapview.replace(
  `        marker.on('click', () => {`,
  `        marker.on('contextmenu', (e) => { e.target.openPopup(); });\n        marker.on('click', () => {`
);

// contextmenu for node
mapview = mapview.replace(
  `            marker.on('click', () => {`,
  `            marker.on('contextmenu', (e) => { e.target.openPopup(); });\n            marker.on('click', () => {`
);


fs.writeFileSync('frontend/components/MapView.js', mapview);
console.log('Frontend patched!');
