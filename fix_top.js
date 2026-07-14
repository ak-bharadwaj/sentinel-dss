const fs = require('fs');

let page = fs.readFileSync('frontend/app/page.js', 'utf8');

const topFix = `"use client";

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
  PanelRightOpen
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
  const [numScouts, setNumScouts] = useState(3);
  const [numRescues, setNumRescues] = useState(3);
  const [numZodiacs, setNumZodiacs] = useState(2);
  const [numHelicopters, setNumHelicopters] = useState(1);
`;

const splitIdx = page.indexOf('  const [numTrucks, setNumTrucks] = useState(2);');
if (splitIdx !== -1) {
    page = topFix + page.substring(splitIdx);
    fs.writeFileSync('frontend/app/page.js', page);
    console.log("Fixed page.js");
} else {
    console.log("Could not find numTrucks");
}
