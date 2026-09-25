import fs from 'node:fs';
const required = ['index.html','styles.css','src/app.js','src/engine.js','src/engine-v02.js','src/data-source.js','data/model-catalog.json','data/fallback-models.json'];
let ok = true;
for (const file of required) {
  if (!fs.existsSync(new URL(`../${file}`, import.meta.url))) { console.error(`MISSING ${file}`); ok = false; }
}
const catalog = JSON.parse(fs.readFileSync(new URL('../data/model-catalog.json', import.meta.url),'utf8'));
const fallback = JSON.parse(fs.readFileSync(new URL('../data/fallback-models.json', import.meta.url),'utf8'));
const keys = new Set(catalog.map(x=>x.key.toLowerCase()));
const uncovered = fallback.filter(x=>!keys.has(`${x.brand} ${x.model}`.toLowerCase()));
if (uncovered.length) { console.error('Fallback models missing catalog mapping:', uncovered.map(x=>`${x.brand} ${x.model}`)); ok=false; }
if (!ok) process.exit(1);
console.log(`PASS: ${required.length} core files; ${catalog.length} catalog entries; ${fallback.length} fallback models.`);
