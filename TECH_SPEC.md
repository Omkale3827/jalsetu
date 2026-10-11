# Technical Specification

> **Status:** Draft v0.1. **Nothing below is implemented yet.** Every item is
> **Proposed** unless marked **Confirmed**. Requirement IDs refer to [PRD.md](PRD.md).

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [AGENTS.md](AGENTS.md) · [TASKS.md](TASKS.md)

## Contents

1. [Overview](#1-overview)
2. [Stack and rationale](#2-stack-and-rationale)
3. [Runtime and configuration](#3-runtime-and-configuration)
4. [Data model](#4-data-model)
5. [ML specification](#5-ml-specification)
6. [Internal interfaces](#6-internal-interfaces)
7. [Security and privacy](#7-security-and-privacy)
8. [Errors and logging](#8-errors-and-logging)
9. [Performance](#9-performance)
10. [Testing](#10-testing)
11. [Deployment](#11-deployment)
12. [Open decisions](#12-open-decisions)

## 1. Overview

A single Python application. A pipeline turns raw consumption data into
features, forecasts, anomaly flags, shortage estimates and an allocation plan.
A Flask app serves the pages (Jinja templates, HTML, CSS, vanilla JS) and a small JSON API
that the pages call. Business logic stays in plain Python modules (decision D-1: Flask).

## 2. Stack and rationale

| Layer | Choice | Rationale | Status |
|---|---|---|---|
| Language | Python 3.11+ | ML ecosystem; one language for pipeline and UI | Proposed |
| Data | pandas, numpy | Standard tabular tooling | Proposed |
| Forecasting | LightGBM (global model) + seasonal-naive baseline | Handles many zones in one model; fast to train; baseline gives an honest benchmark | Proposed |
| Anomaly detection | Residual-based robust z-score (MAD) | Explainable, works without labels | Proposed |
| Allocation | Pure-Python weighted water-filling | Deterministic, testable, no solver dependency | Proposed |
| Web framework | Flask | Matches the UI mockup (HTML/CSS/JS); handles uploads and an admin view | Proposed |
| Charts | Plotly.js (CDN or vendored) | Interactive charts in the browser | Proposed |
| Map | Leaflet + OpenStreetMap tiles | No API key needed | Proposed |
| Tests | pytest | Standard | Proposed |
| Lint/format | ruff | Single fast tool | Proposed |

Alternatives considered: scikit-learn `HistGradientBoostingRegressor`
(fewer dependencies, similar quality, fallback if LightGBM install fails);
Prophet or LSTM (heavier, no clear gain for this data size).

## 3. Runtime and configuration

| Item | Value |
|---|---|
| Python | 3.11+ |
| OS | Linux, macOS, Windows (Unconfirmed on Windows) |
| GPU | Not required |

Configuration lives in `config.yaml` (Proposed). Environment variables hold
only secrets or paths.

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `WDMS_DATA_DIR` | Location of datasets | No (default `data/`) | `data/` |
| `WDMS_WEATHER_API_KEY` | Weather provider key, only if a keyed API is used (TBD) | No | `changeme` |

`config.yaml` keys (Proposed): forecast horizon, anomaly threshold, risk
thresholds, allocation weights, random seed.

## 4. Data model

The raw schema is **Unconfirmed** until the dataset is profiled (TASK-004).
The pipeline normalizes any source into these canonical tables.

**`consumption`** (long format)

| Column | Type | Rules |
|---|---|---|
| `timestamp` | datetime (UTC or one documented tz) | Unique per `zone_id`; regular frequency after resampling |
| `zone_id` | string | Non-null |
| `consumption` | float | ≥ 0; missing values interpolated up to a limit (TBD), else dropped and reported |

**`weather`** (optional): `timestamp`, `zone_id` or city-level, `temperature`,
`rainfall`, `humidity`. Columns TBD by the chosen source.

**`zones`**: `zone_id`, `name`, `lat`, `lon`, optional `capacity`. Hand-made
file (assumption A-3 in the PRD).

**`supply`**: scenario input, not a stored dataset. Either one total
(`total_supply`) or per-zone `current_supply`. Definition is an open question (PRD §11).

**`reports`** (citizen water wastage submissions):

| Column | Type | Rules |
|---|---|---|
| `id` | string (UUID) | Unique primary key, returned to reporter |
| `timestamp` | datetime (UTC) | Creation timestamp |
| `lat`, `lon` | float | Required; within supported city bounds |
| `address_text` | text | Optional, up to 200 characters (landmark or street) |
| `zone_id` | string, optional | Derived from the nearest zone, or chosen by reporter |
| `category` | enum | `burst_pipe`, `leak`, `overflow`, `other` |
| `severity` | enum, optional | `minor`, `heavy` (reporter's view) |
| `description` | text | Up to 500 characters |
| `photos` | array of strings | 1–3 image paths (stored in `data/uploads/`) |
| `status` | enum | `submitted`, `in_review`, `actioned`, `resolved`, `dismissed` |
| `received_by` | string | Authority name from config, e.g. `MCD` |

Zone assignment (nearest zone to the pin) is optional. If `zones.csv` is missing, the report is
still saved with lat/lon and no zone.

**Validation rules (PRD-001):** reject negative consumption; report duplicate
timestamps, gaps, and zones with fewer than *K* observations (K TBD).

### 5.5 Photo and location upload rules

1. Accept 1–3 images (JPEG or PNG only), maximum 5 MB per image.
2. Strip EXIF metadata before saving to protect citizen privacy.
3. Generate a secure random filename; never store files using client-supplied names.
4. Quarantine unverified uploads in a staging directory.
5. Location (lat/lon) is mandatory; address text is optional.
6. A submission without a location or with a non-image file is rejected with a clear message.
7. Reports work standalone: submitting does not depend on model inference.
8. Validate lat/lon ranges server-side; never trust client coordinates for access control.
9. Store location at the precision the reporter gave; treat it as personal data (retention D-7).
10. Possible duplicate: same category within a small radius (value TBD) and a recent time window is linked to the earlier report instead of creating a new issue. (Proposed; optional.)

## 6. Internal interfaces

Page routes (Proposed):
  GET   /report                  public report form
  GET   /report/track            public status lookup
  GET   /mcd/reports             MCD review view (passcode required)

HTTP endpoints (Proposed; paths and parameters not final):
  GET   /api/overview?time=&supply=       zone table: demand, supply, shortage, risk, flags
  GET   /api/forecast?zone=&from=&to=     predicted and historical series
  GET   /api/anomalies?time=              abnormal and surge flags
  GET   /api/allocation?supply=           redistribution plan
  POST  /api/reports                      submit a photo report (multipart)
  GET   /api/reports                      list reports (passcode required)
  PATCH /api/reports/<id>                 change status (passcode required)

Report routes use their own template and their own JS file; they import no forecasting modules.

Modules expose plain functions. Signatures are indicative and may change at implementation time:

```python
def load_consumption(path: str) -> pd.DataFrame: ...
def build_features(df: pd.DataFrame, weather: pd.DataFrame | None) -> pd.DataFrame: ...
def train_model(features: pd.DataFrame, cfg: dict) -> Model: ...
def forecast(model: Model, history: pd.DataFrame, horizon: int) -> pd.DataFrame: ...
def detect_anomalies(actual: pd.DataFrame, expected: pd.DataFrame, cfg: dict) -> pd.DataFrame: ...
def estimate_shortage(demand: pd.DataFrame, supply: pd.DataFrame, cfg: dict) -> pd.DataFrame: ...
def allocate(demand: pd.Series, total_supply: float, risk: pd.Series, cfg: dict) -> pd.DataFrame: ...
```

## 7. Security and privacy

- Data is aggregate zone-level consumption; no personal data expected (**Unconfirmed**: check the dataset).
- No credentials in the repository; `.env` is git-ignored; ship `.env.example` only.
- Validate uploaded files, if upload is supported: extension, size limit, schema.
- Pin dependency versions.
- No authentication in scope (PRD non-goal). The app must not be exposed publicly with sensitive data.

## 8. Errors and logging

| Situation | Behavior |
|---|---|
| Missing or malformed data file | Show a clear UI error naming the file and the failed check |
| Zone with too little history | Exclude, list in a "skipped zones" notice |
| Weather unavailable | Fall back to a no-weather model; show a notice |
| Model artifact missing | Prompt to run training; do not silently retrain |

Use Python `logging` with INFO by default. Log data-quality counts and model metrics.

## 9. Performance

Targets are in the PRD (NFR-001). Approach: train offline via a script, persist
the model, cache loaded data and forecasts in memory (e.g. `functools.lru_cache`), load the model once at startup, and keep
allocation vectorized. Scale target: tens of zones, a few years of hourly data
(**Unconfirmed**, dataset dependent).

## 10. Testing

| Level | Scope |
|---|---|
| Unit | Validation rules, feature builder (no leakage), shortage math, allocation invariants |
| Model | Metrics vs. baseline on the holdout; anomaly precision and recall on injected anomalies |
| Smoke | App starts and renders with a small fixture dataset |

Quality bar: tests pass and ruff reports no errors before a task is Done (see [AGENTS.md](AGENTS.md)).

## 11. Deployment

Local run is the primary target. Optional: container or hosted deployment (TBD). Deployment is not required for the problem statement.

## 12. Open decisions

| ID | Decision | Options | Status |
|---|---|---|---|
| D-1 | App framework | Flask + HTML, CSS, JS | **Decided (proposed by team lead, matches mockup):** Flask |
| D-2 | Dataset | `dm1718` / Smart Cities city dataset / both | Open |
| D-3 | Multi-step strategy | Direct vs. recursive | Open |
| D-4 | Allocation method | Weighted water-filling / linear program | Proposed: water-filling |
| D-5 | Weather source | Public archive API / bundled CSV / skip | Open |
