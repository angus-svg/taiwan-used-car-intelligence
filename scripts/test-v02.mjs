import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as v2 from '../src/engine-v02.js';
import { formatWan, priceDifference, safeResidual } from '../src/engine.js';
import { estimateCar } from '../src/data-source.js';

const models = [
  {brand:'A',model:'One',listings:999,year_prices_wan:{2020:40,2021:44,2022:50}},
  {brand:'B',model:'Two',year_prices_wan:{2020:38,2021:42,2022:46}},
  {brand:'C',model:'Sedan',year_prices_wan:{2021:39}},
];
const catalog = [{key:'A One',segment:'SUV'},{key:'B Two',segment:'SUV'},{key:'C Sedan',segment:'Sedan'}];
const options = {asOfYear:2026,live:true};

test('matrix uses explicit bounded mileage assumptions, never observed transactions', () => {
  const matrix=v2.yearMileageMatrix(models[0],[2020,2021],[0,9,100],options);
  assert.equal(matrix.length,2);
  assert.equal(matrix[0].cells.length,3);
  assert.equal(matrix[0].cells[1].price,40);
  assert.equal(matrix[0].cells[0].price,43.6);
  assert.equal(matrix[0].cells[2].price,32);
  assert.equal(matrix[0].cells[0].provenance,'Derived');
  assert.equal(matrix[0].cells[0].sampleSize,null);
  assert.equal(matrix[0].cells[0].confidence.level,'low');
  assert.ok(matrix[0].cells[0].assumptions.length);
});
test('missing year is Unknown, never substituted with a nearby year', () => {
  const cell=v2.mileageScenario(models[0],2019,5,options);
  assert.equal(cell.price,null);
  assert.equal(cell.provenance,'Unknown');
});
test('boolean and blank baseline prices cannot become numeric valuations', () => {
  for(const value of [null,'',true,false,-1,0]) {
    assert.equal(v2.mileageScenario({year_prices_wan:{2020:value}},2020,5,options).price,null);
  }
});
test('external estimates keep zero mileage and terminate stalled requests', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async(url,{signal})=>{
      assert.equal(new URL(url).searchParams.get('mileage'),'0');
      assert.ok(signal,'an abort signal must bound every estimate request');
      return {ok:true,json:async()=>({price_wan:{suggested_deal:40}})};
    };
    assert.equal((await estimateCar({model:'A One',year:2020,mileage:0})).price_wan.suggested_deal,40);
    globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
    await assert.rejects(estimateCar({model:'A One',year:2020,mileage:5},{timeoutMs:5}),/aborted/);
  } finally { globalThis.fetch=original; }
});
test('invalid inputs are Unknown and zero mileage is valid', () => {
  for(const value of [null,'',undefined,-1,Infinity,'no',true,[]]) {
    assert.equal(v2.mileageScenario(models[0],2020,value,options).price,null);
  }
  assert.equal(v2.mileageScenario(models[0],2027,5,options).price,null);
  assert.equal(v2.mileageScenario(models[0],2020.5,5,options).price,null);
  assert.ok(v2.mileageScenario(models[0],2020,0,options).price>0);
});
test('fallback is clearly demo Derived, with no fabricated statistical sample', () => {
  const cell=v2.mileageScenario(models[0],2020,5,{...options,live:false});
  assert.equal(cell.provenance,'Derived');
  assert.equal(cell.demo,true);
  assert.equal(cell.sampleSize,null);
  assert.match(cell.source,/示範/);
});
test('frontier honors strict and stretched ceilings after mileage adjustment', () => {
  const strict=v2.budgetFrontierV2(models,catalog,{budget:40,segment:'SUV',stretch:0,mileage:9},options);
  assert.ok(strict.length);
  assert.ok(strict.every(x=>x.price<=40&&x.budgetBand==='within'));
  const stretch=v2.budgetFrontierV2(models,catalog,{budget:40,segment:'SUV',stretch:5,mileage:9},options);
  assert.ok(stretch.every(x=>x.price<=42));
  assert.ok(stretch.some(x=>x.budgetBand==='stretch'));
  assert.ok(stretch.every(x=>x.meta.segment==='SUV'));
  assert.equal(new Set(stretch.map(x=>x.label)).size,stretch.length);
});
test('frontier rejects invalid budgets and stretch, and keeps nearest upgrade visible', () => {
  for(const budget of [null,'',0,-1,NaN]) assert.deepEqual(v2.budgetFrontierV2(models,catalog,{budget,segment:'SUV',stretch:0,mileage:9},options),[]);
  assert.deepEqual(v2.budgetFrontierV2(models,catalog,{budget:40,stretch:-1,mileage:9},options),[]);
  const row=v2.budgetFrontierV2(models,catalog,{budget:40,segment:'SUV',stretch:0,mileage:9},options).find(x=>x.label==='A One');
  assert.equal(row.year,2020);
  assert.equal(row.nextYear,2021);
  assert.ok(row.upgradeCost>0);
});
test('comparables are matched peers, exclude self and expose confidence/sample size', () => {
  const result=v2.comparableEngine(models,catalog,{model:models[0],year:2021,mileage:5},options);
  assert.ok(result.length);
  assert.ok(result.every(x=>x.meta.segment==='SUV'&&Math.abs(x.year-2021)<=2));
  assert.ok(result.every(x=>!(x.label==='A One'&&x.year===2021)));
  assert.ok(result.every(x=>x.sampleSize===null&&x.confidence.level==='low'));
  assert.ok(result.every(x=>x.provenance==='Derived'&&Number.isFinite(x.priceDelta)));
  assert.ok(result.every(x=>x.matchReasons.length));
});
test('comparables reject missing target price or segment and do not duplicate candidates', () => {
  assert.deepEqual(v2.comparableEngine(models,[],{model:models[0],year:2021,mileage:5},options),[]);
  assert.deepEqual(v2.comparableEngine(models,catalog,{model:models[0],year:2019,mileage:5},options),[]);
  const rows=v2.comparableEngine([...models,models[1]],catalog,{model:models[0],year:2021,mileage:5},options);
  assert.equal(rows.length,new Set(rows.map(x=>`${x.label}/${x.year}`)).size);
});
test('unknown numeric values never become zero-price or zero-residual facts', () => {
  for(const value of [null,'',undefined,NaN]) {
    assert.equal(formatWan(value),'—');
    assert.equal(priceDifference(value,40),null);
  }
  assert.equal(priceDifference(-1,40),null);
  assert.deepEqual(safeResidual({resale_forecast_wan:{1:null,3:'',5:-1}}),[]);
});
test('all three existing entry modes stay present with the new inline results', () => {
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.deepEqual([...html.matchAll(/class="entry-card[^"\n]*" data-mode="([^"]+)"/g)].map(x=>x[1]),['budget','model','listing']);
  for(const id of ['budgetMileage','yearMileageMatrix','modelComparables','listingComparables']) assert.ok(html.includes(`id="${id}"`),id);
});
