"""
Machine Learning Model Training Pipeline for JalSetu Water Demand Forecasting.

This script:
1. Loads the hourly water consumption dataset.
2. Derives temporal and lag-based consumption features.
3. Performs a strictly chronological train-test split (preventing future-data leakage).
4. Trains a scikit-learn regression model (HistGradientBoostingRegressor).
5. Evaluates against a Lag-1 / Seasonal Baseline and computes MAE and RMSE.
6. Serializes the model bundle to disk via joblib and saves metrics as JSON.
"""

import json
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs leak-free feature vectors for regression.
    Features:
    - Time representations: hour, day_of_week, is_weekend, cyclic sin/cos encoding
    - Zone one-hot representations
    - Lag features (previous consumption values per zone)
    - Moving average features
    """
    df = df.copy()
    df["dt"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(by=["zone_id", "dt"]).reset_index(drop=True)

    # 1. Cyclic time features
    hour = df["dt"].dt.hour
    dow = df["dt"].dt.dayofweek
    df["sin_hour"] = np.sin(2 * np.pi * hour / 24.0)
    df["cos_hour"] = np.cos(2 * np.pi * hour / 24.0)
    df["sin_dow"] = np.sin(2 * np.pi * dow / 7.0)
    df["cos_dow"] = np.cos(2 * np.pi * dow / 7.0)

    # 2. Lag features per zone (strictly past data)
    grouped = df.groupby("zone_id")["consumption_m3"]
    df["lag_1"] = grouped.shift(1)       # previous hour consumption
    df["lag_2"] = grouped.shift(2)       # 2 hours ago
    df["lag_24"] = grouped.shift(24)     # same hour yesterday
    df["rolling_mean_6"] = grouped.transform(lambda s: s.shift(1).rolling(6, min_periods=1).mean())
    df["rolling_mean_24"] = grouped.transform(lambda s: s.shift(1).rolling(24, min_periods=1).mean())

    # Drop rows with NaN from lag shift (initial 24 hours of each zone)
    df_clean = df.dropna().reset_index(drop=True)
    return df_clean

def train_and_evaluate(
    data_path: str = None,
    model_dir: str = None,
    test_ratio: float = 0.20
):
    base_dir = Path(__file__).resolve().parent
    if data_path is None:
        data_path = base_dir / "data" / "synthetic_hourly_water_consumption.csv"
    if model_dir is None:
        model_dir = base_dir / "models"

    model_dir = Path(model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading data from {data_path}...")
    df_raw = pd.read_csv(data_path)

    # Feature engineering
    df_feat = prepare_features(df_raw)
    print(f"Total feature records after lag extraction: {len(df_feat)}")

    # Define feature columns
    zone_dummies = pd.get_dummies(df_feat["zone_id"], prefix="zone", dtype=float)
    feature_cols = [
        "sin_hour", "cos_hour", "sin_dow", "cos_dow", "is_weekend",
        "temperature_c", "lag_1", "lag_2", "lag_24", "rolling_mean_6", "rolling_mean_24"
    ]

    X = pd.concat([df_feat[feature_cols], zone_dummies], axis=1)
    y = df_feat["consumption_m3"]
    timestamps = df_feat["dt"]

    # Chronological Split (No data leakage)
    split_index = int(len(df_feat) * (1.0 - test_ratio))
    split_cutoff_time = timestamps.iloc[split_index]
    print(f"Chronological Train/Test Split Cutoff: {split_cutoff_time}")

    X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
    y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]
    df_test = df_feat.iloc[split_index:].copy()

    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # 1. Baseline Model: Persistence Baseline (predict next hour = lag_1, or lag_24)
    # Baseline 1: Lag-1 persistence
    y_pred_baseline_lag1 = df_test["lag_1"].values
    baseline_lag1_mae = float(mean_absolute_error(y_test, y_pred_baseline_lag1))
    baseline_lag1_rmse = float(root_mean_squared_error(y_test, y_pred_baseline_lag1))

    # Baseline 2: Seasonal Lag-24 persistence (same hour yesterday)
    y_pred_baseline_lag24 = df_test["lag_24"].values
    baseline_lag24_mae = float(mean_absolute_error(y_test, y_pred_baseline_lag24))
    baseline_lag24_rmse = float(root_mean_squared_error(y_test, y_pred_baseline_lag24))

    print("\n--- BASELINE EVALUATION (Held-out Test Set) ---")
    print(f"Lag-1 Persistence   -> MAE: {baseline_lag1_mae:.3f} m³/h | RMSE: {baseline_lag1_rmse:.3f} m³/h")
    print(f"Lag-24 Seasonal     -> MAE: {baseline_lag24_mae:.3f} m³/h | RMSE: {baseline_lag24_rmse:.3f} m³/h")

    # 2. Genuine Scikit-Learn Regression Model
    print("\nTraining HistGradientBoostingRegressor on chronological training set...")
    model = HistGradientBoostingRegressor(
        max_iter=150,
        learning_rate=0.08,
        max_depth=8,
        random_state=42
    )
    model.fit(X_train, y_train)

    # 3. Model Predictions on held-out test data
    y_pred = model.predict(X_test)
    ml_mae = float(mean_absolute_error(y_test, y_pred))
    ml_rmse = float(root_mean_squared_error(y_test, y_pred))

    print("\n--- ML MODEL EVALUATION (Held-out Test Set) ---")
    print(f"ML Model (HistGBR)  -> MAE: {ml_mae:.3f} m³/h | RMSE: {ml_rmse:.3f} m³/h")
    
    mae_improvement = ((baseline_lag1_mae - ml_mae) / baseline_lag1_mae) * 100.0
    rmse_improvement = ((baseline_lag1_rmse - ml_rmse) / baseline_lag1_rmse) * 100.0
    print(f"Improvement over Lag-1: MAE: {mae_improvement:+.2f}% | RMSE: {rmse_improvement:+.2f}%")

    # 4. Save Model Artifacts
    feature_columns_list = list(X.columns)
    zone_columns_list = list(zone_dummies.columns)

    model_bundle = {
        "model": model,
        "feature_columns": feature_columns_list,
        "numeric_features": feature_cols,
        "zone_columns": zone_columns_list,
        "metrics": {
            "test_samples": len(X_test),
            "mae": round(ml_mae, 3),
            "rmse": round(ml_rmse, 3),
            "baseline_lag1_mae": round(baseline_lag1_mae, 3),
            "baseline_lag1_rmse": round(baseline_lag1_rmse, 3),
            "baseline_lag24_mae": round(baseline_lag24_mae, 3),
            "baseline_lag24_rmse": round(baseline_lag24_rmse, 3),
            "mae_improvement_pct": round(mae_improvement, 2),
            "rmse_improvement_pct": round(rmse_improvement, 2)
        },
        "disclaimer": "Trained on synthetic benchmark dataset. NOT validated on real Thane consumption data."
    }

    model_file = model_dir / "water_demand_model.joblib"
    joblib.dump(model_bundle, model_file)
    print(f"\nModel successfully saved to {model_file}")

    metrics_file = model_dir / "model_metrics.json"
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(model_bundle["metrics"], f, indent=2)
    print(f"Model metrics saved to {metrics_file}")

    return model_bundle

if __name__ == "__main__":
    train_and_evaluate()
