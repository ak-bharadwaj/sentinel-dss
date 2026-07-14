import React from 'react';

// ── Status pill config (IBM Carbon tokens) ──────────────────────────────────
const STATUS_CONFIG = {
  AVAILABLE:  { label: "AVAILABLE",  bg: "rgba(66,190,101,0.15)",  color: "#42be65", border: "rgba(66,190,101,0.35)"  },
  IDLE:       { label: "STANDBY",    bg: "rgba(141,141,141,0.15)", color: "#8d8d8d", border: "rgba(141,141,141,0.35)" },
  MOVING:     { label: "EN ROUTE",   bg: "rgba(69,137,255,0.15)",  color: "#4589ff", border: "rgba(69,137,255,0.35)"  },
  OBSERVING:  { label: "SCANNING",   bg: "rgba(241,194,27,0.15)",  color: "#f1c21b", border: "rgba(241,194,27,0.35)"  },
  RESCUING:   { label: "RESCUING",   bg: "rgba(255,131,137,0.15)", color: "#ff8389", border: "rgba(255,131,137,0.35)" },
  RETURNING:  { label: "RETURNING",  bg: "rgba(0,188,212,0.15)",   color: "#00bcd4", border: "rgba(0,188,212,0.35)"   },
  EMERGENCY:  { label: "⚠ EMERGENCY", bg: "#ff0000",               color: "#fff",    border: "#ff0000", blink: true   },
};

function StatusBadge({ status, commsBlackout }) {
  if (commsBlackout) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        borderRadius: "999px", padding: "2px 8px",
        background: "rgba(220,38,38,0.15)", color: "#ff8389",
        border: "1px solid rgba(220,38,38,0.35)",
        fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.05em", whiteSpace: "nowrap"
      }}>
        <span style={{ fontSize: "7px" }}>●</span> OFFLINE
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.IDLE;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      borderRadius: "999px", padding: "2px 8px",
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.05em", whiteSpace: "nowrap",
      animation: cfg.blink ? "sentinel-blink 0.5s step-end infinite" : "none"
    }}>
      <span style={{ fontSize: "7px" }}>●</span> {cfg.label}
    </span>
  );
}

