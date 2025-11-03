# Take2 LLM Health Monitor

## Overview
This project implements a minimal multi-model health monitoring system for Take2 AI.
It checks LLM providers' health and automatically falls back to a healthy model if the primary is degraded.

- **Python (FastAPI)** — probes models and simulates latency/availability.
- **Node.js (Express)** — manages state, handles interview requests, and triggers fallbacks.

## Setpup
1. Clone this repo.
2. Run the Python service:
   ```bash
   cd python
   cp .env.example .env
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app:app --host 0.0.0.0 --port 8001 --reload

## Sstructure

- Node.js (Express) = configs + health state + orchestration
- Python (FastAPI) = LLM provider ping + initiate (real if keys provided, else mocked)

## Quick Start

### Python (LLM handler)
cd python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add API keys if you want real pings
uvicorn app:app --host 0.0.0.0 --port 8001 --reload

### Node (state + orchestration)
cd node
cp .env.example .env
npm install
npm start

### Test
curl -s localhost:3000/health | jq
curl -s -X POST localhost:3000/interviews/start -H 'Content-Type: application/json' -d '{"simulationId":"medspa-intake"}' | jq

### Force fallback (mock mode)
in python/.env: set MOCK_DOWN_MODELS=gpt-4o-mini then restart python


### Future imporvments  (if time allows)
- Persist health/fallback events to a database.
- Add retry/backoff logic for probe failures.
- Replace mock latency with actual OpenAI/Anthropic API calls.


