import sys
import re

file_path = 'c:/Users/dorni/OneDrive/Desktop/project/frontend/app/page.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace websocket handler
content = re.sub(
    r'(if \(data\.status === "Success" && data\.step\) \{\s*setSimulationTime\(data\.step\);\s*)(if \(data\.events)',
    r'\1if (data.telemetry) setTelemetry(data.telemetry);\n        \2',
    content
)

content = re.sub(
    r'(data\.events\.forEach\(ev => \{\s*setEventLog\(prev => \[\.\.\.prev, ev\]\);\s*\}\);\s*\})',
    r'\1\n        if (data.replanning_reason) {\n          setEventLog(prev => [...prev, `[System] 🔄 REPLANNING TRIGGERED: ${data.replanning_reason}`]);\n        }',
    content
)

# Add setTelemetry
if "const [telemetry, setTelemetry] = useState(null);" not in content:
    content = content.replace("const [selectedAgentId, setSelectedAgentId] = useState(null);", 
                              "const [selectedAgentId, setSelectedAgentId] = useState(null);\n  const [telemetry, setTelemetry] = useState(null);")

# Inject UI Panel
ui_panel = """</div>
              )}
              {telemetry && (
                <div style={{ marginBottom: "20px", padding: "12px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <h4 style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>System Latency (ms)</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Physics (Ground Truth)</span><span style={{ fontSize: "0.75rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{(telemetry.physics_ms || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Belief Update</span><span style={{ fontSize: "0.75rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{(telemetry.belief_ms || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Decision Engine</span><span style={{ fontSize: "0.75rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{(telemetry.decision_ms || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Resource Allocation</span><span style={{ fontSize: "0.75rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{(telemetry.allocation_ms || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "0.75rem", color: "#64748b" }}>Routing Engine</span><span style={{ fontSize: "0.75rem", color: "#fff", fontFamily: "var(--font-mono)" }}>{(telemetry.routing_ms || 0).toFixed(2)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px" }}>
                      <span style={{ fontSize: "0.75rem", color: "#eab308", fontWeight: "bold" }}>Total Tick Latency</span>
                      <span style={{ fontSize: "0.75rem", color: "#eab308", fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
                        {((telemetry.physics_ms || 0) + (telemetry.belief_ms || 0) + (telemetry.decision_ms || 0) + (telemetry.allocation_ms || 0) + (telemetry.routing_ms || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}"""

content = re.sub(r'(>LIVE OPERATIONS IN PROGRESS\.\.\.</span>\s*</div>\s*)\)}', r'\1)}\n              ' + ui_panel, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
