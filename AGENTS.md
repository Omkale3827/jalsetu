# AGENTS.md

Instructions for AI coding agents and contributors. Keep this file short; details live in
[TECH_SPEC.md](TECH_SPEC.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

> **Verification note:** The repository is not yet scaffolded. Commands below are
> **Proposed**. Update them as soon as `requirements.txt` and the folders exist,
> and do not claim a command works until you have run it.

## 1. Project

WDMS forecasts per-zone water demand, flags abnormal consumption, estimates
shortages and recommends supply redistribution. Python plus Streamlit.
Product intent: [PRD.md](PRD.md). Work items: [TASKS.md](TASKS.md).

## 2. Layout (Proposed)

| Path | Responsibility |
|---|---|
| `src/wdms/data/` | Ingest, validation, canonical schema |
| `src/wdms/features/` | Feature building |
| `src/wdms/forecast/` | Train, evaluate, predict |
| `src/wdms/anomaly/` | Residual scoring, surge flag |
| `src/wdms/shortage/` | Shortage and risk |
| `src/wdms/allocation/` | Redistribution |
| `src/wdms/services/` | Orchestration for the UI, caching |
| `src/wdms/ui/` | Streamlit pages, components, tokens |
| `app/streamlit_app.py` | App entry point |
| `scripts/` | Training and data-prep entry points |
| `tests/` | pytest tests, small fixtures |
| `data/`, `models/` | Data and artifacts (large files git-ignored) |

## 3. Rules

1. **Separation:** UI code has no business logic. Core modules never import Streamlit.
2. **Pure functions** for forecast post-processing, anomaly, shortage, allocation.
3. **No data leakage:** features use only information available at forecast time. Splits are time-based.
4. **Determinism:** seeds come from config; same input gives same output.
5. **Typing and style:** type hints on public functions; `snake_case` for functions and variables, `PascalCase` for classes; format and lint with ruff.
6. **Design:** use tokens from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); do not hard-code colors.
7. **Units:** every quantity carries a documented unit. Do not mix units.

## 4. Dependencies

- Add a dependency only if the standard library or an existing dependency cannot do the job.
- Pin versions in `requirements.txt`. State the reason in the PR or commit message.
- Do not add paid or key-gated services without approval.

## 5. Commands (Proposed, unverified)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/train.py            # train and save model
streamlit run app/streamlit_app.py # run the app
pytest                             # tests
ruff check . && ruff format --check .
```

## 6. Before you finish a task

1. Tests for new logic exist and `pytest` passes.
2. `ruff` reports no errors.
3. The app starts if UI or services changed.
4. Docs updated: README commands, TECH_SPEC, ARCHITECTURE, or DESIGN_SYSTEM if behavior changed.
5. The matching entry in [TASKS.md](TASKS.md) is updated with evidence (test name, command output, or file). Never mark Done without evidence.

## 7. Security and privacy

- Never commit secrets, keys, or `.env`. Use `.env.example` with placeholders.
- Do not log or print credentials.
- Treat dataset files and user inputs as untrusted; validate them.

## 8. Git and change management

- Small, focused commits with imperative messages (e.g. `Add shortage risk thresholds`).
- Work on a branch; reference the task ID (e.g. `TASK-012`) in the commit or PR.
- Do not rewrite shared history.

## 9. Do not

- Delete or overwrite `data/raw/`.
- Make unrelated refactors or reformat files you did not change.
- Run destructive commands (`rm -rf`, force push, dropping data) without explicit approval.
- Invent dataset columns, APIs, or metrics. If unknown, mark it TBD and ask.

## 10. Uncertainty and blockers

If requirements conflict, the dataset schema is unknown, or a decision is listed as
Open in [TECH_SPEC.md](TECH_SPEC.md#12-open-decisions): stop, state the question,
propose a default with its trade-off, and set the task to **Blocked** in
[TASKS.md](TASKS.md) with the reason.

## 11. Scope of this file

This is the only `AGENTS.md`. If nested ones are added, the nearest file to the
edited path takes precedence, and it must not contradict this root file on security rules.
