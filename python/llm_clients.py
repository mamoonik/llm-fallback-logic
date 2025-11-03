import os, time, random, hashlib
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MOCK_DOWN = set([m.strip() for m in os.getenv("MOCK_DOWN_MODELS","").split(",") if m.strip()])
MOCK_BASE_MS = int(os.getenv("MOCK_BASE_MS", "600"))

PING_PROMPT = "You are a ping. Reply with a single word: pong."
PROVIDERS = {
    "gpt-4o-mini": "openai",
    "gpt-4o": "openai",
    "claude-3-5-sonnet": "anthropic"
}

async def _openai_ping(model: str):
    # Check if model is mocked as down FIRST
    if model in MOCK_DOWN:
        return _mock_latency(model)
    
    if not OPENAI_API_KEY:
        return _mock_latency(model)
    
    if MOCK_BASE_MS >= 4000:
        return _mock_latency(model)
    
    t0 = time.perf_counter()
    try:
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "user", "content": PING_PROMPT}], "max_tokens": 3, "temperature": 0}
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
            ok = r.status_code == 200
    except Exception:
        ok = False
    dt = int((time.perf_counter() - t0)*1000)
    return ok, dt

async def _anthropic_ping(model: str):
    if model in MOCK_DOWN:
        return _mock_latency(model)
    
    if not ANTHROPIC_API_KEY:
        return _mock_latency(model)
    
    if MOCK_BASE_MS >= 4000:
        return _mock_latency(model)
    
    t0 = time.perf_counter()
    try:
        headers = {"x-api-key": ANTHROPIC_API_KEY, "content-type": "application/json", "anthropic-version": "2023-06-01"}
        payload = {"model": model, "max_tokens": 5, "messages": [{"role": "user", "content": PING_PROMPT}]}
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            ok = r.status_code == 200
    except Exception:
        ok = False
    dt = int((time.perf_counter() - t0)*1000)
    return ok, dt

def _mock_latency(model: str):
    h = int(hashlib.sha256(model.encode()).hexdigest(), 16)
    jitter = (h % 400)  # 0..399ms
    spike = 800 if random.random() < 0.1 else 0
    latency = MOCK_BASE_MS + jitter + spike
    ok = model not in MOCK_DOWN  
    return ok, latency

async def ping_model(model: str):
    provider = PROVIDERS.get(model, "unknown")
    if provider == "openai":
        ok, ms = await _openai_ping(model)
    elif provider == "anthropic":
        ok, ms = await _anthropic_ping(model)
    else:
        ok, ms = _mock_latency(model)
    return ok, ms, provider