# JalSetu Synthetic Water-Demand Dataset Documentation

- **Primary File:** `synthetic_hourly_water_demand.csv`
- **Total Records:** 600 (120 hours per zone across 5 zones)
- **Primary Unit:** Litres per Hour (L/h)
- **Time Range:** 2026-05-01 00:00:00 to 2026-05-05 23:00:00
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
