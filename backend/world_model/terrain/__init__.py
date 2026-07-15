"""
Sentinel Terrain Intelligence Subsystem
========================================
Terrain is a world property, not a flood-specific feature.
All disaster modules consume the same TerrainProcessor output.

Public API:
  from backend.world_model.terrain import TerrainProcessor
  processor = TerrainProcessor()
  processor.enrich(graph)   # attaches terrain data to every node/edge
"""
from backend.world_model.terrain.processor import TerrainProcessor

__all__ = ["TerrainProcessor"]
