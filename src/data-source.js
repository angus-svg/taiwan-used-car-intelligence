import { normalizeModelsPayload } from './engine.js';

const CARBOOK_MODELS = 'https://carbook.tw/api/v1/models.json';
const CARBOOK_ESTIMATE = 'https://carbook.tw/api/v1/estimate';

export async function loadCarbookModels() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(CARBOOK_MODELS, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const models = normalizeModelsPayload(payload);
    if (!models.length) throw new Error('API 回應格式無可用車款');
    return { models, source: 'Carbook 車書公開 API', live: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadFallbackModels() {
  const res = await fetch('./data/fallback-models.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Fallback data unavailable');
  return { models: await res.json(), source: '本機示範資料', live: false };
}

export async function estimateCar({ model, year, mileage, condition='normal' }) {
  const url = new URL(CARBOOK_ESTIMATE);
  url.searchParams.set('model', model);
  if (year) url.searchParams.set('year', year);
  if (mileage !== '' && mileage != null) url.searchParams.set('mileage', mileage);
  url.searchParams.set('cond', condition);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`估價 API HTTP ${res.status}`);
  return res.json();
}
