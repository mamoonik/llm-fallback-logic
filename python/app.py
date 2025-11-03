from fastapi import FastAPI, Query
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

from llm_clients import ping_model

app = FastAPI(title="Take2 LLM Agent")

class InitiateReq(BaseModel):
    model: str
    prompt: str
    metadata: Optional[dict] = None

@app.get("/probe")
async def probe(model: str = Query(...)):
    ok, latency_ms, provider = await ping_model(model)
    return {"ok": ok, "latency_ms": latency_ms, "provider": provider, "model": model}

@app.post("/initiate")
async def initiate(req: InitiateReq):
    ok, latency_ms, provider = await ping_model(req.model)
    return {
        "ok": ok,
        "latency_ms": latency_ms,
        "provider": provider,
        "model": req.model,
        "note": "Mocked unless real API keys provided"
    }
