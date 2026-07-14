const fs = require('fs');
const lines = fs.readFileSync('frontend/app/page.js', 'utf8').split('\n');

const buttonStr = `
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
              </button>
`;

// Reverse loop to avoid index shifting
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Cars: {numCars}')) {
        // Insert after the end of this control group div
        // usually 2 lines down is the closing div
        lines.splice(i + 4, 0, buttonStr);
    }
}

fs.writeFileSync('frontend/app/page.js', lines.join('\n'));
console.log('Buttons forcefully injected via lines.splice');
