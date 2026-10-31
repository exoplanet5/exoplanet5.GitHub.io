/* Limiting-magnitude calculator core: photon rates, PSF geometry, noise model and the
 * three solvers (limiting magnitude, SNR, exposure time).
 * Plain script (no build step); attaches `LimCore` to the global object so it runs from
 * file:// and GitHub Pages alike, and can be require()d by the Node tests.
 */
(function (root) {
  'use strict';

  const ARCSEC_PER_RAD = 206264.80624709636;
  const DEG = Math.PI / 180;
  const FWHM_PER_SIGMA = 2 * Math.sqrt(2 * Math.LN2);       // 2.3548
  const GAUSS_NEA = Math.PI / (2 * Math.LN2);                // ∫P² NEA of a Gaussian, in FWHM² (2.2662)

  // ---------------------------------------------------------------- special functions
  // Complementary error function, Numerical Recipes erfcc (fractional error < 1.2e-7).
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const Phi = (z) => 0.5 * erfc(-z / Math.SQRT2);                       // standard normal CDF
  const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);   // standard normal PDF
  const Psi = (z) => z * Phi(z) + phi(z);                               // ∫_{-∞}^{z} Φ(u) du

  // ---------------------------------------------------------------- atmosphere
  // Relative air mass, Pickering (2002); finite down to the horizon. elev in degrees.
  function airmass(elev) {
    const h = Math.max(0, Math.min(90, elev));
    return 1 / Math.sin((h + 244 / (165 + 47 * Math.pow(h, 1.1))) * DEG);
  }
  // Sky-brightness air mass of Krisciunas & Schaefer (1991, eq. 3): airglow layer at altitude.
  function skyAirmass(elev) {
    const s = Math.sin((90 - Math.max(0, Math.min(90, elev))) * DEG);
    return 1 / Math.sqrt(1 - 0.96 * s * s);
  }
  // Dark-sky brightness away from the zenith, K&S (1991, eq. 2): B(z) = B_zen 10^(−0.4k(X−1)) X.
  function skyAtElevation(muZen, k, elev) {
    const X = skyAirmass(elev);
    return muZen - 2.5 * Math.log10(X * Math.pow(10, -0.4 * k * (X - 1)));
  }

  // Approximate brightening of the moonlit sky (mag/arcsec²) by lunar age, from the classic
  // Kitt Peak UBVRI table (Walker 1987; NOAO).  Interpolated linearly in wavelength.
  const MOON_AGES = [0, 3, 7, 10, 14];
  const MOON_TABLE = {   // pivot λ (Å): Δmag for ages 0, 3, 7, 10, 14 d
    3600: [0, 0.5, 2.1, 3.5, 5.0],
    4400: [0, 0.3, 1.1, 2.0, 3.2],
    5500: [0, 0.1, 0.4, 1.1, 1.8],
    6400: [0, 0.1, 0.3, 0.6, 1.0],
    8000: [0, 0.0, 0.2, 0.4, 0.7],
  };
  function moonBrightening(lam, age) {
    const ai = MOON_AGES.indexOf(age);
    if (ai < 0) return 0;
    const lams = Object.keys(MOON_TABLE).map(Number);
    if (lam <= lams[0]) return MOON_TABLE[lams[0]][ai];
    if (lam >= lams[lams.length - 1]) return MOON_TABLE[lams[lams.length - 1]][ai];
    for (let i = 0; i < lams.length - 1; i++) {
      if (lam <= lams[i + 1]) {
        const f = (lam - lams[i]) / (lams[i + 1] - lams[i]);
        return MOON_TABLE[lams[i]][ai] * (1 - f) + MOON_TABLE[lams[i + 1]][ai] * f;
      }
    }
    return 0;
  }

  // ---------------------------------------------------------------- PSF profiles
  // Moffat: I ∝ (1 + r²/α²)^−β with FWHM = 2α√(2^{1/β} − 1).  β = 4.765 matches Kolmogorov seeing
  // (Trujillo et al. 2001).  Each profile is mapped onto an "equivalent Gaussian" for the pixel and
  // trail integrals: σ_nea reproduces the profile's noise-equivalent area, σ_peak its peak intensity.
  function profileInfo(type, beta, fwhm) {
    if (type === 'gauss' || !(beta > 1.55)) {
      const s = fwhm / FWHM_PER_SIGMA;
      return { type: 'gauss', fwhm, sigma: s, sigNea: s, sigPeak: s, neaCont: GAUSS_NEA * fwhm * fwhm,
        enclosed: (r) => 1 - Math.exp(-r * r / (2 * s * s)),
        strip: (r) => 2 * Phi(r / s) - 1 };
    }
    const alpha = fwhm / (2 * Math.sqrt(Math.pow(2, 1 / beta) - 1));
    const neaCont = Math.PI * alpha * alpha * (2 * beta - 1) / ((beta - 1) * (beta - 1));
    // line-spread function ∝ (1 + y²/α²)^(1/2−β); with y = α tanθ its integral is ∫ cos^(2β−3)θ dθ
    const cosInt = (th) => {
      const n = 96, d = th / n;
      let s = 0;
      for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.pow(Math.cos(i * d), 2 * beta - 3);
      return s * d / 3;
    };
    const lsfNorm = cosInt(Math.PI / 2);
    return { type: 'moffat', fwhm, beta, alpha, sigma: fwhm / FWHM_PER_SIGMA,
      sigNea: Math.sqrt(neaCont / (4 * Math.PI)), sigPeak: alpha / Math.sqrt(2 * (beta - 1)), neaCont,
      enclosed: (r) => 1 - Math.pow(1 + r * r / (alpha * alpha), 1 - beta),
      strip: (r) => cosInt(Math.atan(r / alpha)) / lsfNorm };
  }

  // ---------------------------------------------------------------- pixel / trail integrals
  // Fraction of a 1-D Gaussian (σ, px units) smeared over a trail of length L (px) that falls in the
  // pixel whose centre is at offset x from the trail centre.
  function pixFrac(x, sig, L) {
    const a = x + 0.5, b = x - 0.5;
    if (L < 1e-6 * sig) return Phi(a / sig) - Phi(b / sig);
    const h = L / 2;
    return (sig / L) * (Psi((a + h) / sig) - Psi((a - h) / sig) - Psi((b + h) / sig) + Psi((b - h) / sig));
  }
  // Phase-averaged Σ p_i² and the peak p_i for the 1-D profile above.
  function lineSums(sig, L) {
    const nPh = sig < 2 ? 8 : 1;
    const half = L / 2 + 8 * sig + 2;
    let sum2 = 0, peak = 0;
    for (let k = 0; k < nPh; k++) {
      const ph = nPh === 1 ? 0 : (k + 0.5) / nPh - 0.5;
      const iLo = Math.floor(-half + ph), iHi = Math.ceil(half + ph);
      // pixels deep inside a long trail all hold exactly 1/L: count them instead of summing
      const jLo = Math.ceil(-L / 2 + 8 * sig + 1 + ph), jHi = Math.floor(L / 2 - 8 * sig - 1 + ph);
      let s2 = 0;
      for (let i = iLo; i <= iHi; i++) {
        if (jHi > jLo && i === jLo) { s2 += (jHi - jLo + 1) / (L * L); i = jHi; continue; }
        const p = pixFrac(i - ph, sig, L);
        s2 += p * p;
        if (p > peak) peak = p;
      }
      sum2 += s2;
      if (jHi > jLo) peak = Math.max(peak, 1 / L);
    }
    return { sum2: sum2 / nPh, peak };
  }
  // Fraction of a trailed Gaussian (σ, trail L along x, arcsec) inside a "stadium" aperture of
  // radius r around the trail: rectangle |x| ≤ L/2, |y| ≤ r plus two semicircular caps.
  function trailedGaussInStadium(sig, L, r) {
    const fy = 2 * Phi(r / sig) - 1;
    if (L < 1e-6 * sig) return 1 - Math.exp(-r * r / (2 * sig * sig));
    const h = L / 2;
    const hx = (x) => (Phi((x + h) / sig) - Phi((x - h) / sig)) / L;
    const core = (sig / L) * (Psi(L / sig) - 2 * Psi(0) + Psi(-L / sig));
    const n = 64, dx = r / n;
    let cap = 0;
    for (let i = 0; i <= n; i++) {
      const u = i * dx, w = Math.sqrt(Math.max(0, r * r - u * u));
      const wt = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      cap += wt * hx(h + u) * (2 * Phi(w / sig) - 1);
    }
    return core * fy + 2 * cap * dx / 3;
  }

  // ---------------------------------------------------------------- system model
  /* Parameters (all plain numbers / strings):
   *   band {F0, k, sky, lam}       F0 photons s⁻¹ m⁻² at mag 0 through the peak-normalised band
   *   tpMode 'components'|'zp'     photon budget from components, or from a measured zero point
   *   D (m), obsc (D_obs/D), fNum, topt (optics × filter), qe     components mode
   *   zp (mag giving 1 e⁻/s at X = 1, atmosphere included)       zero-point mode
   *   pix (µm), dark (e⁻/s/px), rn (e⁻/px/frame), fullWell (e⁻)
   *   sky (mag/arcsec²), k (mag/airmass), elev (°), fwhm (″)
   *   scaleSky, scaleSeeing (bool): sky / FWHM are zenith values, scaled to the target air mass
   *   psf 'moffat'|'gauss', beta, phot 'psf'|'aper', apR (aperture radius in FWHM)
   *   rate (″/s, target motion relative to the tracking)
   */
  function prepare(p) {
    const X = airmass(p.elev);
    const mu = p.scaleSky ? skyAtElevation(p.sky, p.k, p.elev) : p.sky;
    const fwhm = p.scaleSeeing ? p.fwhm * Math.pow(X, 0.6) : p.fwhm;
    const scale = ARCSEC_PER_RAD * p.pix * 1e-6 / (p.D * p.fNum);          // ″/px
    const Tatm = Math.pow(10, -0.4 * p.k * X);
    let src0, skyArc, area = NaN;
    if (p.tpMode === 'zp') {
      src0 = Math.pow(10, 0.4 * p.zp) * Math.pow(10, -0.4 * p.k * (X - 1));
      skyArc = Math.pow(10, -0.4 * (mu - p.zp - p.k));     // sky is measured below the atmosphere
    } else {
      area = Math.PI / 4 * p.D * p.D * (1 - p.obsc * p.obsc);
      const inst = p.band.F0 * area * p.topt * p.qe;        // e⁻/s at mag 0, above the atmosphere
      src0 = inst * Tatm;
      skyArc = Math.pow(10, -0.4 * mu) * inst;
    }
    const prof = profileInfo(p.psf, p.beta, fwhm);
    const bgPix = skyArc * scale * scale + p.dark;           // e⁻/s/px of sky + dark
    return { p, X, Tatm, mu, fwhm, scale, area, src0, skyArc, bgPix, prof, geomCache: new Map() };
  }

  // PSF / aperture geometry for a trail of length L (″): noise pixels, source fraction, peak pixel.
  function geometry(m, L) {
    const key = L;
    const hit = m.geomCache.get(key);
    if (hit) return hit;
    const { p, prof, scale } = m;
    const Lpx = L / scale;
    let g;
    const peakX = lineSums(prof.sigPeak / scale, Lpx).peak, peakY = lineSums(prof.sigPeak / scale, 0).peak;
    if (p.phot === 'aper') {
      const r = p.apR * prof.fwhm;
      let f = prof.enclosed(r);
      if (Lpx > 1e-6 && prof.type === 'gauss') f = trailedGaussInStadium(prof.sigma, L, r);
      else if (Lpx > 1e-6) {
        // Moffat: interpolate between the point-source (circle) and long-trail (strip) limits with
        // the weight that is exact for the Gaussian of the same FWHM
        const sg = prof.sigma, cG = 1 - Math.exp(-r * r / (2 * sg * sg)), sG = 2 * Phi(r / sg) - 1;
        const w = sG - cG > 1e-9 ? (sG - trailedGaussInStadium(sg, L, r)) / (sG - cG) : 0;
        f = w * f + (1 - w) * prof.strip(r);
      }
      g = { nPix: (Math.PI * r * r + 2 * r * L) / (scale * scale), fSrc: f, rAp: r };
    } else {
      const sx = lineSums(prof.sigNea / scale, Lpx).sum2, sy = lineSums(prof.sigNea / scale, 0).sum2;
      g = { nPix: 1 / (sx * sy), fSrc: 1 };
    }
    g.peakFrac = peakX * peakY;
    g.trailPx = Lpx;
    if (m.geomCache.size > 4096) m.geomCache.clear();
    m.geomCache.set(key, g);
    return g;
  }

  // Electron budget of the stacked image.  t: single exposure (s), n: frames, mag: source mag.
  function budget(m, t, n, mag, opts) {
    const o = opts || {};
    const g = geometry(m, (m.p.rate || 0) * t);
    const T = t * n;
    const rn = o.ideal ? 0 : m.p.rn, dark = o.ideal ? 0 : m.p.dark;
    const srcRate = m.src0 * g.fSrc;                                   // e⁻/s for mag 0
    const S = mag == null ? NaN : Math.pow(10, -0.4 * mag) * srcRate * T;
    const sky = m.skyArc * m.scale * m.scale * g.nPix * T;
    const dk = dark * g.nPix * T;
    const read = n * rn * rn * g.nPix;
    return { t, n, T, g, srcRate, S, sky, dark: dk, read, bg: sky + dk + read };
  }

  const snrOf = (b) => b.S / Math.sqrt(b.S + b.bg);

  // ---- Mode 1: faintest magnitude reaching `snr`
  function solveMag(m, t, n, snr, opts) {
    const b = budget(m, t, n, null, opts);
    const s2 = snr * snr;
    b.S = (s2 + Math.sqrt(s2 * s2 + 4 * s2 * b.bg)) / 2;
    const mag = -2.5 * Math.log10(b.S / (b.srcRate * b.T));
    return isFinite(mag) ? { mag, snr, b } : null;
  }

  // ---- Mode 2: SNR of a source of magnitude `mag`
  function solveSNR(m, t, n, mag, opts) {
    const b = budget(m, t, n, mag, opts);
    const snr = snrOf(b);
    return isFinite(snr) && snr > 0 ? { mag, snr, b } : null;
  }

  // ---- Mode 3: single-exposure time giving `snr` on `mag` with `n` frames
  const T_MIN = 1e-4, T_MAX = 1e7;
  function solveExp(m, n, snr, mag, opts) {
    const rate = m.p.rate || 0;
    if (!(rate > 0)) {
      // stationary source: SNR² (S + B) = S² with S = αT, B = βT + δ → quadratic in T
      const b1 = budget(m, 1, n, mag, opts);                 // per-second rates at t = 1 s
      const alpha = b1.S / n, beta = (b1.sky + b1.dark) / n, delta = b1.read;
      const s2 = snr * snr;
      const T = (s2 * (alpha + beta) + Math.sqrt(s2 * s2 * (alpha + beta) ** 2 + 4 * alpha * alpha * s2 * delta)) / (2 * alpha * alpha);
      if (!isFinite(T) || T <= 0) return null;
      const t = T / n;
      return { mag, snr, t, b: budget(m, t, n, mag, opts) };
    }
    // moving source: the trail grows with t, so solve numerically on a log grid then bisect
    const f = (lt) => snrOf(budget(m, Math.exp(lt), n, mag, opts)) - snr;
    let lo = Math.log(T_MIN), prev = f(lo);
    if (prev >= 0) return { mag, snr, t: T_MIN, b: budget(m, T_MIN, n, mag, opts), clipped: 'min' };
    const step = Math.LN10 / 16;
    let best = prev, bestLt = lo;
    for (let lt = lo + step; lt <= Math.log(T_MAX) + 1e-9; lt += step) {
      const v = f(lt);
      if (v > best) { best = v; bestLt = lt; }
      if (v >= 0) {
        let a = lt - step, z = lt;
        for (let i = 0; i < 60; i++) { const mid = (a + z) / 2; if (f(mid) >= 0) z = mid; else a = mid; }
        const t = Math.exp(z);
        return { mag, snr, t, b: budget(m, t, n, mag, opts) };
      }
      prev = v;
    }
    const t = Math.exp(bestLt);
    return { mag, snr, t: null, unreachable: true, snrMax: best + snr, tBest: t, b: budget(m, t, n, mag, opts) };
  }

  // Bright limit: magnitude at which the peak pixel of one frame reaches full well.
  function saturationMag(m, t) {
    const g = geometry(m, (m.p.rate || 0) * t);
    const room = m.p.fullWell - m.bgPix * t;
    if (!(m.p.fullWell > 0)) return { mag: NaN, skySaturates: false };
    if (room <= 0) return { mag: Infinity, skySaturates: true };
    return { mag: -2.5 * Math.log10(room / (m.src0 * t * g.peakFrac)), skySaturates: false };
  }
  // Peak electrons in the brightest pixel of one frame for a source of magnitude mag.
  function peakElectrons(m, t, mag) {
    const g = geometry(m, (m.p.rate || 0) * t);
    return Math.pow(10, -0.4 * mag) * m.src0 * t * g.peakFrac + m.bgPix * t;
  }
  // Shortest sub-exposure for which sky + dark per pixel exceed f × RN² (background-limited stacking).
  const backgroundLimitedSub = (m, f) => (f || 10) * m.p.rn * m.p.rn / m.bgPix;

  // Which noise term dominates the variance.
  function regime(b) {
    const parts = { source: b.S, sky: b.sky, dark: b.dark, read: b.read };
    let best = 'source';
    for (const k in parts) if (parts[k] > parts[best]) best = k;
    return best;
  }

  const api = {
    ARCSEC_PER_RAD, GAUSS_NEA, MOON_AGES, erfc, Phi, Psi, airmass, skyAirmass, skyAtElevation, moonBrightening,
    profileInfo, pixFrac, lineSums, trailedGaussInStadium, prepare, geometry, budget, snrOf,
    solveMag, solveSNR, solveExp, saturationMag, peakElectrons, backgroundLimitedSub, regime,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LimCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
