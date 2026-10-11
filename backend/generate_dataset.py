"""
Dataset Generator for JalSetu ML Pipeline.
IMPORTANT NOTICE:
This script generates a clearly labelled SYNTHETIC hourly water consumption dataset.
This dataset is generated for machine learning benchmarking, algorithm development,
and college demonstration purposes. IT IS NOT REAL THANE DATA.
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd

def generate_synthetic_water_dataset(
    start_date: str = "2026-07-01",
    days: int = 90,
    output_path: str = None,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates realistic hourly water consumption time-series for 5 zones.
    
    Realistic factors modeled:
    - Diurnal pattern: Morning peak (06:00 - 10:00), Afternoon plateau (11:00 - 16:00),
      Evening peak (18:00 - 21:00), and Night trough (00:00 - 05:00).
    - Zone specific profiles (Residential, Commercial, Industrial).
    - Day of week differences (weekend shifts in residential vs commercial).
    - Weather / temperature proxy (higher ambient temperature leads to higher demand).
    - Stochastic noise and occasional demand surges.
    """
    np.random.seed(seed)
    
    # 5 Canonical Zones from JalSetu project
    zones = [
        {"id": "zone-a", "name": "Zone A (North District)", "type": "residential", "base_m3": 500.0, "scale": 45.0},
        {"id": "zone-b", "name": "Zone B (Central Commercial)", "type": "commercial", "base_m3": 650.0, "scale": 70.0},
        {"id": "zone-c", "name": "Zone C (West Suburbs)", "type": "suburban", "base_m3": 540.0, "scale": 40.0},
        {"id": "zone-d", "name": "Zone D (Industrial Belt)", "type": "industrial", "base_m3": 680.0, "scale": 50.0},
        {"id": "zone-e", "name": "Zone E (South Residential)", "type": "residential", "base_m3": 510.0, "scale": 40.0},
    ]

    date_range = pd.date_range(start=start_date, periods=days * 24, freq="h")
    records = []

    for zone in zones:
        zone_id = zone["id"]
        zone_name = zone["name"]
        zone_type = zone["type"]
        base = zone["base_m3"]
        scale = zone["scale"]

        for ts in date_range:
            hour = ts.hour
            dow = ts.dayofweek  # 0=Mon, 6=Sun
            is_weekend = int(dow >= 5)

            # 1. Base Diurnal Factor (0.0 to 1.5)
            # Normal morning peak around 8 AM, evening peak around 19:00 PM
            morning_peak = np.exp(-((hour - 8.0) ** 2) / (2 * 1.8 ** 2)) * 0.45
            evening_peak = np.exp(-((hour - 19.5) ** 2) / (2 * 2.0 ** 2)) * 0.35
            afternoon_dip = 0.15 if (12 <= hour <= 16) else 0.0
            night_trough = -0.35 if (hour <= 4 or hour >= 23) else 0.0

            diurnal_factor = 1.0 + morning_peak + evening_peak + afternoon_dip + night_trough

            # 2. Zone type adjustments
            if zone_type == "commercial":
                # Commercial runs high on weekdays 9-18, drops on weekends
                if is_weekend:
                    type_factor = 0.70
                else:
                    type_factor = 1.25 if (9 <= hour <= 18) else 0.85
            elif zone_type == "industrial":
                # Continuous industrial shift, slightly lower on Sundays
                type_factor = 0.90 if dow == 6 else 1.05
            else:
                # Residential zones consume slightly more on weekends
                type_factor = 1.10 if is_weekend else 1.00

            # 3. Temperature effect (daily sinusoidal proxy + random drift)
            # Temperature peaks at ~14:00, lowest at ~05:00
            temp_c = 26.0 + 7.0 * np.sin((hour - 9) * np.pi / 12.0) + np.random.normal(0, 1.2)
            temp_effect = 1.0 + (temp_c - 28.0) * 0.006  # approx 0.6% per deg C deviation

            # 4. Stochastic Gaussian noise
            noise = np.random.normal(0, scale)

            # 5. Occasional demand surges (anomalies / pipe bursts / emergency fillings)
            surge = 0.0
            if np.random.rand() < 0.008:  # 0.8% chance of surge anomaly
                surge = np.random.uniform(80.0, 180.0)

            # Calculate raw hourly consumption in m3/h
            raw_consumption = (base * diurnal_factor * type_factor * temp_effect) + noise + surge
            consumption = max(50.0, round(raw_consumption, 2))  # ensure non-negative realistic minimum

            records.append({
                "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "zone_id": zone_id,
                "zone_name": zone_name,
                "hour": hour,
                "day_of_week": dow,
                "is_weekend": is_weekend,
                "temperature_c": round(temp_c, 1),
                "consumption_m3": consumption,
                "is_synthetic": True,
                "data_source": "SYNTHETIC_BENCHMARK_SIMULATION_NOT_REAL_THANE"
            })

    df = pd.DataFrame(records)
    
    # Chronological sort
    df["dt"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(by=["dt", "zone_id"]).drop(columns=["dt"]).reset_index(drop=True)

    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(out_file, index=False)
        print(f"Saved {len(df)} synthetic hourly records to {out_file}")

    return df

if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    target_csv = base_dir / "data" / "synthetic_hourly_water_consumption.csv"
    generate_synthetic_water_dataset(output_path=str(target_csv))
