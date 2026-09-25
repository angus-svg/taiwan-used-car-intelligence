import { loadCarbookModels, loadFallbackModels, estimateCar } from './data-source.js';
import { budgetFrontier, findModel, modelLabel, yearPricePairs, priceDifference, pricePosition, formatWan, safeResidual } from './engine.js';

const $ = (id) => document.getElementById(id);
const state = { models: [], catalog: [], source: '', live: false };

async function loadCatalog() {
  const r = await fetch('./data/model-catalog.json');
  state.catalog = await r.json();
}

async function boot() {
  await loadCatalog();
  try {
    const data = await loadCarbookModels();
    Object.assign(state, data);
    $('sourceStatus').textContent = `即時：${data.source}`;
    $('sourceStatus').className = 'status-pill status-live';
  } catch (err) {
    const data = await loadFallbackModels();
    Object.assign(state, data);
    $('sourceStatus').textContent = '示範模式：外部 API 未連線';
    $('sourceStatus').className = 'status-pill status-fallback';
    console.warn(err);
  }
  populateModels();
  runBudget();
}

function populateModels() {
  const list = $('modelList');
  list.innerHTML = state.models.slice().sort((a,b)=>modelLabel(a).localeCompare(modelLabel(b))).map(m => `<option value="${escapeHtml(modelLabel(m))}"></option>`).join('');
}

function setMode(mode) {
  document.querySelectorAll('.entry-card').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  $('budgetPanel').classList.toggle('hidden', mode !== 'budget');
  $('modelPanel').classList.toggle('hidden', mode !== 'model');
  $('listingPanel').classList.toggle('hidden', mode !== 'listing');
}

document.querySelectorAll('.entry-card').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

function runBudget() {
  const budget = Number($('budgetInput').value || 40);
  const segment = $('segmentInput').value;
  const stretch = Number($('stretchInput').value || 0);
  const rows = budgetFrontier(state.models, state.catalog, budget, segment, stretch).slice(0, 12);
  $('budgetSummary').innerHTML = `預算 <b>${budget} 萬</b> · ${segment === 'All' ? '不限車型' : segment} · 上浮 ${stretch}% · 找到 <b>${rows.length}</b> 個可比較車款。<br><small>此頁比較的是車款／年式的市場基準，不是特定單一實車。</small>`;
  $('frontierResults').innerHTML = rows.length ? rows.map(renderFrontierCard).join('') : `<div class="empty">目前資料中找不到符合預算的候選。可增加預算彈性或切換車身型式。</div>`;
}

function renderFrontierCard(row) {
  const { model, meta, year, price, delta, depreciation } = row;
  const direction = delta <= 0 ? `低於預算 ${Math.abs(delta).toFixed(1)}萬` : `超出預算 ${delta.toFixed(1)}萬`;
  return `<article class="car-card">
    <header><div><h4>${escapeHtml(modelLabel(model))}</h4><div class="brand">${escapeHtml(meta.segment)} · ${escapeHtml(meta.size || '未分類')}</div></div><div class="price">${price.toFixed(1)}<small> 萬</small></div></header>
    <div class="metric-grid">
      <div class="metric"><span>預算可觸及年式</span><b>${year}</b></div>
      <div class="metric"><span>與預算差</span><b>${direction}</b></div>
      <div class="metric"><span>年均折舊基準</span><b>${depreciation == null ? '—' : depreciation.toFixed(1)+'%'}</b></div>
      <div class="metric"><span>比較定位</span><b>${escapeHtml(meta.tradeoff || '同價位比較')}</b></div>
    </div>
    <div class="tag-row">${(meta.tags||[]).slice(0,4).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    <div class="source-line">${state.live ? '即時外部基準：Carbook 車書公開 API' : '示範資料：請勿視為即時市場報價'}</div>
  </article>`;
}

$('runBudget').addEventListener('click', runBudget);

$('runModel').addEventListener('click', async () => {
  const query = $('modelSearch').value;
  const year = Number($('modelYear').value);
  const mileage = Number($('modelMileage').value);
  const model = findModel(state.models, query);
  if (!model) return showModelError('找不到這個車款，請從下拉候選選擇。');
  const pairs = yearPricePairs(model);
  let estimate = null, estimateError = '';
  try { estimate = await estimateCar({model:modelLabel(model), year, mileage}); }
  catch (e) { estimateError = '即時估價 API 暫時無法使用；仍顯示年式行情基準。'; }
  renderModelOverview(model, pairs, estimate, estimateError);
});

