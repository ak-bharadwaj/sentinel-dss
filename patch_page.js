const fs = require('fs');

let content = fs.readFileSync('frontend/app/page.js', 'utf8');

// 1. Add isPlacingHaven state
if (!content.includes('const [isPlacingHaven')) {
    content = content.replace(
        'const [newHavenLabel, setNewHavenLabel] = useState("");',
        'const [newHavenLabel, setNewHavenLabel] = useState("");\n  const [isPlacingHaven, setIsPlacingHaven] = useState(false);'
    );
}

// 2. Update handleMapClick
const oldHandleMapClick = `  const handleMapClick = (lat, lon) => {
    if (!isDeploying) return;`;
const newHandleMapClick = `  const handleMapClick = (lat, lon) => {
    if (isPlacingHaven) {
      const entry = { lat: parseFloat(lat), lon: parseFloat(lon), label: newHavenLabel || newHavenType };
      if (newHavenType === "SHELTER") setCustomShelters(prev => [...prev, entry]);
      else setCustomHospitals(prev => [...prev, entry]);
      setIsPlacingHaven(false);
      return;
    }
    if (!isDeploying) return;`;
content = content.replace(oldHandleMapClick, newHandleMapClick);

// 3. Update Add Haven UI
const oldAddHaven = `              </div>
              <button
                id="btn-add-haven"
                className="btn btn-success"
                style={{ fontSize: "0.68rem", padding: "5px 0", width: "100%", fontWeight: "700" }}
                onClick={() => {
                  const lat = parseFloat(newHavenLat);
                  const lon = parseFloat(newHavenLon);
                  if (isNaN(lat) || isNaN(lon)) return;
                  const entry = { lat, lon, label: newHavenLabel || newHavenType };
                  if (newHavenType === "SHELTER") setCustomShelters(prev => [...prev, entry]);
                  else setCustomHospitals(prev => [...prev, entry]);
                  setNewHavenLat(""); setNewHavenLon(""); setNewHavenLabel("");
                }}
              >
                + Add Haven
              </button>
            </div>`;
const newAddHaven = `              </div>
              <button
                id="btn-add-haven"
                className={\`btn \${isPlacingHaven ? 'btn-danger' : 'btn-success'}\`}
                style={{ fontSize: "0.68rem", padding: "5px 0", width: "100%", fontWeight: "700" }}
                onClick={() => {
                  setIsPlacingHaven(!isPlacingHaven);
                }}
              >
                {isPlacingHaven ? "Cancel Placement" : "📍 Drop on Map"}
              </button>
            </div>`;
content = content.replace(oldAddHaven, newAddHaven);

// 4. Extract HUD
const hudRegex = /<div className="map-coordinate-hud">[\s\S]*?<\/div>\s*<\/div>/;
const hudMatch = content.match(/<div className="map-coordinate-hud">[\s\S]*?<\/div>/);
if (hudMatch) {
    // Remove from map-container
    content = content.replace(hudMatch[0], '');
    
    // Inject into dashboard-header right side
    const headerEnd = `          {/* Header Right */}`;
    content = content.replace(headerEnd, `          {/* Header Right */}\n          ` + hudMatch[0] + `\n`);
}

// 5. Pass isPlacingHaven down to map view style wrapper?
// We will let MapView handle cursor based on props.
content = content.replace(
    'isDeploying={isDeploying}',
    'isDeploying={isDeploying || isPlacingHaven}'
);

fs.writeFileSync('frontend/app/page.js', content);
console.log('page.js patched!');
