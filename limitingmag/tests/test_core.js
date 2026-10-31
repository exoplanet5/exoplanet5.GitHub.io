// Node tests of js/core.js: geometry vs a brute-force reference, Rubin SMTN-002 m5,
// three-mode round trips, noise-regime scaling laws, and edge cases.
//   node tests/test_core.js
const C = require('../js/core.js');
const BANDS = require('../js/bands.js');
const REF = require('./ref_geometry.json');

let fails = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { fails++; console.log('FAIL', msg); } };
const close = (a, b, tol) => Math.abs(a - b) <= tol;

const PIX_1AS = 1e6 / C.ARCSEC_PER_RAD;   // with D = 1 m, f/1 this pixel is 1″
const base = (over) => Object.assign({
  band: BANDS.Johnson_V, tpMode: 'components', D: 0.3, obsc: 0, fNum: 5, topt: 0.5, qe: 0.8,
  pix: 3.76, dark: 0.0022, rn: 1.2, fullWell: 51400, sky: 21.72, k: 0.153, elev: 40, fwhm: 5,
  scaleSky: true, scaleSeeing: false, psf: 'moffat', beta: 4.765, phot: 'psf', apR: 1, rate: 0, zp: 25,
}, over || {});

// ---- 1. geometry vs tests/ref_geometry.py (16× supersampled brute force)
for (const c of REF) {
  const p = base({ D: 1, fNum: 1, pix: PIX_1AS, fwhm: c.fwhm, scaleSky: false, scaleSeeing: false, psf: c.profile, beta: c.beta, apR: c.apR });
  const gp = C.geometry(C.prepare(Object.assign({}, p, { phot: 'psf' })), c.L);
  const ga = C.geometry(C.prepare(Object.assign({}, p, { phot: 'aper' })), c.L);
  const tag = `${c.profile} β=${c.beta} FWHM=${c.fwhm}px L=${c.L}px`;
  const neaTol = c.fwhm < 1 ? 0.08 : c.profile === 'gauss' ? 0.005 : 0.03;
  check(Math.abs(gp.nPix / c.nea - 1) < neaTol, `NEA ${tag}: ${gp.nPix} vs ${c.nea}`);
  check(Math.abs(gp.peakFrac / c.peak - 1) < (c.profile === 'gauss' ? 0.02 : 0.05), `peak ${tag}: ${gp.peakFrac} vs ${c.peak}`);
  check(close(ga.fSrc, c.fap, 0.008), `aperture fraction ${tag}: ${ga.fSrc} vs ${c.fap}`);
}

// ---- 2. Rubin SMTN-002 (2026-08-12): m5 for a 1 × 30 s visit, dark sky, zenith, FWHM_eff, Gaussian NEA
const SMTN = { u: [23.70, 0.92], g: [24.97, 0.87], r: [24.52, 0.83], i: [24.13, 0.80], z: [23.56, 0.78], y: [22.55, 0.76] };
const ZP = { u: 26.52, g: 28.51, r: 28.36, i: 28.17, z: 27.78, y: 26.82 };
const rubinRows = [];
for (const b of 'ugrizy') {
  const band = BANDS['LSST_' + b];
  check(close(band.zpRubin, ZP[b], 0.01), `Rubin zero point ${b}: ${band.zpRubin} vs ${ZP[b]}`);
  const m = C.prepare(base({ band, tpMode: 'zp', zp: band.zpRubin, D: 8.36, obsc: 0.64, fNum: 1.2336, pix: 10,
    dark: 0.2, rn: 8.8, sky: band.sky, k: band.k, elev: 90, fwhm: SMTN[b][1], psf: 'gauss' }));
  const r = C.solveMag(m, 30, 1, 5);
  rubinRows.push(`${b} ${r.mag.toFixed(3)} (SMTN-002 ${SMTN[b][0].toFixed(2)}, Δ ${(r.mag - SMTN[b][0]).toFixed(3)})`);
  check(close(r.mag, SMTN[b][0], 0.03), `Rubin m5 ${b}: ${r.mag} vs ${SMTN[b][0]}`);
}
console.log('Rubin m5, 1×30 s:', rubinRows.join(' · '));

