import axios from 'axios';
import { warn } from './logger.js';

export class HealthRegistry {
  constructor({ pythonBaseUrl, maxOkMs = 3000 }) {
    this.pythonBaseUrl = pythonBaseUrl;
    this.maxOkMs = maxOkMs;
    this.snapshot = new Map(); // model -> { ok, latency_ms, lastChecked }
  }
  get(model) {
    return this.snapshot.get(model) || { ok: false, latency_ms: null, lastChecked: null };
  }
  set(model, data) {
    this.snapshot.set(model, { ...data, lastChecked: Date.now() });
  }
  pickHealthy(primary, fallbacks = []) {
    const list = [primary, ...fallbacks];
    for (const m of list) {
      const s = this.get(m);
      if (s.ok && s.latency_ms !== null && s.latency_ms <= this.maxOkMs)
        return { model: m, wasFallback: m !== primary, s };
    }
    return null;
  }
  async probeOnce(model) {
    try {
      const res = await axios.get(`${this.pythonBaseUrl}/probe`, { params: { model } });
      const data = res.data;
      const ok = !!data.ok && typeof data.latency_ms === 'number' && data.latency_ms <= this.maxOkMs;
      this.set(model, { ok, latency_ms: data.latency_ms });
      return this.get(model);
    } catch (e) {
      warn('probe failed', model, e?.message);
      this.set(model, { ok: false, latency_ms: null });
      return this.get(model);
    }
  }
  async probeAll(models) {
    return Promise.all(models.map(m => this.probeOnce(m)));
  }
}
