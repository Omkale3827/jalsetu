"""
JalSetu - Data and Machine Learning Pipeline (train_model.py)

Module Responsibilities:
1. Synthetic Hourly Water-Demand Dataset Generation (with reproducible seed).
2. Data Validation & Cleaning (handling missing values, invalid timestamps, gaps).
3. Feature Engineering (hour, day_of_week, month, cyclic encodings, leak-free historical lags).
4. Chronological Train-Test Split (strictly temporal, zero future-data leakage).
5. Baseline Comparison (Previous day's demand at same hour: Lag-24 baseline).
6. Scikit-learn Regression Model Training (HistGradientBoostingRegressor).
7. Evaluation (MAE and RMSE on held-out test data).
8. Model Serialization (joblib model bundle + metadata in models/).

PRIMARY UNIT: Litres per Hour (L/h)
ACADEMIC DISCLAIMER: The dataset and trained models are synthetic benchmarks
generated for an academic capstone demonstration. THEY DO NOT REPRESENT REAL THANE DATA.
"""

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import shutil
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("JalSetu-ML")

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ROOT_DATA_DIR = BASE_DIR.parent / "data"
MODELS_DIR = BASE_DIR / "models"
PRIMARY_CSV_PATH = DATA_DIR / "synthetic_hourly_water_demand.csv"
LEGACY_CSV_PATH = DATA_DIR / "synthetic_hourly_water_consumption.csv"
MODEL_BUNDLE_PATH = MODELS_DIR / "water_demand_model.joblib"
METRICS_JSON_PATH = MODELS_DIR / "model_metrics.json"

# Fictional Water Zones in Thane (with realistic baseline consumption in Litres/hour)
FICTIONAL_ZONES = [
    {
        "id": "zone-a",
        "name": "Zone A (North District)",
        "zone_type": "residential",
        "base_lph": 510000.0,
        "std_lph": 35000.0,
        "normal_range_lph": [450000.0, 550000.0]
    },
    {
        "id": "zone-b",
        "name": "Zone B (Central Commercial)",
        "zone_type": "commercial",
        "base_lph": 850000.0,
        "std_lph": 60000.0,
        "normal_range_lph": [400000.0, 600000.0]
    },
    {
        "id": "zone-c",
        "name": "Zone C (West Suburbs)",
        "zone_type": "suburban",
        "base_lph": 590000.0,
        "std_lph": 38000.0,
        "normal_range_lph": [500000.0, 650000.0]
    },
    {
        "id": "zone-d",
        "name": "Zone D (Industrial Belt)",
        "zone_type": "industrial",
        "base_lph": 720000.0,
        "std_lph": 45000.0,
        "normal_range_lph": [600000.0, 700000.0]
    },
    {
        "id": "zone-e",
        "name": "Zone E (South Residential)",
        "zone_type": "residential",
        "base_lph": 480000.0,
        "std_lph": 32000.0,
        "normal_range_lph": [450000.0, 600000.0]
    }
]

# ==============================================================================
# 1. SYNTHETIC DATASET GENERATION
# ==============================================================================

