from typing import Dict, Any

class ResourcePool:
    def __init__(self):
        # Base National Reserve Quantities
        self.total_assets = {
            "SCOUT_CAR": 150,
            "HELICOPTER": 25,
            "ZODIAC_BOAT": 200,
            "HIGH_WATER_TRUCK": 75,
            "STANDARD_CAR": 100,
            "PERSONNEL": 5000
        }
        
        # Currently deployed assets
        self.deployed_assets = {
            "SCOUT_CAR": 0,
            "HELICOPTER": 0,
            "ZODIAC_BOAT": 0,
            "HIGH_WATER_TRUCK": 0,
            "STANDARD_CAR": 0,
            "PERSONNEL": 0
        }

    def get_available(self, unit_type: str) -> int:
        return self.total_assets.get(unit_type, 0) - self.deployed_assets.get(unit_type, 0)

    def can_deploy(self, unit_type: str, count: int = 1) -> bool:
        return self.get_available(unit_type) >= count

    def deploy(self, unit_type: str, count: int = 1) -> bool:
        if self.can_deploy(unit_type, count):
            self.deployed_assets[unit_type] += count
            return True
        return False

    def recall(self, unit_type: str, count: int = 1) -> bool:
        if self.deployed_assets.get(unit_type, 0) >= count:
            self.deployed_assets[unit_type] -= count
            return True
        return False

    def reset(self):
        for k in self.deployed_assets:
            self.deployed_assets[k] = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total_assets,
            "deployed": self.deployed_assets,
            "available": {k: self.get_available(k) for k in self.total_assets}
        }
