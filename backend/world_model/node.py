from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean
from datetime import datetime
from backend.database import Base

class NodeModel(Base):
    __tablename__ = "nodes"
    
    id = Column(String, primary_key=True, index=True)
    node_type = Column(String, nullable=False)  # ROAD, BRIDGE, HOSPITAL, SHELTER, POPULATION_ZONE, JUNCTION
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    population = Column(Integer, default=0)
    triage_immediate = Column(Integer, default=0)
    triage_delayed = Column(Integer, default=0)
    triage_minor = Column(Integer, default=0)
    importance = Column(Float, default=0.0)  # normalized 0.0 - 1.0 importance
    
    p_danger = Column(Float, default=0.0)  # probability of hazard affecting node
    p_state_correct = Column(Float, default=1.0)  # knowledge confidence (decays over time)
    status = Column(String, default="SAFE")  # SAFE, DANGER, BLOCKED
    last_observed = Column(DateTime, default=datetime.utcnow)
    
    # Context-Aware Hazards
    dist_to_water = Column(Float, default=999999.0)
    dist_to_coast = Column(Float, default=999999.0)
    is_tall_building_zone = Column(Boolean, default=False) # SQLite doesn't have native bool

    def to_dict(self):
        return {
            "id": self.id,
            "node_type": self.node_type,
            "lat": self.lat,
            "lon": self.lon,
            "population": self.population,
            "triage_immediate": self.triage_immediate,
            "triage_delayed": self.triage_delayed,
            "triage_minor": self.triage_minor,
            "importance": self.importance,
            "p_danger": self.p_danger,
            "p_state_correct": self.p_state_correct,
            "status": self.status,
            "dist_to_water": self.dist_to_water,
            "dist_to_coast": self.dist_to_coast,
            "is_tall_building_zone": bool(self.is_tall_building_zone),
            "last_observed": self.last_observed.isoformat() if self.last_observed else None
        }