// ---- 3. three-mode round trips on randomised systems (incl. trailing, apertures, zero-point mode)
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const bandKeys = Object.keys(BANDS);
let worstSnr = 0, worstT = 0;
for (let i = 0; i < 400; i++) {
  const p = base({
    band: BANDS[bandKeys[Math.floor(rnd() * bandKeys.length)]],
    tpMode: rnd() < 0.2 ? 'zp' : 'components', zp: 22 + 6 * rnd(),
    D: 0.05 + 8 * rnd(), obsc: 0.6 * rnd(), fNum: 1 + 9 * rnd(), topt: 0.2 + 0.7 * rnd(), qe: 0.3 + 0.65 * rnd(),
    pix: 2 + 14 * rnd(), dark: 0.2 * rnd() ** 3, rn: 0.5 + 10 * rnd(), sky: 17 + 6 * rnd(), k: 0.5 * rnd(),
    elev: 10 + 80 * rnd(), fwhm: 0.5 + 5 * rnd(), psf: rnd() < 0.5 ? 'gauss' : 'moffat', beta: 2 + 6 * rnd(),
    phot: rnd() < 0.5 ? 'psf' : 'aper', apR: 0.5 + rnd(), rate: rnd() < 0.4 ? 30 * rnd() ** 2 : 0,
    scaleSky: rnd() < 0.5, scaleSeeing: rnd() < 0.5,
  });
  p.k = p.band.k * (0.5 + rnd());
  const m = C.prepare(p);
  const t = Math.pow(10, -1 + 4 * rnd()), n = 1 + Math.floor(50 * rnd()), snr = 2 + 20 * rnd();
  const a = C.solveMag(m, t, n, snr);
  check(a && isFinite(a.mag), `solveMag finite case ${i}`);
  const b = C.solveSNR(m, t, n, a.mag);
  worstSnr = Math.max(worstSnr, Math.abs(b.snr / snr - 1));
  check(Math.abs(b.snr / snr - 1) < 1e-9, `mag→SNR round trip case ${i}: ${b.snr} vs ${snr}`);
  const e = C.solveExp(m, n, snr, a.mag);
  check(e && e.t && Math.abs(e.t / t - 1) < 1e-6, `mag→exposure round trip case ${i}: ${e && e.t} vs ${t} (rate ${p.rate})`);
  if (e && e.t) worstT = Math.max(worstT, Math.abs(e.t / t - 1));
}
console.log(`round trips: worst SNR error ${worstSnr.toExponential(1)}, worst exposure error ${worstT.toExponential(1)}`);

// ---- 4. scaling laws of the three noise regimes
{
  const slope = (m, t1, t2, n) => (C.solveMag(m, t2, n, 5).mag - C.solveMag(m, t1, n, 5).mag) / Math.log10(t2 / t1);
  // read-noise limited: m_lim ∝ 2.5 log t  (signal ∝ t, noise constant)
  const mRead = C.prepare(base({ sky: 30, dark: 0, rn: 50 }));
  check(close(slope(mRead, 0.01, 0.1, 1), 2.5, 0.02), `read-limited slope ${slope(mRead, 0.01, 0.1, 1)}`);
  // sky limited: m_lim ∝ 1.25 log t
  const mSky = C.prepare(base({ sky: 16, dark: 0, rn: 0.01 }));
  check(close(slope(mSky, 100, 1000, 1), 1.25, 0.01), `sky-limited slope ${slope(mSky, 100, 1000, 1)}`);
  // source limited (no background): SNR = √S, so exposure ∝ SNR²
  const mSrc = C.prepare(base({ sky: 40, dark: 0, rn: 0 }));
  const t5 = C.solveExp(mSrc, 1, 5, 12).t, t50 = C.solveExp(mSrc, 1, 50, 12).t;
  check(close(t50 / t5, 100, 1e-6), `source-limited exposure ratio ${t50 / t5}`);
  // stacking: N frames of t equals one frame of N·t when read noise and dark vanish
  const mIdeal = C.prepare(base({ rn: 0, dark: 0 }));
  check(close(C.solveMag(mIdeal, 10, 10, 5).mag, C.solveMag(mIdeal, 100, 1, 5).mag, 1e-12), 'stack = long exposure without read noise');
  // read noise penalty grows with frame count at fixed total time
  const mRN = C.prepare(base({ rn: 5 }));
  check(C.solveMag(mRN, 1, 100, 5).mag < C.solveMag(mRN, 100, 1, 5).mag, 'many short frames lose depth to read noise');
  // regime classifier
  check(C.regime(C.solveMag(mRead, 0.01, 1, 5).b) === 'read', 'regime read');
  check(C.regime(C.solveMag(mSky, 100, 1, 5).b) === 'sky', 'regime sky');
}

