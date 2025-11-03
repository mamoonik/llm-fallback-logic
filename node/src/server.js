// import express from 'express';
// import dotenv from 'dotenv';
// import axios from 'axios';
// import { HealthRegistry } from './health.js';
// import { SIM_CONFIGS } from './config.js';
// import { log, warn } from './logger.js';

// dotenv.config();
// const app = express();
// app.use(express.json());

// const PORT = process.env.PORT || 3000;
// const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://localhost:8001';
// const HEALTH_INTERVAL_MS = Number(process.env.HEALTH_INTERVAL_MS || 15000);
// const HEALTH_MAX_MS = Number(process.env.HEALTH_MAX_MS || 3000);
// const MODELS = (process.env.MODELS || 'gpt-4o-mini,claude-3-5-sonnet,gpt-4o').split(',');

// const health = new HealthRegistry({ pythonBaseUrl: PYTHON_BASE_URL, maxOkMs: HEALTH_MAX_MS });

// // initial + periodic probes
// (async function initProbes() {
//   await health.probeAll(MODELS);
//   setInterval(() => health.probeAll(MODELS), HEALTH_INTERVAL_MS);
// })();

// app.get('/health', (req, res) => {
//   const out = {};
//   for (const m of MODELS) out[m] = health.get(m);
//   res.json({ models: out, max_ok_ms: HEALTH_MAX_MS, checked_at: Date.now() });
// });

// app.post('/interviews/start', async (req, res) => {
//   const { simulationId } = req.body || {};
//   const sim = SIM_CONFIGS[simulationId];
//   if (!sim) return res.status(400).json({ error: 'unknown simulationId' });

//   ///////////////
//   let pick = health.pickHealthy(sim.primary, sim.fallbacks);

// ///////////
//   if (!pick) {
//     await health.probeAll([sim.primary, ...sim.fallbacks]);
//     pick = health.pickHealthy(sim.primary, sim.fallbacks);
//   }
//   if (!pick) return res.status(503).json({ error: 'no healthy models', tried: [sim.primary, ...sim.fallbacks] });

//   const { model, wasFallback } = pick;
//   try {
//     const resp = await axios.post(`${PYTHON_BASE_URL}/initiate`, {
//       model,
//       prompt: sim.prompt,
//       metadata: { simulationId }
//     });
//     const { ok, latency_ms, provider } = resp.data;
//     const event = {
//       simulationId,
//       requestedModel: sim.primary,
//       usedModel: model,
//       wasFallback,
//       provider,
//       latency_ms,
//       ok,
//       at: Date.now()
//     };
//     log('interview.start', event);
//     res.json(event);
//   } catch (e) {
//     const status = e?.response?.status || 500;
//     warn('initiate failed', model, status);
//     res.status(status).json({ error: 'initiate_failed', details: e?.response?.data || e.message });
//   }
// });

// app.listen(PORT, () => log(`Node server on :${PORT} (python at ${PYTHON_BASE_URL})`));



import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { HealthRegistry } from './health.js';
import { SIM_CONFIGS } from './config.js';
import { log, warn } from './logger.js';

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PYTHON_BASE_URL = process.env.PYTHON_BASE_URL || 'http://localhost:8001';
const HEALTH_INTERVAL_MS = Number(process.env.HEALTH_INTERVAL_MS || 15000);
const HEALTH_MAX_MS = Number(process.env.HEALTH_MAX_MS || 3000);
const MODELS = (process.env.MODELS || 'gpt-4o-mini,claude-3-5-sonnet,gpt-4o').split(',');

const health = new HealthRegistry({ pythonBaseUrl: PYTHON_BASE_URL, maxOkMs: HEALTH_MAX_MS });

// initial and periodic probes
(async function initProbes() {
  await health.probeAll(MODELS);
  setInterval(() => health.probeAll(MODELS), HEALTH_INTERVAL_MS);
})();

app.get('/health', (req, res) => {
  const out = {};
  for (const m of MODELS) out[m] = health.get(m);
  res.json({ models: out, max_ok_ms: HEALTH_MAX_MS, checked_at: Date.now() });
});

app.post('/interviews/start', async (req, res) => {
  const { simulationId } = req.body || {};
  const sim = SIM_CONFIGS[simulationId];
  if (!sim) return res.status(400).json({ error: 'unknown simulationId' });

  // choose from current snapshot
  let pick = health.pickHealthy(sim.primary, sim.fallbacks);

  // if nothing, OR if primary was selected but cache is old, do a fresh probe
  const primaryHealth = health.get(sim.primary);
  const cacheAge = Date.now() - (primaryHealth.lastChecked || 0);
  
  if (!pick || (pick.model === sim.primary && cacheAge > 5000)) {  // ← Added staleness check
    await health.probeAll([sim.primary, ...sim.fallbacks]);
    pick = health.pickHealthy(sim.primary, sim.fallbacks);
  }
  
  if (!pick) return res.status(503).json({ error: 'no healthy models', tried: [sim.primary, ...sim.fallbacks] });

  const { model, wasFallback } = pick;
  try {
    const resp = await axios.post(`${PYTHON_BASE_URL}/initiate`, {
      model,
      prompt: sim.prompt,
      metadata: { simulationId }
    });
    const { ok, latency_ms, provider, initial_message } = resp.data;
    const event = {
      simulationId,
      requestedModel: sim.primary,
      usedModel: model,
      wasFallback,
      provider,
      latency_ms,
      ok,
      initial_message,
      at: Date.now()
    };
    log('interview.start', event);
    res.json(event);
  } catch (e) {
    const status = e?.response?.status || 500;
    warn('initiate failed', model, status);
    res.status(status).json({ error: 'initiate_failed', details: e?.response?.data || e.message });
  }
});


app.listen(PORT, () => log(`Node server on :${PORT} (python at ${PYTHON_BASE_URL})`));