function showModelError(msg) { $('modelOverview').innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`; }

function renderModelOverview(model, pairs, estimate, note='') {
  const selectedYear = Number($('modelYear').value);
  const closest = pairs.find(x=>x.year===selectedYear) || pairs.slice().sort((a,b)=>Math.abs(a.year-selectedYear)-Math.abs(b.year-selectedYear))[0];
  const prices = pairs.map(x=>x.price); const max = prices.length ? Math.max(...prices) : 1;
  const bars = pairs.slice(-12).map(x=>`<div class="year-bar"><b>${x.year}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,x.price/max*100)}%"></div></div><span>${x.price.toFixed(1)}萬</span></div>`).join('');
  const p = estimate?.price_wan || {};
  const residual = safeResidual(estimate);
  $('modelOverview').innerHTML = `<div class="overview-grid">
    <section class="kpi-panel"><h4>${escapeHtml(modelLabel(model))}</h4><div class="kpi-list">
      <div class="kpi"><span>${selectedYear} 年式市場基準</span><b>${closest ? formatWan(closest.price) : '—'}</b></div>
      <div class="kpi"><span>建議成交估值</span><b>${formatWan(p.suggested_deal)}</b></div>
      <div class="kpi"><span>私人出售估值</span><b>${formatWan(p.private_sell)}</b></div>
      <div class="kpi"><span>車行收購估值</span><b>${formatWan(p.dealer_buy)}</b></div>
      ${residual.map(r=>`<div class="kpi"><span>${r.years} 年後殘值</span><b>${formatWan(r.price)}</b></div>`).join('')}
    </div>${note ? `<p class="source-line">${escapeHtml(note)}</p>`:''}</section>
    <section class="chart-panel"><b>年式 × 行情基準</b><div class="year-bars">${bars || '<div class="empty">沒有年式價格資料</div>'}</div></section>
  </div>`;
}

$('runListing').addEventListener('click', async () => {
  const query = $('listingModel').value;
  const model = findModel(state.models, query);
  if (!model) { $('listingResult').innerHTML='<div class="empty">找不到這個車款，請從下拉候選選擇。</div>'; return; }
  const year = Number($('listingYear').value), mileage=Number($('listingMileage').value), listing=Number($('listingPrice').value);
  $('listingResult').innerHTML='<div class="summary-strip">正在比較價格…</div>';
  try {
    const estimate = await estimateCar({model:modelLabel(model), year, mileage});
    const p = estimate?.price_wan || {};
    const ref = Number(p.suggested_deal || p.private_sell || p.market);
    const diff = priceDifference(listing, ref);
    const pos = pricePosition(diff?.pct);
    const residual = safeResidual(estimate);
    $('listingResult').innerHTML = `<div class="price-position ${pos.tone}">
      <h4>${escapeHtml(pos.label)}</h4>
      <p>刊登價 <b>${formatWan(listing)}</b>；估值基準 <b>${formatWan(ref)}</b>${diff ? `；價差 <b>${diff.diff>=0?'+':''}${diff.diff.toFixed(1)}萬（${diff.pct>=0?'+':''}${diff.pct.toFixed(1)}%）</b>`:''}。</p>
      <div class="metric-grid" style="margin-top:14px">
        <div class="metric"><span>車行收購估值</span><b>${formatWan(p.dealer_buy)}</b></div>
        <div class="metric"><span>私人出售估值</span><b>${formatWan(p.private_sell)}</b></div>
        ${residual.map(r=>`<div class="metric"><span>${r.years}年後殘值基準</span><b>${formatWan(r.price)}</b></div>`).join('')}
      </div>
      <p class="source-line">價格位置只比較外部模型估值；不代表事故、泡水、維修紀錄、配備與實際車況已驗證。</p>
    </div>`;
  } catch (e) {
    $('listingResult').innerHTML='<div class="empty">即時估價 API 暫時無法使用。請稍後重試；本頁不會用示範數字假裝即時估值。</div>';
  }
});

function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

boot();