// ---- 5. physics fixes relative to v1
{
  // sky photons are not attenuated by the atmosphere: sky counts must not depend on k (scaleZenith off)
  const a = C.prepare(base({ k: 0.0, scaleSky: false, scaleSeeing: false })), b = C.prepare(base({ k: 0.5, scaleSky: false, scaleSeeing: false }));
  check(close(a.skyArc, b.skyArc, 1e-9 * a.skyArc), 'sky counts independent of extinction');
  check(b.src0 < a.src0, 'source counts do depend on extinction');
  // aperture photometry counts only the enclosed flux: r = FWHM/2 holds exactly 50 % of a Gaussian
  const g = C.geometry(C.prepare(base({ psf: 'gauss', phot: 'aper', apR: 0.5 })), 0);
  check(close(g.fSrc, 0.5, 1e-9), `Gaussian r=FWHM/2 encloses ${g.fSrc}`);
  // air mass: Pickering (2002)
  check(close(C.airmass(90), 1, 1e-4), `X(90°) ${C.airmass(90)}`);
  check(close(C.airmass(30), 1 / Math.sin(30 * Math.PI / 180), 0.01), `X(30°) ${C.airmass(30)}`);
  check(C.airmass(0) > 30 && C.airmass(0) < 45 && isFinite(C.airmass(-5)), `X(0°) ${C.airmass(0)}`);
  // K&S sky brightening: brighter (smaller μ) towards the horizon for typical k
  check(C.skyAtElevation(21.7, 0.15, 30) < 21.7 && close(C.skyAtElevation(21.7, 0.15, 90), 21.7, 1e-12), 'K&S sky vs elevation');
  // moon brightening table: full moon in V is +1.8 mag, nothing at new moon
  check(close(C.moonBrightening(5500, 14), 1.8, 1e-9) && C.moonBrightening(5500, 0) === 0, 'moon table');
  // Moffat NEA closed form → Gaussian for β → ∞
  check(close(C.profileInfo('moffat', 400, 1).neaCont / C.GAUSS_NEA, 1, 0.01), 'Moffat → Gaussian for large β');
  check(close(C.profileInfo('moffat', 4.765, 1).neaCont, 3.018, 0.002), 'Moffat β=4.765 NEA = 3.018 FWHM²');
}

// ---- 6. bands: AB top-hat F0 has the exact closed form 3631 Jy / h × ln(λ2/λ1)
{
  const F0 = (l1, l2) => 3631e-23 / 6.62607015e-27 * Math.log(l2 / l1) * 1e4;
  check(close(BANDS.Lum_400_800.F0 / F0(4000, 8000), 1, 2e-3), `top-hat F0 ${BANDS.Lum_400_800.F0} vs ${F0(4000, 8000)}`);
  for (const k in BANDS) {
    const b = BANDS[k];
    check(b.F0 > 1e9 && b.F0 < 1e11 && b.k > 0 && b.k < 0.7 && b.sky > 17 && b.sky < 24, `band sanity ${k}`);
  }
}

// ---- 7. moving targets and saturation
{
  // trailing: SNR of a trailed source saturates with exposure time in the sky-limited regime
  const m = C.prepare(base({ rate: 15, fwhm: 2.5, rn: 0.5, sky: 19 }));
  const s1 = C.solveSNR(m, 10, 1, 14).snr, s2 = C.solveSNR(m, 1000, 1, 14).snr;
  check(s2 / s1 < 1.2, `trailed SNR saturates: ${s1} → ${s2}`);
  const un = C.solveExp(m, 1, 1e4, 14);
  check(un.unreachable && un.snrMax < 1e4, 'unreachable SNR is flagged');
  // trailing loss of a well-sampled Gaussian (0.1″ pixels) vs the Veres & Chesley (2017) SNR-loss fit
  const p0 = base({ D: 1, fNum: 1, pix: PIX_1AS / 10, psf: 'gauss', fwhm: 1, scaleSky: false, scaleSeeing: false, rate: 1 });
  const mm = C.prepare(p0);
  const nea0 = C.geometry(mm, 0).nPix, neaL = C.geometry(mm, 20).nPix;
  const vc = 1 + 0.761 * 400 / (1 + 1.162 * 20);           // x = L/FWHM = 20, SNR-loss form
  check(Math.abs(1.25 * Math.log10(neaL / nea0) - 1.25 * Math.log10(vc)) < 0.01,
    `trailing loss ${1.25 * Math.log10(neaL / nea0)} vs Veres & Chesley ${1.25 * Math.log10(vc)}`);
  // saturation: the peak pixel at the saturation magnitude equals full well
  const ms = C.prepare(base());
  const sat = C.saturationMag(ms, 10);
  check(close(C.peakElectrons(ms, 10, sat.mag), 51400, 1e-6 * 51400), 'saturation magnitude ↔ full well');
  const msky = C.prepare(base({ fullWell: 10, sky: 15 }));
  check(C.saturationMag(msky, 100).skySaturates, 'sky saturation flagged');
}

console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(fails ? 1 : 0);
