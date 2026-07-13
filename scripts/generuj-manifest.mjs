/* Vygeneruje data-manifest.json zo štruktúry zložky Dáta/<rok>/<Platforma>/*.csv
   Spustenie:  node scripts/generuj-manifest.mjs                                  */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const koren = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(koren, "Dáta");

const subory = {};
if (fs.existsSync(dataDir)) {
  for (const rok of fs.readdirSync(dataDir).sort()) {
    const rokDir = path.join(dataDir, rok);
    if (!fs.statSync(rokDir).isDirectory()) continue;
    for (const platforma of fs.readdirSync(rokDir).sort()) {
      const platDir = path.join(rokDir, platforma);
      if (!fs.statSync(platDir).isDirectory()) continue;
      const csv = fs.readdirSync(platDir)
        .filter(f => f.toLowerCase().endsWith(".csv"))
        .sort()
        .map(f => ["Dáta", rok, platforma, f].join("/"));
      if (!csv.length) continue;
      (subory[platforma] = subory[platforma] || []).push(...csv);
    }
  }
}

const manifest = { generovane: new Date().toISOString(), subory };
fs.writeFileSync(path.join(koren, "data-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const pocet = Object.values(subory).reduce((s, a) => s + a.length, 0);
console.log(`data-manifest.json aktualizovaný (${pocet} súborov: ${Object.entries(subory).map(([k, v]) => `${k} ${v.length}`).join(", ")})`);