export default function AgentCard({ agent, isSelected, onSelect }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isScout   = agent.agent_type === "SCOUT";
  const typeColor = isScout ? "#4589ff" : "#E65100";
  const typeLabel = isScout ? "SCOUT / RECON" : "RESCUE UNIT";

  // ── Route progress (Phase B2) ───────────────────────────────────────────────
  let routePct   = 0;
  let taskLabel  = "STANDBY";

  if (agent.full_planned_route && agent.full_planned_route.length > 1) {
    const idx   = agent.full_planned_route.indexOf(agent.current_node);
    const total = agent.full_planned_route.length - 1;
    if (idx >= 0) routePct = Math.round((idx / total) * 100);
  }

  // Fallback for edge-level progress
  if (agent.status === "MOVING")    { taskLabel = `EN ROUTE → ${agent.next_node || agent.target_node || "?"}`; }
  else if (agent.status === "OBSERVING") { taskLabel = "SCANNING ZONE"; }
  else if (agent.status === "RESCUING")  { taskLabel = "EXTRACTING SURVIVORS"; }
  else if (agent.status === "RETURNING") { taskLabel = "RETURNING TO BASE"; }
  else if (agent.status === "AVAILABLE") { taskLabel = "AVAILABLE"; }

  // ── ETA computation (Phase B3) — remaining hops × 2s per step ─────────────
  let etaLabel = null;
  if (agent.status === "MOVING" && agent.full_planned_route) {
    const idx       = agent.full_planned_route.indexOf(agent.current_node);
    const remaining = idx >= 0 ? agent.full_planned_route.length - 1 - idx : 0;
    if (remaining > 0) {
      const etaSec = remaining * 2;
      etaLabel     = etaSec < 60 ? `< 1 min` : `~${Math.round(etaSec / 60)} min`;
    }
  }

  // Progress bar color by status
  const barColor = STATUS_CONFIG[agent.status]?.color || "#4589ff";

  // Auto-expand if agent card becomes selected
  React.useEffect(() => {
    if (isSelected) setIsExpanded(true);
  }, [isSelected]);

  return (
    <div
      onClick={(e) => {
        // Toggle expanded status
        setIsExpanded(!isExpanded);
        if (onSelect) onSelect(agent.id);
        // Sidebar → Map: pan/fly to unit (Phase B5)
        if (window.panToAgent) window.panToAgent(agent.id);
      }}
      style={{
        display: "flex", flexDirection: "column", gap: "6px",
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: "6px",
        border: isSelected ? "1px solid #4589ff" : "1px solid rgba(255,255,255,0.07)",
        background: agent.comms_blackout
          ? "rgba(100,116,139,0.03)"
          : isSelected
            ? "rgba(69,137,255,0.08)"
            : "rgba(15,23,42,0.6)",
        opacity: agent.comms_blackout ? 0.65 : 1,
        transition: "all 0.2s ease-in-out",
        boxShadow: isSelected ? "0 0 0 1px rgba(69,137,255,0.3), inset 3px 0 0 #4589ff" : "none",
      }}
    >
      {/* ── Header row: ID + status badge ──────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Unit ID */}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem",
            fontWeight: 700, color: "#f4f4f4", letterSpacing: "0.02em"
          }}>
            {agent.id}
          </span>
          {/* Unit type label */}
          <span style={{ fontSize: "0.62rem", fontWeight: 600, color: typeColor }}>
            {typeLabel}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <StatusBadge status={agent.status} commsBlackout={agent.comms_blackout} />
          <span style={{ color: "#8d8d8d", fontSize: "0.65rem", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
            ▼
          </span>
        </div>
      </div>

      {/* ── Collapsed view quick metric summary ── */}
      {!isExpanded && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#6f6f6f" }}>
          <span>⛽ {Math.round(agent.fuel || 100)}%</span>
          <span>{taskLabel.length > 25 ? `${taskLabel.slice(0, 25)}...` : taskLabel}</span>
        </div>
      )}

      {/* ── Expanded view elements (Progressive Disclosure) ── */}
      <div style={{
        display: isExpanded ? "flex" : "none",
        flexDirection: "column",
        gap: "8px",
        overflow: "hidden",
        transition: "max-height 0.3s ease-in-out"
      }}>
        {/* ── Info row: fuel, crew, survivors, ETA ────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.62rem", color: "#8d8d8d" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <span title="Fuel Level">⛽ {Math.round(agent.fuel || 100)}%</span>
            <span title="Crew Count">👥 {agent.crew || (isScout ? 2 : 4)}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {etaLabel && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem",
                color: "#4589ff", fontWeight: 600
              }}>
                ETA {etaLabel}
              </span>
            )}
            {agent.survivors_onboard > 0 && (
              <span style={{ color: "#f1c21b", fontWeight: 700 }}>
                ⛑️ {agent.survivors_onboard} PAX
              </span>
            )}
          </div>
        </div>

        {/* ── Task label ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "0.6rem", color: "#c6c6c6",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: "200px"
          }}>
            {taskLabel}
          </span>
          {agent.status !== "IDLE" && agent.status !== "AVAILABLE" && (
            <span style={{ fontSize: "0.6rem", color: "#8d8d8d", fontFamily: "'IBM Plex Mono', monospace" }}>
              {routePct}%
            </span>
          )}
        </div>

        {/* ── Route progress bar (Phase B2) ─────────────────────────────────── */}
        {agent.status !== "IDLE" && agent.status !== "AVAILABLE" && (
          <div style={{
            width: "100%", height: "3px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "2px", overflow: "hidden"
          }}>
            <div style={{
              width: `${routePct}%`, height: "100%",
              background: barColor,
              borderRadius: "2px",
              transition: "width 0.8s ease",
              boxShadow: `0 0 6px ${barColor}`
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
