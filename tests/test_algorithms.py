"""
Unit tests for Jalsetu core algorithms and invariants
Verifies math formulas for Shortage and Progressive Water-Filling Redistribution
"""
import math

def calculate_shortage(demand, supply):
    return max(0, demand - supply)

def classify_risk(demand, supply, t_high=0.20, t_med=0.05):
    shortage = calculate_shortage(demand, supply)
    if shortage <= 0 or demand <= 0:
        return "Low"
    pct = shortage / demand
    if pct >= t_high:
        return "High"
    if pct >= t_med:
        return "Medium"
    return "Low"

def redistribute_supply(zones, total_supply):
    total_demand = sum(z["predictedDemand"] for z in zones)
    if total_supply >= total_demand:
        return [{
            **z,
            "recommendedAllocation": z["predictedDemand"],
            "remainingShortage": 0
        } for z in zones]

    risk_factors = {"High": 0.50, "Medium": 0.20, "Low": 0.0}
    working = []
    for z in zones:
        risk = classify_risk(z["predictedDemand"], z["availableSupply"])
        w = z["predictedDemand"] * (1.0 + risk_factors.get(risk, 0.0))
        working.append({**z, "weight": w, "allocated": 0.0, "capped": False})

    remaining = float(total_supply)
    for _ in range(10):
        if remaining <= 1:
            break
        active = [z for z in working if not z["capped"]]
        if not active:
            break
        tot_w = sum(z["weight"] for z in active)
        if tot_w <= 0:
            break

        newly_capped = False
        avail = remaining
        for z in active:
            share = (z["weight"] / tot_w) * avail
            cand = z["allocated"] + share
            if cand >= z["predictedDemand"]:
                remaining -= (z["predictedDemand"] - z["allocated"])
                z["allocated"] = float(z["predictedDemand"])
                z["capped"] = True
                newly_capped = True
            else:
                z["allocated"] = cand
                remaining -= share
        if not newly_capped:
            break

    return [{
        **z,
        "recommendedAllocation": round(z["allocated"]),
        "remainingShortage": max(0, z["predictedDemand"] - round(z["allocated"]))
    } for z in working]

def test_shortage_formula():
    assert calculate_shortage(500, 600) == 0
    assert calculate_shortage(800, 500) == 300
    assert calculate_shortage(0, 100) == 0

def test_risk_classification():
    # 300 / 800 = 37.5% -> High
    assert classify_risk(800, 500) == "High"
    # 50 / 600 = 8.3% -> Medium
    assert classify_risk(600, 550) == "Medium"
    # 0 shortage -> Low
    assert classify_risk(500, 600) == "Low"

def test_redistribution_invariants():
    zones = [
        {"name": "Zone A", "predictedDemand": 520000, "availableSupply": 600000},
        {"name": "Zone B", "predictedDemand": 760000, "availableSupply": 500000},
        {"name": "Zone C", "predictedDemand": 430000, "availableSupply": 300000},
        {"name": "Zone D", "predictedDemand": 690000, "availableSupply": 550000},
        {"name": "Zone E", "predictedDemand": 580000, "availableSupply": 400000},
    ]
    total_supply = 1620000
    res = redistribute_supply(zones, total_supply)

    # Invariant 1: Sum(allocations) <= total_supply
    total_allocated = sum(z["recommendedAllocation"] for z in res)
    assert total_allocated <= total_supply + 5  # Allow minor rounding margin
    
    # Invariant 2: 0 <= allocation <= demand
    for z in res:
        assert 0 <= z["recommendedAllocation"] <= z["predictedDemand"]

if __name__ == "__main__":
    test_shortage_formula()
    test_risk_classification()
    test_redistribution_invariants()
    print("All Jalsetu algorithm and invariant tests passed successfully!")
