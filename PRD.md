# Product Requirements: Water Demand Management System

> **Status:** Draft v0.1 · **Project state:** Greenfield (no repository existed at authoring time)
> **Working title:** WDMS (Water Demand Management System), TBD final name.

Related: [TECH_SPEC.md](TECH_SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [TASKS.md](TASKS.md) · [README.md](README.md)

## Contents

1. [Overview](#1-overview)
2. [Problem](#2-problem)
3. [Users](#3-users)
4. [Goals and success criteria](#4-goals-and-success-criteria)
5. [Scope](#5-scope)
6. [Functional requirements](#6-functional-requirements)
7. [User stories](#7-user-stories)
8. [Core user journey](#8-core-user-journey)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [Constraints, assumptions, risks](#10-constraints-assumptions-risks)
11. [Open questions and future work](#11-open-questions-and-future-work)

## 1. Overview

WDMS is an ML-based web application that turns historical water consumption
into decisions. For each supply zone it forecasts upcoming demand, flags
abnormal consumption, estimates shortages against available supply, and
recommends how to redistribute water.

**Vision:** a water operator should see, in one screen, which zones will run
short, why, and what to do about it.

Source: hackathon problem statement (confirmed). Everything below that goes
beyond the statement is labeled **Proposed**.

## 2. Problem

Water demand shifts with hour, day, season, weather and recent usage.
Dashboards that only show history do not help operators react to demand
spikes or unusual consumption.

Pain points:

- No forward view of demand per zone.
- Abnormal usage (leaks, surges) is noticed late.
- Supply is allocated without comparing it to expected demand.

## 3. Users

| Persona | Need | Status |
|---|---|---|
| **Operations officer** (primary) | See predicted shortages and act on a distribution recommendation | Proposed |
| **Planner / analyst** | Compare forecasts with history, test supply scenarios | Proposed |
| **Hackathon judge** | Understand the system and verify each required capability quickly | Confirmed context |

## 4. Goals and success criteria

| ID | Goal | Success criterion | Status |
|---|---|---|---|
| G-1 | Accurate short-term forecast | Beats a seasonal-naive baseline on MAE on a time-based holdout | Proposed target |
| G-2 | Useful anomaly flags | Injected or known anomalies in the holdout are flagged; false-alarm rate reported | Proposed target |
| G-3 | Actionable shortage view | Every zone shows demand, supply, shortage | Confirmed |
| G-4 | Actionable redistribution | Allocation never exceeds total supply; higher-risk zones are served first | Confirmed intent, rule Proposed |
| G-5 | Usable UI | A new user completes the journey in [section 8](#8-core-user-journey) without help | Proposed |

Numeric accuracy thresholds: **TBD** until the dataset is profiled.

## 5. Scope

**In scope:** forecasting, anomaly detection, shortage estimation,
redistribution recommendation, interactive UI, visualizations.

**Non-goals:**

- Real-time sensor ingestion or SCADA integration.
- Controlling physical valves or pumps.
- Hydraulic network simulation (pipe pressure, flow physics).
- User accounts and multi-tenant access.

## 6. Functional requirements

Priority uses MoSCoW. "Source" is *Statement* (core requirement from the
problem statement), *Brownie* (optional bonus in the statement) or *Proposed*.

| ID | Requirement | Priority | Source |
|---|---|---|---|
| PRD-001 | The system loads a historical consumption dataset and validates schema, timestamps, missing values and duplicates, reporting problems to the user. | Must | Proposed |
| PRD-002 | The system forecasts expected consumption per zone for each of the next *N* hours (default N = 24, TBD). | Must | Statement |
| PRD-003 | Forecasts use time features (hour, day of week, season) and recent consumption; weather is used when available. | Must | Statement |
| PRD-004 | The system flags zones whose current consumption deviates significantly from their normal pattern and highlights them in the UI. | Must | Statement |
| PRD-005 | The system flags sudden demand increases (surges) separately from sustained abnormal levels. | Must | Statement |
| PRD-006 | For each zone the UI shows expected demand, available supply and estimated shortage. | Must | Statement |
| PRD-007 | Zones are ranked by shortage risk (Low / Medium / High). Thresholds are configurable. | Must | Statement |
| PRD-008 | The system recommends a redistribution of available supply across zones, prioritizing higher predicted demand and higher shortage risk. | Must | Statement |
| PRD-009 | The UI visualizes consumption trends, future predictions and abnormal consumption. | Must | Statement |
| PRD-010 | The user can change total available supply and see the recommendation update. | Should | Brownie |
| PRD-011 | Zones appear on a map showing current demand, predicted demand and shortage risk. | Should | Brownie |
| PRD-012 | The user selects a future period and compares predicted demand with historical consumption for the same period. | Should | Brownie |
| PRD-013 | Weather is an input factor and the UI shows how weather conditions change predicted demand. | Should | Brownie |
| PRD-014 | Forecast accuracy metrics (MAE, sMAPE vs. baseline) are visible in the UI. | Should | Proposed |
| PRD-015 | The user can export the recommendation as CSV. | Could | Proposed |

## 7. User stories

| ID | Story | Acceptance criteria | Req. |
|---|---|---|---|
| US-1 | As an operations officer, I want to see predicted demand per zone for the next hours so I can plan supply. | Given a selected start time, when I open the dashboard, then each zone shows one predicted value per future hour. | PRD-002 |
| US-2 | As an operations officer, I want abnormal zones highlighted so I can investigate them first. | Given current readings, when a zone's deviation exceeds the threshold, then it is visibly marked and lists the deviation size. | PRD-004, PRD-005 |
| US-3 | As an operations officer, I want to see shortage per zone so I know where water is insufficient. | Each zone row shows demand, supply, shortage = max(0, demand − supply). | PRD-006 |
| US-4 | As an operations officer, I want a redistribution plan so I know how to move water. | Plan lists transfers between zones; total allocated ≤ total supply; no zone allocated more than its predicted demand. | PRD-008 |
| US-5 | As a planner, I want to change total supply and see the plan change. | Moving the supply control updates shortages and the plan without a page reload. | PRD-010 |
| US-6 | As a planner, I want to compare a future period with history. | Selecting a period shows predicted vs. historical series on one chart. | PRD-012 |

## 8. Core user journey

1. Open the dashboard; the latest data and forecasts load.
2. Review the zone summary: anomalies, risk levels, shortages.
3. Open a zone to see trend, forecast and anomaly detail.
4. Adjust available supply (what-if).
5. Read the redistribution recommendation and export it.

## 9. Non-functional requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-001 | Dashboard interactions (supply change, zone selection) respond in under 2 s on a laptop. | Proposed target |
| NFR-002 | Forecasting and anomaly results are reproducible: fixed random seeds, versioned data. | Proposed |
| NFR-003 | The UI meets the accessibility rules in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#12-accessibility). | Proposed |
| NFR-004 | The project runs locally from the README quick start with no paid services. | Proposed |

## 10. Constraints, assumptions, risks

**Constraints (confirmed):** ML-based; must include a UI; dataset may be the
Kaggle `dm1718` sample or another suitable one, and the team is responsible
for its suitability.

**Assumptions (unconfirmed):**

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | The dataset has a column that identifies a zone-like entity (district, meter, area). | Zones must be constructed (e.g. clustering) or a different dataset chosen. |
| A-2 | The dataset has no supply data; supply is a user input or derived from history (e.g. a percentile of past consumption). | Shortage numbers are scenario-based, not measured. |
| A-3 | The dataset has no coordinates; a small `zones.csv` with approximate lat/lon is added. | Map requirement (PRD-011) needs extra data work. |
| A-4 | Weather is not in the dataset; it comes from a public archive or is skipped. | PRD-013 may be reduced to a time/season proxy. |

**Risks:**

| Risk | Mitigation |
|---|---|
| Dataset is unsuitable (too few zones, long gaps) | Profile in M1 ([TASKS.md](TASKS.md)); switch dataset early. |
| Anomaly labels do not exist, so detection cannot be scored | Inject synthetic anomalies for evaluation and label them as synthetic. |
| Scope too large for the hackathon | Ship all *Must* items first; brownie items follow in priority order. |

## 11. Open questions and future work

**Open questions**

1. Which dataset is final: `dm1718`, a Smart Cities portal city, or both?
2. What forecast horizon and time granularity does the data support?
3. How is "available supply" defined: one total, or per-zone capacity?
4. Are there redistribution constraints (zones that cannot give or receive water)?

**Future enhancements (Proposed, not committed):** live data feeds, leak
localization, multi-city support, alerting by SMS or email.
