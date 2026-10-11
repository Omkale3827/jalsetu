"""
Live End-to-End Endpoint Verification Script for JalSetu Flask ML Server.
Tests:
- GET  /api/health
- GET  /api/metrics
- GET  /api/history (valid and invalid)
- POST /api/predict (valid, invalid inputs, and dynamic sensitivity verification)
"""

import json
import threading
import time
import urllib.request
import urllib.error
from app import app, model, MODEL_PATH

def run_verification():
    # 1. Verify model is loaded and joblib file exists
    assert MODEL_PATH.exists(), f"Model file {MODEL_PATH} does not exist!"
    assert model is not None, "Model object is None in memory!"
    print(f"[OK] Model verified loaded in memory from: {MODEL_PATH}")

    # Start Flask on local test port
    PORT = 5002
    server_thread = threading.Thread(target=lambda: app.run(port=PORT, debug=False, use_reloader=False), daemon=True)
    server_thread.start()
    time.sleep(1.2)
    BASE_URL = f"http://127.0.0.1:{PORT}"

    def http_get(endpoint):
        req = urllib.request.Request(f"{BASE_URL}{endpoint}")
        with urllib.request.urlopen(req) as resp:
            return resp.getcode(), json.loads(resp.read().decode())

    def http_post(endpoint, payload):
        req = urllib.request.Request(
            f"{BASE_URL}{endpoint}",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.getcode(), json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode())

    # --- TEST 1: GET /api/health ---
    code, data = http_get("/api/health")
    assert code == 200, f"Health check failed with {code}"
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    print(f"[PASS] GET /api/health -> Status: {data['status']}, Model Loaded: {data['model_loaded']}")

    # --- TEST 2: GET /api/metrics ---
    code, data = http_get("/api/metrics")
    assert code == 200, f"Metrics failed with {code}"
    assert "metrics" in data
    m = data["metrics"]
    print(f"[PASS] GET /api/metrics -> MAE: {m['mae_litres_per_hour']:,} L/h | RMSE: {m['rmse_litres_per_hour']:,} L/h | Prev Day Baseline MAE: {m['baseline_previous_day_mae']:,} L/h")

    # --- TEST 3: GET /api/history ---
    code, data = http_get("/api/history?limit=5")
    assert code == 200
    assert len(data["data"]) == 5
    print(f"[PASS] GET /api/history?limit=5 -> Retrieved {len(data['data'])} records.")

    # GET /api/history with invalid zone
    try:
        http_get("/api/history?zone_id=nonexistent")
    except urllib.error.HTTPError as e:
        assert e.code == 400
        print(f"[PASS] GET /api/history?zone_id=nonexistent -> Rejected with HTTP 400.")

    # --- TEST 4: POST /api/predict (Valid Inputs & Dynamic Output Check) ---
    # Prediction 1: Zone A at 8 AM (morning peak) with normal past lag
    p1_payload = {
        "zone_id": "zone-a",
        "hour": 8,
        "day_of_week": 1,
        "is_weekend": 0,
        "temperature_c": 29.0,
        "lag_1": 520000.0,
        "lag_2": 480000.0,
        "lag_24": 510000.0
    }
    code, data1 = http_post("/api/predict", p1_payload)
    assert code == 200
    pred1 = data1["predicted_demand_lph"]
    print(f"[PASS] POST /api/predict (Zone A, 8 AM Morning) -> {pred1:,.1f} L/h")

    # Prediction 2: Same Zone A at 3 AM (night trough) with low past lag
    p2_payload = {
        "zone_id": "zone-a",
        "hour": 3,
        "day_of_week": 1,
        "is_weekend": 0,
        "temperature_c": 24.0,
        "lag_1": 310000.0,
        "lag_2": 330000.0,
        "lag_24": 320000.0
    }
    code, data2 = http_post("/api/predict", p2_payload)
    assert code == 200
    pred2 = data2["predicted_demand_lph"]
    print(f"[PASS] POST /api/predict (Zone A, 3 AM Night)   -> {pred2:,.1f} L/h")

    # Prediction 3: Zone B (Commercial Belt) with heavy draw
    p3_payload = {
        "zone_id": "zone-b",
        "hour": 14,
        "day_of_week": 2,
        "is_weekend": 0,
        "temperature_c": 32.0,
        "lag_1": 890000.0,
        "lag_2": 850000.0,
        "lag_24": 840000.0
    }
    code, data3 = http_post("/api/predict", p3_payload)
    assert code == 200
    pred3 = data3["predicted_demand_lph"]
    print(f"[PASS] POST /api/predict (Zone B, 2 PM Commercial) -> {pred3:,.1f} L/h")

    # CONFIRM MODEL GENERATES DYNAMIC PREDICTIONS (Not hardcoded!)
    assert pred1 != pred2, f"Predictions must be dynamic! {pred1} vs {pred2}"
    assert pred1 > pred2, f"Morning demand ({pred1}) should exceed night demand ({pred2})"
    assert pred3 > pred1, f"Commercial demand ({pred3}) should exceed residential demand ({pred1})"
    print(f"[PASS] Confirmed predictions are dynamic and respond correctly to inputs and diurnal curves.")

    # --- TEST 5: POST /api/predict (Invalid Inputs) ---
    # Case A: Invalid zone_id
    code, err_data = http_post("/api/predict", {"zone_id": "mars-zone"})
    assert code == 400
    print(f"[PASS] POST /api/predict (Invalid Zone 'mars-zone') -> Rejected with HTTP 400: {err_data['message']}")

    # Case B: Out of range hour
    code, err_data = http_post("/api/predict", {"zone_id": "zone-a", "hour": 25})
    assert code == 400
    print(f"[PASS] POST /api/predict (Hour 25 out of range)   -> Rejected with HTTP 400: {err_data['message']}")

    # Case C: Negative lag
    code, err_data = http_post("/api/predict", {"zone_id": "zone-a", "lag_1": -50000.0})
    assert code == 400
    print(f"[PASS] POST /api/predict (Negative lag)           -> Rejected with HTTP 400: {err_data['message']}")

    # Case D: Empty body
    code, err_data = http_post("/api/predict", {})
    assert code == 400
    print(f"[PASS] POST /api/predict (Empty payload)           -> Rejected with HTTP 400: {err_data['message']}")

    print("\n[ALL 5 ENDPOINT VERIFICATION TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    run_verification()
