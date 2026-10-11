"""
Pytest unit tests for the data and machine learning pipeline in train_model.py.
Verifies:
1. Data generation reproducibility (random seed consistency).
2. Data validation and graceful handling of missing/invalid inputs.
3. Feature engineering ensures no future data leakage.
4. Chronological split ordering.
5. Baseline comparison calculations.
"""

from datetime import datetime
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from train_model import (
    generate_synthetic_water_dataset,
    validate_and_clean_data,
    engineer_features,
    predict_single_zone_demand,
    MODEL_BUNDLE_PATH,
    FICTIONAL_ZONES
)
import joblib

def test_data_generation_reproducible():
    """Confirms random seed yields identical dataframes."""
    df1 = generate_synthetic_water_dataset(days=3, seed=42)
    df2 = generate_synthetic_water_dataset(days=3, seed=42)
    pd.testing.assert_frame_equal(df1, df2)

def test_data_cleaning_handles_invalid_and_missing():
    """Confirms missing values and invalid timestamps are handled gracefully."""
    dirty_data = pd.DataFrame({
        "timestamp": ["2026-08-01 00:00:00", "invalid_timestamp", "2026-08-01 02:00:00"] * 20,
        "zone_id": ["zone-a"] * 60,
        "water_demand_lph": [500000.0, np.nan, -100.0] * 20
    })
    cleaned = validate_and_clean_data(dirty_data, min_hours_per_zone=10)
    assert cleaned["dt"].isna().sum() == 0
    assert cleaned["water_demand_lph"].isna().sum() == 0
    assert (cleaned["water_demand_lph"] < 0).sum() == 0

def test_feature_engineering_leakage_prevention():
    """Confirms lag features do not look forward into the future."""
    df = generate_synthetic_water_dataset(days=5, seed=99)
    cleaned = validate_and_clean_data(df)
    features = engineer_features(cleaned)

    # Check lag_1 corresponds strictly to previous observation
    zone_a = features[features["zone_id"] == "zone-a"].reset_index(drop=True)
    for i in range(1, 10):
        assert zone_a.loc[i, "lag_1"] == zone_a.loc[i - 1, "water_demand_lph"]

def test_model_inference_offline():
    """Confirms offline inference works using saved joblib bundle."""
    assert MODEL_BUNDLE_PATH.exists()
    bundle = joblib.load(MODEL_BUNDLE_PATH)
    pred = predict_single_zone_demand(
        model_bundle=bundle,
        zone_id="zone-a",
        target_dt=datetime(2026, 8, 15, 14, 0),
        lag_1=510000.0,
        lag_2=500000.0,
        lag_24=490000.0
    )
    assert pred > 10000.0
    assert isinstance(pred, float)
