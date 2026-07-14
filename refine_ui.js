const fs = require('fs');

// 1. Remove map CSS filter
let globalsCss = fs.readFileSync('frontend/app/globals.css', 'utf8');
globalsCss = globalsCss.replace(/\.leaflet-tile-pane \{ filter: invert\(100%\) hue-rotate\(180deg\) brightness\([0-9]+%\) contrast\([0-9]+%\); \}/g, '');

// Update container and header CSS to float
if (!globalsCss.includes('.dashboard-header-float')) {
    globalsCss += `\n
.dashboard-header-float {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  pointer-events: none; /* Let clicks pass through to map */
}
.dashboard-header-float > * {
  pointer-events: auto; /* Re-enable clicks on header items */
}
.warning-banner-float {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  pointer-events: auto;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  max-width: 80%;
}
.unit-allocation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
`;
}
fs.writeFileSync('frontend/app/globals.css', globalsCss);

// 2. MapView.js tile update
let mapView = fs.readFileSync('frontend/components/MapView.js', 'utf8');
mapView = mapView.replace(
  /"https:\/\/mt1\.google\.com\/vt\/lyrs=m&x=\{x\}&y=\{y\}&z=\{z\}"/g,
  '"https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&apistyle=s.t:poi|p.v:off"'
);
fs.writeFileSync('frontend/components/MapView.js', mapView);

// 3. page.js updates
let pageJs = fs.readFileSync('frontend/app/page.js', 'utf8');

// Header
pageJs = pageJs.replace(
  /<header className="dashboard-header">/g,
  '<header className="dashboard-header dashboard-header-float">'
);

// Warning banner
pageJs = pageJs.replace(
  /<div style=\{\{\s*background: "rgba\(217, 119, 6, 0.95\)",/g,
  '<div className="warning-banner-float" style={{ background: "rgba(217, 119, 6, 0.95)",'
);

// We need to fix Unit Allocation in phase 1 & 3
// Let's replace the whole block by finding it.
// Phase 1 Unit Allocation
const replaceUnitAlloc = (content) => {
    // This is a simple regex that finds the sliders and wraps them.
    // Since there are multiple sliders, we can just replace the parent div of the sliders.
    // Instead, I'll use string replacement carefully.
    return content;
}

// Manually replace the Unit allocation sections
// There are two: one around line 1450 (Phase 1) and one around 1600 (Phase 3)
// Wait, Phase 3 Unit Allocation:
const phase3Start = `              <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', margin: '4px 0', fontFamily: 'var(--font-sans)', letterSpacing: '1px' }}>
                Unit Allocation
              </h3>`;
const phase3StartNew = `              <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', margin: '4px 0', fontFamily: 'var(--font-sans)', letterSpacing: '1px' }}>
                Unit Allocation
              </h3>
              <div className="unit-allocation-grid">`;

if (pageJs.includes(phase3Start)) {
  pageJs = pageJs.replace(phase3Start, phase3StartNew);
  // Close the grid after Cars
  const phase3End = `              <div className="control-group-sidebar">
                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>`;
  const phase3EndNew = `              <div className="control-group-sidebar">
                <label className="sidebar-label">Cars: {numCars}</label>
                <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
              </div>
              </div>`; // Close grid
  pageJs = pageJs.replace(phase3End, phase3EndNew);
}

// Do the same for Phase 1
const phase1Start = `<h3 className="sidebar-section-title">Unit Allocation</h3>`;
const phase1StartNew = `<h3 className="sidebar-section-title">Unit Allocation</h3>
              <div className="unit-allocation-grid">`;

if (pageJs.includes(phase1Start)) {
  pageJs = pageJs.replace(phase1Start, phase1StartNew);
  // In phase 1, cars is near Deploy button
  const phase1End = `                  <div className="control-group-sidebar">
                    <label className="sidebar-label">Cars: {numCars}</label>
                    <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
                  </div>
                </div>
              </div>`;
  const phase1EndNew = `                  <div className="control-group-sidebar">
                    <label className="sidebar-label">Cars: {numCars}</label>
                    <input type="range" min="0" max="30" value={numCars} onChange={(e) => setNumCars(Number(e.target.value))} className="select-input-sidebar" style={{ background: 'rgba(255,255,255,0.05)', padding: 0, height: "8px", borderRadius: "4px", margin: "10px 0", cursor: "pointer" }} />
                  </div>
                </div>
              </div>
              </div>`; // Close grid
  pageJs = pageJs.replace(phase1End, phase1EndNew);
}

// One more fix: .dashboard-main is display flex, but .dashboard-container is also display flex column.
// If the header is absolute, it doesn't take space, so dashboard-main will take full height.
// But we need to make sure the floating sidebars are adjusted if they were `top: 16px`.
// They should probably be pushed down slightly so they don't overlap the header.
// Header is around 60px.
globalsCss = globalsCss.replace(/top: 16px;/g, 'top: 65px;');
fs.writeFileSync('frontend/app/globals.css', globalsCss);

fs.writeFileSync('frontend/app/page.js', pageJs);
console.log('UI refined!');
