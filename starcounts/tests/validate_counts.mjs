// Validate the binned Gaia table model against star-by-star counts.
// For each position, all Gaia DR3 stars in a cone are fetched from the GAVO TAP
// mirror, converted to each band individually (same G - X relations), and counted
// in magnitude windows; the model density at the cone centre x cone area is the
// prediction. The G band is the spatial control: band/G ratios isolate the colour
// machinery (class binning, reddening offsets) from cone-vs-pixel area effects.
//   node tests/validate_counts.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('../data/gaia_dr3_counts.js', import.meta.url), 'utf8'));
const C = require('../js/core.js');
const model = new C.CountModel(window.STARCOUNT_DATA);

// Cone radii: small at low latitude to keep row counts modest. VALIDATE_RADIUS overrides
// them (e.g. 1.0 for pixel-sized cones, which separates dust structure on scales below
// the 1.8-deg table pixels from errors of the colour machinery).
const RAD = process.env.VALIDATE_RADIUS ? +process.env.VALIDATE_RADIUS : null;
const GMAX = process.env.VALIDATE_GMAX || '21.5';
const ONLY_LOW = !!process.env.VALIDATE_LOW;
const FIELDS = [
  ['NGP', 0, 90, 1.0], ['l180 b+60', 180, 60, 1.0], ['l180 b+30', 180, 30, 0.7], ['l90 b+20', 90, 20, 0.5],
  ['l0 b+20', 0, 20, 0.35], ['l180 b-10', 180, -10, 0.35], ['l300 b-15', 300, -15, 0.3], ['l30 b+5', 30, 5, 0.12],
].filter((f) => !ONLY_LOW || Math.abs(f[2]) <= 20).map((f) => (RAD ? [f[0], f[1], f[2], RAD] : f));
const BANDS = [['G', 15, 19], ['r', 15, 19], ['r', 17, 19.5], ['V', 15, 19], ['g', 15, 19], ['i', 15, 19], ['z', 15, 19], ['B', 15, 19], ['U', 14, 18]];

async function cone(ra, dec, rad) {
  const sql = `SELECT phot_g_mean_mag AS g, phot_bp_mean_mag AS bp, phot_rp_mean_mag AS rp FROM gaia.dr3lite ` +
    `WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, ${rad})) AND phot_g_mean_mag < ${GMAX}`;
  const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', MAXREC: '400000', QUERY: sql });
  const r = await fetch('https://dc.g-vo.org/tap/sync', { method: 'POST', body });
  const t = await r.text();
  if (!r.ok || t.startsWith('<')) throw new Error(t.slice(0, 300));
  return t.trim().split('\n').slice(1).map((s) => s.split(',').map((x) => (x === '' ? null : +x)));
}

const out = [];
for (const [name, l, b, rad] of FIELDS) {
  const [ra, dec] = C.galToEq(l, b);
  const rows = await cone(ra.toFixed(5), dec.toFixed(5), rad);
  const areaArcmin2 = 2 * Math.PI * (1 - Math.cos(rad * C.DEG)) * (180 / Math.PI) ** 2 * 3600;
  const res = { name, n: rows.length };
  for (const [band, m1, m2] of BANDS) {
    let obs = 0;
    for (const [g, bp, rp] of rows) {
      let m = model.toBand(band, g, bp, rp);
      if (m == null) m = g - model.bandOffset(band, 1.0);      // no colour: median colour
      if (m >= m1 && m < m2) obs++;
    }
    const dens = model.densityMap(band, m1, m2);
    const pred = model.densityAt(dens, l, b) * areaArcmin2;
    res[`${band} ${m1}-${m2}`] = { obs, pred: +pred.toFixed(1), ratio: +(pred / obs).toFixed(3) };
  }
  out.push(res);
  const g = res['G 15-19'].ratio;
  console.log(name.padEnd(11), `stars=${String(rows.length).padStart(6)}`,
    BANDS.map(([bd, m1, m2]) => { const q = res[`${bd} ${m1}-${m2}`]; return `${bd}${m1}-${m2}: ${q.obs}/${q.pred.toFixed(0)} (${(q.ratio / g).toFixed(3)})`; }).join('  '));
}
// summary: colour machinery error = band ratio relative to the G control
const rel = [];
for (const r of out) for (const [bd, m1, m2] of BANDS.slice(1)) rel.push([bd, r[`${bd} ${m1}-${m2}`].ratio / r['G 15-19'].ratio]);
const byBand = {};
for (const [bd, x] of rel) (byBand[bd] ||= []).push(x);
console.log('\nmodel/observed relative to G control (mean, max |dev|):');
for (const [bd, xs] of Object.entries(byBand)) {
  const mean = xs.reduce((a, c) => a + c, 0) / xs.length, dev = Math.max(...xs.map((x) => Math.abs(x - 1)));
  console.log(`  ${bd}: ${mean.toFixed(3)}  max ${(100 * dev).toFixed(1)}%`);
}
console.log('G control ratios (cone vs interpolated pixels):', out.map((r) => r['G 15-19'].ratio).join(', '));
