// Numbers quoted in README "Accuracy": v1 vs Gaia densities, and the MUST guider
// star-count table (RD-008 / MUST_Guider_Sensor_Review section 6.3) recomputed with Gaia DR3.
//   node tests/report_numbers.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('../data/gaia_dr3_counts.js', import.meta.url), 'utf8'));
const C = require('../js/core.js');
const M = new C.CountModel(window.STARCOUNT_DATA);
const at = (band, m1, m2, l, b) => M.densityAt(M.densityMap(band, m1, m2), l, b);      // per arcmin^2

console.log('Cumulative density per deg^2 at the NGP (Gaia v2 | v1 analytic):');
for (const [band, m] of [['G', 17], ['G', 19], ['G', 20], ['r', 17], ['r', 19], ['r', 20], ['Rc', 17], ['Rc', 18.5]]) {
  console.log(`  ${band} < ${m}: ${(at(band, 0, m, 0, 90) * 3600).toFixed(0)} | ${(C.V1.inWindow(band, 0, m, 0, 90) * 3600).toFixed(0)}`);
}

const A = (2048 * 15 / 116.87 / 60) * (2064 * 15 / 116.87 / 60);
console.log(`\nMUST CCD230-42 full frame (${A.toFixed(1)} arcmin^2), r 17-19, stars per sensor (Gaia | v1 | v1/Gaia):`);
for (const [n, l, b] of [['NGP', 0, 90], ['l180 b60', 180, 60], ['l180 b30', 180, 30], ['l180 b20', 180, 20], ['l90 b20', 90, 20], ['l0 b20', 0, 20], ['l180 b10', 180, 10], ['l0 b10', 0, 10]]) {
  const g = at('r', 17, 19, l, b) * A, v = C.V1.inWindow('r', 17, 19, l, b) * A;
  console.log(`  ${n.padEnd(9)} ${g.toFixed(2).padStart(7)} | ${v.toFixed(2).padStart(7)} | ${(v / g).toFixed(2)}`);
}

console.log('\nRD-008 check (Rc, cumulative, pole = |b|>80 median over longitude; b=30/20 median at that |b|):');
const ring = (band, m1, m2, b0) => {
  const d = M.densityMap(band, m1, m2), xs = [];
  for (let p = 0; p < M.npix; p++) { const ab = Math.abs(M.gb[p]); if (b0 === 90 ? ab >= 80 : Math.abs(ab - b0) <= 2) xs.push(d[p]); }
  xs.sort((a, b) => a - b); return xs[xs.length >> 1];
};
for (const [lim, b0] of [[17, 90], [17, 30], [17, 20], [18.5, 90], [19, 90]]) console.log(`  R < ${lim} at |b| ${b0}: ${ring('Rc', 0, lim, b0).toFixed(3)} /arcmin^2`);
console.log('\n  area   |b|   R<   lambda  P(>=1)  P(>=3)  P(all 6 >=1)  P(>=3 of 6 lit)');
for (const [area, b0, lim] of [[15.3, 90, 17], [15.3, 30, 17], [15.3, 20, 17], [25, 90, 17], [25, 30, 17], [15.3, 90, 18.5], [25, 90, 18.5], [19.4, 90, 18.5]]) {
  const lam = ring('Rc', 0, lim, b0) * area, p1 = C.poissonTail(1, lam), p3 = C.poissonTail(3, lam);
  console.log(`  ${String(area).padEnd(6)} ${String(b0).padEnd(4)} ${String(lim).padEnd(5)} ${lam.toFixed(2).padStart(6)}  ${(100 * p1).toFixed(0).padStart(5)}%  ${(100 * p3).toFixed(0).padStart(5)}%  ${(100 * p1 ** 6).toFixed(0).padStart(10)}%  ${(100 * C.binomTail(3, 6, p1)).toFixed(0).padStart(12)}%`);
}
