import threading

# Global lock for simulation synchronization
simulation_lock = threading.RLock()

def get_simulation_lock():
    """Dependency that returns the simulation lock."""
    return simulation_lock
