export function normalizeModelsPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.models)) return payload.models;
  if (Array.isArray(payload.data)) return payload.data;
  if (typeof payload === 'object') {
    const vals = Object.values(payload);
    if (vals.length && vals.every(v => v && typeof v === 'object')) return vals;
  }
  return [];
}

export function modelLabel(model) {
  return [model?.brand, model?.model].filter(Boolean).join(' ').trim() || model?.name || model?.slug || '未知車款';
}

export function findModel(models, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return models.find(m => modelLabel(m).toLowerCase() === q || String(m.slug || '').toLowerCase() === q)
    || models.find(m => modelLabel(m).toLowerCase().includes(q))
    || null;
}

export function yearPricePairs(model) {
  const raw = model?.year_prices_wan || model?.yearPrices || {};
  return Object.entries(raw)
    .map(([year, price]) => ({ year: finiteNumber(year), price: finiteNumber(price) }))
    .filter(x => Number.isFinite(x.year) && Number.isFinite(x.price) && x.price > 0)
    .sort((a,b) => a.year - b.year);
}

export function chooseBudgetYear(model, budgetWan, stretchPct = 5) {
  const ceiling = budgetWan * (1 + stretchPct / 100);
  const pairs = yearPricePairs(model).filter(x => x.price <= ceiling);
  if (!pairs.length) return null;
  return pairs.sort((a,b) => b.year - a.year || Math.abs(a.price-budgetWan)-Math.abs(b.price-budgetWan))[0];
}

function compactKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

export function budgetFrontier(models, catalog, budgetWan, segment='All', stretchPct=5) {
  const catalogMap = new Map(catalog.map(c => [compactKey(c.key), c]));
  const out = [];
  for (const model of models) {
    const label = modelLabel(model);
    const meta = catalogMap.get(compactKey(label)) || catalogMap.get(compactKey(model.slug));
    if (!meta) continue;
    if (segment !== 'All' && meta.segment !== segment) continue;
    const best = chooseBudgetYear(model, budgetWan, stretchPct);
    if (!best) continue;
    const dep = Number(model.annual_depreciation_pct ?? model.depreciation_pct ?? NaN);
    out.push({ model, meta, ...best, delta: best.price - budgetWan, depreciation: Number.isFinite(dep) ? dep : null });
  }
  return out.sort((a,b) => b.year-a.year || Math.abs(a.delta)-Math.abs(b.delta));
}

export function priceDifference(listingPrice, referencePrice) {
  const lp = finiteNumber(listingPrice), rp = finiteNumber(referencePrice);
  if (lp === null || rp === null || lp <= 0 || rp <= 0) return null;
  const diff = lp - rp;
  return { diff, pct: diff / rp * 100 };
}

export function pricePosition(pct) {
  if (!Number.isFinite(pct)) return {label:'資料不足', tone:'warn'};
  if (pct <= -10) return {label:'明顯低於估值基準', tone:'good'};
  if (pct <= -5) return {label:'低於估值基準', tone:'good'};
  if (pct < 5) return {label:'接近估值基準', tone:'good'};
  if (pct < 10) return {label:'高於估值基準', tone:'warn'};
  return {label:'明顯高於估值基準', tone:'bad'};
}

export function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatWan(value, digits=1) {
  const n = finiteNumber(value);
  return n !== null && n >= 0 ? `${n.toFixed(digits)}萬` : '—';
}

export function safeResidual(estimate) {
  const raw = estimate?.resale_forecast_wan || estimate?.residual || {};
  return ['1','3','5'].map(y => ({ years:Number(y), price:finiteNumber(raw[y]) })).filter(x => x.price !== null && x.price > 0);
}
