// Audit of v1 (April 2026) against v2 for three observing situations and all three solve modes.
// The v1 functions below are copied from the v1 index.html (git history of this folder), with
// switches that remove one v1 defect at a time so each fix can be quantified.
//   node tests/audit_v1.js
const C = require('../js/core.js');
const BANDS = require('../js/bands.js');

const V1_BANDS = {   // v1 band table: F0 (ph/m²/s), k, dark sky
  Johnson_V: { F0: 8.35e9, k: 0.15, sky: 21.8 },
  SDSS_r: { F0: 1.03e10, k: 0.10, sky: 21.1 },
  Gaia_G: { F0: 3.45e10, k: 0.13, sky: 21.4 },
};

// ---- v1 model.  fix.flux: count only the flux inside the r = FWHM/2 aperture (50 % for a Gaussian);
// fix.sky: do not attenuate the ground-measured sky by the atmosphere.
function v1Params(s, fix) {
  const zenith = (90 - s.elev) * Math.PI / 180;
  const airmass = 1 / Math.cos(zenith);
  const Tatm = Math.pow(10, -0.4 * s.k * airmass);
  const Qeff = s.qe * s.trans * Tatm;
  const Aarea = Math.PI * s.D * s.D / 4;
  const pixscale = (s.pix / (1e6 * s.D * s.fn)) / Math.PI * 648000;
  const psfpix = s.seeing / pixscale;
  const npix = Math.PI * psfpix * psfpix / 4;
  const psfarea = pixscale * pixscale * npix;
  const skyQ = fix.sky ? s.qe * s.trans : Qeff;
  const frac = fix.flux ? 0.5 : 1;
  return { A0rate: s.F0 * Aarea * Qeff * frac, skyRate: Math.pow(10, -0.4 * s.skymag) * s.F0 * psfarea * Aarea * skyQ, npix, s };
}
function v1Mag(q, t, n, snr) {
  const T = t * n, A0 = q.A0rate * T;
  const B = q.skyRate * T + q.s.dc * T * q.npix + q.s.rn * q.s.rn * n * q.npix;
  const a = (A0 / snr) ** 2, x = (A0 + Math.sqrt(A0 * A0 + 4 * a * B)) / (2 * a);
  return -2.5 * Math.log10(x);
}
function v1SNR(q, t, n, mag) {
  const T = t * n, S = Math.pow(10, -0.4 * mag) * q.A0rate * T;
  return S / Math.sqrt(S + q.skyRate * T + q.s.dc * T * q.npix + q.s.rn * q.s.rn * n * q.npix);
}
function v1Exp(q, n, snr, mag) {
  const al = Math.pow(10, -0.4 * mag) * q.A0rate, be = q.skyRate, ga = q.s.dc * q.npix, de = q.s.rn * q.s.rn * n * q.npix;
  const At = al * al, Bt = -snr * snr * (al + be + ga), Ct = -snr * snr * de;
  return (-Bt + Math.sqrt(Bt * Bt - 4 * At * Ct)) / (2 * At) / n;
}

// ---- three situations (v1 inputs)
const SITUATIONS = [
  { name: 'Small telescope + CMOS stack (v1 default)', band: 'Johnson_V', D: 0.3, fn: 5, seeing: 5.0, elev: 40, trans: 0.5,
    qe: 0.80, pix: 3.76, dc: 0.0022, rn: 1.2, t: 10, n: 10, snr: 4, mag: 18 },
  { name: 'Survey telescope + CCD, sky limited', band: 'SDSS_r', D: 8.4, fn: 1.234, seeing: 1.0, elev: 60, trans: 0.5,
    qe: 0.93, pix: 10, dc: 0.002, rn: 5.0, t: 30, n: 1, snr: 5, mag: 24 },
  { name: 'Short exposure, read-noise limited (Mayall + CCD230-42)', band: 'Gaia_G', D: 3.797, fn: 3.86, seeing: 1.5, elev: 60,
    trans: 0.5, qe: 0.92, pix: 15, dc: 0.2, rn: 4.0, t: 0.2, n: 1, snr: 10, mag: 17 },
];

