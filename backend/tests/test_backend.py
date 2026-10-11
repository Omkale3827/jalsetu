"""
Comprehensive Pytest Test Suite for JalSetu Flask ML Backend.
Tests all 10 core requirements:
1. Water-demand prediction for next 24 hours
2. Historical water-consumption data
3. Water supply adjustment by user
4. Shortage calculation
5. Abnormal-consumption detection
6. Zone-wise risk analysis
7. Water redistribution recommendations
8. Model performance metrics
9. Health-check API
10. Frontend integration endpoints (overview, zones, telemetry)
"""

import sys
from pathlib import Path
import pytest

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_01_health_check(client):
    """Test 9. Health-check API."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert "zone-a" in data["supported_zones"]
    assert "Litres per Hour" in data["primary_unit"]

def test_02_model_metrics(client):
    """Test 8. Model performance metrics."""
    res = client.get("/api/metrics")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "metrics" in data
    assert "mae_litres_per_hour" in data["metrics"]
    assert "rmse_litres_per_hour" in data["metrics"]
    assert data["metrics"]["mae_litres_per_hour"] > 0

def test_03_historical_consumption(client):
    """Test 2. Historical water-consumption data."""
    res = client.get("/api/history?limit=20")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert len(data["data"]) == 20
    assert "consumption_litres_per_hour" in data["data"][0]

    # Test zone filter
    res_b = client.get("/api/history?zone_id=zone-b&limit=10")
    assert res_b.status_code == 200
    data_b = res_b.get_json()
    assert all(r["zone_id"] == "zone-b" for r in data_b["data"])

def test_04_single_hour_predict(client):
    """Test single hour ML demand prediction and input validation."""
    payload = {
        "zone_id": "zone-b",
        "hour": 14,
        "day_of_week": 2,
        "is_weekend": 0,
        "temperature_c": 31.0,
        "lag_1": 820000.0,
        "lag_2": 800000.0,
        "lag_24": 780000.0
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["zone_id"] == "zone-b"
    assert data["predicted_demand_lph"] > 0
    assert data["unit"] == "Litres per Hour (L/h)"

    # Validation: reject unknown zone
    bad_zone = client.post("/api/predict", json={"zone_id": "invalid-zone"})
    assert bad_zone.status_code == 400

    # Validation: reject negative lag
    bad_lag = client.post("/api/predict", json={"zone_id": "zone-a", "lag_1": -500})
    assert bad_lag.status_code == 400

def test_05_predict_24h_forecast(client):
    """Test 1. Water-demand prediction for the next 24 hours."""
    res = client.get("/api/predict/24h?zone_id=zone-a")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["forecast_horizon_hours"] == 24
    assert "zone-a" in data["forecasts"]
    hourly = data["forecasts"]["zone-a"]["hourly_forecast"]
    assert len(hourly) == 24
    assert data["forecasts"]["zone-a"]["total_24h_demand_litres"] > 0

def test_06_supply_adjustment(client):
    """Test 3. Water supply adjustment by the user."""
    # View initial supply
    res_get = client.get("/api/supply")
    assert res_get.status_code == 200
    initial_total = res_get.get_json()["total_municipal_supply_lph"]

    # Adjust total supply
    adjust_payload = {"total_supply_lph": 3000000.0}
    res_post = client.post("/api/supply", json=adjust_payload)
    assert res_post.status_code == 200
    data = res_post.get_json()
    assert data["total_municipal_supply_lph"] == 3000000.0

    # Reject negative supply
    bad_supply = client.post("/api/supply", json={"total_supply_lph": -100})
    assert bad_supply.status_code == 400

def test_07_shortage_calculation(client):
    """Test 4. Shortage calculation."""
    res = client.get("/api/shortage")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "summary" in data
    assert "total_shortage_lph" in data["summary"]
    for z in data["zones"]:
        # Verify invariant: shortage = max(0, demand - supply)
        expected_shortage = max(0.0, z["demand_lph"] - z["supply_lph"])
        assert abs(z["shortage_lph"] - round(expected_shortage, 1)) < 1.0

def test_08_abnormal_consumption(client):
    """Test 5. Abnormal-consumption detection."""
    res = client.get("/api/anomalies")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert len(data["zones"]) == 5
    for z in data["zones"]:
        assert "is_anomaly" in z
        assert "severity" in z
        assert "deviation_pct" in z

def test_09_zone_risk_analysis(client):
    """Test 6. Zone-wise risk analysis."""
    res = client.get("/api/risk")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert len(data["zones"]) == 5
    for z in data["zones"]:
        assert z["risk_level"] in ["High", "Medium", "Low"]
        assert "recommended_action" in z

def test_10_water_redistribution(client):
    """Test 7. Water redistribution recommendations."""
    res = client.get("/api/redistribution?supply=2500000")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert len(data["redistribution_plan"]) == 5
    total_allocated = sum(z["recommended_allocation_lph"] for z in data["redistribution_plan"])
    # Allocated supply should not exceed available supply
    assert total_allocated <= 2500000.0 + 10.0

def test_11_frontend_integration(client):
    """Test 10. Frontend integration endpoints."""
    # Overview / Zones
    res_zones = client.get("/api/zones")
    assert res_zones.status_code == 200
    zones = res_zones.get_json()
    assert len(zones) == 5

    # Telemetry for Chart.js
    res_telem = client.get("/api/telemetry")
    assert res_telem.status_code == 200
    telem = res_telem.get_json()
    assert "series" in telem
    assert "profiles" in telem["series"]
