import { finiteNumber, modelLabel, yearPricePairs } from './engine.js';

// Scenario assumptions, not a fitted market model. Units: 萬 TWD and 萬 km.
export const MILEAGE_ASSUMPTIONS = Object.freeze({annualMileage:1.5, adjustmentPerWanKm:0.01, maxAdjustment:0.20});
const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'');
const round = value => Math.round((value + Number.EPSILON)*100)/100;
const metadata = (catalog,model) => catalog.find(x=>key(x.key)===key(modelLabel(model))||key(x.key)===key(model.slug));

export function mileageScenario(model, year, mileage, options={}) {
  const y=finiteNumber(year), km=finiteNumber(mileage);
  const asOfYear=options.asOfYear ?? new Date().getFullYear();
  const base=yearPricePairs(model).find(x=>x.year===y)?.price;
  const common={year:y,mileage:km,price:null,provenance:'Unknown',sampleSize:null,
    confidence:{level:'unknown',reason:'缺少年式價格或輸入無效'},
    demo:options.live!==true,source:options.live===true?'Carbook 外部年式基準':'本機示範資料',assumptions:[]};
  if (!Number.isInteger(y)||!Number.isInteger(asOfYear)||y<1990||y>asOfYear||km===null||km<0||km>100||!base) return common;
  const {annualMileage,adjustmentPerWanKm,maxAdjustment}=MILEAGE_ASSUMPTIONS;
  const referenceMileage=Math.max(0,asOfYear-y)*annualMileage;
  const adjustment=Math.max(-maxAdjustment,Math.min(maxAdjustment,(referenceMileage-km)*adjustmentPerWanKm));
  return {...common,price:round(base*(1+adjustment)),basePrice:base,referenceMileage,adjustment,
    provenance:'Derived',confidence:{level:'low',reason:'情境假設未以逐車里程樣本校準；配備與車況未知'},
    assumptions:[`以 ${asOfYear} 年計算車齡，假設每年 ${annualMileage} 萬 km`,
      '相對假設里程每差 1 萬 km 調整 1%，上限 ±20%',
      '年式基準的實際里程分布未知；不是同條件實車報價或成交紀錄']};
}

export function yearMileageMatrix(model, years, mileages, options={}) {
  return years.map(year=>({year,cells:mileages.map(mileage=>mileageScenario(model,year,mileage,options))}));
}

export function budgetFrontierV2(models,catalog,input,options={}) {
  const budget=finiteNumber(input.budget), stretch=finiteNumber(input.stretch ?? 5), mileage=finiteNumber(input.mileage);
  if (budget===null||budget<=0||stretch===null||stretch<0||stretch>100||mileage===null) return [];
  const ceiling=budget*(1+stretch/100), seen=new Set(), result=[];
  for(const model of models) {
    const meta=metadata(catalog,model), label=modelLabel(model);
    if (!meta||seen.has(key(label))||(input.segment&&input.segment!=='All'&&meta.segment!==input.segment)) continue;
    const scenarios=yearPricePairs(model).map(x=>mileageScenario(model,x.year,mileage,options)).filter(x=>x.price!==null);
    const best=scenarios.filter(x=>x.price<=ceiling+1e-8).sort((a,b)=>b.year-a.year||a.price-b.price)[0];
    if (!best) continue;
    seen.add(key(label));
    const next=scenarios.filter(x=>x.year>best.year).sort((a,b)=>a.year-b.year)[0];
    result.push({...best,model,meta,label,delta:round(best.price-budget),budgetBand:best.price<=budget?'within':'stretch',
      nextYear:next?.year ?? null,upgradeCost:next?round(next.price-best.price):null});
  }
  return result.sort((a,b)=>b.year-a.year||Math.abs(a.delta)-Math.abs(b.delta)||a.label.localeCompare(b.label));
}

export function comparableEngine(models,catalog,target,options={}) {
  const targetMeta=metadata(catalog,target.model), reference=mileageScenario(target.model,target.year,target.mileage,options);
  if (!targetMeta||reference.price===null) return [];
  const seen=new Set(), result=[];
  for(const model of models) {
    const meta=metadata(catalog,model),label=modelLabel(model);
    if (!meta||meta.segment!==targetMeta.segment) continue;
    for(const {year} of yearPricePairs(model)) {
      const id=`${key(label)}/${year}`;
      if (seen.has(id)||Math.abs(year-reference.year)>2||(key(label)===key(modelLabel(target.model))&&year===reference.year)) continue;
      const scenario=mileageScenario(model,year,target.mileage,options);
      if (scenario.price===null||Math.abs(scenario.price/reference.price-1)>0.25+1e-8) continue;
      seen.add(id);
      result.push({...scenario,model,meta,label,priceDelta:round(scenario.price-reference.price),
        matchReasons:[`同車身型式 ${meta.segment}`,'年式差 ≤2 年','同里程情境；估值差 ≤25%'],
        unknownFields:['等級／配備','事故／維修／車況','實際里程分布','逐車樣本數與去重','成交價格']});
    }
  }
  return result.sort((a,b)=>Math.abs(a.priceDelta)-Math.abs(b.priceDelta)||Math.abs(a.year-reference.year)-Math.abs(b.year-reference.year)||a.label.localeCompare(b.label)).slice(0,6);
}
