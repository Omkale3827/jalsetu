"""
Comprehensive automated test suite for JalSetu Flask ML backend.
Tests:
- GET  /api/health
- GET  /api/metrics
- GET  /api/history
- POST /api/predict (Normal prediction, edge cases, error validation)
- GET  /api/zones
- GET  /api/telemetry
"""

import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import app

class TestJalsetuMLBackend(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_health_endpoint(self):
        """GET /api/health returns 200 with model_loaded: True."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertTrue(data.get("model_loaded"))
        self.assertIn("zone-a", data.get("supported_zones"))
        print("\n[PASS] GET /api/health: Service is healthy and ML model is loaded.")

    def test_02_metrics_endpoint(self):
        """GET /api/metrics returns evaluation metrics and baseline comparisons."""
        res = self.client.get("/api/metrics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        metrics = data.get("metrics")
        self.assertIn("mae", metrics)
        self.assertIn("rmse", metrics)
        self.assertIn("baseline_lag1_mae", metrics)
        self.assertLess(metrics["mae"], metrics["baseline_lag1_mae"])
        print(f"\n[PASS] GET /api/metrics: Test MAE: {metrics['mae']} m3/h | Baseline MAE: {metrics['baseline_lag1_mae']} m3/h")

    def test_03_history_endpoint(self):
        """GET /api/history returns recent time series records."""
        res = self.client.get("/api/history?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(len(data.get("data")), 10)

        # Test zone filtering
        res_zone = self.client.get("/api/history?zone_id=zone-b&limit=5")
        self.assertEqual(res_zone.status_code, 200)
        records = res_zone.get_json().get("data")
        self.assertTrue(all(r["zone_id"] == "zone-b" for r in records))
        print(f"\n[PASS] GET /api/history: Fetched historical records with zone filtering.")

    def test_04_predict_valid_payload(self):
        """POST /api/predict returns genuine ML prediction for valid payload."""
        payload = {
            "zone_id": "zone-b",
            "hour": 14,
            "day_of_week": 2,
            "is_weekend": 0,
            "temperature_c": 31.5,
            "lag_1": 820.0,
            "lag_2": 800.0,
            "lag_24": 780.0
        }
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("zone_id"), "zone-b")
        self.assertGreater(data.get("predicted_consumption_m3"), 0)
        self.assertEqual(data.get("unit"), "m3/hour")
        self.assertIn("disclaimer", data)
        print(f"\n[PASS] POST /api/predict: Zone B Predicted Demand = {data.get('predicted_consumption_m3')} m3/h")

    def test_05_predict_invalid_zone(self):
        """POST /api/predict rejects unknown zone_id with 400 Bad Request."""
        payload = {"zone_id": "zone-xyz"}
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data.get("status"), "error")
        print("\n[PASS] POST /api/predict correctly rejected invalid zone_id.")

    def test_06_predict_invalid_hour(self):
        """POST /api/predict rejects out-of-range hour with 400."""
        payload = {"zone_id": "zone-a", "hour": 28}
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 400)
        print("\n[PASS] POST /api/predict correctly rejected out-of-range hour 28.")

    def test_07_predict_negative_lag(self):
        """POST /api/predict rejects negative lag consumption with 400."""
        payload = {"zone_id": "zone-a", "lag_1": -50.0}
        res = self.client.post("/api/predict", json=payload)
        self.assertEqual(res.status_code, 400)
        print("\n[PASS] POST /api/predict correctly rejected negative lag value.")

    def test_08_zones_and_telemetry_compatibility(self):
        """GET /api/zones and GET /api/telemetry return valid frontend-compatible data."""
        res_zones = self.client.get("/api/zones")
        self.assertEqual(res_zones.status_code, 200)
        zones_data = res_zones.get_json()
        self.assertEqual(len(zones_data), 5)

        res_telem = self.client.get("/api/telemetry")
        self.assertEqual(res_telem.status_code, 200)
        telem_data = res_telem.get_json()
        self.assertIn("series", telem_data)
        print("\n[PASS] GET /api/zones & /api/telemetry frontend compatibility verified.")

if __name__ == "__main__":
    unittest.main()
