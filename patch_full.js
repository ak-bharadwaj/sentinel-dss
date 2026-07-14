const fs = require('fs');

// --- MapView.js Fixes ---
let mapview = fs.readFileSync('frontend/components/MapView.js', 'utf8');

// 1. Popup text contrast: change #fff to #0f172a (dark slate) for popup text
mapview = mapview.replace(/color:#fff/g, 'color:#0f172a');
// Ensure buttons stay white text
mapview = mapview.replace(/background:#10b981; color:#0f172a/g, 'background:#10b981; color:#fff');
mapview = mapview.replace(/background:#3b82f6; color:#0f172a/g, 'background:#3b82f6; color:#fff');

// 2. Leaflet zoom controls: move to bottomright and ensure it's removed from top left
if (mapview.includes('zoomControl: false')) {
  // If my previous patch ran, I just need to ensure position is correct
  mapview = mapview.replace(/position:\s*["']bottomleft["']/g, 'position: "bottomright"');
} else {
  // If it didn't run, apply it now
  mapview = mapview.replace(
    'const map = L.map(mapRef.current, {',
    'const map = L.map(mapRef.current, {\n        zoomControl: false,'
  );
  mapview = mapview.replace(
    '      if (!map.hasLayer(L.tileLayer)) {',
    '      L.control.zoom({ position: "bottomright" }).addTo(map);\n      if (!map.hasLayer(L.tileLayer)) {'
  );
}

// 3. Move Tactical Layers panel to top center to avoid sidebars completely
mapview = mapview.replace(
  'bottom: "16px",\n        right: "400px",',
  'top: "80px",\n        left: "50%",\n        transform: "translateX(-50%)",'
);
// Fallback if previous patch didn't run
mapview = mapview.replace(
  'top: "16px",\n        right: "16px",',
  'top: "80px",\n        left: "50%",\n        transform: "translateX(-50%)",'
);

// 4. Edges (red lines) - make them subtle slate instead of bright red
mapview = mapview.replace(
  'color: clearedEdges.includes(edge.id) ? "#10b981" : "#ef4444",',
  'color: clearedEdges.includes(edge.id) ? "#10b981" : "#64748b",'
);
mapview = mapview.replace(
  'opacity: 0.6',
  'opacity: 0.25'
);

// Ensure map roads are dark and hotels removed
if (!mapview.includes('s.t:poi.lodging')) {
  mapview = mapview.replace(
    '"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off"',
    '"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off,s.t:poi.lodging|p.v:off,s.t:road|s.e:geometry.fill|p.c:%23666666"'
  );
}

fs.writeFileSync('frontend/components/MapView.js', mapview);

// --- page.js Fixes ---
let page = fs.readFileSync('frontend/app/page.js', 'utf8');

// Re-inject the deployment button after the Cars slider
const targetPhase1End = `                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>
            </div>
          </div>
          </div>`;

const newPhase1End = `                <label className="sidebar-label">Cars: {numCars}</label>
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
            {isDeployingUnits ? "📍 CLICK MAP TO DROP UNITS" : "✅ AUTHORIZE & DEPLOY UNITS"}
          </button>`;

if (page.includes(targetPhase1End) && !page.includes("AUTHORIZE & DEPLOY UNITS")) {
    page = page.replace(targetPhase1End, newPhase1End);
}

fs.writeFileSync('frontend/app/page.js', page);

console.log('Full fixes applied successfully.');
