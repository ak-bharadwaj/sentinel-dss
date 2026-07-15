"""
Tests for Sentinel Terrain Intelligence Framework V1
=====================================================
Verifies that terrain attributes are correctly computed and that
disaster modules respond correctly to elevation.

Run: python -m pytest tests/test_terrain_intelligence.py -v
"""
import pytest
import math
import networkx as nx
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Terrain subsystem unit tests
# ---------------------------------------------------------------------------

class TestStructuralOffsets:
    def test_bridge_gets_positive_offset(self):
        from backend.world_model.terrain.structural_offsets import compute_structural_offset
        tags = {"bridge": "yes", "highway": "motorway"}
        offset = compute_structural_offset(tags)
        assert offset >= 8.0, f"Motorway bridge should have offset ≥ 8m, got {offset}"

    def test_tunnel_gets_negative_offset(self):
        from backend.world_model.terrain.structural_offsets import compute_structural_offset
        tags = {"tunnel": "yes", "layer": "-1"}
        offset = compute_structural_offset(tags)
        assert offset < 0.0, f"Tunnel should have negative offset, got {offset}"

    def test_ground_level_road_zero_offset(self):
        from backend.world_model.terrain.structural_offsets import compute_structural_offset
        tags = {"highway": "residential"}
        offset = compute_structural_offset(tags)
        assert offset == 0.0, f"Plain road should have zero offset, got {offset}"

    def test_explicit_height_tag_wins(self):
        from backend.world_model.terrain.structural_offsets import compute_structural_offset
        tags = {"bridge": "yes", "highway": "primary", "height": "15"}
        offset = compute_structural_offset(tags)
        assert offset == 15.0, f"Explicit height=15 should override class, got {offset}"

    def test_bridge_amplification_factor_increases_with_height(self):
        from backend.world_model.terrain.structural_offsets import compute_bridge_amplification_factor
        low = compute_bridge_amplification_factor({"bridge": "yes"}, 5.0)
        high = compute_bridge_amplification_factor({"bridge": "yes"}, 15.0)
        assert high > low, "Higher bridges should have higher amplification factor"
        assert low >= 1.0 and high <= 1.60, "Amplification should be in [1.0, 1.60]"

    def test_non_bridge_has_no_amplification(self):
        from backend.world_model.terrain.structural_offsets import compute_bridge_amplification_factor
        amp = compute_bridge_amplification_factor({"highway": "residential"}, 0.0)
        assert amp == 1.0, "Non-bridge should have amplification factor of 1.0"


class TestSlopeComputation:
    def test_flat_terrain_has_low_slope(self):
        from backend.world_model.terrain.slope import compute_slope_degrees
        elev_map = {
            (19.0760, 72.8777): 5.0,
            (19.0770, 72.8777): 5.1,
            (19.0750, 72.8777): 4.9,
            (19.0760, 72.8787): 5.0,
            (19.0760, 72.8767): 5.0,
        }
        slope, aspect = compute_slope_degrees(19.0760, 72.8777, elev_map, delta_deg=0.001)
        assert slope < 5.0, f"Flat terrain should have slope < 5°, got {slope}"

    def test_steep_hill_has_high_slope(self):
        from backend.world_model.terrain.slope import compute_slope_degrees
        # 10m rise over ~111m = about 5° slope
        elev_map = {
            (37.775, -122.419): 50.0,
            (37.776, -122.419): 60.0,
            (37.774, -122.419): 40.0,
            (37.775, -122.418): 50.0,
            (37.775, -122.420): 50.0,
        }
        slope, _ = compute_slope_degrees(37.775, -122.419, elev_map, delta_deg=0.001)
        assert slope > 3.0, f"Steep hill should have slope > 3°, got {slope}"

    def test_slope_multiplier_car_flat(self):
        from backend.world_model.terrain.slope import slope_accessibility_multiplier
        mult = slope_accessibility_multiplier(2.0, "STANDARD_CAR")
        assert mult == 1.0, "Flat road should have multiplier 1.0"

    def test_slope_multiplier_car_steep(self):
        from backend.world_model.terrain.slope import slope_accessibility_multiplier
        mult = slope_accessibility_multiplier(30.0, "STANDARD_CAR")
        assert mult > 2.0, "Very steep road should have multiplier > 2.0 for cars"

    def test_helicopter_ignores_slope(self):
        from backend.world_model.terrain.slope import slope_accessibility_multiplier
        mult = slope_accessibility_multiplier(45.0, "HELICOPTER")
        assert mult == 1.0, "Helicopters should ignore slope entirely"


