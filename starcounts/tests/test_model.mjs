// Compare the browser count model (js/core.js + data/gaia_dr3_counts.js) with exact
// per-pixel counts from the full-resolution histograms (tests/ref_pixels.py).
//   node tests/test_model.mjs ref_pixels.json
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('../data/gaia_dr3_counts.js', import.meta.url), 'utf8'));
const C = require('../js/core.js');
const M = new C.CountModel(window.STARCOUNT_DATA);
const ref = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let worst = 0;
for (const cs of ref.cases) {
  M.prepareBand(cs.band);
  const rs = [];
  ref.pix.forEach((p, i) => {
    const exact = cs.n[i];
    if (exact < 30) return;                    // Poisson-irrelevant cells
    rs.push((M.cumulative(p, cs.m2) - M.cumulative(p, cs.m1)) / exact);
  });
  rs.sort((a, b) => a - b);
  const q = (f) => rs[Math.floor(f * (rs.length - 1))];
  const tail = Math.max(Math.abs(q(0.05) - 1), Math.abs(q(0.95) - 1));
  if (!['U', 'B', 'g'].includes(cs.band)) worst = Math.max(worst, tail);
  console.log(`${cs.band.padEnd(2)} ${cs.m1}-${cs.m2}`.padEnd(12), `n=${rs.length}  median ${q(0.5).toFixed(4)}  5-95% [${q(0.05).toFixed(3)}, ${q(0.95).toFixed(3)}]  min ${rs[0].toFixed(3)} max ${rs[rs.length - 1].toFixed(3)}`);
}
const ok = worst < 0.03;
console.log(ok ? `PASS: 5-95% model/exact within ${(100 * worst).toFixed(1)}% for G, r, R, V, i, z, BP` : `FAIL: tail ${(100 * worst).toFixed(1)}%`);
process.exit(ok ? 0 : 1);
