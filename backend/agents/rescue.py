from backend.agents.base_agent import BaseAgent, AgentStatus
from backend.config import settings
from typing import Dict, Any

class RescueAgent(BaseAgent):
    def __init__(self, agent_id: str, start_node: str, capacity: int = 50, vehicle_type: str = "STANDARD_CAR") -> None:
        from backend.config_params.parameters import params
        super().__init__(
            agent_id=agent_id, 
            agent_type="RESCUE", 
            speed=getattr(params, 'rescue_speed_ms', 10.0), 
            start_node=start_node,
            crew=4
        )
        self.capacity: int = capacity
        self.survivors_onboard: int = 0
        self.survivors_immediate: int = 0
        self.survivors_delayed: int = 0
        self.survivors_minor: int = 0
        self.vehicle_type: str = vehicle_type

    def to_dict(self) -> Dict[str, Any]:
        d = super().to_dict()
        d["capacity"] = self.capacity
        d["survivors_onboard"] = self.survivors_onboard
        d["survivors_immediate"] = self.survivors_immediate
        d["survivors_delayed"] = self.survivors_delayed
        d["survivors_minor"] = self.survivors_minor
        d["vehicle_type"] = self.vehicle_type
        return d