class TestDrainageIndex:
    def test_flat_terrain_high_twi(self):
        from backend.world_model.terrain.drainage import compute_twi
        twi = compute_twi(slope_deg=0.5, area_proxy=1.0)
        # TWI for very flat terrain (0.5°) with area_proxy=1 → ln(1/tan(0.5°)) ≈ 4.7
        # Floor at 4.0 is the correct expectation for this configuration
        assert twi > 4.0, f"Very flat terrain should have high TWI (>4), got {twi}"

    def test_steep_terrain_low_twi(self):
        from backend.world_model.terrain.drainage import compute_twi
        twi = compute_twi(slope_deg=25.0, area_proxy=1.0)
        assert twi < 4.0, f"Steep terrain should have low TWI (<4), got {twi}"

    def test_basin_classification(self):
        from backend.world_model.terrain.drainage import classify_drainage
        assert classify_drainage(10.0) == "BASIN"
        assert classify_drainage(8.0) == "VALLEY"
        assert classify_drainage(6.0) == "SLOPE"
        assert classify_drainage(4.0) == "CREST"
        assert classify_drainage(1.0) == "PEAK"

    def test_basin_accumulates_faster(self):
        from backend.world_model.terrain.drainage import twi_to_accumulation_rate
        basin_rate = twi_to_accumulation_rate(11.0)
        slope_rate = twi_to_accumulation_rate(5.0)
        assert basin_rate > slope_rate, "Basins should accumulate water faster than slopes"


# ---------------------------------------------------------------------------
# Flood module terrain integration tests
# ---------------------------------------------------------------------------

class TestFloodTerrainIntegration:
    def _make_graph_with_elevations(self):
        """Create a small graph with two nodes: one elevated (motorway), one low."""
        g = nx.Graph()
        g.add_node("elevated", lat=19.076, lon=72.877,
                   effective_elevation=12.0, elevation=12.0,
                   terrain_elevation=4.0, structural_offset=8.0,
                   twi=4.0, drainage_accumulation_rate=0.6,
                   is_coastal=False, is_tunnel=False,
                   node_type="ROAD", status="SAFE", p_danger=0.1,
                   water_level=0.0)
        g.add_node("low", lat=19.077, lon=72.877,
                   effective_elevation=1.5, elevation=1.5,
                   terrain_elevation=1.5, structural_offset=0.0,
                   twi=9.0, drainage_accumulation_rate=2.2,
                   is_coastal=True, is_tunnel=False,
                   node_type="ROAD", status="SAFE", p_danger=0.5,
                   water_level=0.0)
        g.add_edge("elevated", "low", id="E_test", distance=100.0,
                   blocked=False, confidence=1.0, is_bridge=False,
                   effective_elevation=6.0)
        return g

    def test_elevated_road_not_flooded_at_low_water(self):
        """Motorway at +12m should NOT flood when only the low node has 0.5m water.
        The gravity flow from low (1.5m) to elevated (12m) cannot push water uphill
        because total head at low = 1.5 + 0.5 = 2.0 < head at elevated = 12.0.
        """
        from backend.disaster.flood import FloodModule
        flood = FloodModule(rainfall=0.0)  # no rain
        g = self._make_graph_with_elevations()
        # Water is on the LOW node only (0.5m) — not enough to reach elevated road (+12m)
        g.nodes["low"]["water_level"] = 0.5
        g.nodes["elevated"]["water_level"] = 0.0
        newly_blocked = flood.update_simulation_step(g, step=1)
        assert not any("elevated" in str(e) for e in newly_blocked), \
            "Elevated road at +12m should NOT be blocked when low node has only 0.5m water"

    def test_coastal_low_road_floods(self):
        """Coastal road at 1.5m SHOULD flood when water exceeds 1.5 + 0.30m."""
        from backend.disaster.flood import FloodModule
        flood = FloodModule(rainfall=0.9)
        g = self._make_graph_with_elevations()
        # Set water level well above road surface for low node
        g.nodes["low"]["water_level"] = 2.5   # 2.5m total water, road at 1.5m → 1.0m above road
        newly_blocked = flood.update_simulation_step(g, step=1)
        # The edge connected to "low" should be blocked
        assert len(newly_blocked) > 0, "Coastal low road should be blocked when water > effective_elevation + threshold"


