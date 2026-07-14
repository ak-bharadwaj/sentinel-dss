const fs = require('fs');
let page = fs.readFileSync('frontend/app/page.js', 'utf8');

const target1 = `                  <div className="control-group-sidebar">
                    <label className="sidebar-label">Cars: {numCars}</label>
                    <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
                  </div>
                </div>
              </div>`;

const target2 = `              <div className="control-group-sidebar">
                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>

            </div>
          </div>`;

const button1 = `
              <button 
                className="btn" 
                onClick={() => setIsDeployingUnits(!isDeployingUnits)}
                style={{ 
                  width: "100%", marginTop: "12px", 
                  background: isDeployingUnits ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.2)", 
                  borderColor: isDeployingUnits ? "#ef4444" : "#10b981", 
                  color: isDeployingUnits ? "#fca5a5" : "#6ee7b7",
                  padding: "10px", borderRadius: "6px", fontWeight: "bold"
                }}>
                {isDeployingUnits ? "📍 CLICK MAP TO DROP UNITS" : "✅ AUTHORIZE & DEPLOY UNITS"}
              </button>`;

if (page.includes(target1) && !page.includes("AUTHORIZE & DEPLOY UNITS")) {
    page = page.replace(target1, target1 + button1);
    console.log("Injected button 1");
} else {
    console.log("Failed target 1");
}

if (page.includes(target2)) {
    page = page.replace(target2, target2 + button1);
    console.log("Injected button 2");
} else {
    console.log("Failed target 2");
}

fs.writeFileSync('frontend/app/page.js', page);
