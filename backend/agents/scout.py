from backend.agents.base_agent import BaseAgent, AgentStatus
from backend.config import settings
from typing import Dict, Any

class ScoutAgent(BaseAgent):
    def __init__(self, agent_id: str, start_node: str) -> None:
        from backend.config_params.parameters import params
        super().__init__(
            agent_id=agent_id, 
            agent_type="SCOUT", 
            speed=getattr(params, 'scout_speed_ms', 15.0), 
            start_node=start_node,
            crew=2
        )
        self.vehicle_type: str = "SCOUT_CAR"

    def to_dict(self) -> Dict[str, Any]:
        d = super().to_dict()
        d["vehicle_type"] = self.vehicle_type
        return d