# ---------------------------------------------------------------------------
# Cyclone terrain integration test
# ---------------------------------------------------------------------------

class TestCycloneTerrainIntegration:
    def test_elevated_node_not_inundated_by_surge(self):
        """A node at +12m effective_elevation should NOT get water_level set
        by a 3m storm surge (surge can't reach +12m)."""
        from backend.disaster.cyclone import CycloneModule
        cyclone = CycloneModule(wind_speed=150.0)
        cyclone.eye_lat = 19.0
        cyclone.eye_lon = 72.87

        g = nx.Graph()
        g.add_node("high_ground", lat=19.076, lon=72.877,
                   effective_elevation=12.0, elevation=12.0,
                   dist_to_coast=5000.0, p_danger=0.2, water_level=0.0)
        g.add_node("dummy", lat=19.077, lon=72.878,
                   effective_elevation=1.0, elevation=1.0,
                   dist_to_coast=200.0, p_danger=0.4, water_level=0.0)
        g.add_edge("high_ground", "dummy", blocked=False, confidence=1.0)

        cyclone.update_simulation_step(g, step=1)
        # High ground node should have water_level = 0 (surge doesn't reach it)
        assert g.nodes["high_ground"].get("water_level", 0.0) == 0.0, \
            "Elevated node should not be inundated by cyclone surge"


# ---------------------------------------------------------------------------
# Earthquake terrain integration test
# ---------------------------------------------------------------------------

class TestEarthquakeTerrainIntegration:
    def test_vs30_uses_terrain_class(self):
        """Vs30 should come from vs30_terrain when available."""
        from backend.disaster.earthquake import EarthquakeModule
        eq = EarthquakeModule()
        # BASIN class → low Vs30
        data_basin = {"vs30_terrain": 150.0, "effective_elevation": 2.0}
        vs30 = eq.get_vs30(data_basin)
        assert vs30 == 150.0, f"Should use vs30_terrain value, got {vs30}"

    def test_vs30_low_elevation_correction(self):
        """Node at 2m effective_elevation should be capped to Class E (≤180)."""
        from backend.disaster.earthquake import EarthquakeModule
        eq = EarthquakeModule()
        data = {"vs30_terrain": 350.0, "effective_elevation": 2.0}  # slope class but very low
        vs30 = eq.get_vs30(data)
        assert vs30 <= 180.0, f"Low elevation should trigger Class E cap, got {vs30}"

    def test_vs30_geological_takes_priority(self):
        """Official geological Vs30 should beat terrain estimate."""
        from backend.disaster.earthquake import EarthquakeModule
        eq = EarthquakeModule()
        data = {"vs30_geological": 760.0, "vs30_terrain": 150.0}
        vs30 = eq.get_vs30(data)
        assert vs30 == 760.0, f"vs30_geological should take priority, got {vs30}"