const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
for (const s0 of SITUATIONS) {
  const vb = V1_BANDS[s0.band], nb = BANDS[s0.band];
  const s = Object.assign({}, s0, { F0: vb.F0, k: vb.k, skymag: vb.sky });
  const q = (fix, band) => v1Params(band ? Object.assign({}, s, { F0: band.F0, k: band.k, skymag: band.sky }) : s, fix);
  const m1 = v1Mag(q({}), s.t, s.n, s.snr);
  const steps = [
    ['v1 as published', m1],
    ['+ only the enclosed flux counts (50 % in r = FWHM/2)', v1Mag(q({ flux: true }), s.t, s.n, s.snr)],
    ['+ sky not dimmed by extinction', v1Mag(q({ flux: true, sky: true }), s.t, s.n, s.snr)],
    ['+ band zero point, sky and k recomputed', v1Mag(q({ flux: true, sky: true }, nb), s.t, s.n, s.snr)],
  ];
  const v2 = (over) => C.prepare(Object.assign({
    band: nb, tpMode: 'components', D: s.D, obsc: 0, fNum: s.fn, topt: s.trans, qe: s.qe, pix: s.pix, dark: s.dc,
    rn: s.rn, fullWell: 1e5, sky: nb.sky, k: nb.k, elev: s.elev, fwhm: s.seeing, scaleSky: false, scaleSeeing: false,
    psf: 'gauss', beta: 4.765, phot: 'aper', apR: 0.5, rate: 0, zp: 25,
  }, over));
  steps.push(['v2, Gaussian, aperture r = FWHM/2 (closest to v1)', C.solveMag(v2({}), s.t, s.n, s.snr).mag]);
  steps.push(['v2, Gaussian, PSF fit', C.solveMag(v2({ phot: 'psf' }), s.t, s.n, s.snr).mag]);
  const mDef = v2({ phot: 'psf', psf: 'moffat', scaleSky: true, scaleSeeing: false });
  const v2m = C.solveMag(mDef, s.t, s.n, s.snr);
  steps.push(['v2 default: Moffat β = 4.765, PSF fit, zenith sky scaled', v2m.mag]);

  console.log(`\n## ${s.name}`);
  console.log(`${s.band}, D = ${s.D} m f/${s.fn}, FWHM ${s.seeing}″, elev ${s.elev}°, ${s.n} × ${s.t} s, SNR ${s.snr}`);
  console.log('\n| Mode 1 — limiting magnitude | m_lim | Δ vs v1 |\n|---|---|---|');
  for (const [label, m] of steps) console.log(`| ${label} | ${f2(m)} | ${m === m1 ? '—' : (m - m1 >= 0 ? '+' : '') + f2(m - m1)} |`);
  const sv1 = v1SNR(q({}), s.t, s.n, s.mag), sv2 = C.solveSNR(mDef, s.t, s.n, s.mag).snr;
  const ev1 = v1Exp(q({}), s.n, s.snr, s.mag), ev2 = C.solveExp(mDef, s.n, s.snr, s.mag).t;
  console.log(`\n| Mode | input | v1 | v2 default | ratio |\n|---|---|---|---|---|`);
  console.log(`| 2 — SNR | m = ${s.mag} | ${f2(sv1)} | ${f2(sv2)} | ${f3(sv2 / sv1)} |`);
  console.log(`| 3 — exposure per frame | m = ${s.mag}, SNR ${s.snr}, ${s.n} frames | ${ev1.toPrecision(3)} s | ${ev2.toPrecision(3)} s | ${f2(ev2 / ev1)}× |`);
  console.log(`\nv2 noise budget at the limit: source ${f2(100 * v2m.b.S / (v2m.b.S + v2m.b.bg))} %, sky ${f2(100 * v2m.b.sky / (v2m.b.S + v2m.b.bg))} %, ` +
    `dark ${f2(100 * v2m.b.dark / (v2m.b.S + v2m.b.bg))} %, read ${f2(100 * v2m.b.read / (v2m.b.S + v2m.b.bg))} % → ${C.regime(v2m.b)} limited`);
}
