import { loadCarbookModels, loadFallbackModels, estimateCar } from './data-source.js';
import { findModel, modelLabel, yearPricePairs, priceDifference, pricePosition, formatWan, safeResidual, finiteNumber } from './engine.js';
import { budgetFrontierV2, yearMileageMatrix, comparableEngine } from './engine-v02.js';

const $ = id => document.getElementById(id);
const state = {models:[],catalog:[],source:'',live:false};
const options = () => ({live:state.live,asOfYear:new Date().getFullYear()});
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const badge = type => `<span class="evidence">${type}</span>`;
const positive = value => { const n=finiteNumber(value); return n!==null&&n>0?n:null; };
const valuation = value => `${formatWan(positive(value))} ${badge(positive(value)===null?'Unknown':'Derived')}`;
const sourceLabel = () => state.live?'Carbook 外部模型基準':'本機示範資料；非即時市場報價';
const assumptionNote = () => `<p class="assumption-note">Derived 情境：以 ${new Date().getFullYear()} 年計算車齡，假設每年 1.5 萬 km；相對假設里程每差 1 萬 km 調整 1%，上限 ±20%。此係數未經實際樣本校準，年式價格的里程分布未知。${escapeHtml(sourceLabel())}。這不是實車報價或成交紀錄。</p>`;
function empty(id,message) { $(id).innerHTML=`<div class="empty">${escapeHtml(message)}</div>`; }
function valid(ids) {
  return ids.every(id => { const el=$(id); if (!el.value.trim()) { el.focus(); return false; } return el.reportValidity(); });
}

async function boot() {
  const buttons=['runBudget','runModel','runListing'];
  buttons.forEach(id=>$(id).disabled=true);
  try {
    const response=await fetch('./data/model-catalog.json');
    if (!response.ok) throw new Error('車款分類無法載入');
    state.catalog=await response.json();
    try { Object.assign(state,await loadCarbookModels()); }
    catch { Object.assign(state,await loadFallbackModels()); }
    $('sourceStatus').textContent=state.live?'即時：Carbook 車書公開 API':'示範模式：外部 API 未連線';
    $('sourceStatus').className=`status-pill ${state.live?'status-live':'status-fallback'}`;
    $('modelList').innerHTML=state.models.slice().sort((a,b)=>modelLabel(a).localeCompare(modelLabel(b))).map(m=>`<option value="${escapeHtml(modelLabel(m))}"></option>`).join('');
    buttons.forEach(id=>$(id).disabled=false);
    runBudget();
  } catch {
    $('sourceStatus').textContent='Unknown：資料載入失敗';
    empty('frontierResults','資料無法載入，請重新整理後再試。');
  }
}
function setMode(mode) {
  document.querySelectorAll('.entry-card').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
  ['budget','model','listing'].forEach(name=>$(name+'Panel').classList.toggle('hidden',name!==mode));
}
document.querySelectorAll('.entry-card').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode)));

function runBudget() {
  if (!valid(['budgetInput','budgetMileage'])) return;
  const budget=Number($('budgetInput').value),segment=$('segmentInput').value,stretch=Number($('stretchInput').value),mileage=Number($('budgetMileage').value);
  const all=budgetFrontierV2(state.models,state.catalog,{budget,segment,stretch,mileage},options());
  const rows=all.slice(0,12);
  $('budgetSummary').innerHTML=`Budget Frontier V0.2 · 預算 <b>${budget} 萬</b> · ${mileage} 萬 km 情境 · 上浮 ${stretch}% · ${all.length} 個車款候選（顯示 ${rows.length} 個）。${assumptionNote()}`;
  $('frontierResults').innerHTML=rows.length?rows.map(row=>{
    const difference=row.delta<=0?`低於預算 ${formatWan(Math.abs(row.delta))}`:`超出預算 ${formatWan(row.delta)}`;
    return `<article class="car-card"><header><div><h4>${escapeHtml(row.label)}</h4><div class="brand">${escapeHtml(row.meta.segment)} · ${row.budgetBand==='within'?'預算內':'彈性區間'}</div></div><div class="price">${valuation(row.price)}</div></header>
      <div class="metric-grid"><div class="metric"><span>情境可觸及年式</span><b>${row.year}</b></div><div class="metric"><span>與預算差 · Derived</span><b>${difference}</b></div>
      <div class="metric"><span>下一個可用年式</span><b>${row.nextYear??'Unknown'}</b></div><div class="metric"><span>年式升級價差 · ${row.upgradeCost===null?'Unknown':'Derived'}</span><b>${row.upgradeCost===null?'—':(row.upgradeCost>=0?'+':'−')+formatWan(Math.abs(row.upgradeCost))}</b></div></div>
      <div class="source-line">${escapeHtml(row.source)} · 信心 low（未校準情境） · 樣本數 Unknown（未提供）</div></article>`;
  }).join(''):'<div class="empty">目前情境沒有符合預算的候選；可調整預算、里程或車型。</div>';
}
$('runBudget').addEventListener('click',runBudget);

