from sqlalchemy import Column, String, Float, Boolean, DateTime, JSON
from datetime import datetime
from backend.database import Base

class EdgeModel(Base):
    __tablename__ = "edges"
    
    id = Column(String, primary_key=True, index=True)
    source = Column(String, nullable=False)
    target = Column(String, nullable=False)
    distance = Column(Float, nullable=False)  # in meters
    confidence = Column(Float, default=1.0)  # confidence of edge properties
    blocked = Column(Boolean, default=False)
    speed_factor = Column(Float, default=1.0)  # multiplier for speed (e.g. highway vs residential)
    last_observed = Column(DateTime, default=datetime.utcnow)
    name = Column(String, default="Unnamed Road")
    geometry = Column(JSON, nullable=True)  # List of [lat, lon] coordinate pairs

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "distance": self.distance,
            "confidence": self.confidence,
            "blocked": self.blocked,
            "speed_factor": self.speed_factor,
            "last_observed": self.last_observed.isoformat() if self.last_observed else None,
            "name": self.name or "Unnamed Road",
            "geometry": self.geometry
        }
