"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Activity, 
  Users, 
  Shield, 
  MapPin,
  TrendingUp,
  Cpu,
  RotateCcw,
  BarChart3,
  Terminal,
  AlertTriangle,
  Navigation,
  CheckCircle2,
  Lock,
  Heart,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  Radio
} from "lucide-react";

// Import Leaflet Map dynamically to prevent SSR window reference errors
const MapView = dynamic(() => import("../components/MapView"), { ssr: false });
const SelectionMap = dynamic(() => import("../components/SelectionMap"), { ssr: false });
import AgentCard from "../components/AgentCard";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const listener = (e) => handleRemoveUnit(e.detail.id, e.detail.type);
    window.addEventListener('removeUnit', listener);
    return () => window.removeEventListener('removeUnit', listener);
  }, []);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [clearedEdges, setClearedEdges] = useState([]);
  const [agents, setAgents] = useState([]);
  const [coordinates, setCoordinates] = useState({});
  const [resources, setResources] = useState(null);
  const [numScouts, setNumScouts] = useState(3);
  const [numRescues, setNumRescues] = useState(3);
  const [numZodiacs, setNumZodiacs] = useState(2);
  const [numHelicopters, setNumHelicopters] = useState(1);
  const [numTrucks, setNumTrucks] = useState(2);
  const [numCars, setNumCars] = useState(3);
  const [activeDeployUnitState, setActiveDeployUnitState] = useState(null);
  const activeDeployUnit = activeDeployUnitState;
  const setActiveDeployUnit = (val) => {
    window.activeDeployUnit = val;
    setActiveDeployUnitState(val);
  };
  const [metrics, setMetrics] = useState({
    active_baseline: "AMIS-RU",
    total_survivors_saved: 0,
    initial_population: 0,
    simulation_time: 0,
    history: []
  });
  
  const locations = [
    { name: "San Francisco, USA", lat: 37.7749, lon: -122.4194 },
    { name: "Tokyo, Japan", lat: 35.6762, lon: 139.6503 },
    { name: "London, UK", lat: 51.5074, lon: -0.1278 },
    { name: "Mumbai, India", lat: 19.0760, lon: 72.8777 },
    { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093 }
  ];

  // Controls state
  const [baselineType, setBaselineType] = useState("AMIS-RU");
  const [disasterType, setDisasterType] = useState("FLOOD");
  if (typeof window !== "undefined") {
    window.activeDisasterType = disasterType;
  }
  const [nodeNames, setNodeNames] = useState({});
  const [corruptionLevel, setCorruptionLevel] = useState(0.60);
  const [selectedLocIndex, setSelectedLocIndex] = useState("0");
  const [customLat, setCustomLat] = useState("37.7749");
  const [customLon, setCustomLon] = useState("-122.4194");
  const [span, setSpan] = useState(0.18);
  const [showCustomCoords, setShowCustomCoords] = useState(false);
  const [mapMode, setMapMode] = useState("REAL"); // "REAL" or "SYNTHETIC"
  const [isRunning, setIsRunning] = useState(false);
  const [eventLog, setEventLog] = useState([]);
  const [activeTab, setActiveTab] = useState("telemetry"); // "telemetry", "analytics", "experiments"
  const [sidebarTab, setSidebarTab] = useState("incidents"); // "incidents", "scouts", "agents"
  const [experimentResults, setExperimentResults] = useState([]);
  const [showGuide, setShowGuide] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  // Locked coordinates — set once when user clicks INITIALIZE; never drifts from Step-2 panning
  const [committedLat, setCommittedLat] = useState(37.7749);
  const [committedLon, setCommittedLon] = useState(-122.4194);
  const [committedSpan, setCommittedSpan] = useState(0.18);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMode, setDeployMode] = useState("SHELTER");
  const [deployedUnits, setDeployedUnits] = useState({ havens: [], hospitals: [], scouts: [], rescues: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCity, setLoadingCity] = useState("");
  const [configCity, setConfigCity] = useState(null);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [customShelters, setCustomShelters] = useState([]);  // [{lat, lon, label}]
  const [customHospitals, setCustomHospitals] = useState([]); // [{lat, lon, label}]
  const [newHavenLat, setNewHavenLat] = useState("");
  const [newHavenLon, setNewHavenLon] = useState("");
  const [newHavenType, setNewHavenType] = useState("SHELTER");
  const [newHavenLabel, setNewHavenLabel] = useState("");
  const [isPlacingHaven, setIsPlacingHaven] = useState(false);
  const [mapModeUsed, setMapModeUsed] = useState(null); // "REAL" | "SYNTHETIC" | null
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // ── Phase B: Agent filter state (no API impact) ─────────────────────────
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [airdropTargetId, setAirdropTargetId] = useState("");
  const [airdropAmount, setAirdropAmount] = useState(100);

  // ── WebSocket status indicator state ───────────────────────────────────
  const [wsStatus, setWsStatus] = useState("CONNECTING"); // "LIVE" | "CONNECTING" | "OFFLINE"

  // ── Task 2: High priority warnings/emergency toasts state ──────────────
  const [toasts, setToasts] = useState([]);
  const warnedAgentsRef = useRef(new Set());

  const [gpuStatus, setGpuStatus] = useState(null);
  const [isGpuWaking, setIsGpuWaking] = useState(false);
  const [phaseRationale, setPhaseRationale] = useState("");
  const [stageBriefing, setStageBriefing] = useState(null);
  const [showStageCompleteModal, setShowStageCompleteModal] = useState(false);
  const [decision, setDecision] = useState(null);
  const [broadcastMode, setBroadcastMode] = useState("SHELTER_IN_PLACE");
  const [offlineDeltas, setOfflineDeltas] = useState("");

  const handlePlanPhase = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/plan_phase", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
        setStageBriefing(data.briefing || null);
        setPhaseRationale("");
        setEventLog(prev => [...prev, "[Tactical] Phase Plan Generated. Awaiting Execution."]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecutePhase = () => {
    setIsRunning(true);
    setEventLog(prev => [...prev, "[Tactical] Executing Phase..."]);
  };

  const airdropResources = async () => {
    setIsGpuWaking(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/wake-gpu", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setGpuStatus("RTX GPU ACTIVE");
        setEventLog(prev => [...prev, `[System] ${data.message}`]);
      } else {
        setGpuStatus("CPU FALLBACK");
        setEventLog(prev => [...prev, `[System] ${data.message}`]);
      }
    } catch (e) {
      console.error(e);
      setGpuStatus("CONNECTION FAILED");
    }
    setIsGpuWaking(false);
  };

  const handleWakeGpu = async () => {
    setIsGpuWaking(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/wake-gpu", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setGpuStatus("RTX GPU ACTIVE");
        setEventLog(prev => [...prev, `[System] ${data.message}`]);
      } else {
        setGpuStatus("CPU FALLBACK");
        setEventLog(prev => [...prev, `[System] ${data.message}`]);
      }
    } catch (e) {
      console.error(e);
      setGpuStatus("CONNECTION FAILED");
    }
    setIsGpuWaking(false);
  };

  const runInterval = useRef(null);
  const hasInitializedRef = useRef(false);

  // ── Phase B4: Map → Sidebar linking via global callback ─────────────────
  useEffect(() => {
    window.onAgentSelectCb = (id) => {
      setSelectedAgentId(id);
      setSidebarTab("agents"); // auto-switch to agents tab
    };
    return () => { window.onAgentSelectCb = null; };
  }, []);

  // ── Task 2: Live monitoring hook for low-fuel and EMERGENCY agent state ──
  useEffect(() => {
    if (!agents || agents.length === 0) return;

    agents.forEach(agent => {
      const isLowFuel = agent.fuel !== undefined && agent.fuel < 15;
      const isEmerg   = agent.status === "EMERGENCY";

      if (isLowFuel || isEmerg) {
        const warnKey = `${agent.id}_${isLowFuel ? "fuel" : "emerg"}`;
        
        if (!warnedAgentsRef.current.has(warnKey)) {
          warnedAgentsRef.current.add(warnKey);
          
          const alertMsg = isEmerg 
            ? `🚨 CRITICAL STATE: Unit ${agent.id} reports operational emergency!` 
            : `⚠ LOW FUEL WARNING: Unit ${agent.id} is at ${Math.round(agent.fuel)}% fuel level!`;

          const newToast = {
            id: Date.now() + Math.random(),
            agentId: agent.id,
            message: alertMsg,
            type: isEmerg ? "emergency" : "warning"
          };

          setToasts(prev => [newToast, ...prev].slice(0, 5)); // cap at 5 concurrent toasts
        }
      }
    });
  }, [agents]);

  // 1. Initial State Fetch & WebSocket with Reconnect Logic
  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connectWS = () => {
      setWsStatus("CONNECTING");
      ws = new WebSocket("ws://127.0.0.1:8000/api/ws");

      ws.onopen = () => {
        setWsStatus("LIVE");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === "Success" && data.step !== undefined) {
            // A simulation step was broadcasted by someone else!
            setMetrics(prev => ({
              ...prev,
              simulation_time: data.step,
              total_survivors_saved: data.survivors_saved,
              active_baseline: data.active_baseline
            }));
            
            if (data.events && data.events.length > 0) {
              setEventLog(prev => [...prev, ...data.events]);
            }
            
            // Re-fetch world/agent geometries to ensure we have the exact route data
            fetchState();
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onclose = () => {
        setWsStatus("OFFLINE");
        // Auto-reconnect after 3 seconds
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
        ws.close();
      };
    };

    connectWS();
    
    return () => {
      clearInterval(runInterval.current);
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // 2. Play loop
  const stepSimulation = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/step", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.replanning_required) {
        setIsRunning(false);
        setPhase(5); // Force back to Planning
        setEventLog(prev => [...prev, JSON.stringify({
          time: new Date().toLocaleTimeString(),
          type: "xai",
          action: "🛑 ENVIRONMENTAL SHIFT DETECTED",
          reason: "Critical changes in environment (e.g. Tide) detected. Replanning Phase required.",
          requires_approval: false,
          confidence: 1.0,
          recommendation: "Simulation paused. Please review new operational zones and request a new plan."
        })]);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    if (isRunning) {
      runInterval.current = setInterval(() => {
        stepSimulation();
      }, 500); // Fast live-action loop
    } else {
      clearInterval(runInterval.current);
    }
    return () => clearInterval(runInterval.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  async function fetchState() {
    try {
      const results = await Promise.allSettled([
        fetch("http://127.0.0.1:8000/api/world").then(res => res.ok ? res.json() : null),
        fetch("http://127.0.0.1:8000/api/agents").then(res => res.ok ? res.json() : null),
        fetch("http://127.0.0.1:8000/api/analytics/metrics").then(res => res.ok ? res.json() : null),
        fetch("http://127.0.0.1:8000/api/simulation/resources").then(res => res.ok ? res.json() : null),
        fetch("http://127.0.0.1:8000/api/simulation/decision").then(res => res.ok ? res.json() : null)
      ]);

      if (results[0].status === 'fulfilled' && results[0].value) {
        setNodes(results[0].value.nodes || []);
        setEdges(results[0].value.edges || []);
        setCoordinates(results[0].value.coordinates || {});
        setClearedEdges(results[0].value.cleared_edges || []);
        setNodeNames(results[0].value.node_names || {});
        setOfflineDeltas(results[0].value.offline_deltas || "");
      }
      
      if (results[1].status === 'fulfilled' && results[1].value) {
        setAgents(results[1].value || []);
      }
      
      if (results[2].status === 'fulfilled' && results[2].value) {
        setMetrics(results[2].value);
      }

      if (results[3].status === 'fulfilled' && results[3].value) {
        setResources(results[3].value);
      }
      
      if (results[4].status === 'fulfilled' && results[4].value) {
        setDecision(results[4].value);
        if (results[4].value.broadcast_mode) {
          setBroadcastMode(results[4].value.broadcast_mode);
        }
      }
      
      // Event logs are dynamically synced via WebSockets, no client-side generation needed here
    } catch (e) {
      console.warn("Failed to fetch backend states:", e.message);
    }
  };

  const handleToggleBroadcast = async (newMode) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/toggle_broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastMode(data.broadcast_mode);
        fetchState();
      }
    } catch (err) {
      console.error("Failed to toggle broadcast:", err);
    }
  };

  const handleResolveDecision = async (optionId) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/resolve_decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId })
      });
      if (res.ok) {
        setDecision(null);
        fetchState();
      }
    } catch (err) {
      console.error("Failed to resolve decision:", err);
    }
  };

  const handleDesignateNode = async (nodeId, nodeType) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/world/node/designate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, node_type: nodeType })
      });
      const data = await res.json();
      if (data.status === "Success") {
        setEventLog(prev => [...prev, `[System] Node ${nodeId} designated as ${nodeType}.`]);
        await fetchState();
      }
    } catch (e) {
      console.error("Failed to designate node:", e);
    }
  };

  const handleRequestAirdrop = async (nodeId, amount = 100) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/airdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, amount: amount }),
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleXaiApproval = async (idx, approved) => {
    setEventLog(prev => {
      const newLog = [...prev];
      try {
        const reversedIdx = newLog.length - 1 - idx;
        const parsed = JSON.parse(newLog[reversedIdx]);
        parsed.requires_approval = false;
        parsed.action = `${approved ? "[APPROVED]" : "[REJECTED]"} ${parsed.action}`;
        newLog[reversedIdx] = JSON.stringify(parsed);
      } catch (e) {}
      return newLog;
    });
  };

  const renderLogLine = (log, idx) => {
    if (typeof log === 'string' && log.startsWith('{')) {
      try {
        const parsed = JSON.parse(log);
        if (parsed.type === "xai") {
          const isWarning = parsed.reason && (parsed.reason.includes("Emergency") || parsed.reason.includes("Flood") || parsed.reason.includes("Override"));
          const isApproval = parsed.requires_approval;
          const borderColor = isWarning ? "rgba(245, 158, 11, 0.5)" : (isApproval ? "rgba(99, 102, 241, 0.5)" : "rgba(16, 185, 129, 0.5)");
          const textColor = isWarning ? "#f59e0b" : (isApproval ? "#818cf8" : "#10b981");

          return (
            <div key={idx} style={{ 
              marginBottom: "10px", 
              background: "rgba(15, 23, 42, 0.6)", 
              border: `1px solid ${borderColor}`,
              borderRadius: "6px",
              padding: "10px",
              boxShadow: isApproval ? "0 0 10px rgba(99, 102, 241, 0.15)" : "none"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{parsed.time}</span>
                {parsed.confidence && (
                  <span style={{ fontSize: "0.65rem", color: textColor, fontWeight: "bold" }}>
                    Confidence: {Math.round(parsed.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.75rem", marginBottom: "4px" }}>
                {parsed.action}
              </div>
              {parsed.reason && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontStyle: "italic", borderLeft: `2px solid ${borderColor}`, paddingLeft: "6px" }}>
                  Rationale: {parsed.reason}
                </div>
              )}
              {parsed.recommendation && (
                <div style={{ color: "var(--text-primary)", fontSize: "0.75rem", marginTop: "6px", background: "rgba(255,255,255,0.05)", padding: "6px", borderRadius: "4px" }}>
                  <strong style={{color: textColor}}>AI Suggestion:</strong> {parsed.recommendation}
                </div>
              )}
              {isApproval && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button 
                    onClick={() => handleXaiApproval(idx, true)}
                    style={{ flex: 1, padding: "6px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#10b981", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem", fontWeight: "bold" }}>
                    APPROVE
                  </button>
                  <button 
                    onClick={() => handleXaiApproval(idx, false)}
                    style={{ flex: 1, padding: "6px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#ef4444", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem", fontWeight: "bold" }}>
                    REJECT
                  </button>
                </div>
              )}
            </div>
          );
        }
      } catch (e) {
      }
    }
    
    // ── Task 4: Categorized badge coloring parser for flat string log feeds ──
    let lineContent = typeof log === 'string' ? log : '';
    let badgeLabel = "EVENT";
    let badgeColor = "#4b5563"; // default gray
    let bgTint = "rgba(75, 85, 99, 0.05)";
    
    if (lineContent.startsWith("[System]")) {
      badgeLabel = "SYSTEM";
      badgeColor = "#06b6d4"; // cyan
      bgTint = "rgba(6, 182, 212, 0.05)";
      lineContent = lineContent.replace("[System]", "").trim();
    } else if (lineContent.startsWith("[Deploy]")) {
      badgeLabel = "DEPLOY";
      badgeColor = "#3b82f6"; // blue
      bgTint = "rgba(59, 130, 246, 0.05)";
      lineContent = lineContent.replace("[Deploy]", "").trim();
    } else if (lineContent.startsWith("[Tactical]")) {
      badgeLabel = "TACTICAL";
      badgeColor = "#a855f7"; // purple
      bgTint = "rgba(168, 85, 247, 0.05)";
      lineContent = lineContent.replace("[Tactical]", "").trim();
    } else if (lineContent.startsWith("[Error]")) {
      badgeLabel = "ALERT";
      badgeColor = "#ef4444"; // red
      bgTint = "rgba(239, 68, 68, 0.08)";
      lineContent = lineContent.replace("[Error]", "").trim();
    } else if (lineContent.startsWith("[EXCHANGE]")) {
      badgeLabel = "EXCHANGE";
      badgeColor = "#10b981"; // green
      bgTint = "rgba(16, 185, 129, 0.05)";
      lineContent = lineContent.replace("[EXCHANGE]", "").trim();
    }
    
    return (
      <div key={idx} style={{
        padding: "6px 10px",
        fontSize: "0.68rem",
        color: badgeColor === "#ef4444" ? "#fca5a5" : "#e2e8f0",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        background: bgTint,
        display: "flex",
        alignItems: "flex-start",
        gap: "8px"
      }}>
        <span style={{
          fontSize: "0.55rem",
          fontWeight: "800",
          color: "#fff",
          background: badgeColor,
          padding: "1px 5px",
          borderRadius: "3px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          flexShrink: 0,
          marginTop: "1px"
        }}>
          {badgeLabel}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", lineHeight: "1.3" }}>
          {lineContent}
        </span>
      </div>
    );
  };

  const handleDispatchAgent = async (nodeId) => {
    if (!selectedAgentId) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/agents/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentId, target_node_id: nodeId })
      });
      const data = await res.json();
      if (data.status === "Success") {
        setEventLog(prev => [...prev, `[System] 🚀 Manually dispatched ${selectedAgentId} to node ${nodeId}. Override active.`]);
        setSelectedAgentId(null);
        await fetchState();
      } else {
        alert(`Dispatch failed: ${data.message}`);
      }
    } catch (e) {
      console.error("Failed to dispatch agent:", e);
    }
  };

  const handleToggleBlockage = async (source, target) => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/world/edge/toggle_blockage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, target })
      });
      const data = await res.json();
      if (data.status === "Success") {
        await fetchState();
      }
    } catch (e) {
      console.error("Failed to toggle blockage:", e);
    }
  };

  const handleGlobalRTB = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/agents/rtb_all", { method: "POST" });
      const data = await res.json();
      if (data.status === "Success") {
        setEventLog(prev => [...prev, "[System] 🚨 GLOBAL RTB TRIGGERED!"]);
        await fetchState();
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.error("Failed to trigger RTB:", e);
    }
  };

  const handleAARExport = () => {
    window.open("http://127.0.0.1:8000/api/analytics/export_csv", "_blank");
  };

  const handlePDFExport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Sentinel After Action Review</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .metric { margin-bottom: 15px; }
            .label { font-weight: bold; color: #64748b; font-size: 0.9rem; text-transform: uppercase; }
            .value { font-size: 1.2rem; font-weight: 600; color: #334155; display: block; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Mission After Action Review (AAR)</h1>
          <div class="grid">
            <div class="metric"><span class="label">Disaster Type</span> <span class="value">${metrics?.disaster_type || "FLOOD"}</span></div>
            <div class="metric"><span class="label">Total Duration</span> <span class="value">${metrics?.simulation_time || 0} Minutes</span></div>
            <div class="metric"><span class="label">Survivors Rescued</span> <span class="value">${metrics?.total_survivors_saved || 0}</span></div>
            <div class="metric"><span class="label">Final Tide Phase</span> <span class="value">${metrics?.tide_phase || "LOW TIDE"}</span></div>
          </div>
          <h2 style="margin-top: 40px; color: #0f172a;">Operational Objectives</h2>
          <ul>
            ${(metrics?.briefing?.objectives || []).map(obj => `<li style="margin-bottom: 10px;"><strong>${obj.id}</strong>: ${obj.description}</li>`).join('') || "<li>No objectives recorded.</li>"}
          </ul>
          <p style="margin-top: 50px; font-size: 0.8rem; color: #94a3b8; text-align: center;">Generated automatically by Sentinel Command Engine</p>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveMission = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/save", { method: "POST" });
      const data = await res.json();
      if (data.status === "Success") {
        setEventLog(prev => [...prev, "[System] 💾 Mission State Saved."]);
      }
    } catch (e) {
      console.error("Failed to save:", e);
    }
  };

  const handleLoadMission = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulation/load", { method: "POST" });
      const data = await res.json();
      if (data.status === "Success") {
        setEventLog(prev => [...prev, "[System] 📂 Mission State Loaded."]);
        await fetchState();
      }
    } catch (e) {
      console.error("Failed to load:", e);
    }
  };

  const startSimulation = async (overrideParams = {}) => {
    setIsRunning(false);
    const params = {
      baseline_type: overrideParams.baselineType ?? baselineType,
      disaster_type: overrideParams.disasterType ?? disasterType,
      corruption_level: Number(overrideParams.corruptionLevel ?? corruptionLevel),
      center_lat: Number(overrideParams.customLat ?? customLat),
      center_lon: Number(overrideParams.customLon ?? customLon),
      span: Number(overrideParams.span ?? span),
      map_mode: overrideParams.mapMode ?? mapMode,
      num_scouts: Number(overrideParams.numScouts ?? numScouts),
      num_rescues: Number(overrideParams.numRescues ?? numRescues),
      num_zodiacs: Number(overrideParams.numZodiacs ?? numZodiacs),
      num_helicopters: Number(overrideParams.numHelicopters ?? numHelicopters),
      num_trucks: Number(overrideParams.numTrucks ?? numTrucks),
      num_cars: Number(overrideParams.numCars ?? numCars),
      custom_shelters: customShelters,
      custom_hospitals: customHospitals
    };

    try {
      // Use 600s timeout to handle large OSM file parsing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);
      const res = await fetch("http://127.0.0.1:8000/api/simulation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      const modeUsed = data.map_mode_used || (params.map_mode === "REAL" ? "SYNTHETIC" : "SYNTHETIC");
      setMapModeUsed(modeUsed);
      const modeMsg = modeUsed === "REAL"
        ? `[0m] 🗺️ Real OSM road network loaded successfully.`
        : `[0m] ⚠️ OSM download failed — using synthetic grid. City map may not reflect real roads.`;
      setEventLog([`[0m] System initialized. Command profile: ${params.baseline_type}. Map corruption: ${params.corruption_level*100}%.`, modeMsg]);
      await fetchState();
    } catch (e) {
      console.error("Error starting simulation:", e);
    } finally {
      setIsLoading(false);
      setIsDeploying(true);
    }
  };

    const [isAwaitingDeployClick, setIsAwaitingDeployClick] = useState(false);

  // When Authorize & Deploy is clicked
  const handleAuthorizeDeployClick = () => {
    setIsAwaitingDeployClick(true);
    setEventLog(prev => [...prev, "[System] Select target drop zone on tactical map..."]);
  };


  const handleUnitMove = (id, type, lat, lon) => {
    fetch("http://127.0.0.1:8000/api/simulation/move_unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type, lat, lon })
    }).then(res => {
      if(res.ok) {
         setEventLog(prev => [...prev, `[System] Unit ${id} manually repositioned.`]);
         fetchState();
      }
    });
  };

  useEffect(() => {
    window.onUnitMoveCb = handleUnitMove;
    return () => { window.onUnitMoveCb = null; };
  }, [fetchState]);

  // Map Click Handler overlay
  const handleMapClick = (lat, lon) => {
    const currentDeployUnit = window.activeDeployUnit;
    if (currentDeployUnit) {
      setEventLog(prev => [...prev, `[System] Deploying 1x ${currentDeployUnit} unit at coordinates...`]);
      
      let scoutsArray = [];
      let rescuesArray = [];
      
      if (currentDeployUnit === 'SCOUTS') {
        scoutsArray = [{ lat, lon }];
        setNumScouts(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      } else if (currentDeployUnit === 'CARS') {
        scoutsArray = [{ lat, lon }];
        setNumCars(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      } else if (currentDeployUnit === 'ZODIACS') {
        scoutsArray = [{ lat, lon }];
        setNumZodiacs(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      } else if (currentDeployUnit === 'RESCUES') {
        rescuesArray = [{ lat, lon }];
        setNumRescues(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      } else if (currentDeployUnit === 'HELICOPTERS') {
        rescuesArray = [{ lat, lon, vehicle_type: 'HELICOPTER' }];
        setNumHelicopters(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      } else if (currentDeployUnit === 'TRUCKS') {
        rescuesArray = [{ lat, lon, vehicle_type: 'HIGH_WATER_TRUCK' }];
        setNumTrucks(prev => {
          const nextVal = prev - 1;
          if (nextVal <= 0) {
            setActiveDeployUnit(null);
            return 0;
          }
          return nextVal;
        });
      }

      const payload = {
        havens: [], hospitals: [], scouts: scoutsArray, rescues: rescuesArray
      };

      fetch("http://127.0.0.1:8000/api/simulation/deploy_units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => {
        if(res.ok) {
           setEventLog(prev => [...prev, `[System] Successfully deployed 1x ${currentDeployUnit} unit.`]);
           fetchState();
        } else {
           setEventLog(prev => [...prev, `[Error] Backend rejected deployment.`]);
        }
      }).catch(err => {
        setEventLog(prev => [...prev, `[Error] Deployment failed: ${err.message}`]);
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
    // Do nothing on regular clicks, prevent random safehouse dropping!
  };

  const avgConfidence = metrics?.map_confidence !== undefined ? metrics.map_confidence * 100 : 100.0;
  
  let verifiedCount = 0;
  let decayingCount = 0;
  let blindspotCount = 0;
  
  if (nodes && nodes.length > 0) {
    nodes.forEach(n => {
      const conf = n.confidence !== undefined ? n.confidence : 1.0;
      if (conf > 0.8) verifiedCount++;
      else if (conf > 0.3) decayingCount++;
      else blindspotCount++;
    });
  }
  
  let scannerColor = "var(--color-safe)";
  let systemStatusText = "NOMINAL";
  let alertDotClass = "status-dot safe";
  
  if (avgConfidence < 40) {
    scannerColor = "var(--color-danger)";
    systemStatusText = "CRITICAL DECAY";
    alertDotClass = "status-dot pulse-danger";
  } else if (avgConfidence < 75) {
    scannerColor = "var(--color-uncertain)";
    systemStatusText = "DEGRADED";
    alertDotClass = "status-dot pulse-warning";
  }

  const renderWorkflowStepper = () => {
    let currentStep = 1;
    if (!isInitialized) {
      if (configCity) currentStep = 2;
      else currentStep = 1;
    } else {
      if (isRunning || (metrics && metrics.step > 0)) currentStep = 5;
      else if (stageBriefing) currentStep = 4;
      else currentStep = 3;
    }

    const steps = [
      { id: 1, label: "Select Location" },
      { id: 2, label: "Define Area" },
      { id: 3, label: "Tactical Deployment" },
      { id: 4, label: "Plan Approval" },
      { id: 5, label: "Execute Mission" }
    ];

    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "12px 24px", background: "rgba(8,12,28,0.7)",
        backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 1000, position: "relative"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", letterSpacing: "1px", fontFamily: "var(--font-mono)" }}>
            SENTINEL //
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            TACTICAL ADVISOR
          </span>
          
          {/* WebSocket Status Indicator Pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.58rem",
            fontWeight: "700",
            padding: "2px 8px",
            borderRadius: "12px",
            marginLeft: "12px",
            background: wsStatus === "LIVE" ? "rgba(66,190,101,0.12)" : wsStatus === "CONNECTING" ? "rgba(241,194,27,0.12)" : "rgba(239,68,68,0.12)",
            color: wsStatus === "LIVE" ? "#42be65" : wsStatus === "CONNECTING" ? "#f1c21b" : "#ff8389",
            border: `1px solid ${wsStatus === "LIVE" ? "rgba(66,190,101,0.2)" : wsStatus === "CONNECTING" ? "rgba(241,194,27,0.2)" : "rgba(239,68,68,0.2)"}`
          }}>
            <span style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: wsStatus === "LIVE" ? "#42be65" : wsStatus === "CONNECTING" ? "#f1c21b" : "#ff8389",
              animation: wsStatus === "CONNECTING" ? "sentinel-blink 0.8s step-end infinite" : "none"
            }} />
            {wsStatus}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {steps.map((st, idx) => {
            const isActive = st.id === currentStep;
            const isCompleted = st.id < currentStep;
            return (
              <div key={st.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%",
                  backgroundColor: isActive ? "rgba(245,158,11,0.15)" : isCompleted ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                  border: "1px solid " + (isActive ? "#f59e0b" : isCompleted ? "#10b981" : "rgba(255,255,255,0.08)"),
                  color: isActive ? "#f59e0b" : isCompleted ? "#10b981" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: "bold", fontFamily: "var(--font-mono)"
                }}>
                  {isCompleted ? "✓" : st.id}
                </div>
                <span style={{
                  fontSize: "0.68rem",
                  color: isActive ? "#fff" : isCompleted ? "var(--text-secondary)" : "var(--text-muted)",
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.5px"
                }}>
                  {st.label}
                </span>
                {idx < steps.length - 1 && (
                  <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.65rem", marginLeft: "12px", fontFamily: "var(--font-mono)" }}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const havens = nodes ? nodes.filter(n => n.node_type === "SHELTER" || n.node_type === "HOSPITAL") : [];

  if (!isMounted) return null;

  // ── STEP 1 & 2: Setup screens (shown before tactical dashboard) ──────────
  if (!isInitialized || isLoading) {

    // Loading spinner while simulation initialises
    if (isLoading) {
      return (
        <div className="welcome-overlay-container">
          <div className="welcome-card" style={{ textAlign: "center", padding: "56px 48px", maxWidth: "440px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", top: "-60px", left: "-60px", pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: "150px", height: "150px", borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)", bottom: "-40px", right: "-40px", pointerEvents: "none" }} />
            <div style={{ marginBottom: "28px", position: "relative" }}>
              <div style={{ position: "relative", width: "72px", height: "72px", margin: "0 auto 24px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.1)", borderTop: "2px solid #6366f1", animation: "spin 1.2s cubic-bezier(0.5,0,0.5,1) infinite" }} />
                <div style={{ position: "absolute", inset: "10px", borderRadius: "50%", border: "2px solid rgba(6,182,212,0.1)", borderBottom: "2px solid #06b6d4", animation: "spin 0.9s cubic-bezier(0.5,0,0.5,1) infinite reverse" }} />
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.05em" }}>
                Initialising <span style={{ color: "#6366f1" }}>{loadingCity}</span>
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0 }}>Building disaster environment…</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left" }}>
              {["Fetching OSM road graph data", "Building disaster belief state model", "Spawning scout and rescue agents"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.5, fontSize: "0.75rem" }}>
                  <span>⚙</span> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Full-screen region configuration
    if (configCity) {
      return (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#040914", color: "white", zIndex: 9999, height: "100dvh", overflow: "hidden" }}>
          {renderWorkflowStepper()}
        <div style={{ display: "flex", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* LEFT PANEL */}
          <div style={{
            width: "360px", flexShrink: 0,
            background: "rgba(8,12,28,0.95)", backdropFilter: "blur(20px)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            overflow: "hidden"   /* Panel itself does NOT scroll — inner content area does */
          }}>
            {/* === SCROLLABLE CONTENT AREA === */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.18em", color: "#6366f1", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>
                  PHASE 2 — AREA DEFINITION
                </div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 4px", letterSpacing: "0.02em" }}>
                  {configCity.name}
                </h2>
                <p style={{ fontSize: "0.72rem", color: "#475569", margin: 0, lineHeight: 1.5 }}>
                  Pan &amp; zoom the map to define your operational bounding box.
                </p>
              </div>

              {/* Coordinates readout */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.6rem", color: "#475569", letterSpacing: "0.1em", marginBottom: "10px" }}>CURRENT COORDINATES</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.6rem", color: "#818cf8", display: "block", marginBottom: "4px" }}>LATITUDE</label>
                    <input
                      type="number"
                      value={customLat}
                      onChange={e => setCustomLat(e.target.value)}
                      className="select-input-sidebar"
                      style={{ width: "100%", padding: "8px 10px", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.6rem", color: "#818cf8", display: "block", marginBottom: "4px" }}>LONGITUDE</label>
                    <input
                      type="number"
                      value={customLon}
                      onChange={e => setCustomLon(e.target.value)}
                      className="select-input-sidebar"
                      style={{ width: "100%", padding: "8px 10px", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick city jump */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.6rem", color: "#475569", letterSpacing: "0.1em", marginBottom: "10px" }}>QUICK JUMP</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {locations.map((loc, i) => (
                    <button key={i}
                      onClick={() => {
                        setConfigCity({ ...loc, index: i });
                        setCustomLat(loc.lat.toString());
                        setCustomLon(loc.lon.toString());
                        setSpan(0.06);
                      }}
                      style={{
                        background: configCity.name === loc.name ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                        border: configCity.name === loc.name ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "8px", padding: "8px 12px", cursor: "pointer",
                        color: "white", textAlign: "left", fontSize: "0.78rem",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        transition: "all 0.15s"
                      }}
                    >
                      <span>📍 {loc.name}</span>
                      <span style={{ fontSize: "0.62rem", color: "#475569", fontFamily: "var(--font-mono)" }}>
                        {loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation parameters */}
              <div style={{ padding: "16px 24px" }}>
                <div style={{ fontSize: "0.6rem", color: "#475569", letterSpacing: "0.1em", marginBottom: "10px" }}>SIMULATION PARAMETERS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.6rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>MAP MODE</label>
                    <select className="select-input-sidebar" value={mapMode} onChange={e => setMapMode(e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: "0.75rem" }}>
                      <option value="REAL">Real-world OSM Network</option>
                      <option value="SYNTHETIC">Synthetic Grid (Fallback)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.6rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>DISASTER PROFILE</label>
                    <select className="select-input-sidebar" value={disasterType} onChange={e => setDisasterType(e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: "0.75rem" }}>
                      <option value="FLOOD">🌊 Flood (Dynamic Road Blocks)</option>
                      <option value="EARTHQUAKE">🌍 Earthquake (Structural Damage)</option>
                      <option value="WILDFIRE">🔥 Wildfire (Expanding Zones)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {/* === STICKY ACTION BUTTONS — always visible at the bottom === */}
            <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,12,28,0.98)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                className="btn btn-success"
                style={{ width: "100%", padding: "14px", fontSize: "0.88rem", fontWeight: 800, letterSpacing: "1.5px" }}
                onClick={async () => {
                  const finalLat = parseFloat(customLat) || 19.0760;
                  const finalLon = parseFloat(customLon) || 72.8777;
                  
                  // Find closest matching city presets or dynamically fetch via OpenStreetMap Nominatim reverse geocode lookup
                  let activeCityName = `Region at (${finalLat.toFixed(3)}, ${finalLon.toFixed(3)})`;
                  const matchedCity = locations.find(loc => Math.abs(loc.lat - finalLat) < 0.05 && Math.abs(loc.lon - finalLon) < 0.05);
                  if (matchedCity) {
                    activeCityName = matchedCity.name;
                  } else {
                    try {
                      const lookupUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${finalLon}&zoom=10`;
                      const rGeo = await fetch(lookupUrl, { headers: { "User-Agent": "Sentinel-DSS-Client" } });
                      if (rGeo.ok) {
                        const rGeoData = await rGeo.json();
                        if (rGeoData.address) {
                          activeCityName = rGeoData.address.city || rGeoData.address.town || rGeoData.address.village || rGeoData.address.county || rGeoData.address.state || activeCityName;
                        }
                      }
                    } catch (lookupErr) {
                      console.error("Reverse lookup failed:", lookupErr);
                    }
                  }
                  
                  setCommittedLat(finalLat);
                  setCommittedLon(finalLon);
                  setCommittedSpan(span);

                  setIsLoading(true);
                  setLoadingCity(activeCityName);
                  try {
                    await startSimulation({
                      customLat: finalLat,
                      customLon: finalLon,
                      span: span,
                      mapMode: mapMode,
                      disasterType: disasterType
                    });
                    setIsInitialized(true);
                  } catch (e) {
                    console.error("Failed to start simulation:", e);
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                🚀 INITIALIZE TACTICAL VIEW
              </button>
              <button
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#475569", fontSize: "0.78rem", cursor: "pointer" }}
                onClick={() => setConfigCity(null)}
              >
                ← Back to City Selection
              </button>
            </div>
          </div>

          {/* RIGHT: Full-screen map */}
          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
            {/* Search bar row from SelectionMap sits at top, then map fills rest */}
            {isMounted && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <SelectionMap
                  key={`${configCity.lat}-${configCity.lon}`}
                  centerLat={Number(configCity.index === "custom" ? customLat : configCity.lat)}
                  centerLon={Number(configCity.index === "custom" ? customLon : configCity.lon)}
                  span={span}
                  mapHeight="calc(100vh - 80px)"
                  onChange={(lat, lon, s) => {
                    setCustomLat(lat.toString());
                    setCustomLon(lon.toString());
                    setSpan(s);
                  }}
                />
              </div>
            )}
            {/* Overlay hint */}
            <div style={{
              position: "absolute", bottom: "80px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(4,9,20,0.75)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px",
              padding: "10px 18px", color: "#94a3b8", fontSize: "0.72rem",
              pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1000
            }}>
              🗺 Pan &amp; zoom to position bounding box · Use slider to adjust area size
            </div>
          </div>
        </div>
      </div>
      );
    }

    // Step 1: City selection grid
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#040914" }}>
        {renderWorkflowStepper()}
        <div className="welcome-overlay-container" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "4px", margin: "0 0 8px", background: "linear-gradient(135deg, #6366f1, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SENTINEL
            </h1>
            <div style={{ fontSize: "0.8rem", color: "#475569", letterSpacing: "0.2em" }}>AUTONOMOUS DISASTER RESPONSE SYSTEM</div>
          </div>

        <div className="welcome-card" style={{ maxWidth: "720px", width: "100%" }}>
          <div className="welcome-header">
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "#6366f1", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>PHASE 1 — SECTOR SELECTION</div>
            <h2 className="welcome-title">Select Operational Zone</h2>
            <p className="welcome-subtitle">Choose a predefined city sector or enter custom coordinates to define your tactical AO.</p>
          </div>

          {/* Preset cities */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {locations.map((loc, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedLocIndex(String(i));
                  setConfigCity({ ...loc, index: i });
                  setCustomLat(loc.lat.toString());
                  setCustomLon(loc.lon.toString());
                  setSpan(0.06);
                }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "white",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <span style={{ fontSize: "1.4rem" }}>📍</span>
                <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{loc.name}</span>
                <span style={{ fontSize: "0.65rem", color: "#475569", fontFamily: "var(--font-mono)" }}>
                  {loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}
                </span>
              </button>
            ))}

            {/* Custom coordinates option */}
            <button
              onClick={() => {
                setSelectedLocIndex("custom");
                setConfigCity({ name: "Custom Location", lat: parseFloat(customLat) || 37.7749, lon: parseFloat(customLon) || -122.4194, index: "custom" });
                setSpan(0.06);
              }}
              style={{
                background: "rgba(99,102,241,0.05)",
                border: "1px dashed rgba(99,102,241,0.3)",
                borderRadius: "10px",
                padding: "16px",
                cursor: "pointer",
                textAlign: "left",
                color: "white",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "rgba(99,102,241,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; e.currentTarget.style.background = "rgba(99,102,241,0.05)"; }}
            >
              <span style={{ fontSize: "1.4rem" }}>🌐</span>
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Custom Location</span>
              <span style={{ fontSize: "0.65rem", color: "#6366f1", fontFamily: "var(--font-mono)" }}>Enter lat / lon →</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }
  // ── End of setup screens ──────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "#040914" }}>
      {renderWorkflowStepper()}
      <div className="layout-container" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* LEFT COLUMN: Setup / Controls */}
      {leftSidebarOpen && (
        <section className="sidebar-panel">
          {/* Operational Region Configuration */}
          <div className="card">
            <h2 className="card-title">
              <span>Operational Area</span>
              <span style={{ fontSize: "12px" }}>📍</span>
            </h2>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "8px" }}>
              Define the bounding box for agent operations.
            </div>
            <button
              className={`btn ${isSelectingRegion ? "btn-danger" : "btn-success"}`}
              style={{ width: "100%", padding: "8px", fontSize: "0.7rem", fontWeight: "700" }}
              onClick={() => setIsSelectingRegion(!isSelectingRegion)}
            >
              {isSelectingRegion ? "Close Location Setup" : "Select Region..."}
            </button>

            {isSelectingRegion && (
              <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px" }}>
                 <SelectionMap 
                   centerLat={Number(customLat)} 
                   centerLon={Number(customLon)} 
                   span={span} 
                   onChange={(lat, lon, s) => {
                     setCustomLat(lat);
                     setCustomLon(lon);
                     setSpan(s);
                   }}
                 />
              </div>
            )}
          </div>

          {/* Safe Havens Pre-Configuration */}
          <div className="card">
            <h2 className="card-title">
              <span>Safe Havens</span>
              <Shield size={14} style={{ color: "#3b82f6" }} />
            </h2>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "8px" }}>
              Pre-designate shelters &amp; hospitals before deployment. Click a node on the map to designate mid-mission.
            </div>

            {/* Add a new haven */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  id="haven-lat"
                  type="text" placeholder="Lat"
                  value={newHavenLat} onChange={e => setNewHavenLat(e.target.value)}
                  className="select-input-sidebar"
                  style={{ flex: 1, fontSize: "0.68rem", padding: "4px 6px" }}
                />
                <input
                  id="haven-lon"
                  type="text" placeholder="Lon"
                  value={newHavenLon} onChange={e => setNewHavenLon(e.target.value)}
                  className="select-input-sidebar"
                  style={{ flex: 1, fontSize: "0.68rem", padding: "4px 6px" }}
                />
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <select
                  value={newHavenType} onChange={e => setNewHavenType(e.target.value)}
                  className="select-input-sidebar"
                  style={{ flex: 1, fontSize: "0.68rem" }}
                >
                  <option value="SHELTER">🛡️ Shelter</option>
                  <option value="HOSPITAL">🏥 Hospital</option>
                </select>
                <input
                  id="haven-label"
                  type="text" placeholder="Label (opt.)"
                  value={newHavenLabel} onChange={e => setNewHavenLabel(e.target.value)}
                  className="select-input-sidebar"
                  style={{ flex: 1.4, fontSize: "0.68rem", padding: "4px 6px" }}
                />
              </div>
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
            </div>

            {/* List configured havens or active havens */}
            {nodes.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                {nodes.filter(n => n.node_type === "SHELTER" || n.node_type === "HOSPITAL").map((h, idx) => {
                  const occupants = h.occupants ?? 0;
                  const res = h.resources ?? { food: 100, water: 100, medicine: 100 };
                  const isHospital = h.node_type === "HOSPITAL";
                  const color = isHospital ? "#ec4899" : "#3b82f6";
                  
                  return (
                    <div key={idx} style={{
                      padding: "8px", background: "rgba(255,255,255,0.01)",
                      border: `1px solid ${isHospital ? "rgba(236,72,153,0.15)" : "rgba(59,130,246,0.15)"}`,
                      borderRadius: "6px", fontSize: "0.68rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ color: color, fontWeight: "700" }}>
                          {isHospital ? "🏥" : "🛡️"} {h.label || `${h.node_type} #${h.id.slice(0,6)}`}
                        </span>
                        <span style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "4px", padding: "1px 5px", fontSize: "0.6rem", color: "#34d399", fontWeight: "bold" }}>
                          🏠 {occupants} SAVED
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                        {/* Food Resource Bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "var(--text-secondary)", marginBottom: "1px" }}>
                            <span>🌾 FOOD SUPPLY</span>
                            <span style={{ color: res.food < 20 ? "#ef4444" : "inherit", fontWeight: "bold" }}>{Math.round(res.food)}%</span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.03)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, res.food))}%`, height: "100%", background: res.food < 20 ? "#ef4444" : "#10b981", transition: "width 0.3s ease" }} />
                          </div>
                        </div>

                        {/* Water Resource Bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.58rem", color: "var(--text-secondary)", marginBottom: "1px" }}>
                            <span>💧 WATER SUPPLY</span>
                            <span style={{ color: res.water < 20 ? "#ef4444" : "inherit", fontWeight: "bold" }}>{Math.round(res.water)}%</span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.03)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, res.water))}%`, height: "100%", background: res.water < 20 ? "#ef4444" : "#3b82f6", transition: "width 0.3s ease" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              [...customShelters.map(s => ({...s, type: "SHELTER"})), ...customHospitals.map(h => ({...h, type: "HOSPITAL"}))].length === 0 ? (
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0", borderTop: "1px solid var(--border-color)" }}>
                  No havens configured. Add above or designate on map.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                  {[...customShelters.map((s,i) => ({...s, type:"SHELTER", idx:i})), ...customHospitals.map((h,i) => ({...h, type:"HOSPITAL", idx:i}))].map((h, gi) => (
                    <div key={gi} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "5px 8px", background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${h.type === "HOSPITAL" ? "rgba(236,72,153,0.3)" : "rgba(59,130,246,0.3)"}`,
                      borderRadius: "5px", fontSize: "0.65rem"
                    }}>
                      <span style={{ color: h.type === "HOSPITAL" ? "#ec4899" : "#3b82f6", fontWeight: "700" }}>
                        {h.type === "HOSPITAL" ? "🏥" : "🛡️"} {h.label}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {h.lat.toFixed(4)}, {h.lon.toFixed(4)}
                      </span>
                      <button
                        onClick={() => {
                          if (h.type === "SHELTER") setCustomShelters(prev => prev.filter((_,i) => i !== h.idx));
                          else setCustomHospitals(prev => prev.filter((_,i) => i !== h.idx));
                        }}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold", padding: "0 2px" }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* UNIT DEPLOYMENT CONTROLS */}
          <div className="card" style={{ border: "1px solid rgba(99,102,241,0.3)" }}>
            <h2 className="card-title">
              <span style={{ color: "#818cf8" }}>Unit Deployment</span>
              <Users size={14} style={{ color: "#818cf8" }} />
            </h2>
            <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: "10px" }}>
              Set counts &amp; click Deploy to place units on map click.
            </div>

            {/* Unit rows */}
            {[
              { key: "SCOUTS",      label: "🔭 Scouts",      count: numScouts,      setCount: setNumScouts,      color: "#22d3ee" },
              { key: "RESCUES",     label: "🚑 Rescues",     count: numRescues,     setCount: setNumRescues,     color: "#f59e0b" },
              { key: "ZODIACS",     label: "🚤 Zodiacs",     count: numZodiacs,     setCount: setNumZodiacs,     color: "#3b82f6" },
              { key: "HELICOPTERS", label: "🚁 Helicopters", count: numHelicopters, setCount: setNumHelicopters, color: "#a78bfa" },
              { key: "TRUCKS",      label: "🚛 Trucks",      count: numTrucks,      setCount: setNumTrucks,      color: "#fb923c" },
              { key: "CARS",        label: "🚗 Cars",         count: numCars,        setCount: setNumCars,        color: "#34d399" },
            ].map(u => (
              <div key={u.key} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 8px", marginBottom: "4px",
                background: activeDeployUnit === u.key ? `rgba(${u.color === "#22d3ee" ? "34,211,238" : u.color === "#f59e0b" ? "245,158,11" : u.color === "#3b82f6" ? "59,130,246" : u.color === "#a78bfa" ? "167,139,250" : u.color === "#fb923c" ? "251,146,60" : "52,211,153"},0.1)` : "rgba(255,255,255,0.02)",
                border: `1px solid ${activeDeployUnit === u.key ? u.color : "rgba(255,255,255,0.05)"}`,
                borderRadius: "7px", transition: "all 0.15s"
              }}>
                {/* Label */}
                <span style={{ flex: 1, fontSize: "0.72rem", fontWeight: 600, color: activeDeployUnit === u.key ? u.color : "var(--text-secondary)" }}>
                  {u.label}
                </span>
                {/* Spinner */}
                <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <button
                    onClick={() => u.setCount(Math.max(1, u.count - 1))}
                    style={{ width: "20px", height: "20px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", cursor: "pointer", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >−</button>
                  <span style={{ minWidth: "20px", textAlign: "center", fontSize: "0.78rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: u.color }}>
                    {u.count}
                  </span>
                  <button
                    onClick={() => u.setCount(u.count + 1)}
                    style={{ width: "20px", height: "20px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", cursor: "pointer", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >+</button>
                </div>
                {/* Deploy toggle button */}
                <button
                  onClick={() => {
                    if (activeDeployUnit === u.key) {
                      setActiveDeployUnit(null);
                    } else {
                      setActiveDeployUnit(u.key);
                      setEventLog(prev => [...prev, `[Deploy] Click map to drop ${u.count}× ${u.label}`]);
                    }
                  }}
                  style={{
                    padding: "3px 8px", borderRadius: "5px", border: "none", cursor: "pointer",
                    background: activeDeployUnit === u.key ? u.color : "rgba(255,255,255,0.08)",
                    color: activeDeployUnit === u.key ? "#000" : "var(--text-muted)",
                    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em",
                    transition: "all 0.15s"
                  }}
                >
                  {activeDeployUnit === u.key ? "✓ ACTIVE" : "DEPLOY"}
                </button>
              </div>
            ))}

            {activeDeployUnit && (
              <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "7px", fontSize: "0.68rem", color: "#818cf8", textAlign: "center" }}>
                🎯 Click anywhere on the map to drop <strong>{activeDeployUnit}</strong>
                <button onClick={() => setActiveDeployUnit(null)} style={{ display: "block", width: "100%", marginTop: "6px", padding: "4px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "5px", color: "#ef4444", cursor: "pointer", fontSize: "0.65rem" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 0 15px rgba(245,158,11,0.02)" }}>
            <h2 className="card-title" style={{ color: "#f59e0b" }}>
              <span>Tactical Signal Broadcast</span>
              <Radio size={14} style={{ color: "#f59e0b" }} />
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                Instruct civilian populations offline via Cell Broadcast / Radio RDS signaling bands.
              </span>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button
                  onClick={() => handleToggleBroadcast("SHELTER_IN_PLACE")}
                  style={{
                    padding: "8px", borderRadius: "6px", border: "1px solid " + (broadcastMode === "SHELTER_IN_PLACE" ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.05)"),
                    background: broadcastMode === "SHELTER_IN_PLACE" ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.02)",
                    color: broadcastMode === "SHELTER_IN_PLACE" ? "#38bdf8" : "var(--text-muted)",
                    cursor: "pointer", fontSize: "0.68rem", fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                >
                  🛡️ Shelter in Place
                </button>
                <button
                  onClick={() => handleToggleBroadcast("DIRECTED_EVACUATION")}
                  style={{
                    padding: "8px", borderRadius: "6px", border: "1px solid " + (broadcastMode === "DIRECTED_EVACUATION" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.05)"),
                    background: broadcastMode === "DIRECTED_EVACUATION" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.02)",
                    color: broadcastMode === "DIRECTED_EVACUATION" ? "#f59e0b" : "var(--text-muted)",
                    cursor: "pointer", fontSize: "0.68rem", fontWeight: "bold",
                    animation: broadcastMode === "DIRECTED_EVACUATION" ? "pulse 2s ease-in-out infinite" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  🚶 Directed Evac
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                    RDS / SMS Broadcast Delta Packet
                  </span>
                  <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "1px 4px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                    {offlineDeltas ? new Blob([offlineDeltas]).size : 0} bytes
                  </span>
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "#10b981",
                  background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)",
                  padding: "8px", borderRadius: "6px", overflowWrap: "break-word", maxHeight: "65px", overflowY: "auto"
                }}>
                  {offlineDeltas || "No deltas generated. Run steps to compile."}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title" style={{ color: "#38bdf8" }}>
              <span>Incident Command Operations</span>
              <Activity size={14} style={{ color: "#38bdf8" }} />
            </h2>
            
            {isRunning && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "6px 10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "6px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "#10b981", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE OPERATIONS IN PROGRESS...</span>
              </div>
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
              )}
            
            {!stageBriefing && !isRunning && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                <button 
                  onClick={handlePlanPhase} 
                  className="btn btn-primary" 
                  style={{ width: "100%", background: "rgba(56, 189, 248, 0.15)", borderColor: "rgba(56, 189, 248, 0.5)", color: "#38bdf8" }}
                  disabled={isRunning}
                >
                  <Terminal size={14} /> GENERATE OPERATIONAL PLAN
                </button>
              </div>
            )}
            
            {stageBriefing && !isRunning && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                
                {/* NDMA OPERATIONAL PLAN */}
                <div style={{ padding: "16px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "8px", fontFamily: "var(--font-mono)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed rgba(56, 189, 248, 0.3)", paddingBottom: "8px", marginBottom: "12px" }}>
                    <span style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "0.9rem", textTransform: "uppercase" }}>
                      {stageBriefing.operation_name || "Active Operation"}
                    </span>
                    <span style={{ fontSize: "0.6rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "3px 6px", borderRadius: "4px" }}>PENDING APPROVAL</span>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                    <div><span style={{ color: "var(--text-primary)" }}>🚨 Tactical Risk level:</span> <span style={{ color: stageBriefing.risk === "High" ? "#f87171" : stageBriefing.risk === "Medium" ? "#f59e0b" : "#10b981", fontWeight: "bold" }}>{stageBriefing.risk}</span></div>
                    <div><span style={{ color: "var(--text-primary)" }}>🌦️ Weather Report:</span> <span style={{ color: "var(--text-primary)" }}>{formatWeatherInfo(stageBriefing.weather)}</span></div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "bold" }}>Mission Objectives</span>
                    
                    {(!stageBriefing.objectives || stageBriefing.objectives.length === 0) && (
                      <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px", borderRadius: "6px", color: "#fca5a5", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontWeight: "bold" }}>⚠️ Operational Plan Incomplete</span>
                        <span>No tactical mission objectives generated because no scouts or rescue vehicles are currently deployed.</span>
                        <span style={{ fontSize: "0.65rem", opacity: 0.8, lineHeight: 1.4 }}>To generate objectives: use the "UNIT DEPLOYMENT" panel to deploy assets on the map first, then click "REJECT & REPLAN" to recompute.</span>
                      </div>
                    )}

                    {stageBriefing.objectives?.map((obj, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "6px", borderLeft: obj.priority === "Critical" ? "3px solid #ef4444" : "3px solid #eab308" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-primary)", fontWeight: "bold", fontSize: "0.75rem" }}>{obj.id}</span>
                          <span style={{ color: obj.priority === "Critical" ? "#ef4444" : "#eab308", fontSize: "0.6rem", fontWeight: "bold", textTransform: "uppercase" }}>Priority: {obj.priority}</span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "6px" }}>{obj.description}</div>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>Assigned Units:</span>
                            <span style={{ color: "#38bdf8" }}>{obj.assigned_units.join(", ")}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
                            <span>ETA:</span>
                            <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{obj.eta}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COMMANDER APPROVAL BUTTONS */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button 
                    onClick={handleExecutePhase} 
                    className="btn btn-success" 
                    style={{ width: "100%", padding: "12px", fontWeight: "bold", fontSize: "0.85rem", letterSpacing: "0.05em", background: "linear-gradient(90deg, #059669 0%, #10b981 100%)", border: "none", boxShadow: "0 0 15px rgba(16, 185, 129, 0.3)" }}
                    disabled={isRunning}
                  >
                    <Play size={14} /> APPROVE EXECUTION
                  </button>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      onClick={() => setEventLog(prev => [...prev, JSON.stringify({ time: new Date().toLocaleTimeString(), type: "xai", action: "Commander Initiated Manual Override", reason: "Modifying operational parameters on live map." })]) }
                      className="btn" 
                      style={{ flex: 1, padding: "8px", fontSize: "0.7rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-secondary)" }}
                    >
                      MODIFY PLAN
                    </button>
                    <button 
                      onClick={() => setStageBriefing(null)}
                      className="btn" 
                      style={{ flex: 1, padding: "8px", fontSize: "0.7rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                    >
                      REJECT & REPLAN
                    </button>
                  </div>
                </div>

              </div>
            )}
            
            <div className="telemetry-row" style={{ marginTop: "12px", borderTop: "1px solid rgba(99,102,241,0.1)", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Elapsed Mission: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{metrics.simulation_time} mins</span></span>
              <span style={{ color: varColor(metrics.active_baseline), fontWeight: 700, fontSize: "0.68rem" }}>{metrics.active_baseline}</span>
            </div>
            
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button onClick={handleSaveMission} className="btn btn-ghost" style={{ flex: 1, padding: "6px 8px", fontSize: "0.68rem", fontWeight: 600, gap: "5px" }}>
                Save State
              </button>
              <button onClick={handleLoadMission} className="btn btn-ghost" style={{ flex: 1, padding: "6px 8px", fontSize: "0.68rem", fontWeight: 600, gap: "5px" }}>
                Load State
              </button>
            </div>
          </div>

          {/* EMERGENCY OVERRIDES */}
          <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.4)", boxShadow: "0 0 15px rgba(239,68,68,0.15)" }}>
            <h2 className="card-title">
              <span style={{ color: "var(--color-danger)" }}>Emergency Overrides</span>
              <AlertTriangle size={14} style={{ color: "var(--color-danger)" }} />
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              <div style={{ background: "rgba(239, 68, 68, 0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: "800", marginBottom: "8px", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <RotateCcw size={12}/> GLOBAL RECALL (RTB)
                </div>
                <button 
                  onClick={handleGlobalRTB} 
                  className="btn btn-danger" 
                  style={{ width: "100%", padding: "10px", fontWeight: "700", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "1px" }}
                >
                  ABORT MISSION: RETURN ALL ASSETS
                </button>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>
                  Forces all units to abandon tasks and return to closest Safe Haven.
                </div>
              </div>

              <div style={{ background: "rgba(59, 130, 246, 0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: "800", marginBottom: "8px", color: "var(--color-rescue)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Navigation size={12}/> EMERGENCY AIRDROP
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input 
                    type="text" 
                    placeholder="Haven Node ID" 
                    value={airdropTargetId} 
                    onChange={e => setAirdropTargetId(e.target.value)}
                    className="select-input-sidebar" 
                    style={{ flex: 1, padding: "8px" }} 
                  />
                  <input 
                    type="number" 
                    placeholder="Qty" 
                    value={airdropAmount} 
                    onChange={e => setAirdropAmount(Number(e.target.value))}
                    className="select-input-sidebar" 
                    style={{ width: "70px", padding: "8px", textAlign: "center" }} 
                  />
                </div>
                <button 
                  onClick={() => handleRequestAirdrop(airdropTargetId, airdropAmount)} 
                  className="btn btn-primary" 
                  style={{ width: "100%", fontWeight: "700", padding: "10px", textTransform: "uppercase", letterSpacing: "1px" }}
                >
                  DEPLOY CARGO DROPS
                </button>
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>
                  Restores Food/Water resources at target Safe Haven instantly.
                </div>
              </div>
            </div>
          </div>

          {/* SIGNATURE: Grid Entropy & Knowledge Decay Scanner */}
          <div className="card">
            <h2 className="card-title">
              <span>Belief State Confidence Scanner</span>
              <Cpu size={14} />
            </h2>
            <div className="scanner-grid">
              <div className="scanner-ring-container">
                <svg className="scanner-svg" width="70" height="70">
                  <circle className="scanner-track" cx="35" cy="35" r="25" />
                  <circle 
                    className="scanner-indicator" 
                    cx="35" 
                    cy="35" 
                    r="25" 
                    strokeDasharray="157" 
                    strokeDashoffset={157 - (157 * avgConfidence) / 100}
                    style={{ stroke: scannerColor }}
                  />
                </svg>
                <div className="scanner-text" style={{ color: scannerColor }}>
                  {avgConfidence}%
                </div>
              </div>
              <div className="scanner-stats">
                <div className="scanner-status-label">
                  <span className={alertDotClass} style={{ color: scannerColor }}></span>
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", letterSpacing: "0.5px", color: scannerColor }}>
                    {systemStatusText}
                  </span>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.3" }}>
                  <div>Verified Nodes: <span style={{ color: "var(--color-safe)", fontWeight: "600" }}>{verifiedCount}</span></div>
                  <div>Decaying: <span style={{ color: "var(--color-uncertain)", fontWeight: "600" }}>{decayingCount}</span></div>
                  <div>Blindspots: <span style={{ color: "var(--color-blocked)", fontWeight: "600" }}>{blindspotCount}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Scout/Rescue Team View */}
          <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "260px", marginBottom: "12px" }}>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <span>Scout/Rescue Team View</span>
              <Navigation size={14} style={{ color: selectedAgentId ? "#10b981" : "var(--text-muted)" }} />
            </h2>
            {!selectedAgentId ? (
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", justifyContent: "center", flex: 1 }}>
                <span>📡 No active unit selected.</span>
                <span>Select a scout or rescue team from the list below or click their icon on the map to monitor real-time data exchanges and path resolutions.</span>
              </div>
            ) : (() => {
              const agent = agents.find(a => a.id === selectedAgentId);
              if (!agent) return <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", padding: "12px" }}>Unit not found.</div>;
              
              const isScout = agent.agent_type === "SCOUT";
              const isEvac = agent.survivors_onboard > 0;
              const routeNodes = agent.full_planned_route && agent.full_planned_route.length > 0 ? agent.full_planned_route : (agent.route || []);
              
              // Find details about current node in nodes state
              const currentNodeData = nodes.find(n => n.id === agent.current_node);
              
              // Generate some simulated data exchanges/logs
              const logs = [];
              if (agent.comms_blackout) {
                logs.push(`[SYSTEM WARNING] Comms blackout: radio signals degraded at ${agent.current_node}.`);
                logs.push(`[TELEMETRY] Cached ${routeNodes.length} route hops in offline memory buffer.`);
              } else {
                logs.push(`[SYS] Telemetry connection active. Speed: ${agent.speed} m/s.`);
                
                // If it's a scout, show unverified zone resolution
                if (isScout) {
                  if (currentNodeData && currentNodeData.node_type === "POPULATION_ZONE") {
                    const isUnverified = currentNodeData.p_state_correct < 0.95;
                    if (isUnverified) {
                      logs.push(`[EXCHANGE] Scout sensor sweep at unverified zone ${agent.current_node}.`);
                      logs.push(`[BELIEF STATE] Resolution: danger=${Math.round(currentNodeData.p_danger*100)}%, pop=${currentNodeData.population}.`);
                      logs.push(`[SYNC] Synced belief state for ${agent.current_node} (Certainty: 100%).`);
                    } else {
                      logs.push(`[EXCHANGE] Node ${agent.current_node} verified safe. State matches belief database.`);
                    }
                  } else {
                    logs.push(`[EXCHANGE] Scanning road intersection ${agent.current_node} for blockages.`);
                  }
                  
                  // Scout planning logs
                  if (agent.target_node) {
                    logs.push(`[ROUTING] Scanning towards target node ${agent.target_node}.`);
                  }
                } else {
                  // Rescue team logs
                  if (agent.status === "RESCUING") {
                    logs.push(`[EXCHANGE] Rescue team deploying medical equipment at ${agent.current_node}.`);
                    logs.push(`[CARGO UPDATE] Loading survivors into medical transport cabin.`);
                  } else if (agent.status === "RETURNING") {
                    logs.push(`[EXCHANGE] Transporting ${agent.survivors_onboard} survivors. Safe Haven corridor active.`);
                    logs.push(`[GPS] Navigating around verified blocked roads.`);
                  } else if (agent.target_node) {
                    logs.push(`[EXCHANGE] En route to pop zone ${agent.target_node}. Path clear confidence high.`);
                  }
                }
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                    <div>
                      <span className={`agent-badge ${isScout ? "agent-badge-scout" : "agent-badge-rescue"}`} style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
                        {agent.id}
                      </span>
                      <span style={{ fontSize: "0.75rem", fontWeight: "700", marginLeft: "8px", color: isScout ? "var(--color-scout)" : "var(--color-rescue)" }}>
                        {agent.agent_type} UNIT
                      </span>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: agent.comms_blackout ? "#ef4444" : "#10b981", fontWeight: "bold" }}>
                      {agent.comms_blackout ? "🚫 BLACKOUT" : `✓ ONLINE (${agent.status})`}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div>📍 <strong>Location:</strong> {agent.current_node} {agent.target_node && `→ target: ${agent.target_node}`}</div>
                    <div>📦 <strong>Cargo Status:</strong> {isScout ? "Recon Only (No Cargo)" : `${agent.survivors_onboard} /  survivors onboard`}</div>
                    <div style={{ marginTop: "4px" }}>
                      🛣️ <strong>Planned Route:</strong>{" "}
                      {routeNodes.length === 0 ? (
                        <span style={{ color: "var(--text-muted)" }}>None (Stationary)</span>
                      ) : (
                        <span style={{ fontFamily: "var(--font-mono)", color: "#a78bfa" }}>
                          {routeNodes.slice(0, 4).join(" → ")}
                          {routeNodes.length > 4 ? ` (+${routeNodes.length - 4} hops)` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: "bold", color: "#60a5fa", letterSpacing: "0.05em" }}>LIVE DATA EXCHANGE & BELIEF RESOLUTION</div>
                    <div style={{
                      backgroundColor: "rgba(0,0,0,0.3)",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.04)",
                      padding: "6px 8px",
                      fontSize: "0.68rem",
                      fontFamily: "var(--font-mono)",
                      color: "#94a3b8",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      overflowY: "auto",
                      maxHeight: "110px"
                    }}>
                      {logs.map((log, idx) => (
                        <div key={idx} style={{
                          color: log.startsWith("[SYSTEM") || log.startsWith("[EXCHANGE")
                            ? "#f59e0b"
                            : log.startsWith("[BELIEF")
                            ? "#10b981"
                            : log.startsWith("[ROUTING")
                            ? "#a78bfa"
                            : "#94a3b8"
                        }}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                  {agent.is_manual_override && (
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch("http://127.0.0.1:8000/api/agents/cancel_override", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ agent_id: agent.id })
                          });
                          const data = await res.json();
                          if (data.status === "Success") {
                            setEventLog(prev => [...prev, `[System] Released manual override for ${agent.id}. Auto-coordinator resumed.`]);
                            await fetchState();
                          }
                        } catch (e) {
                          console.error("Failed to cancel manual override:", e);
                        }
                      }}
                      className="btn"
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        background: "rgba(239, 68, 68, 0.15)",
                        borderColor: "#ef4444",
                        color: "#f87171",
                        fontSize: "0.68rem",
                        padding: "6px",
                        fontWeight: "bold"
                      }}
                    >
                      🤖 Resume Auto-Rescue Control
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* SIGNATURE: Tactical Operations HUD */}
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "350px" }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", gap: "8px", alignItems: "center" }}>
              <h2 className="card-title" style={{ margin: 0, border: "none", padding: 0 }}>
                <span>Tactical Feed</span>
              </h2>
              <div style={{ display: "flex", gap: "3px", marginLeft: "auto" }}>
                {["incidents", "scouts", "agents"].map(t => (
                  <button 
                    key={t}
                    onClick={() => setSidebarTab(t)}
                    className="btn"
                    style={{
                      fontSize: "0.6rem",
                      padding: "3px 6px",
                      background: sidebarTab === t ? "rgba(99, 102, 241, 0.15)" : "transparent",
                      borderColor: sidebarTab === t ? "var(--color-rescue)" : "rgba(255,255,255,0.06)",
                      color: sidebarTab === t ? "#fff" : "var(--text-secondary)",
                      borderRadius: "4px"
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "8px 0", paddingRight: "2px" }}>
              {sidebarTab === "incidents" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {nodes.filter(n => n.node_type === "POPULATION_ZONE" && n.population > 0).length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "16px" }}>
                      ✓ All population zones evacuated safely.
                    </div>
                  ) : (
                    nodes
                      .filter(n => n.node_type === "POPULATION_ZONE" && n.population > 0)
                      .sort((a, b) => (b.population * b.p_danger) - (a.population * a.p_danger))
                      .map(zone => {
                        const threatColor = zone.p_danger > 0.75 ? "var(--color-blocked)" : zone.p_danger > 0.4 ? "var(--color-uncertain)" : "var(--color-safe)";
                        const isUnderRescue = agents.some(a => a.target_node === zone.id && a.agent_type === "RESCUE");
                        return (
                          <div key={zone.id} style={{
                            padding: "8px",
                            background: "rgba(255,255,255,0.01)",
                            border: "1px solid var(--border-color)",
                            borderLeft: `3px solid ${threatColor}`,
                            borderRadius: "6px"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: "700" }}>{zone.id}</span>
                              <span style={{ fontSize: "0.7rem", color: threatColor, fontWeight: "600" }}>
                                {Math.round(zone.p_danger * 100)}% Threat
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                              <span>Stranded: <b>{zone.population} pax</b></span>
                              <span style={{
                                color: isUnderRescue ? "var(--color-safe)" : "var(--color-uncertain)",
                                fontWeight: "600"
                              }}>
                                {isUnderRescue ? "✓ RESCUE ACTIVE" : "⚠️ AWAITING DISPATCH"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {sidebarTab === "scouts" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {nodes.filter(n => n.node_type === "POPULATION_ZONE" && n.population > 0 && n.p_state_correct < 0.65).length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "16px" }}>
                      ✓ Zero blindspots. All zones fully verified.
                    </div>
                  ) : (
                    nodes
                      .filter(n => n.node_type === "POPULATION_ZONE" && n.population > 0 && n.p_state_correct < 0.65)
                      .map(zone => {
                        const isUnderScan = agents.some(a => a.target_node === zone.id && a.agent_type === "SCOUT");
                        return (
                          <div key={zone.id} style={{
                            padding: "8px",
                            background: "rgba(255,255,255,0.01)",
                            border: "1px solid var(--border-color)",
                            borderLeft: `3px solid var(--color-uncertain)`,
                            borderRadius: "6px"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: "700" }}>{zone.id}</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--color-uncertain)", fontWeight: "600" }}>
                                {Math.round(zone.p_state_correct * 100)}% Certainty
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                              <span>Decaying Block (Blindspot)</span>
                              <span style={{
                                color: isUnderScan ? "var(--color-safe)" : "var(--color-uncertain)",
                                fontWeight: "600"
                              }}>
                                {isUnderScan ? "📡 SCANNING" : "⚠️ SCOUT FIRST"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {sidebarTab === "agents" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

                  {/* ── Summary Stats Bar (Phase B6) ──────────────────────── */}
                  {agents.length > 0 && (() => {
                    const deployed = agents.length;
                    const rescued  = metrics.total_survivors_saved || 0;
                    const moving   = agents.filter(a => a.status === "MOVING" || a.status === "RESCUING").length;
                    return (
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "6px", padding: "8px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "6px"
                      }}>
                        {[{label: "DEPLOYED", value: deployed, color: "#4589ff"},
                          {label: "ACTIVE",   value: moving,   color: "#f1c21b"},
                          {label: "RESCUED",  value: rescued,  color: "#42be65"}
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "1rem", fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
                            <div style={{ fontSize: "0.55rem", color: "#6f6f6f", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── Search + Filter Bar (Phase B7) ────────────────────── */}
                  {agents.length > 0 && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        placeholder="Search unit ID…"
                        value={agentFilter}
                        onChange={e => setAgentFilter(e.target.value.toLowerCase())}
                        style={{
                          flex: 1, padding: "5px 8px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px", color: "#f4f4f4",
                          fontSize: "0.7rem", fontFamily: "'IBM Plex Mono', monospace",
                          outline: "none"
                        }}
                      />
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{
                          padding: "5px 6px",
                          background: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px", color: "#c6c6c6",
                          fontSize: "0.65rem", cursor: "pointer", outline: "none"
                        }}
                      >
                        <option value="ALL">All</option>
                        <option value="MOVING">Moving</option>
                        <option value="RESCUING">Rescuing</option>
                        <option value="RETURNING">Returning</option>
                        <option value="IDLE">Idle</option>
                      </select>
                    </div>
                  )}

                  {/* ── Dispatch hint banner ──────────────────────────────── */}
                  {selectedAgentId && (
                    <div style={{
                      padding: "8px 10px",
                      background: "rgba(69,137,255,0.08)",
                      border: "1px solid rgba(69,137,255,0.2)",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      color: "#4589ff",
                      fontFamily: "var(--font-mono)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span>📍 Click map node to dispatch {selectedAgentId}</span>
                      <button
                        onClick={() => setSelectedAgentId(null)}
                        style={{ background: "none", border: "none", color: "#4589ff", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* ── Agent list (filtered) ─────────────────────────────── */}
                  {agents.length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginTop: "16px" }}>
                      No active agents.
                    </div>
                  ) : (
                    agents
                      .filter(a =>
                        (agentFilter === "" || a.id.toLowerCase().includes(agentFilter)) &&
                        (statusFilter === "ALL" || a.status === statusFilter)
                      )
                      .map(agent => {
                        const isSelected = selectedAgentId === agent.id;
                        return (
                          <AgentCard
                            key={agent.id}
                            agent={agent}
                            isSelected={isSelected}
                            onSelect={(id) => setSelectedAgentId(prev => prev === id ? null : id)}
                          />
                        );
                      })
                  )}
                </div>
              )}
            </div>
          </div>
      </section>
    )}

        {/* MIDDLE COLUMN: Interactive Map */}
        <section className="map-viewport">
          {/* Sidebar Toggle Buttons */}
          <button 
            className="btn" 
            style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 1000, padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(9, 13, 20, 0.85)' }}
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            title="Toggle Left Panel"
          >
            {leftSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          
          <button 
            className="btn" 
            style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(9, 13, 20, 0.85)' }}
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            title="Toggle Right Panel"
          >
            {rightSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>

          <div className="map-container">
          <div className="scanning-bar" />
          
          

          <MapView 
            nodes={nodes} 
            edges={edges}
            clearedEdges={clearedEdges}
            agents={agents} 
            coordinates={coordinates} 
            nodeNames={nodeNames}
            onDesignateShelter={handleDesignateNode} 
            simulationTime={metrics.simulation_time} 
            centerLat={committedLat}
            centerLon={committedLon} 
            selectedAgentId={selectedAgentId}
            onDispatchAgent={handleDispatchAgent}
            onRequestAirdrop={handleRequestAirdrop}
            onToggleBlockage={handleToggleBlockage}
            onRefreshState={fetchState}
            isSelectingRegion={isSelectingRegion}
            isDeploying={isDeploying || isPlacingHaven || !!activeDeployUnit}
            onMapClick={handleMapClick}
            deploymentMarkers={deployedUnits}
            span={committedSpan}
            activeDisasterType={disasterType}
            onChangeRegion={(lat, lon, newSpan) => {
              setCustomLat(lat.toString());
              setCustomLon(lon.toString());
              setSpan(newSpan);
            }}
          />

          {/* ── Task 2: Floating overlay container for emergency/warning Toasts ── */}
          {toasts.length > 0 && (
            <div style={{
              position: "absolute",
              top: "16px",
              right: rightSidebarOpen ? "360px" : "16px",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxWidth: "280px",
              pointerEvents: "auto"
            }}>
              {toasts.map(toast => (
                <div 
                  key={toast.id}
                  style={{
                    background: toast.type === "emergency" ? "rgba(220,38,38,0.92)" : "rgba(217,119,6,0.92)",
                    backdropFilter: "blur(8px)",
                    border: `1px solid ${toast.type === "emergency" ? "#fca5a5" : "#fcd34d"}`,
                    borderRadius: "6px",
                    padding: "10px 12px",
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    fontSize: "0.68rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    animation: "fadeIn 0.25s ease-out"
                  }}
                >
                  <div style={{ fontWeight: "700", fontFamily: "var(--font-mono)", lineHeight: "1.3" }}>
                    {toast.message}
                  </div>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setSelectedAgentId(toast.agentId);
                        setSidebarTab("agents");
                        if (window.panToAgent) window.panToAgent(toast.agentId);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        border: "none",
                        borderRadius: "3px",
                        color: "#fff",
                        padding: "3px 6px",
                        fontSize: "0.58rem",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      PAN TO UNIT
                    </button>
                    <button
                      onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        border: "none",
                        borderRadius: "3px",
                        color: "#fff",
                        padding: "3px 6px",
                        fontSize: "0.58rem",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            position: "absolute",
            bottom: "16px",
            left: leftSidebarOpen ? "376px" : "16px",
            zIndex: 1000,
            background: "rgba(10, 15, 28, 0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "0.68rem",
            fontFamily: "'JetBrains Mono', monospace",
            color: "rgba(255,255,255,0.75)",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            minWidth: isLegendOpen ? "185px" : "auto",
            transition: "all 0.3s ease"
          }}>
            <div 
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              style={{ fontWeight: 700, color: "#94a3b8", marginBottom: isLegendOpen ? "4px" : "0", fontSize: "0.6rem", letterSpacing: "0.1em", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              title="Toggle Legend"
            >
              <span>TACTICAL LEGEND</span>
              <span>{isLegendOpen ? "▼" : "▶"}</span>
            </div>
            
            {isLegendOpen && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "13px" }}>🏥</span><span>Hospital (active)</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "13px" }}>🛡️</span><span>Evacuation Shelter</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: "rgba(239,68,68,0.25)", border: "2px solid #ef4444", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Critical zone (&gt;85% danger)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "22px", height: "3px", background: "#3b82f6", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Unit Moving</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "22px", height: "3px", background: "#ef4444", display: "inline-block", flexShrink: 0, boxShadow: "0 0 6px #ef4444" }}></span>
                  <span>Emergency Evac Route</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "22px", height: "3px", background: "#eab308", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Delayed / Returning</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "22px", height: "3px", background: "#10b981", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Mission Complete / Safe</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "22px", height: 0, borderTop: "2px dashed #64748b", display: "inline-block", flexShrink: 0 }}></span>
                  <span style={{ color: "var(--text-muted)" }}>Offline / Unverified</span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px #3b82f6", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Active Unit</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Evacuating Cargo</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: "#64748b", display: "inline-block", flexShrink: 0 }}></span>
                  <span>Comms Blackout</span>
                </div>
                </>
                )}
          </div>

          {havens.length > 0 && (
            <div className="hud-overlay">
              {havens.slice(0, 3).map((haven, idx) => {
                const isHospital = haven.node_type === "HOSPITAL";
                const totalCap = haven.capacity || (isHospital ? 150 : 250);
                
                const portion = haven.occupants ?? 0;
                const fillPct = Math.min(100, Math.round((portion / totalCap) * 100));

                return (
                  <div key={haven.id} className="hud-card">
                    <div className="hud-card-header">
                      <span style={{ color: isHospital ? "var(--color-rescue)" : "var(--color-safe)", display: "flex", alignItems: "center", gap: "4px" }}>
                        {isHospital ? <Heart size={10} fill="currentColor" /> : <Shield size={10} />}
                        {haven.id}
                      </span>
                      <span>{portion}/{totalCap} Pax</span>
                    </div>
                    <div className="hud-progress-container">
                      <div 
                        className="hud-progress-bar" 
                        style={{ 
                          width: `${fillPct}%`,
                          background: isHospital ? "var(--color-rescue)" : "var(--color-safe)"
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </section>
 
        {/* RIGHT COLUMN: Guide, Analytics & Logs */}
        {rightSidebarOpen && (
          <section className="sidebar-right">
            {showGuide && (
            <div className="card" style={{ 
              border: "1px solid rgba(234, 179, 8, 0.35)", 
              background: "rgba(234, 179, 8, 0.05)",
              position: "relative",
              padding: "12px 14px",
              marginBottom: "4px"
            }}>
              <button 
                onClick={() => setShowGuide(false)} 
                style={{ 
                  position: "absolute", 
                  top: "6px", 
                  right: "10px", 
                  background: "none", 
                  border: "none", 
                  color: "var(--text-secondary)", 
                  cursor: "pointer", 
                  fontSize: "0.85rem",
                  fontWeight: "bold"
                }}
                title="Dismiss Guide"
              >
                ✕
              </button>
              <h3 className="card-title" style={{ 
                color: "var(--color-uncertain)", 
                borderBottom: "1px solid rgba(234, 179, 8, 0.15)",
                paddingBottom: "4px",
                marginBottom: "8px",
                fontSize: "0.7rem",
                letterSpacing: "1px"
              }}>
                Emergency Operations Center Guide
              </h3>
              <div style={{ fontSize: "0.72rem", color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: "8px", lineHeight: "1.4" }}>
                <p style={{ color: "var(--text-secondary)" }}>Sentinel integrates multi-source municipal and GIS data to coordinate rescue operations:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "2px 0" }}>
                  <div>🏥 <strong>Hospitals</strong>: Operational status verified via Google Maps API & Health Registries. Only open centers are route targets.</div>
                  <div>🛡️ <strong>Shelters</strong>: Fixed spaces (stadiums, schools) designated by local Disaster Management teams.</div>
                  <div>📊 <strong>Population Zones</strong>: Mapped using demographic census data by district to identify high-density hazards.</div>
                  <div>📡 <strong>Scout Scan</strong>: Scouts prioritize scanning <strong>blindspots</strong> (low confidence roads) to find safe paths before rescue teams commit.</div>
                  <div>🚨 <strong>Tactical Routing</strong>: Once survivors are located, rescue units route them to the nearest safe shelter or operating hospital.</div>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="btn" 
                  style={{ 
                    marginTop: "6px", 
                    width: "100%", 
                    borderColor: "rgba(234, 179, 8, 0.25)", 
                    background: "rgba(234, 179, 8, 0.08)",
                    color: "#fff",
                    fontSize: "0.7rem",
                    padding: "6px"
                  }}
                >
                  Dismiss Guide
                </button>
              </div>
            </div>
          )}
          <div className="stats-grid">
            <div className="stat-box" style={{ borderLeft: "3px solid var(--color-safe)" }}>
              <div className="stat-label">Saved Survivors</div>
              <div className="stat-value" style={{ color: "var(--color-safe)" }}>
                {metrics.total_survivors_saved}
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "2px" }}>
                RESOLVED STATE
              </div>
            </div>
            <div className="stat-box" style={{ borderLeft: "3px solid var(--color-rescue)" }}>
              <div className="stat-label">Initial Impacted</div>
              <div className="stat-value" style={{ color: "#fff" }}>
                {metrics.initial_population}
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "2px" }}>
                TOTAL POPULATION
              </div>
            </div>
          </div>
 
          <div style={{ display: "flex", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
            <button 
              onClick={() => setActiveTab("telemetry")} 
              className="btn" 
              style={{ 
                flex: 1, 
                background: activeTab === "telemetry" ? "rgba(99, 102, 241, 0.1)" : "transparent",
                border: "none",
                borderRadius: 0,
                color: activeTab === "telemetry" ? "#fff" : "var(--text-secondary)",
                fontSize: "0.75rem",
                padding: "10px"
              }}
            >
              <Terminal size={12} style={{ marginRight: "4px", display: "inline" }} /> Logs
            </button>
            <button 
              onClick={() => setActiveTab("analytics")} 
              className="btn"
              style={{ 
                flex: 1, 
                background: activeTab === "analytics" ? "rgba(99, 102, 241, 0.1)" : "transparent",
                border: "none",
                borderRadius: 0,
                color: activeTab === "analytics" ? "#fff" : "var(--text-secondary)",
                fontSize: "0.75rem",
                padding: "10px",
                borderLeft: "1px solid rgba(255,255,255,0.05)",
                borderRight: "1px solid rgba(255,255,255,0.05)"
              }}
            >
              <BarChart3 size={12} style={{ marginRight: "4px", display: "inline" }} /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("experiments")} 
              className="btn"
              style={{ 
                flex: 1, 
                background: activeTab === "experiments" ? "rgba(99, 102, 241, 0.1)" : "transparent",
                border: "none",
                borderRadius: 0,
                color: activeTab === "experiments" ? "#fff" : "var(--text-secondary)",
                fontSize: "0.75rem",
                padding: "10px"
              }}
            >
              <Shield size={12} style={{ marginRight: "4px", display: "inline" }} /> Ablation
            </button>
          </div>
 
          {activeTab === "telemetry" && (
            <div className="card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <h3 className="card-title">Decision Support Feed</h3>
              <div style={{ 
                overflowY: "auto", 
                flex: 1, 
                fontFamily: "var(--font-mono)",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.02)",
                borderRadius: "8px",
                padding: "8px 0"
              }}>
                {eventLog.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "12px", textAlign: "center" }}>
                    Awaiting dispatch signals...
                  </div>
                ) : (
                  [...eventLog].reverse().map((log, idx) => renderLogLine(log, idx))
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && isMounted && (
            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 className="card-title" style={{ margin: 0 }}>Mission Dashboard</h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={handlePDFExport} className="btn btn-primary" style={{ fontSize: "0.62rem", padding: "4px 10px", height: "26px", gap: "4px", background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.4)", color: "#f43f5e" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Export AAR (PDF)
                  </button>
                  <button onClick={handleAARExport} className="btn btn-primary" style={{ fontSize: "0.62rem", padding: "4px 10px", height: "26px", gap: "4px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export AAR (CSV)
                  </button>
                </div>
              </div>

              {metrics?.briefing?.objectives && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                    Active Objectives
                  </span>
                  {metrics.briefing.objectives.map((obj, i) => (
                    <div key={i} style={{ 
                      background: "rgba(255,255,255,0.02)", 
                      border: "1px solid rgba(255,255,255,0.05)", 
                      borderLeft: `3px solid ${obj.priority === 'Critical' ? '#ef4444' : '#eab308'}`,
                      borderRadius: "6px", 
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-primary)", marginBottom: "2px" }}>{obj.id}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.2 }}>{obj.description}</div>
                      </div>
                      <div style={{ fontSize: "0.65rem", background: isRunning ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)", color: isRunning ? "#10b981" : "var(--text-muted)", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", whiteSpace: "nowrap" }}>
                        {isRunning ? "IN PROGRESS" : "PENDING"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  Evacuation Volume (Survivors Rescued)
                </span>
                <div style={{ height: "130px", width: "100%", marginLeft: "-20px" }}>
                  <ResponsiveContainer width="108%" height="100%">
                    <AreaChart data={metrics.history || []}>
                      <defs>
                        <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-safe)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-safe)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="step" stroke="#475569" fontSize={8} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={8} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(9,13,20,0.95)", borderColor: "rgba(99,102,241,0.3)", color: "#f1f5f9", fontSize: "10px", borderRadius: "6px", backdropFilter: "blur(8px)" }}
                        cursor={{ stroke: "rgba(99,102,241,0.3)", strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="survivors_saved" stroke="var(--color-safe)" fillOpacity={1} fill="url(#colorSaved)" strokeWidth={2} name="Rescued" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid rgba(99,102,241,0.1)", paddingTop: "12px" }}>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  Belief Accuracy &amp; Coverage (%)
                </span>
                <div style={{ height: "130px", width: "100%", marginLeft: "-20px" }}>
                  <ResponsiveContainer width="108%" height="100%">
                    <AreaChart data={(metrics.history || []).map(item => ({
                      step: item.step,
                      coverage: Math.round(item.coverage * 100),
                      confidence: Math.round(item.map_confidence * 100)
                    }))}>
                      <defs>
                        <linearGradient id="colorCov" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-scout)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--color-scout)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-rescue)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--color-rescue)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="step" stroke="#475569" fontSize={8} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={8} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(9,13,20,0.95)", borderColor: "rgba(99,102,241,0.3)", color: "#f1f5f9", fontSize: "10px", borderRadius: "6px", backdropFilter: "blur(8px)" }}
                        cursor={{ stroke: "rgba(99,102,241,0.3)", strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="coverage" stroke="var(--color-scout)" fillOpacity={1} fill="url(#colorCov)" strokeWidth={2} name="Map Coverage %" dot={false} />
                      <Area type="monotone" dataKey="confidence" stroke="var(--color-rescue)" fillOpacity={1} fill="url(#colorConf)" strokeWidth={2} name="Avg Certainty %" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
 
          {activeTab === "experiments" && (
            <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 className="card-title">Comparative Performance (60% Corruption)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {experimentResults.map((res, idx) => (
                  <div key={idx} style={{ 
                    padding: "12px 14px", 
                    background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.1) 100%)",
                    borderRadius: "8px", 
                    border: "1px solid var(--border-color)",
                    borderLeft: `3px solid ${varColor(res.baseline)}`,
                    transition: "all 250ms cubic-bezier(0.4,0,0.2,1)",
                    cursor: "default",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.1) 100%)"}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", fontWeight: 700 }}>
                      <span style={{ fontFamily: "var(--font-mono)", color: varColor(res.baseline) }}>{res.baseline}</span>
                      <span style={{ color: "var(--color-safe)", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>{Math.round(res.saved_fraction * 100)}% <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 400 }}>saved</span></span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", margin: "8px 0" }}>
                      <div style={{ height: "100%", width: `${Math.round(res.saved_fraction * 100)}%`, background: `linear-gradient(90deg, ${varColor(res.baseline)}, ${varColor(res.baseline)}aa)`, borderRadius: "2px", transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                    </div>
                    <div className="telemetry-row" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      <span>Steps: {res.steps_run} mins</span>
                      <span>Coverage: {Math.round(res.final_coverage * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </section>
        )}

      {decision && decision.paused && decision.active_decision && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(3, 7, 18, 0.82)", backdropFilter: "blur(12px)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000,
          animation: "fadeIn 0.2s ease-out"
        }}>
          <div style={{
            width: "520px", padding: "28px", borderRadius: "16px",
            backgroundColor: "#0b0f19", border: "1px solid rgba(239, 68, 68, 0.35)",
            boxShadow: "0 0 50px rgba(239, 68, 68, 0.15)", color: "#fff",
            display: "flex", flexDirection: "column", gap: "20px"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "var(--font-mono)" }}>
                  🚨 COMMAND OVERRIDE REQUIRED (TICK: {decision.active_decision.step}m)
                </span>
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "6px 0 0 0", color: "#f8fafc" }}>
                {decision.active_decision.reason}
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                The AI Coordinator has paused operations. Choose a strategic pathway to resolve the blockage and override routing parameters.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {decision.active_decision.options.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleResolveDecision(opt.id)}
                  style={{
                    padding: "16px", borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer", display: "flex", gap: "14px",
                    transition: "all 0.18s ease-in-out"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#818cf8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.85rem", flexShrink: 0
                  }}>
                    {opt.id}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f1f5f9" }}>{opt.title}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{opt.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function varColor(baseline) {
  if (baseline === "AMIS-RU") return "#10b981"; // Emerald
  if (baseline === "BASELINE-A") return "#ef4444"; // Red
  return "#f59e0b"; // Yellow
}

function formatWeatherInfo(weatherVal) {
  if (!weatherVal) return "☀️ CLEAR";
  if (typeof weatherVal === 'string') {
    if (weatherVal.trim().startsWith('{') || weatherVal.trim().startsWith('[')) {
      try {
        const cleaned = weatherVal.replace(/'/g, '"');
        const parsed = JSON.parse(cleaned);
        return formatWeatherInfo(parsed);
      } catch (e) {
        return weatherVal;
      }
    }
    return weatherVal;
  }
  
  if (typeof weatherVal === 'object') {
    const temp = weatherVal.temperature !== undefined ? `${weatherVal.temperature}°C` : "";
    const wind = weatherVal.windspeed !== undefined ? `💨 ${weatherVal.windspeed} km/h` : "";
    const code = weatherVal.weathercode;
    
    let cond = "☀️ CLEAR";
    if (code !== undefined) {
      if (code === 0) cond = "☀️ CLEAR";
      else if ([1, 2, 3].includes(code)) cond = "⛅ PARTLY CLOUDY";
      else if ([45, 48].includes(code)) cond = "🌫️ FOGGY";
      else if ([51, 53, 55].includes(code)) cond = "🌧️ DRIZZLE";
      else if ([61, 63, 65].includes(code)) cond = "🌧️ RAIN";
      else if ([71, 73, 75].includes(code)) cond = "❄️ SNOW";
      else if ([80, 81, 82].includes(code)) cond = "🌧️ SHOWERS";
      else if ([95, 96, 99].includes(code)) cond = "⛈️ THUNDERSTORM";
    }
    
    return `${cond} (${temp}${temp && wind ? ", " : ""}${wind})`;
  }
  
  return String(weatherVal);
}