function renderComparables(id,model,year,mileage) {
  const rows=comparableEngine(state.models,state.catalog,{model,year,mileage},options());
  $(id).className='comparison-section';
  $(id).innerHTML=`<h4>Comparable Engine V0.2</h4><p class="assumption-note">與 ${escapeHtml(modelLabel(model))} ${year} 年／${mileage} 萬 km 情境比較。以下 ${rows.length} 個是模型候選，並非逐車觀測樣本。差價比較同一套 Derived 情境，不混用外部即時估價。</p>${assumptionNote()}
    <div class="result-grid">${rows.length?rows.map(row=>`<article class="car-card"><h4>${escapeHtml(row.label)} · ${row.year}</h4><div>${valuation(row.price)}</div><div>相對情境價差 ${row.priceDelta>=0?'+':'−'}${formatWan(Math.abs(row.priceDelta))} ${badge('Derived')}</div>
    <div>${row.matchReasons.map(escapeHtml).join(' · ')}</div><div class="source-line">confidence: low（情境未校準）<br>sample size: Unknown（逐車配對樣本未提供）<br>Unknown：${row.unknownFields.map(escapeHtml).join('、')}<br>${escapeHtml(row.source)}</div></article>`).join(''):'<div class="empty">Unknown：缺少目標年式基準、車身分類，或沒有符合相近年式與價格條件的候選。</div>'}</div>`;
}
function renderMatrix(model,year,mileage) {
  const asOfYear=new Date().getFullYear();
  const years=[year-2,year-1,year,year+1,year+2].filter(y=>y>=1990&&y<=asOfYear);
  const mileages=[...new Set([0,5,10,15,mileage])].sort((a,b)=>a-b);
  const rows=yearMileageMatrix(model,years,mileages,options());
  $('yearMileageMatrix').className='comparison-section';
  $('yearMileageMatrix').innerHTML=`<h4>Year × Mileage Matrix</h4>${assumptionNote()}<div class="matrix-scroll"><table class="matrix-table"><caption>${escapeHtml(modelLabel(model))} · 單位：萬元；里程：萬 km · 信心 low／樣本數 Unknown</caption><thead><tr><th scope="col">年式</th>${mileages.map(km=>`<th scope="col">${km} 萬 km</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.year}</th>${row.cells.map(cell=>`<td>${formatWan(cell.price)}<small>${cell.provenance}${cell.demo?' · 示範':''}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

$('runModel').addEventListener('click',async()=>{
  if (!valid(['modelYear','modelMileage'])) return;
  const model=findModel(state.models,$('modelSearch').value),year=Number($('modelYear').value),mileage=Number($('modelMileage').value);
  $('yearMileageMatrix').innerHTML=''; $('modelComparables').innerHTML='';
  if (!model) return empty('modelOverview','找不到這個車款，請從下拉候選選擇。');
  if (year>new Date().getFullYear()) return empty('modelOverview','請輸入不晚於今年的年式。');
  renderMatrix(model,year,mileage); renderComparables('modelComparables',model,year,mileage);
  $('runModel').disabled=true;
  empty('modelOverview','正在查詢外部模型估值…');
  let estimate=null,note='';
  try { estimate=await estimateCar({model:modelLabel(model),year,mileage}); }
  catch { note='Unknown：即時估價 API 無法使用；年式基準與里程情境仍可比較。'; }
  finally { $('runModel').disabled=false; }
  const pairs=yearPricePairs(model),exact=pairs.find(x=>x.year===year),max=Math.max(1,...pairs.map(x=>x.price));
  const prices=estimate?.price_wan||{},residual=safeResidual(estimate);
  $('modelOverview').innerHTML=`<div class="overview-grid"><section class="kpi-panel"><h4>${escapeHtml(modelLabel(model))} · ${year} 年／${mileage} 萬 km</h4><div class="kpi-list">
    <div class="kpi"><span>年式基準（${escapeHtml(sourceLabel())}）</span><b>${valuation(exact?.price)}</b></div>
    ${[['外部建議交易估值（非成交紀錄）',prices.suggested_deal],['私人出售估值',prices.private_sell],['車行收購估值',prices.dealer_buy]].map(([label,p])=>`<div class="kpi"><span>${label}</span><b>${valuation(p)}</b></div>`).join('')}
    ${[1,3,5].map(y=>`<div class="kpi"><span>${y} 年後外部殘值基準</span><b>${valuation(residual.find(r=>r.years===y)?.price)}</b></div>`).join('')}</div>
    <p class="source-line">Carbook 外部估值為 Derived；缺值 Unknown。殘值的年式／里程調整方式未提供。${escapeHtml(note)}</p></section>
    <section class="chart-panel"><b>年式 × 行情基準 · Derived</b><div class="year-bars">${pairs.slice(-12).map(x=>`<div class="year-bar"><b>${x.year}</b><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,x.price/max*100)}%"></div></div><span>${formatWan(x.price)}</span></div>`).join('')||'<p>Unknown：缺少年式價格</p>'}</div><p class="source-line">${escapeHtml(sourceLabel())}；未針對輸入里程調整。</p></section></div>`;
});

$('runListing').addEventListener('click',async()=>{
  if (!valid(['listingYear','listingMileage','listingPrice'])) return;
  const model=findModel(state.models,$('listingModel').value),year=Number($('listingYear').value),mileage=Number($('listingMileage').value),listing=Number($('listingPrice').value);
  $('listingComparables').innerHTML='';
  if (!model) return empty('listingResult','找不到這個車款，請從下拉候選選擇。');
  if (year>new Date().getFullYear()) return empty('listingResult','請輸入不晚於今年的年式。');
  renderComparables('listingComparables',model,year,mileage);
  $('runListing').disabled=true;
  empty('listingResult','正在比較價格…');
  try {
    const estimate=await estimateCar({model:modelLabel(model),year,mileage}),prices=estimate?.price_wan||{};
    const reference=positive(prices.suggested_deal)??positive(prices.private_sell)??positive(prices.market);
    const diff=priceDifference(listing,reference),pos=pricePosition(diff?.pct),residual=safeResidual(estimate);
    $('listingResult').innerHTML=`<div class="price-position ${pos.tone}"><h4>${escapeHtml(pos.label)}</h4>
      <p>${escapeHtml(modelLabel(model))} · ${year} 年／${mileage} 萬 km<br>使用者輸入刊登價 <b>${formatWan(listing)}</b> ${badge('Observed')}（未查證，非成交價）；Carbook 外部估值基準 <b>${valuation(reference)}</b>。
      ${diff?`價差 ${diff.diff>=0?'+':'−'}${formatWan(Math.abs(diff.diff))}（${diff.pct>=0?'+':''}${diff.pct.toFixed(1)}%）${badge('Derived')}`:'Unknown：無有效估值，無法判定價差。'}</p>
      <div class="metric-grid">${[['車行收購估值',prices.dealer_buy],['私人出售估值',prices.private_sell],...[1,3,5].map(y=>[`${y} 年後外部殘值基準`,residual.find(r=>r.years===y)?.price])].map(([label,p])=>`<div class="metric"><span>${label}</span><b>${valuation(p)}</b></div>`).join('')}</div>
      <p class="source-line">外部估值非成交保證。事故、泡水、維修、配備與實際車況均為 Unknown；殘值的年式／里程調整方式未提供。</p></div>`;
  } catch { empty('listingResult','Unknown：即時估價 API 暫時無法使用。刊登價未與即時基準完成比較；下方僅提供獨立 Derived 情境候選。'); }
  finally { $('runListing').disabled=false; }
});
boot();
