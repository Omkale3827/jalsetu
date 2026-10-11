"""
JalSetu (Smart Water Redistribution System) - Flask REST API Backend

Primary Measurement Unit: Litres per Hour (L/h)
Location Context: Thane Municipal Corporation (Simulated Benchmark Demonstration)
Scientific Disclaimer: Machine learning models and historical series are synthetic
benchmarks generated for an academic capstone demonstration. Do NOT claim they represent
actual Thane field measurements without empirical sensor calibration.

Features & Endpoints:
1. Health Check               : GET  /api/health
2. Model Performance Metrics  : GET  /api/metrics
3. Historical Consumption     : GET  /api/history
4. Single-Hour Prediction     : POST /api/predict
5. 24-Hour Horizon Forecast   : GET / POST /api/predict/24h (or /api/forecast)
6. Supply Adjustment          : GET / POST /api/supply
7. Shortage Calculation       : GET / POST /api/shortage
8. Abnormal Consumption Check : GET /api/anomalies
9. Zone-wise Risk Analysis    : GET /api/risk
10. Water Redistribution Plan : GET / POST /api/redistribution
11. Frontend Overview & Telemetry: GET /api/overview, GET /api/zones, GET /api/telemetry
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "synthetic_hourly_water_demand.csv"
if not DATA_PATH.exists():
    DATA_PATH = BASE_DIR / "data" / "synthetic_hourly_water_consumption.csv"
MODEL_PATH = BASE_DIR / "models" / "water_demand_model.joblib"
METRICS_PATH = BASE_DIR / "models" / "model_metrics.json"

app = Flask(__name__)
# Enable CORS for all routes and frontends (e.g. Next.js on 3000, SPA on 8000)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Global in-memory state
model_bundle = None
model = None
feature_columns = []
zone_columns = []
model_metrics = {}

# User-adjustable total municipal supply in Litres per Hour (L/h)
# Default: 2,800,000 L/h across Thane
current_municipal_supply_lph = 2800000.0

# Canonical Thane Zone Profiles (in Litres per Hour)
ZONE_CONFIGS = {
    "zone-a": {
        "id": "zone-a",
        "name": "Zone A",
        "displayName": "Zone A (North District)",
        "coordinates": [19.2183, 72.9781],
        "zone_type": "residential",
        "base_lph": 510000.0,
        "normal_range_lph": [450000, 550000],
        "default_supply_lph": 550000.0,
        "capacity_lph": 700000.0
    },
    "zone-b": {
        "id": "zone-b",
        "name": "Zone B",
        "displayName": "Zone B (Central Commercial)",
        "coordinates": [19.1995, 72.9644],
        "zone_type": "commercial",
        "base_lph": 850000.0,
        "normal_range_lph": [400000, 600000],
        "default_supply_lph": 600000.0,
        "capacity_lph": 900000.0
    },
    "zone-c": {
        "id": "zone-c",
        "name": "Zone C",
        "displayName": "Zone C (West Suburbs)",
        "coordinates": [19.1852, 72.9512],
        "zone_type": "suburban",
        "base_lph": 590000.0,
        "normal_range_lph": [500000, 650000],
        "default_supply_lph": 520000.0,
        "capacity_lph": 750000.0
    },
    "zone-d": {
        "id": "zone-d",
        "name": "Zone D",
        "displayName": "Zone D (Industrial Belt)",
        "coordinates": [19.2050, 72.9902],
        "zone_type": "industrial",
        "base_lph": 720000.0,
        "normal_range_lph": [600000, 700000],
        "default_supply_lph": 650000.0,
        "capacity_lph": 850000.0
    },
    "zone-e": {
        "id": "zone-e",
        "name": "Zone E",
        "displayName": "Zone E (South Residential)",
        "coordinates": [19.1724, 72.9730],
        "zone_type": "residential",
        "base_lph": 480000.0,
        "normal_range_lph": [450000, 600000],
        "default_supply_lph": 480000.0,
        "capacity_lph": 650000.0
    }
}

# Per-zone supply state (can be dynamically adjusted by user)
zone_supplies = {z_id: z["default_supply_lph"] for z_id, z in ZONE_CONFIGS.items()}

def load_ml_artifacts():
    """Loads the trained ML model and metrics from disk."""
    global model_bundle, model, feature_columns, zone_columns, model_metrics
    if MODEL_PATH.exists():
        try:
            model_bundle = joblib.load(MODEL_PATH)
            model = model_bundle.get("model")
            feature_columns = model_bundle.get("feature_columns", [])
            zone_columns = model_bundle.get("zone_columns", [])
            print(f"[JalSetu] Loaded ML model successfully from {MODEL_PATH}")
        except Exception as e:
            print(f"[JalSetu] Warning: Failed to load model: {e}")

    if METRICS_PATH.exists():
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                model_metrics = json.load(f)
        except Exception as e:
            print(f"[JalSetu] Warning: Failed to load metrics: {e}")

load_ml_artifacts()

def build_feature_dataframe(zone_id: str, hour: int, dow: int, month: int, is_weekend: int, temp_c: float,
                            lag_1: float, lag_2: float, lag_24: float,
                            rolling_6: float, rolling_24: float) -> pd.DataFrame:
    """Builds a single-row feature vector matching the scikit-learn model schema."""
    sin_hour = np.sin(2 * np.pi * hour / 24.0)
    cos_hour = np.cos(2 * np.pi * hour / 24.0)
    sin_dow = np.sin(2 * np.pi * dow / 7.0)
    cos_dow = np.cos(2 * np.pi * dow / 7.0)
    sin_month = np.sin(2 * np.pi * month / 12.0)
    cos_month = np.cos(2 * np.pi * month / 12.0)

    data = {
        "sin_hour": [sin_hour],
        "cos_hour": [cos_hour],
        "sin_dow": [sin_dow],
        "cos_dow": [cos_dow],
        "sin_month": [sin_month],
        "cos_month": [cos_month],
        "is_weekend": [float(is_weekend)],
        "temperature_c": [float(temp_c)],
        "lag_1": [float(lag_1)],
        "lag_2": [float(lag_2)],
        "lag_24": [float(lag_24)],
        "rolling_mean_6": [float(rolling_6)],
        "rolling_mean_24": [float(rolling_24)],
    }

    for z_col in zone_columns:
        target_z = z_col.replace("zone_", "")
        data[z_col] = [1.0 if target_z == zone_id else 0.0]

    df_row = pd.DataFrame(data)
    return df_row.reindex(columns=feature_columns, fill_value=0.0)

def predict_single_demand(zone_id: str, hour: int, dow: int, is_weekend: int,
                          temp_c: float = 28.5, lag_1: float = None,
                          lag_2: float = None, lag_24: float = None,
                          month: int = None) -> float:
    """Invokes the genuine ML model to predict demand in Litres per Hour (L/h)."""
    base = ZONE_CONFIGS[zone_id]["base_lph"]
    l1 = lag_1 if lag_1 is not None else base
    l2 = lag_2 if lag_2 is not None else base
    l24 = lag_24 if lag_24 is not None else base
    r6 = (l1 + l2) / 2.0
    r24 = (l1 + l24) / 2.0
    m = month if month is not None else datetime.now().month

    if model is None:
        return float(base)

    row = build_feature_dataframe(zone_id, hour, dow, m, is_weekend, temp_c, l1, l2, l24, r6, r24)
    pred = float(model.predict(row)[0])
    return max(10000.0, round(pred, 1))

# ==============================================================================
# 1. HEALTH-CHECK API
# ==============================================================================
@app.route("/api/health", methods=["GET"])
def health_check():
    """Returns system status, active zones, loaded model info, and units."""
    return jsonify({
        "status": "healthy",
        "service": "JalSetu - Smart Water Redistribution System Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "primary_unit": "Litres per Hour (L/h)",
        "model_loaded": model is not None,
        "model_path": str(MODEL_PATH) if MODEL_PATH.exists() else None,
        "dataset_available": DATA_PATH.exists(),
        "supported_zones": list(ZONE_CONFIGS.keys()),
        "disclaimer": "Academic simulation. Synthetic benchmark data for Thane demonstration."
    }), 200

# ==============================================================================
# 2. MODEL PERFORMANCE METRICS
# ==============================================================================
@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    """Returns evaluation metrics comparing ML model with baseline."""
    if not model_metrics:
        return jsonify({
            "status": "error",
            "message": "Metrics not available. Run train_model.py first."
        }), 503

    return jsonify({
        "status": "success",
        "model_algorithm": "HistGradientBoostingRegressor (scikit-learn)",
        "validation_strategy": "Chronological Split (80% Train, 20% Held-out Test)",
        "unit": "Litres per Hour (L/h)",
        "metrics": model_metrics,
        "scientific_disclaimer": "Benchmarked on synthetic data. Not calibrated to real Thane sensors."
    }), 200

# ==============================================================================
# 3. HISTORICAL WATER-CONSUMPTION DATA
# ==============================================================================
@app.route("/api/history", methods=["GET"])
def get_history():
    """Returns historical hourly consumption data."""
    if not DATA_PATH.exists():
        return jsonify({"status": "error", "message": "Dataset not found. Run train_model.py."}), 404

    zone_id = request.args.get("zone_id")
    limit = request.args.get("limit", default=48, type=int)
    limit = max(1, min(limit, 500))

    try:
        df = pd.read_csv(DATA_PATH)
        if zone_id:
            zone_id_clean = zone_id.strip().lower()
            if zone_id_clean not in ZONE_CONFIGS:
                return jsonify({
                    "status": "error",
                    "message": f"Unknown zone_id '{zone_id}'. Valid: {list(ZONE_CONFIGS.keys())}"
                }), 400
            df = df[df["zone_id"] == zone_id_clean]
        records = df.tail(limit).to_dict(orient="records")
        for r in records:
            val = r.get("water_demand_lph") or r.get("consumption_litres_per_hour") or 0.0
            r["water_demand_lph"] = float(val)
            r["consumption_litres_per_hour"] = float(val)

        return jsonify({
            "status": "success",
            "count": len(records),
            "unit": "Litres per Hour (L/h)",
            "zone_filter": zone_id,
            "data": records
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==============================================================================
# 4. SINGLE-HOUR PREDICTION
# ==============================================================================
@app.route("/api/predict", methods=["POST"])
def predict_demand():
    """Predicts water demand for a single hour using trained scikit-learn model."""
    if model is None:
        return jsonify({"status": "error", "message": "Model not loaded. Run train_model.py."}), 503

    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return jsonify({"status": "error", "message": "Valid JSON body required."}), 400

    zone_id = str(payload.get("zone_id", "")).strip().lower()
    if zone_id not in ZONE_CONFIGS:
        return jsonify({
            "status": "error",
            "message": f"Field 'zone_id' is required and must be one of {list(ZONE_CONFIGS.keys())}."
        }), 400

    now = datetime.now()
    hour = int(payload.get("hour", now.hour))
    dow = int(payload.get("day_of_week", now.weekday()))
    month = int(payload.get("month", now.month))
    is_weekend = int(payload.get("is_weekend", 1 if dow >= 5 else 0))
    temp_c = float(payload.get("temperature_c", 28.5))

    if not (0 <= hour <= 23):
        return jsonify({"status": "error", "message": "Hour must be between 0 and 23."}), 400
    if not (0 <= dow <= 6):
        return jsonify({"status": "error", "message": "day_of_week must be between 0 and 6."}), 400
    if not (1 <= month <= 12):
        return jsonify({"status": "error", "message": "month must be between 1 and 12."}), 400

    cfg = ZONE_CONFIGS[zone_id]
    base = cfg["base_lph"]
    lag_1 = float(payload.get("lag_1", base))
    lag_2 = float(payload.get("lag_2", base))
    lag_24 = float(payload.get("lag_24", base))

    if min(lag_1, lag_2, lag_24) < 0:
        return jsonify({"status": "error", "message": "Lags cannot be negative."}), 400

    predicted_lph = predict_single_demand(zone_id, hour, dow, is_weekend, temp_c, lag_1, lag_2, lag_24, month=month)
    normal_min, normal_max = cfg["normal_range_lph"]
    is_anomaly = predicted_lph < normal_min or predicted_lph > normal_max
    dev_pct = round(((predicted_lph - base) / base) * 100.0, 1)

    return jsonify({
        "status": "success",
        "zone_id": zone_id,
        "zone_name": cfg["displayName"],
        "hour": hour,
        "predicted_demand_lph": predicted_lph,
        "unit": "Litres per Hour (L/h)",
        "normal_range_lph": cfg["normal_range_lph"],
        "deviation_pct": dev_pct,
        "anomaly_flag": is_anomaly,
        "disclaimer": "Prediction derived from scikit-learn model trained on synthetic data."
    }), 200

# ==============================================================================
# 5. WATER-DEMAND PREDICTION FOR THE NEXT 24 HOURS
# ==============================================================================
@app.route("/api/predict/24h", methods=["GET", "POST"])
@app.route("/api/forecast", methods=["GET", "POST"])
def predict_24h_forecast():
    """Generates sequential 24-hour ahead demand forecasts per zone."""
    now = datetime.now()
    target_zone = request.args.get("zone_id")

    payload = request.get_json(silent=True) if request.is_json else {}
    if payload and "zone_id" in payload:
        target_zone = payload["zone_id"]

    zones_to_run = [target_zone.lower()] if target_zone and target_zone.lower() in ZONE_CONFIGS else list(ZONE_CONFIGS.keys())

    forecast_results = {}
    current_hour = now.hour
    current_dow = now.weekday()

    for z_id in zones_to_run:
        cfg = ZONE_CONFIGS[z_id]
        base = cfg["base_lph"]
        curr_lag = base
        zone_hourly = []

        for step in range(1, 25):
            future_hour = (current_hour + step) % 24
            future_dow = (current_dow + (current_hour + step) // 24) % 7
            is_wknd = 1 if future_dow >= 5 else 0

            pred = predict_single_demand(z_id, future_hour, future_dow, is_wknd, 28.0, curr_lag, base, base)
            zone_hourly.append({
                "step_hour": step,
                "hour_of_day": future_hour,
                "predicted_demand_lph": pred,
                "unit": "Litres per Hour (L/h)"
            })
            curr_lag = pred

        total_24h_litres = sum(h["predicted_demand_lph"] for h in zone_hourly)
        avg_hourly_lph = round(total_24h_litres / 24.0, 1)

        forecast_results[z_id] = {
            "zone_id": z_id,
            "zone_name": cfg["displayName"],
            "hourly_forecast": zone_hourly,
            "total_24h_demand_litres": round(total_24h_litres, 1),
            "average_demand_lph": avg_hourly_lph
        }

    return jsonify({
        "status": "success",
        "forecast_horizon_hours": 24,
        "primary_unit": "Litres per Hour (L/h)",
        "start_timestamp": now.strftime("%Y-%m-%d %H:00:00"),
        "forecasts": forecast_results
    }), 200

# ==============================================================================
# 6. WATER SUPPLY ADJUSTMENT BY THE USER
# ==============================================================================
@app.route("/api/supply", methods=["GET", "POST"])
def handle_supply_adjustment():
    """Allows user to view or dynamically adjust available water supply in L/h."""
    global current_municipal_supply_lph, zone_supplies

    if request.method == "POST":
        payload = request.get_json(silent=True)
        if not payload or not isinstance(payload, dict):
            return jsonify({"status": "error", "message": "JSON body required."}), 400

        # Adjust total supply
        if "total_supply_lph" in payload:
            try:
                new_total = float(payload["total_supply_lph"])
                if new_total < 0:
                    return jsonify({"status": "error", "message": "Supply cannot be negative."}), 400
                current_municipal_supply_lph = new_total
                # Distribute proportionally to zones
                base_sum = sum(z["base_lph"] for z in ZONE_CONFIGS.values())
                for z_id, z in ZONE_CONFIGS.items():
                    zone_supplies[z_id] = round((z["base_lph"] / base_sum) * new_total, 1)
            except ValueError:
                return jsonify({"status": "error", "message": "Invalid total_supply_lph."}), 400

        # Adjust specific zone supply
        if "zone_supplies" in payload and isinstance(payload["zone_supplies"], dict):
            for z_id, val in payload["zone_supplies"].items():
                if z_id in zone_supplies:
                    try:
                        zone_supplies[z_id] = max(0.0, float(val))
                    except ValueError:
                        pass
            current_municipal_supply_lph = sum(zone_supplies.values())

    return jsonify({
        "status": "success",
        "total_municipal_supply_lph": round(current_municipal_supply_lph, 1),
        "primary_unit": "Litres per Hour (L/h)",
        "zone_supplies": zone_supplies
    }), 200

# ==============================================================================
# 7. SHORTAGE CALCULATION
# ==============================================================================
@app.route("/api/shortage", methods=["GET", "POST"])
def calculate_shortage():
    """Calculates water shortage: Shortage = max(0, Demand - Supply) in L/h."""
    now = datetime.now()
    results = []
    total_demand = 0.0
    total_supply = 0.0
    total_shortage = 0.0

    for z_id, cfg in ZONE_CONFIGS.items():
        demand_lph = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))
        supply_lph = zone_supplies.get(z_id, cfg["default_supply_lph"])
        shortage_lph = max(0.0, demand_lph - supply_lph)

        total_demand += demand_lph
        total_supply += supply_lph
        total_shortage += shortage_lph

        deficit_pct = round((shortage_lph / demand_lph) * 100.0, 1) if demand_lph > 0 else 0.0

        results.append({
            "zone_id": z_id,
            "zone_name": cfg["displayName"],
            "demand_lph": demand_lph,
            "supply_lph": supply_lph,
            "shortage_lph": round(shortage_lph, 1),
            "deficit_pct": deficit_pct,
            "status": "Deficit" if shortage_lph > 0 else "Surplus"
        })

    return jsonify({
        "status": "success",
        "primary_unit": "Litres per Hour (L/h)",
        "summary": {
            "total_demand_lph": round(total_demand, 1),
            "total_supply_lph": round(total_supply, 1),
            "total_shortage_lph": round(total_shortage, 1),
            "overall_deficit_pct": round((total_shortage / total_demand) * 100.0, 1) if total_demand > 0 else 0.0
        },
        "zones": results
    }), 200

# ==============================================================================
# 8. ABNORMAL-CONSUMPTION DETECTION
# ==============================================================================
@app.route("/api/anomalies", methods=["GET"])
def detect_anomalies():
    """Detects abnormal consumption or sudden demand surges across zones."""
    now = datetime.now()
    anomalies = []

    for z_id, cfg in ZONE_CONFIGS.items():
        demand = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))
        norm_min, norm_max = cfg["normal_range_lph"]
        base = cfg["base_lph"]

        is_abnormal = demand < norm_min or demand > norm_max
        dev_pct = round(((demand - base) / base) * 100.0, 1)

        severity = "Normal"
        surge_type = "None"
        if demand > norm_max:
            if dev_pct > 25.0:
                severity = "High Alert"
                surge_type = "Sudden Demand Surge / Pipe Anomaly"
            else:
                severity = "Elevated"
                surge_type = "Above Normal Threshold"
        elif demand < norm_min:
            severity = "Low"
            surge_type = "Depressed Flow"

        anomalies.append({
            "zone_id": z_id,
            "zone_name": cfg["displayName"],
            "current_demand_lph": demand,
            "normal_range_lph": cfg["normal_range_lph"],
            "deviation_pct": dev_pct,
            "is_anomaly": is_abnormal,
            "severity": severity,
            "type": surge_type,
            "timestamp": now.strftime("%Y-%m-%d %H:%M")
        })

    return jsonify({
        "status": "success",
        "timestamp": now.isoformat(),
        "primary_unit": "Litres per Hour (L/h)",
        "zones": anomalies
    }), 200

# ==============================================================================
# 9. ZONE-WISE RISK ANALYSIS
# ==============================================================================
@app.route("/api/risk", methods=["GET"])
def analyze_risk():
    """Categorizes zone risk based on shortage severity: High >=20%, Medium >=5%, Low <5%."""
    now = datetime.now()
    risk_report = []

    for z_id, cfg in ZONE_CONFIGS.items():
        demand = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))
        supply = zone_supplies.get(z_id, cfg["default_supply_lph"])
        shortage = max(0.0, demand - supply)
        deficit_pct = (shortage / demand) if demand > 0 else 0.0

        if deficit_pct >= 0.20:
            risk_level = "High"
            action = "Immediate Redistribution Required"
        elif deficit_pct >= 0.05:
            risk_level = "Medium"
            action = "Monitor & Partial Rebalance"
        else:
            risk_level = "Low"
            action = "Normal Operations"

        risk_report.append({
            "zone_id": z_id,
            "zone_name": cfg["displayName"],
            "demand_lph": demand,
            "supply_lph": supply,
            "shortage_lph": round(shortage, 1),
            "deficit_pct": round(deficit_pct * 100.0, 1),
            "risk_level": risk_level,
            "recommended_action": action
        })

    return jsonify({
        "status": "success",
        "primary_unit": "Litres per Hour (L/h)",
        "zones": risk_report
    }), 200

# ==============================================================================
# 10. WATER REDISTRIBUTION RECOMMENDATIONS (Progressive Water-Filling)
# ==============================================================================
@app.route("/api/redistribution", methods=["GET", "POST"])
@app.route("/api/allocation", methods=["GET", "POST"])
def recommend_redistribution():
    """Calculates equitable redistribution recommendations using weighted progressive water-filling."""
    now = datetime.now()
    supply_override = request.args.get("supply", type=float)

    if request.is_json:
        payload = request.get_json(silent=True) or {}
        if "supply" in payload:
            supply_override = float(payload["supply"])

    avail_supply = supply_override if supply_override is not None else current_municipal_supply_lph

    # Gather demands
    demands = {}
    for z_id, cfg in ZONE_CONFIGS.items():
        demands[z_id] = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))

    total_demand = sum(demands.values())

    # Full fulfillment if surplus
    if avail_supply >= total_demand:
        allocations = {z_id: round(demands[z_id], 1) for z_id in demands}
    else:
        # Weighted proportional distribution based on risk weights
        # Commercial & Industrial priority weights
        weights = {
            "zone-a": 1.0,
            "zone-b": 1.4,  # High economic impact
            "zone-c": 1.0,
            "zone-d": 1.3,  # Industrial base
            "zone-e": 1.0
        }
        weighted_sum = sum(demands[z_id] * weights[z_id] for z_id in demands)
        allocations = {}
        for z_id in demands:
            share = (demands[z_id] * weights[z_id] / weighted_sum) * avail_supply
            allocations[z_id] = round(min(demands[z_id], share), 1)

    plan = []
    transfers = []
    surplus_zones = []
    deficit_zones = []

    for z_id, cfg in ZONE_CONFIGS.items():
        d = demands[z_id]
        cur_s = zone_supplies.get(z_id, cfg["default_supply_lph"])
        recom_s = allocations[z_id]
        net_transfer = round(recom_s - cur_s, 1)
        rem_shortage = max(0.0, round(d - recom_s, 1))

        if net_transfer > 500:
            deficit_zones.append({"zone_id": z_id, "amount": net_transfer})
        elif net_transfer < -500:
            surplus_zones.append({"zone_id": z_id, "amount": abs(net_transfer)})

        plan.append({
            "zone_id": z_id,
            "zone_name": cfg["displayName"],
            "current_supply_lph": cur_s,
            "predicted_demand_lph": d,
            "recommended_allocation_lph": recom_s,
            "net_transfer_lph": net_transfer,
            "remaining_shortage_lph": rem_shortage,
            "risk_after": "Low" if rem_shortage <= 0.05 * d else ("Medium" if rem_shortage <= 0.20 * d else "High")
        })

    # Route transfers from surplus zones to deficit zones
    for s in surplus_zones:
        for d in deficit_zones:
            if s["amount"] > 1000 and d["amount"] > 1000:
                xfer = min(s["amount"], d["amount"])
                transfers.append({
                    "from_zone": s["zone_id"],
                    "to_zone": d["zone_id"],
                    "transfer_volume_lph": round(xfer, 1),
                    "pipeline_route": f"Main Inter-Zone Feeder ({s['zone_id']} -> {d['zone_id']})"
                })
                s["amount"] -= xfer
                d["amount"] -= xfer

    return jsonify({
        "status": "success",
        "primary_unit": "Litres per Hour (L/h)",
        "available_supply_lph": avail_supply,
        "total_predicted_demand_lph": round(total_demand, 1),
        "redistribution_plan": plan,
        "transfer_routes": transfers
    }), 200

# ==============================================================================
# FRONTEND INTEGRATION: OVERVIEW, ZONES & TELEMETRY
# ==============================================================================
@app.route("/api/overview", methods=["GET"])
@app.route("/api/zones", methods=["GET"])
def get_zones_overview():
    """Serves the canonical zones overview table compatible with UI dashboards."""
    now = datetime.now()
    results = []

    for z_id, cfg in ZONE_CONFIGS.items():
        pred_demand = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))
        supply = zone_supplies.get(z_id, cfg["default_supply_lph"])
        norm_min, norm_max = cfg["normal_range_lph"]
        dev_pct = round(((pred_demand - cfg["base_lph"]) / cfg["base_lph"]) * 100.0, 1)
        shortage = max(0.0, pred_demand - supply)

        results.append({
            "id": z_id,
            "name": cfg["name"],
            "displayName": cfg["displayName"],
            "coordinates": cfg["coordinates"],
            "currentConsumption": pred_demand,
            "normalRange": cfg["normal_range_lph"],
            "predictedDemand": pred_demand,
            "availableSupply": supply,
            "capacity": cfg["capacity_lph"],
            "shortage": shortage,
            "trend": "Increase" if dev_pct > 3.0 else ("Decrease" if dev_pct < -3.0 else "Stable"),
            "anomaly": {
                "detected": pred_demand > norm_max,
                "severity": "High Alert" if pred_demand > norm_max and dev_pct > 25.0 else ("High" if pred_demand > norm_max else "Normal"),
                "type": "Sudden Demand Surge" if pred_demand > norm_max else "None",
                "deviationPct": dev_pct,
                "timestamp": now.strftime("%Y-%m-%d %H:%M")
            }
        })

    return jsonify(results), 200

@app.route("/api/telemetry", methods=["GET"])
def get_dashboard_telemetry():
    """Provides time-series telemetry profiles for frontend Chart.js components and live zones."""
    now = datetime.now()
    labels = ["12 AM", "2 AM", "4 AM", "6 AM", "8 AM", "10 AM", "12 PM",
              "2 PM", "4 PM", "6 PM", "8 PM", "10 PM", "12 AM"]
    profiles = {}

    for z_id, cfg in ZONE_CONFIGS.items():
        base = cfg["base_lph"]
        # Chart display values scaled in kL/h (thousands of litres) to fit Chart.js canvas
        base_kL = base / 1000.0
        hist = [round(base_kL * factor, 1) for factor in [0.70, 0.78, 0.90, 1.15, 1.35, 1.12, 1.00]]
        forecast = []
        curr = base
        for h in [14, 16, 18, 20, 22, 24]:
            p = predict_single_demand(z_id, h % 24, 3, 0, 28.0, curr, base, base)
            forecast.append(round(p / 1000.0, 1))
            curr = p

        profiles[z_id] = {
            "historical": hist,
            "forecast": forecast
        }

    # Live zone objects for frontend state
    live_zones = []
    for z_id, cfg in ZONE_CONFIGS.items():
        pred_demand = predict_single_demand(z_id, now.hour, now.weekday(), int(now.weekday() >= 5))
        supply = zone_supplies.get(z_id, cfg["default_supply_lph"])
        norm_min, norm_max = cfg["normal_range_lph"]
        dev_pct = round(((pred_demand - cfg["base_lph"]) / cfg["base_lph"]) * 100.0, 1)
        shortage = max(0.0, pred_demand - supply)

        live_zones.append({
            "id": z_id,
            "name": cfg["name"],
            "displayName": cfg["displayName"],
            "coordinates": cfg["coordinates"],
            "currentConsumption": round(pred_demand / 1000.0, 1),
            "normalRange": [round(norm_min / 1000.0, 1), round(norm_max / 1000.0, 1)],
            "predictedDemand": pred_demand,
            "availableSupply": supply,
            "capacity": cfg["capacity_lph"],
            "shortage": shortage,
            "trend": "Increase" if dev_pct > 3.0 else ("Decrease" if dev_pct < -3.0 else "Stable"),
            "anomaly": {
                "detected": pred_demand > norm_max,
                "severity": "High Alert" if pred_demand > norm_max and dev_pct > 25.0 else ("High" if pred_demand > norm_max else "Normal"),
                "type": "Sudden Demand Surge" if pred_demand > norm_max else "None",
                "deviationPct": dev_pct,
                "timestamp": now.strftime("%Y-%m-%d %H:%M")
            }
        })

    return jsonify({
        "status": "success",
        "primary_unit": "Litres per Hour (L/h)",
        "chart_unit": "kL/h (1,000 Litres/h)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "zones": live_zones,
        "series": {
            "labels": labels,
            "forecastStartIndex": 6,
            "profiles": profiles
        },
        "totalSupply": current_municipal_supply_lph,
        "disclaimer": "Simulated prototype ML results. Not real Thane sensor telemetry."
    }), 200

# Error Handlers
@app.errorhandler(404)
def handle_404(e):
    return jsonify({"status": "error", "message": "API endpoint not found."}), 404

@app.errorhandler(500)
def handle_500(e):
    return jsonify({"status": "error", "message": "Internal server error."}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"JalSetu Flask ML Server starting at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
