# JalSetu — Smart Water Redistribution System (ML Backend)

College Capstone Project: Water-demand prediction and shortage management for Thane Municipal Corporation.

---

## 1. Project Overview & Units
- **Primary Unit of Measurement:** **Litres per Hour (L/h)** for hourly demand, consumption, and supply rates.
- **24-Hour Cumulative Total:** **Litres (L)**.
- **Scientific & Academic Disclaimer:** All training data and baseline models use synthetic benchmark time-series created for academic algorithm validation and demonstration purposes. **Never claim synthetic data represents actual physical measurements from Thane sensors.**

---

## 2. Directory Layout

```
backend/
├── app.py              # Main Flask REST API server implementing all 10 capabilities
├── train_model.py      # ML pipeline: generates L/h synthetic data & trains scikit-learn model
├── requirements.txt    # Pinned Python dependencies (Flask, Pandas, scikit-learn, joblib, pytest, etc.)
├── README.md           # Easy beginner-friendly instructions
├── data/
│   ├── synthetic_hourly_water_consumption.csv   # 10,800 hourly records (90 days, 5 zones in L/h)
│   └── DATASET_DOCUMENTATION.md                 # Documentation of synthetic generation physics
├── models/
│   ├── water_demand_model.joblib                # Serialized HistGradientBoostingRegressor bundle
│   └── model_metrics.json                       # Held-out test evaluation benchmarks
└── tests/
    └── test_backend.py                          # Pytest suite testing all 10 functional features
```

---

## 3. The 10 Core System Capabilities

| # | Feature | Endpoint | Method | Description |
|---|---|---|---|---|
| 1 | **24-Hour Horizon Forecast** | `/api/predict/24h` or `/api/forecast` | `GET`, `POST` | Sequential autoregressive 24-hour demand prediction per zone in L/h. |
| 2 | **Historical Water Consumption** | `/api/history` | `GET` | Historical records with optional `?zone_id=zone-b&limit=48`. |
| 3 | **Supply Adjustment** | `/api/supply` | `GET`, `POST` | Allows user to dynamically inspect or adjust total or per-zone supply in L/h. |
| 4 | **Shortage Calculation** | `/api/shortage` | `GET`, `POST` | Calculates $\text{Shortage} = \max(0, \text{Demand} - \text{Supply})$ and deficit %. |
| 5 | **Abnormal Consumption Detection** | `/api/anomalies` | `GET` | Flags sudden demand surges, pipe anomalies, or depressed flows beyond normal ranges. |
| 6 | **Zone-wise Risk Analysis** | `/api/risk` | `GET` | Classifies zones into **High** ($\ge 20\%$ deficit), **Medium** ($5-20\%$), or **Low** risk. |
| 7 | **Water Redistribution** | `/api/redistribution` | `GET`, `POST` | Progressive water-filling algorithm with inter-zone transfer route planning. |
| 8 | **Model Performance Metrics** | `/api/metrics` | `GET` | Returns MAE, RMSE, and baseline comparisons on held-out test data. |
| 9 | **Health-Check API** | `/api/health` | `GET` | Verifies service status, loaded model, units, and timestamp. |
| 10 | **Frontend Integration** | `/api/overview`, `/api/zones`, `/api/telemetry` | `GET` | Complete JSON APIs with CORS enabled for Next.js, React, or static HTML dashboards. |

---

## 4. Beginner Quickstart on Windows

### Step 1: Install Python Dependencies
Open PowerShell or Command Prompt in the repository root:
```powershell
pip install -r backend/requirements.txt
```

### Step 2: Train the ML Model
Trains the scikit-learn model and saves it to `backend/models/water_demand_model.joblib`:
```powershell
python backend/train_model.py
```

### Step 3: Run the Tests
Run the automated test suite with pytest:
```powershell
pytest backend/tests -v
```

### Step 4: Start the Flask Backend Server
```powershell
python backend/app.py
```
The server will start and be available at:
**`http://127.0.0.1:5000`**

---

## 5. Sample API Request & Response

### Single-Hour Prediction (`POST /api/predict`)
```json
{
  "zone_id": "zone-b",
  "hour": 14,
  "day_of_week": 2,
  "is_weekend": 0,
  "temperature_c": 31.0,
  "lag_1": 820000.0,
  "lag_2": 800000.0,
  "lag_24": 780000.0
}
```

**Response:**
```json
{
  "status": "success",
  "zone_id": "zone-b",
  "zone_name": "Zone B (Central Commercial)",
  "hour": 14,
  "predicted_demand_lph": 845230.1,
  "unit": "Litres per Hour (L/h)",
  "normal_range_lph": [400000, 600000],
  "deviation_pct": -0.6,
  "anomaly_flag": true,
  "disclaimer": "Prediction derived from scikit-learn model trained on synthetic data."
}
```
