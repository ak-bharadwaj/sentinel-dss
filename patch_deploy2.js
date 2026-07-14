const fs = require('fs');

let file = fs.readFileSync('frontend/app/page.js', 'utf8');

const injectBtn = (label, id, btnLabel) => {
  const lines = file.split('\n');
  const makeMiniBtn = `                <button 
                  className="btn" 
                  onClick={() => setActiveDeployUnit(activeDeployUnit === '${id}' ? null : '${id}')}
                  style={{ width: "100%", marginTop: "8px", background: activeDeployUnit === '${id}' ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.1)", borderColor: activeDeployUnit === '${id}' ? "#ef4444" : "#10b981", color: activeDeployUnit === '${id}' ? "#fca5a5" : "#6ee7b7", fontSize: "0.6rem", padding: "4px" }}>
                  {activeDeployUnit === '${id}' ? "CLICK MAP TO DROP" : "DEPLOY ${btnLabel}"}
                </button>`;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`<label className="sidebar-label">${label}`)) {
      // Find the closing </div> of this control-group-sidebar
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('</div>')) {
        j++;
      }
      if (j < lines.length && !lines[j-1].includes('DEPLOY')) { // prevent double inject
        lines.splice(j, 0, makeMiniBtn);
      }
    }
  }
  file = lines.join('\n');
};

injectBtn('Scouts Count:', 'SCOUTS', 'Scouts');
injectBtn('Rescue Teams:', 'RESCUES', 'Rescues');
injectBtn('Zodiac Boats:', 'ZODIACS', 'Zodiacs');
injectBtn('Helicopters:', 'HELICOPTERS', 'Helicopters');
injectBtn('Trucks:', 'TRUCKS', 'Trucks');
injectBtn('Cars:', 'CARS', 'Cars');

fs.writeFileSync('frontend/app/page.js', file);
console.log('Patch 2 complete.');
