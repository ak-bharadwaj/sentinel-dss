import os
import json
import sys

# Ensure backend can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.simulation.engine import simulation_engine
from backend.world_model.world_state import world_state
from backend.disaster.flood import FloodModule

def run_experiment(baseline_type: str, corruption_level: float, steps: int = 60) -> dict:
    """Runs a single simulation to completion and returns the final metrics."""
    # Initialize
    simulation_engine.setup_simulation(
        baseline_type=baseline_type, 
        corruption_level=corruption_level
    )
    
    # Generate Flood priors
    flood_module = FloodModule()
    flood_module.generate_prior(world_state.ground_truth)
    flood_module.generate_prior(world_state.belief)
    world_state.sync_to_db()
    
    # Run loop
    for _ in range(steps):
        simulation_engine.step()
        
        # Early termination check
        active_pop = sum(
            d.get('population', 0)
            for n, d in world_state.ground_truth.nodes(data=True)
            if d.get('node_type') == "POPULATION_ZONE"
        )
        onboard = sum(
            a.survivors_onboard 
            for a in simulation_engine.agents.values() 
            if a.agent_type == "RESCUE"
        )
        if active_pop == 0 and onboard == 0:
            break
            
    # Compile final metrics
    history = simulation_engine.history
    final_metrics = history[-1] if history else {
        "survivors_saved": 0,
        "coverage": 0.0,
        "map_confidence": 0.0
    }
    
    return {
        "baseline": baseline_type,
        "corruption": corruption_level,
        "survivors_saved": final_metrics["survivors_saved"],
        "initial_population": simulation_engine.initial_total_population,
        "saved_fraction": final_metrics["survivors_saved"] / simulation_engine.initial_total_population if simulation_engine.initial_total_population > 0 else 0.0,
        "steps_run": len(history),
        "final_coverage": final_metrics["coverage"],
        "final_map_confidence": final_metrics["map_confidence"]
    }

def main():
    print("Starting Sentinel Comparative Ablation Study...")
    
    baselines = ["BASELINE-A", "BASELINE-B", "AMIS-RU"]
    corruptions = [0.30, 0.60, 0.90]
    
    results = []
    
    for corruption in corruptions:
        for baseline in baselines:
            print(f"Running: {baseline} | Corruption: {int(corruption*100)}%...")
            res = run_experiment(baseline, corruption)
            results.append(res)
            print(f"  Result: Saved {res['survivors_saved']}/{res['initial_population']} in {res['steps_run']} steps.")
            
    # Save results
    output_dir = os.path.join(os.path.dirname(__file__), "results")
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "experiment_results.json")
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"\nExperiments completed successfully. Results saved to: {output_file}")

if __name__ == "__main__":
    main()
