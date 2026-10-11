# Water Demand Management System (WDMS)

An ML-based dashboard that forecasts water demand per zone, flags abnormal
consumption, estimates shortages against available supply, and recommends how
to redistribute water.

> **Project status: planning.** The documentation is drafted; the code is not yet written.
> Setup and run commands below are **Proposed and unverified** until
> [TASK-001](TASKS.md#m0-setup) and [TASK-029](TASKS.md#m6-polish-and-demo) are complete.

## What it does

- Forecasts expected consumption per zone for upcoming hours.
- Highlights zones that deviate from their normal pattern, including sudden surges.
- Shows expected demand, available supply, and estimated shortage per zone.
- Recommends a supply redistribution that prioritizes high-demand, high-risk zones.
- Planned extras: supply what-if, zone map, future-vs-history comparison, weather effect.

## Technology (Proposed)

Python 3.11+, pandas, LightGBM, Plotly, Streamlit, pytest, ruff.
Rationale: [TECH_SPEC.md](TECH_SPEC.md#2-stack-and-rationale).

## Quick start (Proposed, unverified)

Prerequisites: Python 3.11+, git.

```bash
git clone <repository-url>
cd <repository-folder>
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Get the data (steps TBD in [TASK-003](TASKS.md#m1-data)). The suggested sample is the
Kaggle competition `dm1718`: https://www.kaggle.com/competitions/dm1718.
Place files under `data/raw/`.

```bash
python scripts/train.py              # prepare data and train the model
streamlit run app/streamlit_app.py   # start the dashboard
```

## Configuration

Settings live in `config.yaml` (horizon, anomaly threshold, risk thresholds, seed).
Optional environment variables, copied from `.env.example`:

```bash
WDMS_DATA_DIR=data/
WDMS_WEATHER_API_KEY=changeme   # only if a keyed weather API is used (TBD)
```

Never commit real keys.

## Tests and checks (Proposed)

```bash
pytest
ruff check . && ruff format --check .
```

## Basic usage

1. Open the dashboard and pick a forecast start time.
2. Review the zone table: risk, anomaly tags, shortage.
3. Open a zone for charts.
4. Adjust available supply and read the recommended transfers.

## Project structure (Proposed)

```text
app/        Streamlit entry point
src/wdms/   data, features, forecast, anomaly, shortage, allocation, services, ui
scripts/    training and data preparation
tests/      pytest tests
data/       raw and processed data (large files git-ignored)
models/     trained model artifacts
```

## Documentation

| Document | Purpose |
|---|---|
| [PRD.md](PRD.md) | What and why; requirements |
| [TECH_SPEC.md](TECH_SPEC.md) | How the requirements are implemented |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components and data flow |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | UI tokens and components |
| [AGENTS.md](AGENTS.md) | Rules for AI agents and contributors |
| [TASKS.md](TASKS.md) | Roadmap and task status |

## Known limitations

- Dataset, zone definition, and supply source are not final (see PRD open questions).
- Shortage is computed against a scenario supply, not metered supply.
- No pipe-network modeling.

## Troubleshooting

To be filled in as issues are found during implementation.

## Contributing

1. Read [AGENTS.md](AGENTS.md).
2. Pick a task from [TASKS.md](TASKS.md) and mark it In Progress.
3. Make a focused branch and commit; reference the task ID.
4. Run tests and lint; update docs if behavior changed.

## License and acknowledgments

License: TBD. Data: Kaggle `dm1718` and Smart Cities Open Data Portal datasets, subject to their own terms.
