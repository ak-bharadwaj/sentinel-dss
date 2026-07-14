const fs = require('fs');

let page = fs.readFileSync('frontend/app/page.js', 'utf8');

const corrupted = `  CartesianGrid,
  const [coordinates, setCoordinates] = useState({});`;

const fixed = `  Tooltip,
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
  const [coordinates, setCoordinates] = useState({});`;

page = page.replace(corrupted, fixed);
fs.writeFileSync('frontend/app/page.js', page);
console.log('Fixed page.js');
