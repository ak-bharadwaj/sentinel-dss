const fs = require('fs');

let file = fs.readFileSync('frontend/app/page.js', 'utf8');

// 1. Replace State
file = file.replace(
  'const [isDeployingUnits, setIsDeployingUnits] = useState(false);',
  'const [activeDeployUnit, setActiveDeployUnit] = useState(null);'
);

// 2. Replace handleMapClick logic
const oldClickStart = 'if (isDeployingUnits) {';
const newClickLogic = `if (activeDeployUnit) {
      const jitter = () => (Math.random() - 0.5) * 0.01;
      let scoutsArray = [];
      let rescuesArray = [];
      
      if (activeDeployUnit === 'SCOUTS') scoutsArray = Array.from({length: numScouts}).map(() => ({lat: lat + jitter(), lon: lon + jitter()}));
      if (activeDeployUnit === 'RESCUES') rescuesArray = Array.from({length: numRescues}).map(() => ({lat: lat + jitter(), lon: lon + jitter()}));

      const payload = {
        havens: [], hospitals: [], scouts: scoutsArray, rescues: rescuesArray
      };

      fetch("http://127.0.0.1:8000/api/simulation/deploy_units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => {
        if(res.ok) {
           setEventLog(prev => [...prev, \`[System] Deployed \${activeDeployUnit} at drop zone.\`]);
           setActiveDeployUnit(null);
           fetchState();
        }
      });
      return;
    }`;

// Find the block to replace
const clickRegex = /if\s*\(isDeployingUnits\)\s*\{[\s\S]*?fetchState\(\);\s*\}\s*\}\);\s*return;\s*\}/g;
file = file.replace(clickRegex, newClickLogic);


// 3. Remove the big AUTHORIZE & DEPLOY UNITS buttons
const btnRegex1 = /<button[^>]*onClick=\{\(\)\s*=>\s*setIsDeployingUnits\(!isDeployingUnits\)\}[^>]*>[\s\S]*?<\/button>/g;
file = file.replace(btnRegex1, '');

// 4. Add mini buttons to each slider
const makeMiniBtn = (id, label) => `
                <button 
                  className="btn" 
                  onClick={() => setActiveDeployUnit(activeDeployUnit === '${id}' ? null : '${id}')}
                  style={{ width: "100%", marginTop: "8px", background: activeDeployUnit === '${id}' ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.1)", borderColor: activeDeployUnit === '${id}' ? "#ef4444" : "#10b981", color: activeDeployUnit === '${id}' ? "#fca5a5" : "#6ee7b7", fontSize: "0.6rem", padding: "4px" }}>
                  {activeDeployUnit === '${id}' ? "CLICK MAP TO DROP" : "DEPLOY ${label}"}
                </button>
              </div>`;

// Replace ending div of slider groups with the button + ending div
const injectBtn = (regexPattern, id, label) => {
  // Regex looks for the label and the input range, then matches the closing div
  const pattern = new RegExp(`(<label className="sidebar-label">${label}[^<]*<\\/label>[\\s\\S]*?<input type="range"[^>]*\\/>\\s*)<\\/div>`, 'g');
  file = file.replace(pattern, `$1${makeMiniBtn(id, label.replace(' Count:', ''))}`);
};

injectBtn('Scouts Count:', 'SCOUTS', 'Scouts Count:');
injectBtn('Rescue Teams:', 'RESCUES', 'Rescue Teams:');
injectBtn('Zodiac Boats:', 'ZODIACS', 'Zodiac Boats:');
injectBtn('Helicopters:', 'HELICOPTERS', 'Helicopters:');
injectBtn('Trucks:', 'TRUCKS', 'Trucks:');
injectBtn('Cars:', 'CARS', 'Cars:');

// 5. Update MapView prop
file = file.replace(/isDeploying=\{isDeploying \|\| isPlacingHaven \|\| isDeployingUnits\}/g, 'isDeploying={isDeploying || isPlacingHaven || !!activeDeployUnit}');


fs.writeFileSync('frontend/app/page.js', file);
console.log('Patch complete.');