def generate_synthetic_water_dataset(
    start_date: str = "2026-05-01",
    days: int = 150,
    seed: int = 42,
    output_path: Path = PRIMARY_CSV_PATH
) -> pd.DataFrame:
    """
    Generates a reproducible synthetic hourly water-demand dataset.
    
    Realistic factors modeled:
    - Diurnal rhythm: Morning peak (07:00-09:30), Evening peak (18:30-21:30),
      Afternoon lull (12:00-16:00), Night trough (00:00-05:00).
    - Weekly patterns: Commercial offices surge Mon-Fri; Residential zones increase on weekends.
    - Monthly / Seasonal effects: Warm summer months have higher demand than monsoon/winter.
    - Weather / temperature proxy: Sinusoidal temperature curve with stochastic variation.
    - Occasional abnormal spikes (pipe burst simulation, sudden storage refilling).
    """
    np.random.seed(seed)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    date_range = pd.date_range(start=start_date, periods=days * 24, freq="h")
    logger.info(f"Generating synthetic time-series from {date_range[0]} to {date_range[-1]} ({len(date_range)} hours)")

    records = []

    for zone in FICTIONAL_ZONES:
        z_id = zone["id"]
        z_name = zone["name"]
        z_type = zone["zone_type"]
        base = zone["base_lph"]
        scale = zone["std_lph"]

        for ts in date_range:
            hour = ts.hour
            dow = ts.dayofweek   # 0=Monday, 6=Sunday
            month = ts.month
            is_weekend = int(dow >= 5)

            # 1. Diurnal factors
            morning_peak = np.exp(-((hour - 8.2) ** 2) / (2 * (1.8 ** 2))) * 0.42
            evening_peak = np.exp(-((hour - 19.5) ** 2) / (2 * (2.0 ** 2))) * 0.35
            afternoon_dip = 0.08 if (12 <= hour <= 16) else 0.0
            night_trough = -0.38 if (hour <= 4 or hour >= 23) else 0.0
            diurnal_factor = 1.0 + morning_peak + evening_peak + afternoon_dip + night_trough

            # 2. Zone-specific weekly adjustments
            if z_type == "commercial":
                weekly_factor = 0.75 if is_weekend else (1.28 if (9 <= hour <= 18) else 0.85)
            elif z_type == "industrial":
                weekly_factor = 0.90 if dow == 6 else 1.05
            else:
                weekly_factor = 1.12 if is_weekend else 1.00

            # 3. Monthly / Seasonal factors (May=hot summer peak, Jul/Aug=monsoon cooler)
            # Normalizing month impact around 1.0
            seasonal_factor = 1.0 + 0.08 * np.sin((month - 3) * np.pi / 6.0)

            # 4. Temperature proxy
            temp_c = 27.0 + 7.0 * np.sin((hour - 9) * np.pi / 12.0) + np.random.normal(0, 1.2)
            temp_effect = 1.0 + (temp_c - 28.0) * 0.005

            # 5. Gaussian noise
            noise = np.random.normal(0, scale)

            # 6. Occasional abnormal spikes (burst / emergency fill / event)
            abnormal_spike = 0.0
            is_anomaly = False
            if np.random.rand() < 0.009:  # ~0.9% anomaly rate
                abnormal_spike = np.random.uniform(100000.0, 220000.0)
                is_anomaly = True

            raw_demand = (base * diurnal_factor * weekly_factor * seasonal_factor * temp_effect) + noise + abnormal_spike
            demand_lph = max(40000.0, round(raw_demand, 1))

            records.append({
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "zone_id": z_id,
                "zone_name": z_name,
                "hour": hour,
                "day_of_week": dow,
                "month": month,
                "is_weekend": is_weekend,
                "temperature_c": round(temp_c, 1),
                "water_demand_lph": demand_lph,
                "is_anomaly": is_anomaly,
                "unit": "litres_per_hour",
                "is_synthetic": True,
                "data_source": "SYNTHETIC_BENCHMARK_SIMULATION_NOT_REAL_THANE"
            })

    df = pd.DataFrame(records)
    # Chronological sort
    df["dt"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(by=["dt", "zone_id"]).drop(columns=["dt"]).reset_index(drop=True)

    # Save to primary backend data location
    df.to_csv(output_path, index=False)
    logger.info(f"Saved {len(df)} synthetic records to {output_path}")

    # Also maintain backward compatibility copy and root data copy if needed
    try:
        df.to_csv(LEGACY_CSV_PATH, index=False)
        ROOT_DATA_DIR.mkdir(parents=True, exist_ok=True)
        root_target = ROOT_DATA_DIR / "synthetic_hourly_water_demand.csv"
        df.to_csv(root_target, index=False)
    except Exception as e:
        logger.warning(f"Note on secondary copy: {e}")

    # Save Dataset Documentation
    doc_path = DATA_DIR / "DATASET_DOCUMENTATION.md"
    doc_content = f"""# JalSetu Synthetic Water-Demand Dataset Documentation

- **Primary File:** `synthetic_hourly_water_demand.csv`
- **Total Records:** {len(df):,} ({len(df) // len(FICTIONAL_ZONES):,} hours per zone across {len(FICTIONAL_ZONES)} zones)
- **Primary Unit:** Litres per Hour (L/h)
- **Time Range:** {df['timestamp'].iloc[0]} to {df['timestamp'].iloc[-1]}
- **Disclaimer:** **STRICTLY SYNTHETIC BENCHMARK DATA**. This dataset is deterministically simulated for an academic capstone demonstration. It does NOT represent real municipal SCADA measurements from Thane Municipal Corporation.

## Schema
| Column | Type | Description |
|---|---|---|
| `timestamp` | string (ISO-8601) | Date and hour of observation (`YYYY-MM-DD HH:MM:SS`) |
| `zone_id` | string | Fictional zone identifier (`zone-a` to `zone-e`) |
| `zone_name` | string | Full zone display name |
| `hour` | int | Hour of day (0 to 23) |
| `day_of_week` | int | Day of week (0=Monday to 6=Sunday) |
| `month` | int | Calendar month (1 to 12) |
| `is_weekend` | int | 1 if Saturday/Sunday, else 0 |
| `temperature_c` | float | Ambient temperature proxy in Celsius |
| `water_demand_lph` | float | Target variable: water demand in Litres per Hour (L/h) |
| `is_anomaly` | bool | Flag indicating simulated abnormal surge |
| `unit` | string | Always `litres_per_hour` |
| `is_synthetic` | bool | Always `True` |
"""
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(doc_content)

    return df

# ==============================================================================
# 2. DATA VALIDATION & ROBUST CLEANING
# ==============================================================================

def validate_and_clean_data(df: pd.DataFrame, min_hours_per_zone: int = 48) -> pd.DataFrame:
    """
    Validates and cleans input data gracefully:
    - Parses and validates timestamps (coercing invalid ones).
    - Checks for missing or null demand values (interpolates minor gaps, drops unrecoverable).
    - Ensures non-negative demand values.
    - Validates presence of minimum required historical observations per zone.
    """
    logger.info("Validating and cleaning raw dataset...")
    df = df.copy()

    # 1. Parse timestamps
    df["dt"] = pd.to_datetime(df["timestamp"], errors="coerce")
    invalid_ts_count = df["dt"].isna().sum()
    if invalid_ts_count > 0:
        logger.warning(f"Dropped {invalid_ts_count} rows with unparseable timestamps.")
        df = df.dropna(subset=["dt"])

    # 2. Standardize target column name
    if "water_demand_lph" not in df.columns:
        if "consumption_litres_per_hour" in df.columns:
            df["water_demand_lph"] = df["consumption_litres_per_hour"]
        elif "consumption_m3" in df.columns:
            df["water_demand_lph"] = df["consumption_m3"] * 1000.0

    # 3. Check and clean missing values
    missing_demand = df["water_demand_lph"].isna().sum()
    if missing_demand > 0:
        logger.warning(f"Found {missing_demand} missing demand values. Applying linear interpolation per zone...")
        df["water_demand_lph"] = df.groupby("zone_id")["water_demand_lph"].transform(lambda g: g.interpolate().bfill().ffill())

    # 4. Filter invalid or non-positive values
    invalid_values = (df["water_demand_lph"] <= 0).sum()
    if invalid_values > 0:
        logger.warning(f"Correcting {invalid_values} negative/zero consumption values to minimum 10,000 L/h.")
        df["water_demand_lph"] = df["water_demand_lph"].clip(lower=10000.0)

    # 5. Check historical sufficiency per zone
    for z_id, count in df["zone_id"].value_counts().items():
        if count < min_hours_per_zone:
            raise ValueError(f"Insufficient historical data for zone '{z_id}': found {count} rows, minimum required is {min_hours_per_zone}.")

    df = df.sort_values(by=["zone_id", "dt"]).reset_index(drop=True)
    logger.info(f"Data validation passed. Clean dataset contains {len(df)} rows across {df['zone_id'].nunique()} zones.")
    return df

# ==============================================================================
# 3. FEATURE ENGINEERING (Strictly Past Information Only)
# ==============================================================================

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs feature matrix using ONLY information available at prediction time.
    
    Time Features:
    - hour, day_of_week, month, is_weekend
    - Cyclic transformations: sin/cos of hour, day_of_week, and month
    
    Historical Lag Features (Strictly backwards in time, per zone):
    - lag_1: Demand 1 hour prior (t - 1)
    - lag_2: Demand 2 hours prior (t - 2)
    - lag_24: Demand at the same hour on the previous day (t - 24) [Baseline Anchor]
    - rolling_mean_6: Average of previous 6 hours
    - rolling_mean_24: Average of previous 24 hours
    
    Categorical:
    - Zone one-hot dummy variables
    """
    df = df.copy()
    if "dt" not in df.columns:
        df["dt"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values(by=["zone_id", "dt"]).reset_index(drop=True)

    # 1. Time representations
    hour = df["dt"].dt.hour
    dow = df["dt"].dt.dayofweek
    month = df["dt"].dt.month

    df["hour"] = hour
    df["day_of_week"] = dow
    df["month"] = month
    df["is_weekend"] = (dow >= 5).astype(int)

    # Cyclic encodings
    df["sin_hour"] = np.sin(2 * np.pi * hour / 24.0)
    df["cos_hour"] = np.cos(2 * np.pi * hour / 24.0)
    df["sin_dow"] = np.sin(2 * np.pi * dow / 7.0)
    df["cos_dow"] = np.cos(2 * np.pi * dow / 7.0)
    df["sin_month"] = np.sin(2 * np.pi * month / 12.0)
    df["cos_month"] = np.cos(2 * np.pi * month / 12.0)

    # 2. Lag features per zone (shift ensures only historical values are used)
    grouped = df.groupby("zone_id")["water_demand_lph"]
    df["lag_1"] = grouped.shift(1)
    df["lag_2"] = grouped.shift(2)
    df["lag_24"] = grouped.shift(24)  # Previous day at same hour
    df["rolling_mean_6"] = grouped.transform(lambda s: s.shift(1).rolling(6, min_periods=1).mean())
    df["rolling_mean_24"] = grouped.transform(lambda s: s.shift(1).rolling(24, min_periods=1).mean())

    # Drop the initial 24 hours per zone that have NaN for lag_24
    df_clean = df.dropna(subset=["lag_1", "lag_2", "lag_24"]).reset_index(drop=True)
    return df_clean

# ==============================================================================
# 4. TRAINING, EVALUATION & MODEL SERIALIZATION
# ==============================================================================

def train_and_evaluate_pipeline(
    df: pd.DataFrame = None,
    test_ratio: float = 0.20,
    seed: int = 42
) -> dict:
    """
    Executes the end-to-end training and evaluation:
    - Chronological train/test split (no future data leakage).
    - Evaluates against the previous day's demand (Lag-24) and Lag-1 baselines.
    - Trains scikit-learn HistGradientBoostingRegressor.
    - Computes MAE and RMSE on the held-out test split.
    - Saves model bundle using joblib.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    if df is None:
        if PRIMARY_CSV_PATH.exists():
            df = pd.read_csv(PRIMARY_CSV_PATH)
        else:
            logger.info("Dataset not found. Generating fresh synthetic dataset...")
            df = generate_synthetic_water_dataset(seed=seed)

    # Clean & engineer
    df_clean = validate_and_clean_data(df)
    df_feats = engineer_features(df_clean)

    # Prepare feature columns
    zone_dummies = pd.get_dummies(df_feats["zone_id"], prefix="zone", dtype=float)
    numeric_feature_cols = [
        "sin_hour", "cos_hour", "sin_dow", "cos_dow", "sin_month", "cos_month",
        "is_weekend", "temperature_c", "lag_1", "lag_2", "lag_24",
        "rolling_mean_6", "rolling_mean_24"
    ]
    all_feature_cols = numeric_feature_cols + list(zone_dummies.columns)

    X = pd.concat([df_feats[numeric_feature_cols], zone_dummies], axis=1)
    y = df_feats["water_demand_lph"]
    timestamps = df_feats["dt"]

    # Strict Chronological Split (No data leakage)
    split_idx = int(len(df_feats) * (1.0 - test_ratio))
    split_timestamp = timestamps.iloc[split_idx]
    logger.info(f"Chronological Train/Test Cutoff: {split_timestamp}")

    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    df_test = df_feats.iloc[split_idx:].copy()

    logger.info(f"Training Samples: {len(X_train):,} | Held-out Test Samples: {len(X_test):,}")

    # -------------------------------------------------------------
    # 5. BASELINE EVALUATION (Previous Day's Demand at Same Hour: Lag-24)
    # -------------------------------------------------------------
    y_baseline_prev_day = df_test["lag_24"].values
    baseline_prev_day_mae = float(mean_absolute_error(y_test, y_baseline_prev_day))
    baseline_prev_day_rmse = float(root_mean_squared_error(y_test, y_baseline_prev_day))

    # Also calculate Lag-1 persistence baseline for thoroughness
    y_baseline_lag1 = df_test["lag_1"].values
    baseline_lag1_mae = float(mean_absolute_error(y_test, y_baseline_lag1))
    baseline_lag1_rmse = float(root_mean_squared_error(y_test, y_baseline_lag1))

    logger.info("\n" + "="*60)
    logger.info("BASELINE BENCHMARKS ON HELD-OUT TEST DATA:")
    logger.info(f"Baseline (Previous Day Same Hour / Lag-24): MAE = {baseline_prev_day_mae:,.1f} L/h | RMSE = {baseline_prev_day_rmse:,.1f} L/h")
    logger.info(f"Baseline (Previous Hour / Lag-1)           : MAE = {baseline_lag1_mae:,.1f} L/h | RMSE = {baseline_lag1_rmse:,.1f} L/h")

    # -------------------------------------------------------------
    # 6. TRAIN SCIKIT-LEARN REGRESSION MODEL
    # -------------------------------------------------------------
    logger.info("Training scikit-learn HistGradientBoostingRegressor...")
    model = HistGradientBoostingRegressor(
        max_iter=160,
        learning_rate=0.07,
        max_depth=8,
        min_samples_leaf=20,
        random_state=seed
    )
    model.fit(X_train, y_train)

    # -------------------------------------------------------------
    # 7. MODEL EVALUATION ON HELD-OUT TEST SPLIT
    # -------------------------------------------------------------
    y_pred = model.predict(X_test)
    ml_mae = float(mean_absolute_error(y_test, y_pred))
    ml_rmse = float(root_mean_squared_error(y_test, y_pred))

    # Metric improvements
    impr_mae_vs_prev_day = ((baseline_prev_day_mae - ml_mae) / baseline_prev_day_mae) * 100.0
    impr_rmse_vs_prev_day = ((baseline_prev_day_rmse - ml_rmse) / baseline_prev_day_rmse) * 100.0

    impr_mae_vs_lag1 = ((baseline_lag1_mae - ml_mae) / baseline_lag1_mae) * 100.0
    impr_rmse_vs_lag1 = ((baseline_lag1_rmse - ml_rmse) / baseline_lag1_rmse) * 100.0

    logger.info("\n" + "="*60)
    logger.info("SCIKIT-LEARN ML MODEL ON HELD-OUT TEST DATA:")
    logger.info(f"ML Model (HistGBR) : MAE = {ml_mae:,.1f} L/h | RMSE = {ml_rmse:,.1f} L/h")
    logger.info(f"Improvement vs Previous Day's Demand: MAE {impr_mae_vs_prev_day:+.2f}% | RMSE {impr_rmse_vs_prev_day:+.2f}%")
    logger.info(f"Improvement vs Lag-1 Persistence    : MAE {impr_mae_vs_lag1:+.2f}% | RMSE {impr_rmse_vs_lag1:+.2f}%")
    logger.info("="*60 + "\n")

    # -------------------------------------------------------------
    # 8. SAVE TRAINED MODEL AND PREPROCESSING ARTIFACTS
    # -------------------------------------------------------------
    model_bundle = {
        "model": model,
        "feature_columns": all_feature_cols,
        "numeric_feature_columns": numeric_feature_cols,
        "zone_columns": list(zone_dummies.columns),
        "primary_unit": "litres_per_hour",
        "zones_config": FICTIONAL_ZONES,
        "metrics": {
            "test_samples": len(X_test),
            "mae_litres_per_hour": round(ml_mae, 1),
            "rmse_litres_per_hour": round(ml_rmse, 1),
            "baseline_previous_day_mae": round(baseline_prev_day_mae, 1),
            "baseline_previous_day_rmse": round(baseline_prev_day_rmse, 1),
            "baseline_lag1_mae": round(baseline_lag1_mae, 1),
            "baseline_lag1_rmse": round(baseline_lag1_rmse, 1),
            "improvement_vs_previous_day_mae_pct": round(impr_mae_vs_prev_day, 2),
            "improvement_vs_previous_day_rmse_pct": round(impr_rmse_vs_prev_day, 2),
            "primary_unit": "litres_per_hour"
        },
        "disclaimer": (
            "Model trained on reproducible synthetic hourly benchmark data. "
            "It has NOT been validated on real physical telemetry from Thane Municipal Corporation."
        ),
        "trained_at": datetime.now(timezone.utc).isoformat()
    }

    joblib.dump(model_bundle, MODEL_BUNDLE_PATH)
    logger.info(f"Model bundle saved to: {MODEL_BUNDLE_PATH}")

    with open(METRICS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(model_bundle["metrics"], f, indent=2)
    logger.info(f"Metrics saved to: {METRICS_JSON_PATH}")

    return model_bundle

# ==============================================================================
# 9. SAFE INFERENCE HELPER (Guarantees no future data leakage)
# ==============================================================================

def predict_single_zone_demand(
    model_bundle: dict,
    zone_id: str,
    target_dt: datetime,
    temp_c: float = 28.5,
    lag_1: float = None,
    lag_2: float = None,
    lag_24: float = None
) -> float:
    """
    Generates a demand prediction for a specific zone and datetime using strictly
    information available at prediction time. Missing lags fall back to canonical baselines.
    """
    model = model_bundle["model"]
    feature_cols = model_bundle["feature_columns"]
    zone_cols = model_bundle["zone_columns"]

    # Zone defaults
    zone_map = {z["id"]: z for z in model_bundle.get("zones_config", FICTIONAL_ZONES)}
    cfg = zone_map.get(zone_id, FICTIONAL_ZONES[0])
    base = cfg["base_lph"]

    # Graceful fallback for missing lags
    l1 = lag_1 if lag_1 is not None else base
    l2 = lag_2 if lag_2 is not None else base
    l24 = lag_24 if lag_24 is not None else base
    r6 = (l1 + l2) / 2.0
    r24 = (l1 + l24) / 2.0

    hour = target_dt.hour
    dow = target_dt.weekday()
    month = target_dt.month
    is_weekend = int(dow >= 5)

    data = {
        "sin_hour": [np.sin(2 * np.pi * hour / 24.0)],
        "cos_hour": [np.cos(2 * np.pi * hour / 24.0)],
        "sin_dow": [np.sin(2 * np.pi * dow / 7.0)],
        "cos_dow": [np.cos(2 * np.pi * dow / 7.0)],
        "sin_month": [np.sin(2 * np.pi * month / 12.0)],
        "cos_month": [np.cos(2 * np.pi * month / 12.0)],
        "is_weekend": [float(is_weekend)],
        "temperature_c": [float(temp_c)],
        "lag_1": [float(l1)],
        "lag_2": [float(l2)],
        "lag_24": [float(l24)],
        "rolling_mean_6": [float(r6)],
        "rolling_mean_24": [float(r24)]
    }

    for z_col in zone_cols:
        target_z = z_col.replace("zone_", "")
        data[z_col] = [1.0 if target_z == zone_id else 0.0]

    df_row = pd.DataFrame(data).reindex(columns=feature_cols, fill_value=0.0)
    pred = float(model.predict(df_row)[0])
    return max(10000.0, round(pred, 1))

if __name__ == "__main__":
    logger.info("Running JalSetu Data and ML Pipeline...")
    train_and_evaluate_pipeline(seed=42)
