import assert from 'node:assert/strict';
import fs from 'node:fs';
import { budgetFrontier, priceDifference, pricePosition, yearPricePairs, findModel } from '../src/engine.js';

const fallback = JSON.parse(fs.readFileSync(new URL('../data/fallback-models.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../data/model-catalog.json', import.meta.url), 'utf8'));

const kicks = findModel(fallback, 'Nissan Kicks');
assert.ok(kicks, 'Kicks should resolve');
assert.deepEqual(yearPricePairs(kicks).map(x=>x.year), [2019,2020,2021,2022]);

const frontier = budgetFrontier(fallback, catalog, 40, 'SUV', 5);
assert.ok(frontier.length >= 4, '40萬 SUV should have multiple fallback candidates');
assert.ok(frontier.every(x => x.price <= 42.00001), 'strict 5% stretch ceiling');

const d = priceDifference(41, 42.5);
assert.ok(Math.abs(d.pct + 3.5294117647) < 0.001);
assert.equal(pricePosition(d.pct).label, '接近估值基準');
assert.equal(pricePosition(-12).tone, 'good');
assert.equal(pricePosition(12).tone, 'bad');

console.log(`PASS: engine tests; ${frontier.length} budget-frontier candidates at 40萬 SUV.`);
