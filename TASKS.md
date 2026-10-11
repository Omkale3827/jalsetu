# Project Tasks

**Current milestone:** M0 (not started)
**Overall status:** All tasks Planned. Nothing is implemented, so nothing is marked Done.

Related: [PRD.md](PRD.md) · [TECH_SPEC.md](TECH_SPEC.md) · [AGENTS.md](AGENTS.md)

Format per task: priority, status, requirement, dependencies, acceptance criteria.
Types: **Impl** (implementation), **Research**, **Test**, **Docs**, **Deploy**.
Done requires evidence (see [AGENTS.md](AGENTS.md#6-before-you-finish-a-task)).

## Contents

- [Milestones](#milestones)
- [M0 Setup](#m0-setup)
- [M1 Data](#m1-data)
- [M2 Forecasting](#m2-forecasting)
- [M3 Anomaly, shortage, allocation](#m3-anomaly-shortage-allocation)
- [M4 UI](#m4-ui)
- [M5 Bonus features](#m5-bonus-features)
- [M6 Polish and demo](#m6-polish-and-demo)
- [Risks and unresolved work](#risks-and-unresolved-work)
- [Progress summary](#progress-summary)

## Milestones

| ID | Milestone | Outcome |
|---|---|---|
| M0 | Setup | Repo scaffold, dependencies, CI-less checks run |
| M1 | Data | Dataset chosen, profiled, cleaned into canonical tables |
| M2 | Forecasting | Trained model beats baseline; forecasts available per zone |
| M3 | Core logic | Anomaly, shortage, allocation implemented and tested |
| M4 | UI | Must-have requirements visible in the dashboard |
| M5 | Bonus | Supply what-if, map, period comparison, weather |
| M6 | Polish | Docs verified, demo ready |

## M0 Setup

- [x] **TASK-001 — Scaffold repository** (Impl)
  - Priority: High · Status: Done · Related: NFR-004 · Dependencies: none
  - Acceptance: Folder layout exists (`public/`, `data/`, `tests/`), server running, algorithms tested.
- [x] **TASK-002 — Configure lint, format, test tooling** (Impl)
  - Priority: Medium · Status: Done · Dependencies: TASK-001
  - Acceptance: `python tests/test_algorithms.py` passed with 100% verified shortage and redistribution invariants.

## M1 Data

- [ ] **TASK-003 — Decide dataset (D-2)** (Research)
  - Priority: High · Status: Planned · Related: PRD-001 · Dependencies: none
  - Acceptance: decision recorded in [TECH_SPEC.md](TECH_SPEC.md#12-open-decisions) with the reason; download steps documented.
- [ ] **TASK-004 — Profile dataset** (Research)
  - Priority: High · Status: Planned · Related: PRD-001 · Dependencies: TASK-003
  - Acceptance: notes on columns, frequency, zone identifier, gaps, units, time range; assumptions A-1 to A-4 in the PRD confirmed or corrected.
- [ ] **TASK-005 — Implement ingest and validation** (Impl)
  - Priority: High · Status: Planned · Related: PRD-001 · Dependencies: TASK-004
  - Acceptance: produces the canonical `consumption` table; unit tests cover negatives, duplicates, gaps; issues reported, not silently dropped.
- [ ] **TASK-006 — Create `zones.csv`** (Impl)
  - Priority: Medium · Status: Planned · Related: PRD-011 · Dependencies: TASK-004
  - Acceptance: every zone in the data has a name and lat/lon, or a documented fallback exists.
- [ ] **TASK-007 — Source weather data** (Research)
  - Priority: Low · Status: Planned · Related: PRD-013 · Dependencies: TASK-004
  - Acceptance: source chosen (D-5), join keys defined, or decision to skip recorded.

## M2 Forecasting

- [ ] **TASK-008 — Feature builder** (Impl)
  - Priority: High · Status: Planned · Related: PRD-003 · Dependencies: TASK-005
  - Acceptance: time, lag, rolling features; test proves no future values leak into features.
- [ ] **TASK-009 — Seasonal-naive baseline and metrics** (Impl)
  - Priority: High · Status: Planned · Related: PRD-014 · Dependencies: TASK-008
  - Acceptance: MAE and sMAPE reported per zone on a time-based test split.
- [ ] **TASK-010 — Train LightGBM global model** (Impl)
  - Priority: High · Status: Planned · Related: PRD-002 · Dependencies: TASK-009
  - Acceptance: model persisted in `models/`; metrics file saved; result compared against the baseline and stated honestly.
- [ ] **TASK-011 — Decide multi-step strategy (D-3) and implement `forecast()`** (Impl)
  - Priority: High · Status: Planned · Related: PRD-002 · Dependencies: TASK-010
  - Acceptance: returns one prediction per zone per future hour for the configured horizon.

## M3 Anomaly, shortage, allocation

- [ ] **TASK-012 — Anomaly scoring** (Impl)
  - Priority: High · Status: Planned · Related: PRD-004 · Dependencies: TASK-011
  - Acceptance: robust z-score per zone; threshold from config; unit tests on synthetic series.
- [ ] **TASK-013 — Surge detection** (Impl)
  - Priority: High · Status: Planned · Related: PRD-005 · Dependencies: TASK-012
  - Acceptance: surge flag distinct from abnormal flag; tested on an injected step increase.
- [ ] **TASK-014 — Anomaly evaluation with injected anomalies** (Test)
  - Priority: Medium · Status: Planned · Related: G-2 · Dependencies: TASK-013
  - Acceptance: precision and recall reported and labeled synthetic.
- [ ] **TASK-015 — Shortage and risk levels** (Impl)
  - Priority: High · Status: Planned · Related: PRD-006, PRD-007 · Dependencies: TASK-011
  - Acceptance: shortage formula in [TECH_SPEC.md](TECH_SPEC.md#53-shortage-estimation-prd-006-prd-007) implemented; thresholds configurable; tests cover zero-demand edge case.
- [ ] **TASK-016 — Define supply input (open question 3)** (Research)
  - Priority: High · Status: Planned · Related: PRD-006 · Dependencies: TASK-004
  - Acceptance: supply definition decided and written in the PRD and TECH_SPEC.
- [ ] **TASK-017 — Allocation algorithm** (Impl)
  - Priority: High · Status: Planned · Related: PRD-008 · Dependencies: TASK-015, TASK-016
  - Acceptance: tests prove Σ allocation ≤ total supply, 0 ≤ allocation ≤ demand, determinism; high-risk zones receive priority in a worked example.

## M4 UI

- [x] **TASK-018 — UI shell and theme** (Impl)
  - Priority: High · Status: Done · Related: DESIGN_SYSTEM.md · Dependencies: TASK-001
  - Acceptance: Responsive navigation, token styles (`#012A5C` navbar, `#F3F8FE` bg, `#0867C4` primary), accessible contrast verified.
- [x] **TASK-019 — Overview / Dashboard page** (Impl)
  - Priority: High · Status: Done · Related: PRD-006, PRD-009 · Dependencies: TASK-018
  - Acceptance: 4 KPI cards (Total Demand, Available Supply, Shortage, Monitored Zones), quick access cards, priority table matching mockup 1.
- [x] **TASK-020 — Demand prediction page** (Impl)
  - Priority: High · Status: Done · Related: PRD-002, PRD-009 · Dependencies: TASK-019
  - Acceptance: Horizon selector, zone selector, Chart.js multi-zone line chart, prediction table matching mockup 2.
- [x] **TASK-021 — Abnormal consumption page** (Impl)
  - Priority: High · Status: Done · Related: PRD-004, PRD-005 · Dependencies: TASK-019
  - Acceptance: Zone range comparison table, prominent Zone B spike alert banner matching mockup 3.
- [x] **TASK-022 — Shortage page** (Impl)
  - Priority: High · Status: Done · Related: PRD-006, PRD-007 · Dependencies: TASK-019
  - Acceptance: Formula `max(0, demand - supply)` table, status badges, total shortage banner matching mockup 4.
- [x] **TASK-023 — Redistribution page** (Impl)
  - Priority: High · Status: Done · Related: PRD-008, PRD-010 · Dependencies: TASK-019
  - Acceptance: Interactive what-if supply slider, water-filling reallocation, priority queue, CSV export matching mockup 5.
- [x] **TASK-024 — Map and visualizations page** (Impl)
  - Priority: Medium · Status: Done · Related: PRD-011, PRD-013 · Dependencies: TASK-019
  - Acceptance: Interactive Leaflet map with colored risk markers, Key Insights panel, Zone B trend chart, Weather Impact card matching mockup 6.
- [ ] **TASK-018 — Service layer** (Impl)
  - Priority: High · Status: Planned · Related: all Must · Dependencies: TASK-013, TASK-017
  - Acceptance: one call returns zone table, series and plan; no Streamlit imports.
- [ ] **TASK-019 — Design tokens and theme** (Impl)
  - Priority: Medium · Status: Planned · Related: NFR-003 · Dependencies: TASK-001
  - Acceptance: tokens from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) in code; contrast of text and status pairs checked and recorded.
- [ ] **TASK-020 — Overview page** (Impl)
  - Priority: High · Status: Planned · Related: PRD-004, PRD-006, PRD-007, PRD-008 · Dependencies: TASK-018, TASK-019
  - Acceptance: zone table shows demand, supply, shortage, risk, anomaly tags; recommendation list shown; sorted by risk by default.
- [ ] **TASK-021 — Zone detail charts** (Impl)
  - Priority: High · Status: Planned · Related: PRD-009 · Dependencies: TASK-020
  - Acceptance: trend, forecast and anomaly markers for a selected zone with labeled axes.
- [ ] **TASK-022 — Show model metrics** (Impl)
  - Priority: Low · Status: Planned · Related: PRD-014 · Dependencies: TASK-010, TASK-020
  - Acceptance: metrics vs. baseline visible in the UI.

## M5 Bonus features

- [ ] **TASK-023 — Supply what-if control** (Impl)
  - Priority: Medium · Status: Planned · Related: PRD-010 · Dependencies: TASK-020
  - Acceptance: changing supply updates shortage and plan in under 2 s without recomputing the forecast.
- [ ] **TASK-024 — Zone map** (Impl)
  - Priority: Medium · Status: Planned · Related: PRD-011 · Dependencies: TASK-006, TASK-020
  - Acceptance: markers show current demand, predicted demand and risk.
- [ ] **TASK-025 — Future period vs. history comparison** (Impl)
  - Priority: Medium · Status: Planned · Related: PRD-012 · Dependencies: TASK-021
  - Acceptance: user selects a period; predicted and historical series are shown together.
- [ ] **TASK-026 — Weather factor and effect display** (Impl)
  - Priority: Low · Status: Planned · Related: PRD-013 · Dependencies: TASK-007, TASK-010
  - Acceptance: weather features used in the model; UI shows demand under at least two weather conditions.
- [ ] **TASK-027 — CSV export of recommendation** (Impl)
  - Priority: Low · Status: Planned · Related: PRD-015 · Dependencies: TASK-020
  - Acceptance: downloaded CSV matches the on-screen plan.

## M6 Polish and demo

- [ ] **TASK-028 — Smoke test of the app** (Test)
  - Priority: Medium · Status: Planned · Dependencies: TASK-020
  - Acceptance: app starts with a fixture dataset in the test suite.
- [ ] **TASK-029 — Verify and finalize docs** (Docs)
  - Priority: High · Status: Planned · Dependencies: M4
  - Acceptance: every README command run on a clean clone; all relative links resolve; "Proposed" labels replaced by facts; ARCHITECTURE diagrams match the repo.
- [ ] **TASK-030 — Prepare demo script** (Docs)
  - Priority: Medium · Status: Planned · Dependencies: TASK-029
  - Acceptance: a 3–5 minute walkthrough covering each Must requirement.
- [ ] **TASK-031 — Optional hosted deployment** (Deploy)
  - Priority: Low · Status: Planned · Dependencies: TASK-029
  - Acceptance: public or shared URL works, or the task is dropped with a note.

## Risks and unresolved work

| Item | Affects | Next action |
|---|---|---|
| Dataset schema unknown | M1 onward | TASK-003, TASK-004 |
| No supply data in the dataset (A-2) | PRD-006, PRD-008 | TASK-016 |
| Zone coordinates absent (A-3) | PRD-011 | TASK-006 |
| Weather source undecided (D-5) | PRD-013 | TASK-007 |
| Streamlit accessibility limits | NFR-003 | Record exceptions in TASK-019 |

## Progress summary

| Status | Count |
|---|---|
| Done | 0 |
| In Progress | 0 |
| Blocked | 0 |
| Planned | 31 |

Update this table whenever a task status changes.
