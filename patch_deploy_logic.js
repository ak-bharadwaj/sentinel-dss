const fs = require('fs');
let content = fs.readFileSync('frontend/app/page.js', 'utf8');

const newDeployLogic = `  const [isAwaitingDeployClick, setIsAwaitingDeployClick] = useState(false);

  // When Authorize & Deploy is clicked
  const handleAuthorizeDeployClick = () => {
    setIsAwaitingDeployClick(true);
    setEventLog(prev => [...prev, "[System] Select target drop zone on tactical map..."]);
  };

  // Map Click Handler overlay
  const handleMapClick = (lat, lon) => {
    if (isAwaitingDeployClick) {
      // Generate arrays based on sliders
      const jitter = () => (Math.random() - 0.5) * 0.01;
      const scoutsArray = Array.from({length: numScouts}).map(() => ({lat: lat + jitter(), lon: lon + jitter()}));
      const rescuesArray = Array.from({length: numRescues}).map(() => ({lat: lat + jitter(), lon: lon + jitter()}));
      
      const payload = {
        havens: [], hospitals: [], scouts: scoutsArray, rescues: rescuesArray
      };

      fetch("http://127.0.0.1:8000/api/simulation/deploy_units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => {
        if(res.ok) {
           setEventLog(prev => [...prev, \`[System] \${numScouts} Scouts and \${numRescues} Rescues deployed at drop zone.\`]);
           setIsAwaitingDeployClick(false);
           fetchState();
        }
      });
      return;
    }
    if (isPlacingHaven) {
      const entry = { lat: parseFloat(lat), lon: parseFloat(lon), label: newHavenLabel || newHavenType };
      if (newHavenType === "SHELTER") setCustomShelters(prev => [...prev, entry]);
      else setCustomHospitals(prev => [...prev, entry]);
      setIsPlacingHaven(false);
      return;
    }
    if (!isDeploying) return;
    setDeployedUnits(prev => {
      if (deployMode === "SHELTER") return { ...prev, havens: [...prev.havens, { lat, lon }] };
      if (deployMode === "HOSPITAL") return { ...prev, hospitals: [...prev.hospitals, { lat, lon }] };
      if (deployMode === "SCOUT") return { ...prev, scouts: [...prev.scouts, { lat, lon }] };
      if (deployMode === "RESCUE") return { ...prev, rescues: [...prev.rescues, { lat, lon }] };
      return prev;
    });
  };`;

// Replace handleMapClick
const oldHandleMapClickRegex = /const handleMapClick = \(lat, lon\) => \{[\s\S]*?\}\s*\n\s*\};\s*\n/m;
content = content.replace(oldHandleMapClickRegex, newDeployLogic + '\n\n');

// Make sure state exists
if (!content.includes('const [isAwaitingDeployClick')) {
    content = content.replace(
        'const [isPlacingHaven, setIsPlacingHaven] = useState(false);',
        'const [isPlacingHaven, setIsPlacingHaven] = useState(false);\n  const [isAwaitingDeployClick, setIsAwaitingDeployClick] = useState(false);'
    );
}

// Update the button onClick
content = content.replace(
    'onClick={handleConfirmDeployment}',
    'onClick={handleAuthorizeDeployClick}'
);
content = content.replace(
    '🚀 AUTHORIZE & DEPLOY UNITS',
    '{isAwaitingDeployClick ? "🎯 CLICK MAP TO DROP UNITS" : "🚀 AUTHORIZE & DEPLOY UNITS"}'
);

// Apply cursor when awaiting drop
content = content.replace(
    'isDeploying={isDeploying || isPlacingHaven}',
    'isDeploying={isDeploying || isPlacingHaven || isAwaitingDeployClick}'
);

fs.writeFileSync('frontend/app/page.js', content);
console.log("Deployed interactive drop logic!");
