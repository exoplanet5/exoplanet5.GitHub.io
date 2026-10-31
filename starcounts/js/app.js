/* Guide Camera Star Count Calculator - UI layer (inputs, map, charts, live Gaia fields). */
(function () {
  'use strict';
  const C = window.StarCore;
  const D = window.STARCOUNT_DATA;
  const $ = (id) => document.getElementById(id);

  // ===================================================================== presets
  // Plate scale at the guide-sensor location where known (wide-field correctors vary
  // by several per cent across the field). lat = site latitude, n = guide cameras,
  // ring = approximate guide-sensor radius from the field centre (deg), used only
  // for the live-field layout.
  const TELESCOPES = [
    { id: 'rubin', name: 'Rubin Observatory · LSSTCam', plate: 50.0, lat: -30.24, n: 8, ring: 1.95, sensor: 'itl3800',
      note: '8.4 m, EFL 10.31 m (f/1.23): <b>0.20″ per 10 µm pixel</b>. 8 guide CCDs in the four corner rafts, beside the split wavefront sensors.' },
    { id: 'decam', name: 'DECam · Blanco 4 m', plate: 57.0, lat: -30.17, n: 4, ring: 1.05, sensor: 'lbnl2k',
      note: 'Prime-focus corrector, <b>0.263″ per 15 µm pixel</b> at field centre. 4 guide + 8 focus/alignment 2k×2k CCDs on the field edge.' },
    { id: 'desi', name: 'DESI · Mayall 4 m', plate: 73.2, lat: 31.96, n: 6, ring: 1.5, sensor: 'ccd230ft',
      note: 'Prime-focus corrector: 67.5 µm/″ on axis, <b>0.205″ per 15 µm pixel (73.2 µm/″) at the GFAs</b> on the field edge. 6 guide + 4 wavefront GFAs of 7.3′×3.4′.' },
    { id: '4most', name: '4MOST · VISTA 4.1 m', plate: 59.4, lat: -24.62, n: 2, ring: 1.2, sensor: null,
      note: 'Wide-field corrector <b>≈59.4 µm/″</b>. 2 acquisition &amp; guiding cameras (one active at a time); the 4 wavefront cameras are 2k×2k, 13.5 µm. A&amp;G detector not public.' },
    { id: 'lamost', name: 'LAMOST · 4 m Schmidt', plate: 96.96, lat: 40.40, n: 4, ring: 1.25, sensor: null,
      note: 'Focal length 20 m: <b>96.96 µm/″ (10.3″/mm)</b>, 5° field. 4 guide CCDs about halfway out from the field centre.' },
    { id: 'wfst', name: 'WFST · 2.5 m', plate: 30.06, lat: 38.61, n: 4, ring: 1.4, sensor: null,
      note: 'Prime focus f/2.48, EFL 6.2 m: <b>0.333″ per 10 µm pixel</b>, 3° field. 4 guide CCDs on the focal plane.' },
    { id: 'must', name: 'MUST · 6.5 m', plate: 116.87, lat: 38.61, n: 6, ring: 1.3, sensor: null,
      note: 'f = 24.105 m, F/3.70: <b>116.87 µm/″</b> (RD-008 quotes 118). 6 guide cameras in a near-hexagonal ring at r ≈ 500–600 mm; detector under trade study.' },
    { id: 'custom', name: 'Custom', plate: null },
  ];

  const SENSORS = [
    { group: 'Guide-camera CCDs' },
    { id: 'ccd230ft', name: 'e2v CCD230-42 frame transfer (DESI GFA)', x: 2048, y: 1032, pix: 15 },
    { id: 'ccd230', name: 'e2v CCD230-42 full frame', x: 2048, y: 2064, pix: 15 },
    { id: 'ccd4240', name: 'e2v CCD42-40 (VISTA AG)', x: 2048, y: 2048, pix: 13.5 },
    { id: 'ccd4482', name: 'e2v CCD44-82 (VST AG)', x: 2048, y: 4096, pix: 15 },
    { id: 'ccd4720', name: 'e2v CCD47-20 frame transfer (Magellan, PFS AGC)', x: 1024, y: 1024, pix: 13 },
    { id: 'lbnl2k', name: 'LBNL 2k×2k (DECam guide/focus)', x: 2048, y: 2048, pix: 15 },
    { id: 'hsc', name: 'Hamamatsu S10892 (HSC AG)', x: 2048, y: 4096, pix: 15 },
    { group: 'Large-format survey CCDs' },
    { id: 'itl3800', name: 'ITL STA3800C (Rubin guider)', x: 4072, y: 4000, pix: 10 },
    { id: 'ccd250', name: 'e2v CCD250 (LSSTCam)', x: 4096, y: 4004, pix: 10 },
    { id: 'ccd290', name: 'e2v CCD290-99 (WFST science)', x: 9216, y: 9232, pix: 10 },
    { group: 'Scientific CMOS' },
    { id: 'gs400', name: 'Gpixel GSENSE400BSI', x: 2048, y: 2048, pix: 11 },
    { id: 'gs2020', name: 'Gpixel GSENSE2020BSI', x: 2048, y: 2048, pix: 6.5 },
    { id: 'gs4040', name: 'Gpixel GSENSE4040BSI', x: 4096, y: 4096, pix: 9 },
    { id: 'gs6060', name: 'Gpixel GSENSE6060BSI', x: 6144, y: 6144, pix: 10 },
    { id: 'gs9016', name: 'Gpixel GSENSE9016BSI', x: 4096, y: 4096, pix: 9 },
    { id: 'gs1517', name: 'Gpixel GSENSE1517BSI', x: 4096, y: 4096, pix: 15 },
    { id: 'gs64105', name: 'Gpixel GSENSE64105BSI', x: 10240, y: 10240, pix: 6.4 },
    { id: 'gs1081', name: 'Gpixel GSENSE1081BSI', x: 8900, y: 9120, pix: 10 },
    { id: 'orcaq', name: 'Hamamatsu ORCA-Quest qCMOS', x: 4096, y: 2304, pix: 4.6 },
    { group: 'Consumer CMOS (QHY / ZWO)' },
    { id: 'imx455', name: 'Sony IMX455 (QHY600, ASI6200)', x: 9576, y: 6388, pix: 3.76 },
    { id: 'imx411', name: 'Sony IMX411 (QHY411)', x: 14208, y: 10656, pix: 3.76 },
    { id: 'imx571', name: 'Sony IMX571 (QHY268, ASI2600)', x: 6248, y: 4176, pix: 3.76 },
    { id: 'imx432', name: 'Sony IMX432 (ASI432MM)', x: 1608, y: 1104, pix: 9 },
    { id: 'imx174', name: 'Sony IMX174 (ASI174MM)', x: 1936, y: 1216, pix: 5.86 },
    { group: '' },
    { id: 'custom', name: 'Custom' },
  ];
  const SENSOR_BY_ID = Object.fromEntries(SENSORS.filter((s) => s.id).map((s) => [s.id, s]));
  const TEL_BY_ID = Object.fromEntries(TELESCOPES.map((t) => [t.id, t]));

  const BAND_GROUPS = [
    ['SDSS (AB)', ['u', 'g', 'r', 'i', 'z']],
    ['Johnson–Cousins (Vega)', ['U', 'B', 'V', 'Rc', 'Ic']],
    ['Gaia (Vega)', ['G', 'BP', 'RP']],
  ];
  const BAND_TEXT = (k) => (D.bands[k].label || k).replace(/<sub>(.*?)<\/sub>/g, '$1');

  const FIELDS = [
    { id: '', name: 'Choose a field…' },
    { id: 'ngp', name: 'North Galactic Pole', l: 0, b: 90 },
    { id: 'sgp', name: 'South Galactic Pole', l: 0, b: -90 },
    { id: 'b60', name: 'High latitude (l 180°, b +60°)', l: 180, b: 60 },
    { id: 'b30', name: 'Anticentre, b +30°', l: 180, b: 30 },
    { id: 'b20', name: 'Anticentre, b +20°', l: 180, b: 20 },
    { id: 'bulge', name: 'Inner Galaxy (l 0°, b −10°)', l: 0, b: -10 },
    { id: 'cosmos', name: 'COSMOS', ra: 150.12, dec: 2.21 },
    { id: 's82', name: 'Stripe 82 (RA 0°, Dec 0°)', ra: 0, dec: 0 },
    { id: 'lmc', name: 'Large Magellanic Cloud', ra: 80.89, dec: -69.76 },
    { id: 'm31', name: 'M31', ra: 10.68, dec: 41.27 },
  ];

  const METRICS = [
    { id: 'lam', name: 'Expected stars per sensor (λ)' },
    { id: 'pk', name: 'P(one sensor has ≥ k stars)' },
    { id: 'pM', name: 'P(≥ M of n sensors have ≥ k stars)' },
    { id: 'pK', name: 'P(total over n sensors ≥ K)' },
  ];

  // ===================================================================== state
  const DEF = {
    tel: 'must', plate: 116.87, lat: 38.61, sen: 'ccd230', chipX: 2048, chipY: 2064, pix: 15, n: 6,
    band: 'r', mb: 17, mf: 19, l: 180, b: 80, k: 3, M: 6, K: 18, thr: 95, bMin: 20, zMax: 60,
    metric: 'lam', proj: 'eq', layout: 'ring', ring: 1.3,
  };
  const S = { ...DEF };

  // input id -> [state key, min, max, integer]
  const NUM = {
    plateScale: ['plate', 0.5, 2000], siteLat: ['lat', -90, 90],
    chipX: ['chipX', 1, 200000, true], chipY: ['chipY', 1, 200000, true], pixSize: ['pix', 0.1, 200],
    nSensors: ['n', 1, 24, true], magBright: ['mb', -2, 30], magFaint: ['mf', -2, 30],
    gl: ['l', -360, 720], gb: ['b', -90, 90], ra: ['ra', -360, 720], dec: ['dec', -90, 90],
    kStars: ['k', 0, 500, true], mSensors: ['M', 0, 24, true], kTotal: ['K', 0, 20000, true],
    thresh: ['thr', 1, 99.99], bMin: ['bMin', 0, 89.9], zMax: ['zMax', 1, 90], ringR: ['ring', 0, 6],
  };
  const HASH_KEYS = ['tel', 'plate', 'lat', 'sen', 'chipX', 'chipY', 'pix', 'n', 'band', 'mb', 'mf', 'l', 'b',
    'k', 'M', 'K', 'thr', 'bMin', 'zMax', 'metric', 'proj', 'layout', 'ring'];

  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    for (const k of HASH_KEYS) {
      if (!h.has(k)) continue;
      const v = h.get(k);
      if (typeof DEF[k] === 'number') {
        const x = parseFloat(v);
        if (Number.isFinite(x)) S[k] = x;
      } else S[k] = v;
    }
    if (!TEL_BY_ID[S.tel]) S.tel = 'custom';
    if (!SENSOR_BY_ID[S.sen]) S.sen = 'custom';
    if (!D.bands[S.band]) S.band = DEF.band;
    if (!METRICS.some((m) => m.id === S.metric)) S.metric = DEF.metric;
  }
  let hashTimer = 0;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const h = new URLSearchParams();
      for (const k of HASH_KEYS) if (S[k] !== DEF[k]) h.set(k, typeof S[k] === 'number' ? +S[k].toFixed(5) : S[k]);
      history.replaceState(null, '', h.toString() ? '#' + h.toString() : location.pathname + location.search);
    }, 250);
  }

  // ===================================================================== formatting
  const fmtLam = (x) => !Number.isFinite(x) ? '–' : x < 0.095 ? x.toFixed(3) : x < 9.95 ? x.toFixed(2) : x < 99.5 ? x.toFixed(1) : Math.round(x).toLocaleString('en-US');
  const fmtP = (p) => !Number.isFinite(p) ? '–' : p > 0.9995 ? '>99.9%' : p < 0.0005 ? '<0.1%' : (100 * p).toFixed(1) + '%';
  const fmtDeg = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  const fmtInt = (x) => Math.round(x).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function statusOf(p) {
    if (p >= S.thr / 100) return { cls: 'good', icon: '✓', text: 'meets ' + S.thr + '%' };
    if (p >= 0.5) return { cls: 'warn', icon: '!', text: 'marginal' };
    return { cls: 'crit', icon: '✕', text: 'short' };
  }

  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return {
      surface: g('--surface'), field: g('--field'), ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'),
      grid: g('--grid'), axis: g('--axis'), accent: g('--accent'), blue: g('--blue'), aqua: g('--aqua'),
      neutral: g('--neutral'), divLo: g('--div-lo'), divHi: g('--div-hi'), good: g('--good'), crit: g('--crit'),
      ramp: g('--ramp').split(',').map((s) => s.trim()), ord: g('--ord').split(',').map((s) => s.trim()),
      dark: document.documentElement.dataset.theme !== 'light',
    };
  }
  const hexRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function lutFrom(stops, n = 256) {
    const rgb = stops.map(hexRgb), out = new Uint8ClampedArray(n * 3);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * (rgb.length - 1), k = Math.min(rgb.length - 2, Math.floor(t)), f = t - k;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = rgb[k][c] * (1 - f) + rgb[k + 1][c] * f;
    }
    return out;
  }

  // ===================================================================== model
  if (!D) {
    document.querySelector('.outputs').innerHTML = '<div class="card err">Could not load data/gaia_dr3_counts.js</div>';
    return;
  }
  const model = new C.CountModel(D);
  const NP = model.npix;
  const pixArea = model.pixArcmin2 / 3600;     // deg^2
  const arr = {
    dens: new Float32Array(NP), lam: new Float32Array(NP), pk: new Float32Array(NP), pM: new Float32Array(NP),
    pK: new Float32Array(NP), inFp: new Uint8Array(NP), incomplete: new Uint8Array(NP),
  };
  let densKey = '';

  function geom() {
    const pixScale = S.pix / S.plate;                 // arcsec / pixel
    const fx = (S.chipX * pixScale) / 60, fy = (S.chipY * pixScale) / 60;   // arcmin
    return { pixScale, fx, fy, area: fx * fy, mmX: (S.chipX * S.pix) / 1000, mmY: (S.chipY * S.pix) / 1000 };
  }
  const decRange = () => [Math.max(-90, S.lat - S.zMax), Math.min(90, S.lat + S.zMax)];
  const Meff = () => Math.min(S.M, S.n);

  function computeAll() {
    const key = `${S.band}|${S.mb}|${S.mf}`;
    if (key !== densKey) { model.densityMap(S.band, S.mb, S.mf, arr.dens); densKey = key; }
    const A = geom().area, [d0, d1] = decRange(), gFaint = model.faintG(S.band, S.mf), M = Meff();
    for (let p = 0; p < NP; p++) {
      const lam = arr.dens[p] * A;
      arr.lam[p] = lam;
      const pk = C.poissonTail(S.k, lam);
      arr.pk[p] = pk;
      arr.pM[p] = C.binomTail(M, S.n, pk);
      arr.pK[p] = C.poissonTail(S.K, S.n * lam);
      arr.inFp[p] = Math.abs(model.gb[p]) >= S.bMin && model.dec[p] >= d0 && model.dec[p] <= d1 ? 1 : 0;
      arr.incomplete[p] = model.gLim[p] < gFaint ? 1 : 0;
    }
  }

  function pointStats() {
    const A = geom().area, w = model.weightsAt(S.l, S.b);
    let dens = 0, inc = 0, glim = 0;
    for (const [p, x] of w) { dens += x * arr.dens[p]; glim += x * model.gLim[p]; inc = Math.max(inc, arr.incomplete[p]); }
    const lam = dens * A, pk = C.poissonTail(S.k, lam);
    return {
      w, dens, lam, p1: C.poissonTail(1, lam), pk, pM: C.binomTail(Meff(), S.n, pk), pAll: Math.pow(pk, S.n),
      pK: C.poissonTail(S.K, S.n * lam), total: S.n * lam, glim, incomplete: inc,
      v1: C.V1.inWindow(S.band, S.mb, S.mf, S.l, S.b) * A,
    };
  }

  // ===================================================================== inputs
  function buildSelects() {
    $('telSel').innerHTML = TELESCOPES.map((t) => `<option value="${t.id}">${esc(t.name)}${t.plate ? ` — ${t.plate} µm/″` : ''}</option>`).join('');
    let html = '', open = false;
    for (const s of SENSORS) {
      if ('group' in s) { if (open) html += '</optgroup>'; html += s.group ? `<optgroup label="${esc(s.group)}">` : ''; open = !!s.group; continue; }
      html += `<option value="${s.id}">${esc(s.name)}${s.x ? ` — ${s.x}×${s.y}, ${s.pix} µm` : ''}</option>`;
    }
    $('senSel').innerHTML = html + (open ? '</optgroup>' : '');
    $('band').innerHTML = BAND_GROUPS.map(([g, ks]) => `<optgroup label="${g}">${ks.map((k) => `<option value="${k}">${esc(BAND_TEXT(k))}</option>`).join('')}</optgroup>`).join('');
    $('quickSel').innerHTML = FIELDS.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
    $('mapMetric').innerHTML = METRICS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  }

  function syncEqFromGal() { [S.ra, S.dec] = C.galToEq(S.l, S.b); }
  function writeInputs() {
    syncEqFromGal();
    const v = { plateScale: S.plate, siteLat: S.lat, chipX: S.chipX, chipY: S.chipY, pixSize: S.pix, nSensors: S.n,
      magBright: S.mb, magFaint: S.mf, gl: +fmtDeg(S.l, 3), gb: +fmtDeg(S.b, 3), ra: +fmtDeg(S.ra, 3), dec: +fmtDeg(S.dec, 3),
      kStars: S.k, mSensors: S.M, kTotal: S.K, thresh: S.thr, bMin: S.bMin, zMax: S.zMax, ringR: S.ring };
    for (const [id, x] of Object.entries(v)) { const el = $(id); if (document.activeElement !== el) el.value = x; el.removeAttribute('aria-invalid'); }
    $('telSel').value = S.tel; $('senSel').value = S.sen; $('band').value = S.band;
    $('mapMetric').value = S.metric; $('layoutSel').value = S.layout;
    $('projGal').setAttribute('aria-pressed', S.proj === 'gal'); $('projEq').setAttribute('aria-pressed', S.proj === 'eq');
  }

  function onNumber(e) {
    const id = e.target.id, [key, lo, hi, isInt] = NUM[id];
    const x = parseFloat(e.target.value);
    const ok = Number.isFinite(x) && x >= lo && x <= hi && (!isInt || Number.isInteger(x));
    let valid = ok;
    if (ok && id === 'magFaint' && x <= S.mb) valid = false;
    if (ok && id === 'magBright' && x >= S.mf) valid = false;
    e.target.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (!valid) return;
    S[key] = x;
    if (id === 'ra' || id === 'dec') {
      [S.l, S.b] = C.eqToGal(S.ra, S.dec);
      $('gl').value = +fmtDeg(S.l, 3); $('gb').value = +fmtDeg(S.b, 3);
    } else if (id === 'gl' || id === 'gb') {
      S.l = ((S.l % 360) + 360) % 360;
      syncEqFromGal();
      $('ra').value = +fmtDeg(S.ra, 3); $('dec').value = +fmtDeg(S.dec, 3);
    }
    if (id === 'plateScale') { const t = TEL_BY_ID[S.tel]; if (!t.plate || Math.abs(t.plate - x) > 1e-9) { S.tel = 'custom'; $('telSel').value = 'custom'; } }
    if (id === 'chipX' || id === 'chipY' || id === 'pixSize') {
      const s = SENSOR_BY_ID[S.sen];
      if (!s.x || s.x !== S.chipX || s.y !== S.chipY || s.pix !== S.pix) { S.sen = 'custom'; $('senSel').value = 'custom'; }
    }
    if (id === 'magFaint') $('magBright').setAttribute('aria-invalid', 'false');
    if (id === 'magBright') $('magFaint').setAttribute('aria-invalid', 'false');
    $('quickSel').value = '';
    schedule();
  }

  function applyTelescope(id) {
    S.tel = id;
    const t = TEL_BY_ID[id];
    if (t.plate) { S.plate = t.plate; S.lat = t.lat; S.ring = t.ring; }
    writeInputs();
    schedule();
  }
  function applySensor(id) {
    S.sen = id;
    const s = SENSOR_BY_ID[id];
    if (s.x) { S.chipX = s.x; S.chipY = s.y; S.pix = s.pix; }
    writeInputs();
    schedule();
  }

  function bindInputs() {
    for (const id of Object.keys(NUM)) $(id).addEventListener('input', onNumber);
    $('telSel').addEventListener('change', (e) => applyTelescope(e.target.value));
    $('senSel').addEventListener('change', (e) => applySensor(e.target.value));
    $('band').addEventListener('change', (e) => { S.band = e.target.value; schedule(); });
    $('mapMetric').addEventListener('change', (e) => { S.metric = e.target.value; schedule(); });
    $('layoutSel').addEventListener('change', (e) => { S.layout = e.target.value; schedule(); });
    $('projGal').addEventListener('click', () => { S.proj = 'gal'; writeInputs(); schedule(); });
    $('projEq').addEventListener('click', () => { S.proj = 'eq'; writeInputs(); schedule(); });
    $('quickSel').addEventListener('change', (e) => {
      const f = FIELDS.find((x) => x.id === e.target.value);
      if (!f || !f.id) return;
      if (f.ra !== undefined) [S.l, S.b] = C.eqToGal(f.ra, f.dec); else { S.l = f.l; S.b = f.b; }
      writeInputs(); schedule();
      e.target.value = f.id;
    });
    $('nativeBtn').addEventListener('click', () => {
      const t = TEL_BY_ID[S.tel];
      if (!t.sensor) return;
      S.n = t.n; S.M = Math.min(S.M, t.n);
      applySensor(t.sensor);
    });
    $('queryBtn').addEventListener('click', runFields);
    $('themeBtn').addEventListener('click', () => {
      const r = document.documentElement;
      r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('starcount-theme', r.dataset.theme); } catch (_) { /* private mode */ }
      $('themeBtn').textContent = r.dataset.theme === 'light' ? 'Dark' : 'Light';
      lastFields && redrawFields();
      schedule();
    });
    $('linkBtn').addEventListener('click', async () => {
      writeHash();
      setTimeout(async () => {
        try { await navigator.clipboard.writeText(location.href); $('linkBtn').textContent = 'Copied'; }
        catch (_) { $('linkBtn').textContent = 'See URL'; }
        setTimeout(() => ($('linkBtn').textContent = 'Copy link'), 1500);
      }, 300);
    });
    window.addEventListener('resize', () => { mapGeo = null; schedule(); });
  }

  // ===================================================================== render: text panels
  function renderInputNotes() {
    const t = TEL_BY_ID[S.tel], g = geom();
    $('telNote').innerHTML = t.plate ? t.note : 'Enter the plate scale at the guide-sensor location.';
    const native = t.sensor && SENSOR_BY_ID[t.sensor];
    $('nativeRow').hidden = !native;
    if (native) $('nativeTxt').textContent = `${native.name.replace(/ \(.*\)/, '')}, ${native.x}×${native.y}, ${native.pix} µm · n = ${t.n}`;
    $('derived').innerHTML =
      `<span>Pixel scale</span><span>${g.pixScale.toFixed(3)}″/px · ${(1000 / S.plate).toFixed(3)}″/mm</span>` +
      `<span>Sensor FOV</span><span>${g.fx.toFixed(2)}′ × ${g.fy.toFixed(2)}′ = <b style="color:var(--ink)">${g.area.toFixed(1)} arcmin²</b></span>` +
      `<span>Imaging area</span><span>${g.mmX.toFixed(1)} × ${g.mmY.toFixed(1)} mm</span>` +
      `<span>All sensors</span><span>${(S.n * g.area).toFixed(0)} arcmin² (${S.n} × ${g.area.toFixed(1)})</span>`;
    const B = D.bands[S.band];
    const [o0, o1] = model.bandOffsetRange(S.band);
    $('bandNote').innerHTML = S.band === 'G'
      ? 'Gaia G counts are used directly; G is also a fair proxy for an unfiltered back-illuminated silicon sensor.'
      : `${B.system}. Each star is converted from Gaia G with G − ${BAND_TEXT(S.band)} = f(BP−RP): ` +
        `${B.source.replace(/;.*/, '')} (sampled BP−RP ${B.cRange[0]}–${B.cRange[1]}; typical scatter ${median(B.sig.slice(8, 25)).toFixed(2)} mag). ` +
        `G − ${BAND_TEXT(S.band)} spans ${o0.toFixed(2)} to ${o1.toFixed(2)} mag over the colour range.`;
    const [d0, d1] = decRange();
    $('fpNote').innerHTML = `Footprint: |b| ≥ ${S.bMin}° and Dec ${d0.toFixed(0)}° … ${d1.toFixed(0)}° (site ${S.lat.toFixed(1)}°, zenith distance ≤ ${S.zMax}°, airmass ≤ ${(1 / Math.cos(Math.min(S.zMax, 89) * C.DEG)).toFixed(2)}).` +
      (S.M > S.n ? ` <span class="err">M is capped at n = ${S.n}.</span>` : '');
  }
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };

  function tile(k, v, s, p) {
    const st = p === undefined ? '' : (() => { const q = statusOf(p); return `<div class="status ${q.cls}"><i aria-hidden="true">${q.icon}</i>${q.text}</div>`; })();
    return `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div>${st}</div>`;
  }

  function renderTiles(P) {
    const M = Meff();
    $('tiles').innerHTML =
      tile('Expected stars / sensor', fmtLam(P.lam), `${P.dens.toFixed(3)} per arcmin² · ${fmtInt(P.dens * 3600)} per deg²`) +
      tile('P(≥ 1 star) per sensor', fmtP(P.p1), 'Poisson, one sensor', P.p1) +
      tile(`P(≥ ${S.k} stars) per sensor`, fmtP(P.pk), `all ${S.n} sensors: ${fmtP(P.pAll)}`, P.pk) +
      tile(`P(≥ ${M} of ${S.n} sensors with ≥ ${S.k})`, fmtP(P.pM), 'sensors independent', P.pM) +
      tile(`Total stars on ${S.n} sensors`, fmtLam(P.total), `P(total ≥ ${S.K}) = ${fmtP(P.pK)}`, P.pK);
    const ratio = P.v1 / P.lam;
    $('pointLine').innerHTML =
      `<span>l ${fmtDeg(S.l)}°, b ${fmtDeg(S.b)}° · RA ${fmtDeg(S.ra)}°, Dec ${fmtDeg(S.dec)}°</span>` +
      `<span>${BAND_TEXT(S.band)} ${S.mb}–${S.mf} mag</span>` +
      (P.incomplete ? `<span class="flag">! Gaia is incomplete here beyond G ≈ ${P.glim.toFixed(1)}: counts are lower limits</span>`
        : `<span>Gaia complete to G ≈ ${P.glim.toFixed(1)} here</span>`) +
      `<span title="Analytic disk+spheroid model of the original page">v1 model: ${fmtLam(P.v1)} stars/sensor (×${ratio.toFixed(2)})</span>`;
  }

  // footprint statistics
  function renderCoverage() {
    let n = 0, sumP = 0, okM = 0, okK = 0, okk = 0;
    const lams = [];
    const thr = S.thr / 100;
    for (let p = 0; p < NP; p++) {
      if (!arr.inFp[p]) continue;
      n++; lams.push(arr.lam[p]); sumP += arr.pM[p];
      if (arr.pM[p] >= thr) okM++;
      if (arr.pK[p] >= thr) okK++;
      if (arr.pk[p] >= thr) okk++;
    }
    if (!n) { $('coverage').innerHTML = 'The footprint is empty for these limits.'; return; }
    lams.sort((a, b) => a - b);
    const q = (f) => lams[Math.min(n - 1, Math.floor(f * n))];
    const pct = (x) => (100 * x / n).toFixed(0) + '%';
    const M = Meff();
    $('coverage').innerHTML =
      `Footprint <b>${fmtInt(n * pixArea)} deg²</b>: stars per sensor median <b>${fmtLam(q(0.5))}</b>, 5th percentile <b>${fmtLam(q(0.05))}</b>, 95th ${fmtLam(q(0.95))}. ` +
      `P ≥ ${S.thr}% for: one sensor ≥ ${S.k} stars on <b>${pct(okk)}</b> of the footprint · ≥ ${M} of ${S.n} sensors ≥ ${S.k} on <b>${pct(okM)}</b> · total ≥ ${S.K} on <b>${pct(okK)}</b>. ` +
      `A random footprint pointing meets "≥ ${M} of ${S.n} sensors ≥ ${S.k}" with probability <b>${fmtP(sumP / n)}</b>.`;
  }

  // ===================================================================== sky map
  let mapGeo = null;          // { key, W, H, cssW, cssH, pad, ew, eh, idx(Int32Array over raster), dpr }
  const SQ2 = Math.SQRT2;
  function mapLayout() {
    const cv = $('mapCanvas');
    const cssW = Math.max(320, cv.parentElement.clientWidth);
    const pad = 6, ew = cssW - 2 * pad, eh = ew / 2, cssH = Math.round(eh + 2 * pad);
    const key = `${cssW}|${S.proj}`;
    if (mapGeo && mapGeo.key === key) return mapGeo;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
    // raster at CSS resolution, upscaled when drawn
    const W = cssW, H = cssH, idx = new Int32Array(W * H).fill(-1);
    for (let j = 0; j < H; j++) {
      const y = (0.5 - (j + 0.5 - pad) / eh) * 2 * SQ2;
      for (let i = 0; i < W; i++) {
        const x = ((i + 0.5 - pad) / ew - 0.5) * 4 * SQ2;
        const ll = C.mollweideInv(x, y);
        if (!ll) continue;
        idx[j * W + i] = skyToPix(ll[0], ll[1]);
      }
    }
    mapGeo = { key, W, H, cssW, cssH, pad, ew, eh, idx, dpr, raster: null };
    return mapGeo;
  }
  // map longitude (positive to the right of centre) -> HEALPix pixel
  function mapLonLat(lonX, lat) {
    return S.proj === 'gal' ? [((-lonX) % 360 + 360) % 360, lat] : [((180 - lonX) % 360 + 360) % 360, lat];
  }
  function skyToPix(lonX, lat) {
    const [a, b] = mapLonLat(lonX, lat);
    const [ra, dec] = S.proj === 'gal' ? C.galToEq(a, b) : [a, b];
    return C.ang2pixNest(model.nside, ra, dec);
  }
  function lonToX(lon) {     // sky longitude (l or RA) -> signed offset from the map centre, + right
    const c = S.proj === 'gal' ? -lon : 180 - lon;
    return ((c + 540) % 360) - 180;
  }
  function project(lon, lat) {
    const g = mapGeo, [X, Y] = C.mollweideFwd(lonToX(lon), lat);
    return [g.pad + (X / (4 * SQ2) + 0.5) * g.ew, g.pad + (0.5 - Y / (2 * SQ2)) * g.eh];
  }

  function metricValues() {
    const m = S.metric;
    return m === 'lam' ? arr.lam : m === 'pk' ? arr.pk : m === 'pM' ? arr.pM : arr.pK;
  }
  function lamDomain() {
    const xs = [];
    for (let p = 0; p < NP; p++) if (arr.lam[p] > 0) xs.push(arr.lam[p]);
    xs.sort((a, b) => a - b);
    if (!xs.length) return [-2, 0];
    let lo = Math.floor(Math.log10(xs[Math.floor(0.01 * xs.length)] || 1e-3));
    let hi = Math.ceil(Math.log10(xs[Math.floor(0.995 * (xs.length - 1))]));
    if (hi - lo < 2) hi = lo + 2;
    return [Math.max(lo, -4), hi];
  }

  function drawMap() {
    const g = mapLayout(), T = theme(), cv = $('mapCanvas'), ctx = cv.getContext('2d');
    const isP = S.metric !== 'lam';
    const vals = metricValues();
    const lut = isP ? lutFrom([T.divLo, T.neutral, T.divHi]) : lutFrom(T.ramp);
    const [lo, hi] = isP ? [0, 1] : lamDomain();
    const thr = S.thr / 100;
    // per-pixel colour index
    const ci = new Uint8Array(NP);
    for (let p = 0; p < NP; p++) {
      const v = vals[p];
      const t = isP ? v : (v > 0 ? (Math.log10(v) - lo) / (hi - lo) : 0);
      ci[p] = Math.max(0, Math.min(255, Math.round(t * 255)));
    }
    const surf = hexRgb(T.surface), mut = hexRgb(T.muted), ink = hexRgb(T.ink);
    const img = new ImageData(g.W, g.H), px = img.data;
    for (let j = 0; j < g.H; j++) {
      for (let i = 0; i < g.W; i++) {
        const o = j * g.W + i, p = g.idx[o], q = o * 4;
        if (p < 0) { px[q + 3] = 0; continue; }
        let r = lut[ci[p] * 3], gg = lut[ci[p] * 3 + 1], b = lut[ci[p] * 3 + 2];
        if (arr.incomplete[p] && ((i + j) % 7 === 0)) { r = mut[0]; gg = mut[1]; b = mut[2]; }   // 45° hatch
        if (!arr.inFp[p]) { r = r * 0.35 + surf[0] * 0.65; gg = gg * 0.35 + surf[1] * 0.65; b = b * 0.35 + surf[2] * 0.65; }
        if (isP && i > 0 && j > 0) {           // requirement contour
          const a = vals[p] >= thr, pl = g.idx[o - 1], pu = g.idx[o - g.W];
          if ((pl >= 0 && (vals[pl] >= thr) !== a) || (pu >= 0 && (vals[pu] >= thr) !== a)) { r = ink[0]; gg = ink[1]; b = ink[2]; }
        }
        px[q] = r; px[q + 1] = gg; px[q + 2] = b; px[q + 3] = 255;
      }
    }
    const off = g.raster || (g.raster = document.createElement('canvas'));
    off.width = g.W; off.height = g.H;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.cssW, g.cssH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, g.W, g.H);
    drawGraticule(ctx, T);
    // pointing marker
    const [mx, my] = S.proj === 'gal' ? project(S.l, S.b) : project(S.ra, S.dec);
    ctx.lineWidth = 4; ctx.strokeStyle = T.surface;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, 2 * Math.PI); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = T.accent;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.lineTo(mx - 9, my); ctx.moveTo(mx + 9, my); ctx.lineTo(mx + 12, my);
    ctx.moveTo(mx, my - 12); ctx.lineTo(mx, my - 9); ctx.moveTo(mx, my + 9); ctx.lineTo(mx, my + 12); ctx.stroke();
    renderColorbar(T, isP, lo, hi);
  }

  function drawGraticule(ctx, T) {
    ctx.save();
    ctx.lineWidth = 0.75; ctx.strokeStyle = T.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    const line = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const [x, y] = project(a, b); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    for (let lat = -60; lat <= 60; lat += 30) { const pts = []; for (let d = -179.9; d <= 179.9; d += 2) pts.push([S.proj === 'gal' ? -d : 180 - d, lat]); line(pts); }
    for (let lon = 0; lon < 360; lon += 60) { const pts = []; for (let lat = -90; lat <= 90; lat += 2) pts.push([lon, lat]); line(pts); }
    // the other frame's equator, dashed
    ctx.setLineDash([4, 4]); ctx.strokeStyle = T.dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
    const pts = [];
    for (let a = 0; a <= 360; a += 1) {
      const [x, y] = S.proj === 'gal' ? C.eqToGal(a, 0) : C.galToEq(a, 0);
      pts.push([x, y]);
    }
    let prev = null;
    ctx.beginPath();
    for (const [a, b] of pts) {
      const [x, y] = project(a, b);
      if (prev && Math.abs(x - prev[0]) > mapGeo.ew / 3) ctx.moveTo(x, y); else if (prev) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      prev = [x, y];
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // labels
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = T.ink2; ctx.textAlign = 'center';
    const labs = S.proj === 'gal'
      ? [[0, 'l 0°'], [90, '90°'], [270, '270°']]
      : [[180, 'RA 12h'], [90, '6h'], [270, '18h']];
    for (const [lon, t] of labs) { const [x, y] = project(lon, 0); ctx.fillText(t, x, y - 4); }
    ctx.textAlign = 'left';
    ctx.fillText(S.proj === 'gal' ? 'Galactic · dashed: celestial equator' : 'Equatorial · dashed: Galactic plane', mapGeo.pad + 4, mapGeo.cssH - 8);
    ctx.restore();
  }

  function renderColorbar(T, isP, lo, hi) {
    const cb = $('colorbar');
    const w = 260, c = document.createElement('canvas');
    c.width = w; c.height = 12;
    const x = c.getContext('2d'), lut = isP ? lutFrom([T.divLo, T.neutral, T.divHi]) : lutFrom(T.ramp);
    for (let i = 0; i < w; i++) { const k = Math.round((i / (w - 1)) * 255) * 3; x.fillStyle = `rgb(${lut[k]},${lut[k + 1]},${lut[k + 2]})`; x.fillRect(i, 0, 1, 12); }
    const lab = isP ? ['0%', '50%', '100%'] : [10 ** lo, 10 ** ((lo + hi) / 2), 10 ** hi].map((v) => fmtLam(v));
    cb.innerHTML = '';
    const left = document.createElement('span'); left.textContent = lab[0];
    const right = document.createElement('span'); right.textContent = lab[2];
    cb.append(left, c, right);
    const extra = document.createElement('span');
    extra.innerHTML = (isP ? ` · <span class="legend-item"><span class="swatch" style="background:${T.ink};height:2px"></span>${S.thr}% contour</span>` : ' stars per sensor (log)') +
      ` · <span class="legend-item"><span class="swatch" style="background:${T.surface};border:1px solid ${T.muted}"></span>dimmed: outside footprint</span>` +
      ` · <span class="legend-item"><span class="swatch" style="background:repeating-linear-gradient(135deg,${T.muted} 0 1px,transparent 1px 5px)"></span>hatched: Gaia incomplete at the faint limit</span>`;
    cb.append(extra);
  }

  function mapEventPix(e) {
    const g = mapGeo; if (!g) return null;
    const r = $('mapCanvas').getBoundingClientRect();
    const i = e.clientX - r.left, j = e.clientY - r.top;
    const x = ((i - g.pad) / g.ew - 0.5) * 4 * SQ2, y = (0.5 - (j - g.pad) / g.eh) * 2 * SQ2;
    const ll = C.mollweideInv(x, y);
    if (!ll) return null;
    const [a, b] = mapLonLat(ll[0], ll[1]);
    let l, gb, ra, dec;
    if (S.proj === 'gal') { l = a; gb = b; [ra, dec] = C.galToEq(l, gb); } else { ra = a; dec = b; [l, gb] = C.eqToGal(ra, dec); }
    return { l, b: gb, ra, dec, p: C.ang2pixNest(model.nside, ra, dec) };
  }
  function bindMap() {
    const cv = $('mapCanvas'), tip = $('tip');
    cv.addEventListener('mousemove', (e) => {
      const h = mapEventPix(e);
      if (!h) { tip.style.display = 'none'; return; }
      const p = h.p;
      tip.innerHTML = `<div class="t">l ${h.l.toFixed(1)}°, b ${h.b.toFixed(1)}° · RA ${h.ra.toFixed(1)}°, Dec ${h.dec.toFixed(1)}°</div>` +
        `<div><b>${fmtLam(arr.lam[p])}</b> stars / sensor (${(arr.dens[p] * 3600).toFixed(0)} deg⁻²)</div>` +
        `<div>P(≥ ${S.k}) ${fmtP(arr.pk[p])} · P(≥ ${Meff()} of ${S.n}) ${fmtP(arr.pM[p])} · P(Σ ≥ ${S.K}) ${fmtP(arr.pK[p])}</div>` +
        (arr.inFp[p] ? '' : '<div class="t">outside footprint</div>') +
        (arr.incomplete[p] ? `<div class="t">Gaia incomplete beyond G ≈ ${model.gLim[p].toFixed(1)}</div>` : '');
      showTip(e);
    });
    cv.addEventListener('mouseleave', () => (tip.style.display = 'none'));
    cv.addEventListener('click', (e) => {
      const h = mapEventPix(e);
      if (!h) return;
      S.l = +h.l.toFixed(2); S.b = +h.b.toFixed(2);
      $('quickSel').value = '';
      writeInputs(); schedule();
    });
  }
  function showTip(e) {
    const tip = $('tip');
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  // ===================================================================== charts
  const RINGS = [90, 60, 30, 20, 10];
  const MAGS = []; for (let m = 8; m <= 23.0001; m += 0.25) MAGS.push(+m.toFixed(2));
  let ringCache = { band: null, curves: null };
  let ringPix = null;
  function ringPixels() {
    if (ringPix) return ringPix;
    ringPix = RINGS.map((b0) => {
      const sel = [];
      for (let p = 0; p < NP; p++) {
        const ab = Math.abs(model.gb[p]);
        if (b0 === 90 ? ab >= 84 : Math.abs(ab - b0) <= 2.5) sel.push(p);
      }
      const stride = Math.max(1, Math.floor(sel.length / 240));    // ≤ ~240 pixels per ring
      return sel.filter((_, i) => i % stride === 0);
    });
    return ringPix;
  }
  // median cumulative density (per arcmin^2) over longitude for each reference |b|
  function ringCurves() {
    if (ringCache.band === S.band) return ringCache.curves;
    model.prepareBand(S.band);
    const inv = 1 / model.pixArcmin2;
    const curves = ringPixels().map((pixels) => {
      const cols = MAGS.map(() => []);
      for (const p of pixels) MAGS.forEach((m, i) => cols[i].push(model.cumulative(p, m) * inv));
      return cols.map(median);
    });
    ringCache = { band: S.band, curves };
    return curves;
  }
  function pointCurve(P) {
    model.prepareBand(S.band);
    const inv = 1 / model.pixArcmin2;
    return MAGS.map((m) => { let s = 0; for (const [p, w] of P.w) s += w * model.cumulative(p, m); return s * inv; });
  }
  // λ percentiles vs |b| (2° bins), from the current λ map
  function latProfile() {
    const nb = 45, bins = Array.from({ length: nb }, () => []);
    for (let p = 0; p < NP; p++) bins[Math.min(nb - 1, Math.floor(Math.abs(model.gb[p]) / 2))].push(arr.lam[p]);
    return bins.map((v, i) => {
      if (v.length < 3) return null;
      v.sort((a, b) => a - b);
      const q = (f) => v[Math.min(v.length - 1, Math.floor(f * v.length))];
      return { b: 2 * i + 1, p10: q(0.1), p50: q(0.5), p90: q(0.9), n: v.length };
    }).filter(Boolean);
  }

  function setupCanvas(cv, cssH) {
    const cssW = Math.max(260, cv.parentElement.clientWidth);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W: cssW, H: cssH };
  }
  function logAxes(ctx, T, box, xr, yr, xlab, ylab, xstep) {
    const { x0, x1, y0, y1 } = box;
    const sx = (v) => x0 + ((v - xr[0]) / (xr[1] - xr[0])) * (x1 - x0);
    const sy = (v) => y1 - ((Math.log10(Math.max(v, 1e-12)) - yr[0]) / (yr[1] - yr[0])) * (y1 - y0);
    ctx.font = '11px system-ui, sans-serif';
    ctx.lineWidth = 1; ctx.strokeStyle = T.grid; ctx.fillStyle = T.muted;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let e = Math.ceil(yr[0]); e <= yr[1]; e++) {
      const y = Math.round(sy(10 ** e)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillText(10 ** e >= 1 ? fmtInt(10 ** e) : String(+(10 ** e).toPrecision(1)), x0 - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let v = Math.ceil(xr[0] / xstep) * xstep; v <= xr[1] + 1e-9; v += xstep) {
      const x = Math.round(sx(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillText(String(+v.toFixed(1)), x, y1 + 6);
    }
    ctx.strokeStyle = T.axis; ctx.beginPath(); ctx.moveTo(x0, y1 + 0.5); ctx.lineTo(x1, y1 + 0.5); ctx.stroke();
    ctx.fillStyle = T.ink2; ctx.fillText(xlab, (x0 + x1) / 2, y1 + 22);
    ctx.save(); ctx.translate(12, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(ylab, 0, 0); ctx.restore();
    return { sx, sy };
  }
  function polyline(ctx, xs, ys, sx, sy, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    xs.forEach((x, i) => { const y = ys[i]; if (!(y > 0)) { pen = false; return; } const X = sx(x), Y = sy(y); pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; });
    ctx.stroke(); ctx.restore();
  }
  function clipBox(ctx, box) { ctx.save(); ctx.beginPath(); ctx.rect(box.x0, box.y0 - 2, box.x1 - box.x0, box.y1 - box.y0 + 4); ctx.clip(); }

  let chartState = {};
  function drawChartA(P, hoverM) {
    const T = theme(), cv = $('chartA');
    const { ctx, W, H } = setupCanvas(cv, 300);
    const A = geom().area;
    const box = { x0: 52, x1: W - 58, y0: 10, y1: H - 40 };
    const rings = ringCurves(), pc = pointCurve(P);
    const xr = [10, 22];
    const vis = (arrv) => arrv.filter((_, i) => MAGS[i] >= xr[0] && MAGS[i] <= xr[1]).map((v) => v * A).filter((v) => v > 0);
    const all = [...vis(pc), ...rings.flatMap(vis)];
    const yr = [Math.max(-3, Math.floor(Math.log10(Math.min(...all, 1)))), Math.ceil(Math.log10(Math.max(...all, 10)))];
    ctx.fillStyle = T.surface; ctx.fillRect(0, 0, W, H);
    // magnitude window
    const { sx, sy } = logAxes(ctx, T, box, xr, yr, `Limiting magnitude (${BAND_TEXT(S.band)})`, 'Stars per sensor, brighter than m', 1);
    ctx.fillStyle = T.dark ? 'rgba(57,135,229,0.12)' : 'rgba(42,120,214,0.10)';
    const wx0 = Math.max(box.x0, sx(S.mb)), wx1 = Math.min(box.x1, sx(S.mf));
    if (wx1 > wx0) ctx.fillRect(wx0, box.y0, wx1 - wx0, box.y1 - box.y0);
    // Gaia completeness (for median colour) at this pointing
    const mComp = P.glim - model.bandOffset(S.band, 1.0);
    if (mComp < xr[1]) {
      ctx.fillStyle = T.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(sx(mComp), box.y0, box.x1 - sx(mComp), box.y1 - box.y0);
      ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('Gaia incomplete →', box.x1 - 4, box.y0 + 2);
    }
    clipBox(ctx, box);
    // reference levels N = 1 and N = k
    ctx.setLineDash([2, 3]); ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
    for (const lv of [1, S.k].filter((v, i, a) => v > 0 && a.indexOf(v) === i)) {
      const y = sy(lv); ctx.beginPath(); ctx.moveTo(box.x0, y); ctx.lineTo(box.x1, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    const xsA = MAGS;
    rings.forEach((curve, i) => polyline(ctx, xsA, curve.map((v) => v * A), sx, sy, T.ord[i], 1.5));
    polyline(ctx, xsA, pc.map((v) => v * A), sx, sy, T.accent, 2.5);
    ctx.restore();
    // direct labels at right edge
    ctx.font = '10.5px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const ends = rings.map((c, i) => ({ y: sy(c[MAGS.indexOf(xr[1])] * A), t: `|b| ${RINGS[i]}°`, c: T.ink2 }));
    ends.push({ y: sy(pc[MAGS.indexOf(xr[1])] * A), t: 'pointing', c: T.ink });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
    for (const e of ends) { ctx.fillStyle = e.c; ctx.fillText(e.t, box.x1 + 5, Math.min(box.y1, Math.max(box.y0, e.y))); }
    ctx.fillStyle = T.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (const lv of [1, S.k].filter((v, i, a) => v > 0 && a.indexOf(v) === i)) ctx.fillText(`N = ${lv}`, box.x0 + 4, sy(lv) - 2);
    // hover crosshair
    if (hoverM !== undefined) {
      const i = Math.max(0, Math.min(MAGS.length - 1, Math.round((hoverM - MAGS[0]) / 0.25)));
      const x = sx(MAGS[i]);
      ctx.strokeStyle = T.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, box.y0); ctx.lineTo(x, box.y1); ctx.stroke();
      const dot = (v, c) => { if (!(v > 0)) return; ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(x, sy(v), 5, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, sy(v), 3.5, 0, 7); ctx.fill(); };
      rings.forEach((c, k) => dot(c[i] * A, T.ord[k]));
      dot(pc[i] * A, T.accent);
      chartState.A = { i };
    }
    chartState.A = { ...chartState.A, box, sx, sy, xr, rings, pc, A };
    $('legendA').innerHTML = `<span class="legend-item"><span class="line-swatch" style="border-color:${T.accent};border-top-width:3px"></span>pointing</span>` +
      RINGS.map((b, i) => `<span class="legend-item"><span class="line-swatch" style="border-color:${T.ord[i]}"></span>|b| ${b}°</span>`).join('') +
      `<span class="legend-item"><span class="swatch" style="background:rgba(57,135,229,0.25)"></span>magnitude window</span>`;
    $('chartASub').textContent = `${A.toFixed(1)} arcmin² sensor · blue: median over longitude at each |b|`;
  }

  function drawChartB(P, hoverB) {
    const T = theme(), cv = $('chartB');
    const { ctx, W, H } = setupCanvas(cv, 300);
    const A = geom().area;
    const box = { x0: 52, x1: W - 16, y0: 10, y1: H - 40 };
    const prof = latProfile();
    const v1 = []; for (let b = 1; b <= 89; b += 2) v1.push({ b, v: C.V1.inWindow(S.band, S.mb, S.mf, 180, b) * A });
    const all = [...prof.flatMap((r) => [r.p10, r.p90]), ...v1.map((r) => r.v), P.lam].filter((v) => v > 0);
    const yr = [Math.max(-3, Math.floor(Math.log10(Math.min(...all, 1)))), Math.ceil(Math.log10(Math.max(...all, 10)))];
    ctx.fillStyle = T.surface; ctx.fillRect(0, 0, W, H);
    const { sx, sy } = logAxes(ctx, T, box, [0, 90], yr, 'Galactic latitude |b| (°)', `Stars per sensor, ${S.mb}–${S.mf} mag`, 10);
    clipBox(ctx, box);
    // footprint edge
    ctx.setLineDash([2, 3]); ctx.strokeStyle = T.muted; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx(S.bMin), box.y0); ctx.lineTo(sx(S.bMin), box.y1); ctx.stroke();
    // λ giving P(≥k) = threshold
    const lamNeed = lambdaFor(S.k, S.thr / 100);
    if (lamNeed > 0) { const y = sy(lamNeed); ctx.beginPath(); ctx.moveTo(box.x0, y); ctx.lineTo(box.x1, y); ctx.stroke(); }
    ctx.setLineDash([]);
    // 10-90% band
    ctx.fillStyle = T.dark ? 'rgba(57,135,229,0.22)' : 'rgba(42,120,214,0.18)';
    ctx.beginPath();
    prof.forEach((r, i) => { const x = sx(r.b), y = sy(Math.max(r.p90, 1e-12)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    [...prof].reverse().forEach((r) => ctx.lineTo(sx(r.b), sy(Math.max(r.p10, 1e-12))));
    ctx.closePath(); ctx.fill();
    polyline(ctx, prof.map((r) => r.b), prof.map((r) => r.p50), sx, sy, T.blue, 2);
    polyline(ctx, v1.map((r) => r.b), v1.map((r) => r.v), sx, sy, T.muted, 1.5, [5, 4]);
    // pointing
    const px = sx(Math.abs(S.b)), py = sy(Math.max(P.lam, 1e-12));
    ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.font = '10.5px system-ui, sans-serif'; ctx.fillStyle = T.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    if (lamNeed > 0) ctx.fillText(`λ for P(≥${S.k}) = ${S.thr}%`, box.x0 + 4, sy(lamNeed) - 2);
    ctx.textAlign = 'right'; ctx.fillText(`|b| ≥ ${S.bMin}°`, sx(S.bMin) - 3, box.y0 + 12);
    if (hoverB !== undefined) {
      const r = prof.reduce((a, c) => (Math.abs(c.b - hoverB) < Math.abs(a.b - hoverB) ? c : a), prof[0]);
      const x = sx(r.b);
      ctx.strokeStyle = T.ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, box.y0); ctx.lineTo(x, box.y1); ctx.stroke();
      ctx.fillStyle = T.surface; ctx.beginPath(); ctx.arc(x, sy(r.p50), 5, 0, 7); ctx.fill();
      ctx.fillStyle = T.blue; ctx.beginPath(); ctx.arc(x, sy(r.p50), 3.5, 0, 7); ctx.fill();
    }
    chartState.B = { box, sx, prof, v1 };
    $('legendB').innerHTML =
      `<span class="legend-item"><span class="line-swatch" style="border-color:${T.blue}"></span>median over longitude</span>` +
      `<span class="legend-item"><span class="swatch" style="background:rgba(57,135,229,0.35)"></span>10–90% of longitudes</span>` +
      `<span class="legend-item"><span class="swatch" style="background:${T.accent};width:9px;height:9px;border-radius:50%"></span>pointing</span>` +
      `<span class="legend-item"><span class="line-swatch dash" style="border-color:${T.muted}"></span>v1 analytic model (l = 180°)</span>`;
    $('chartBSub').textContent = `${BAND_TEXT(S.band)} ${S.mb}–${S.mf} · both hemispheres, 2° bins`;
  }
  // smallest λ with P(X ≥ k) ≥ p
  function lambdaFor(k, p) {
    if (k <= 0) return 0;
    let lo = 0, hi = Math.max(10, 4 * k + 20);
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; C.poissonTail(k, mid) >= p ? (hi = mid) : (lo = mid); }
    return hi;
  }

  function bindCharts() {
    const tip = $('tip');
    $('chartA').addEventListener('mousemove', (e) => {
      const st = chartState.A; if (!st) return;
      const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left;
      if (x < st.box.x0 || x > st.box.x1) { tip.style.display = 'none'; return; }
      const m = st.xr[0] + ((x - st.box.x0) / (st.box.x1 - st.box.x0)) * (st.xr[1] - st.xr[0]);
      const P = lastPoint; drawChartA(P, m);
      const i = chartState.A.i;
      tip.innerHTML = `<div class="t">${BAND_TEXT(S.band)} &lt; ${MAGS[i].toFixed(2)}</div>` +
        `<div><b>pointing</b> ${fmtLam(st.pc[i] * st.A)}</div>` +
        RINGS.map((b, k) => `<div>|b| ${b}° ${fmtLam(st.rings[k][i] * st.A)}</div>`).join('');
      showTip(e);
    });
    $('chartA').addEventListener('mouseleave', () => { tip.style.display = 'none'; lastPoint && drawChartA(lastPoint); });
    $('chartB').addEventListener('mousemove', (e) => {
      const st = chartState.B; if (!st || !st.prof.length) return;
      const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left;
      if (x < st.box.x0 || x > st.box.x1) { tip.style.display = 'none'; return; }
      const b = ((x - st.box.x0) / (st.box.x1 - st.box.x0)) * 90;
      drawChartB(lastPoint, b);
      const row = st.prof.reduce((a, c) => (Math.abs(c.b - b) < Math.abs(a.b - b) ? c : a), st.prof[0]);
      const v1 = st.v1.find((q) => q.b === row.b);
      tip.innerHTML = `<div class="t">|b| ${row.b - 1}–${row.b + 1}° (${row.n} sky pixels)</div>` +
        `<div><b>median ${fmtLam(row.p50)}</b> stars / sensor</div><div>10–90%: ${fmtLam(row.p10)} – ${fmtLam(row.p90)}</div>` +
        (v1 ? `<div class="t">v1 model: ${fmtLam(v1.v)}</div>` : '');
      showTip(e);
    });
    $('chartB').addEventListener('mouseleave', () => { tip.style.display = 'none'; lastPoint && drawChartB(lastPoint); });
  }

  function renderTable() {
    const st = chartState.A, sb = chartState.B;
    if (!st || !sb) return;
    let h = `<table class="data"><caption class="sub" style="text-align:left">Cumulative stars per sensor brighter than m (${BAND_TEXT(S.band)})</caption><tr><th>m</th><th>pointing</th>` +
      RINGS.map((b) => `<th>|b| ${b}°</th>`).join('') + '</tr>';
    for (let m = 12; m <= 22; m++) {
      const i = MAGS.indexOf(m);
      h += `<tr><td>${m}</td><td>${fmtLam(st.pc[i] * st.A)}</td>` + st.rings.map((c) => `<td>${fmtLam(c[i] * st.A)}</td>`).join('') + '</tr>';
    }
    h += '</table>';
    h += `<table class="data" style="margin-top:14px"><caption class="sub" style="text-align:left">Stars per sensor in ${S.mb}–${S.mf} mag vs |b|</caption><tr><th>|b| bin</th><th>10%</th><th>median</th><th>90%</th><th>v1 model</th></tr>`;
    for (const r of sb.prof.filter((q) => (q.b - 1) % 10 === 0 || q.b === 89)) {
      const v1 = sb.v1.find((q) => q.b === r.b);
      h += `<tr><td>${r.b - 1}–${r.b + 1}°</td><td>${fmtLam(r.p10)}</td><td>${fmtLam(r.p50)}</td><td>${fmtLam(r.p90)}</td><td>${v1 ? fmtLam(v1.v) : '–'}</td></tr>`;
    }
    $('tableView').innerHTML = h + '</table>';
  }

  // ===================================================================== live Gaia fields
  const TAP_URL = 'https://dc.g-vo.org/tap/sync';
  let lastFields = null;      // { sensors, results, geom, band, mb, mf }
  let fieldsRun = 0;

  function layoutSensors(g, seed) {
    const out = [], fx = g.fx / 60, fy = g.fy / 60;        // degrees
    if (S.layout === 'ring') {
      const [ra0, dec0] = C.galToEq(S.l, S.b);
      for (let i = 0; i < S.n; i++) {
        const phi = (i * 2 * Math.PI) / S.n;                  // from north through east
        const a = [Math.cos(phi), -Math.sin(phi)], b = [Math.sin(phi), Math.cos(phi)];
        const c = [S.ring * Math.sin(phi), S.ring * Math.cos(phi)];
        out.push(makeSensor(ra0, dec0, c, a, b, fx, fy));
      }
    } else {
      const rnd = C.mulberry32(seed);
      for (let i = 0; i < S.n; i++) {
        const l = rnd() * 360;
        let b = S.b;
        if (Math.abs(b) > 85) b = Math.sign(b || 1) * (Math.abs(b) - 3 * rnd());
        const [ra, dec] = C.galToEq(l, b);
        out.push(makeSensor(ra, dec, [0, 0], [1, 0], [0, 1], fx, fy));
      }
    }
    return out;
  }
  function makeSensor(ra0, dec0, c, a, b, fx, fy) {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
      C.gnomonicInv(c[0] + (u * fx / 2) * a[0] + (v * fy / 2) * b[0], c[1] + (u * fx / 2) * a[1] + (v * fy / 2) * b[1], ra0, dec0));
    const [ra, dec] = C.gnomonicInv(c[0], c[1], ra0, dec0);
    const [l, gb] = C.eqToGal(ra, dec);
    return { ra0, dec0, c, a, b, fx, fy, corners, ra, dec, l, gb };
  }

  async function queryGaia(s, gmin, gmax, signal) {
    const poly = s.corners.map(([r, d]) => `${r.toFixed(6)},${d.toFixed(6)}`).join(', ');
    const sql = `SELECT ra, dec, phot_g_mean_mag AS g, phot_bp_mean_mag AS bp, phot_rp_mean_mag AS rp FROM gaia.dr3lite ` +
      `WHERE 1=CONTAINS(POINT('ICRS', ra, dec), POLYGON('ICRS', ${poly})) AND phot_g_mean_mag BETWEEN ${gmin.toFixed(2)} AND ${gmax.toFixed(2)}`;
    const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', MAXREC: '20000', QUERY: sql });
    const resp = await fetch(TAP_URL, { method: 'POST', body, signal });
    const text = await resp.text();
    if (!resp.ok || text.trimStart().startsWith('<')) throw new Error(`TAP ${resp.status}`);
    const lines = text.trim().split(/\r?\n/), head = lines[0].split(',');
    const ix = (k) => head.indexOf(k), iR = ix('ra'), iD = ix('dec'), iG = ix('g'), iB = ix('bp'), iP = ix('rp');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const v = lines[i].split(',');
      const num = (j) => (v[j] === '' || v[j] === undefined ? null : +v[j]);
      rows.push({ ra: +v[iR], dec: +v[iD], g: num(iG), bp: num(iB), rp: num(iP) });
    }
    return { rows, truncated: rows.length >= 20000 };
  }

  function starsInSensor(s, rows) {
    const out = [];
    let noColour = 0;
    for (const r of rows) {
      const t = C.gnomonic(r.ra, r.dec, s.ra0, s.dec0);
      if (!t) continue;
      const dx = t[0] - s.c[0], dy = t[1] - s.c[1];
      const u = dx * s.a[0] + dy * s.a[1], v = dx * s.b[0] + dy * s.b[1];
      if (Math.abs(u) > s.fx / 2 || Math.abs(v) > s.fy / 2) continue;
      let m = model.toBand(S.band, r.g, r.bp, r.rp);
      if (m == null && r.g != null) { m = r.g - model.bandOffset(S.band, 1.0); noColour++; }
      if (m == null || m < S.mb || m >= S.mf) continue;
      out.push({ u, v, m });
    }
    return { stars: out, noColour };
  }

  function simulateSensor(s, lam, rnd) {
    const n = C.poissonSample(lam, rnd), p = C.ang2pixNest(model.nside, s.ra, s.dec);
    const mags = model.sampleMags(S.band, p, S.mb, S.mf, n, rnd);
    return mags.map((m) => ({ u: (rnd() - 0.5) * s.fx, v: (rnd() - 0.5) * s.fy, m }));
  }

  async function runFields() {
    const run = ++fieldsRun, g = geom();
    const btn = $('queryBtn');
    btn.disabled = true; btn.textContent = 'Querying…';
    const seed = (Date.now() & 0xffffffff) >>> 0;
    const sensors = layoutSensors(g, seed);
    const A = g.area;
    for (const s of sensors) s.lam = model.densityAt(arr.dens, s.l, s.gb) * A;
    const [o0, o1] = model.bandOffsetRange(S.band);
    const gmin = S.mb + o0 - 0.05, gmax = S.mf + o1 + 0.05;
    lastFields = { sensors, results: sensors.map(() => ({ state: 'pending' })), g, band: S.band, mb: S.mb, mf: S.mf, k: S.k };
    redrawFields();
    const rnd = C.mulberry32(seed ^ 0x9e3779b9);
    let next = 0, failedService = false;
    const worker = async () => {
      while (next < sensors.length) {
        const i = next++, s = sensors[i];
        if (failedService) { lastFields.results[i] = { state: 'sim', stars: simulateSensor(s, s.lam, rnd) }; redrawFields(); continue; }
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
        try {
          const q = await queryGaia(s, gmin, gmax, ctl.signal);
          if (run !== fieldsRun) return;
          const r = starsInSensor(s, q.rows);
          lastFields.results[i] = { state: 'gaia', stars: r.stars, truncated: q.truncated, noColour: r.noColour };
        } catch (err) {
          if (run !== fieldsRun) return;
          console.warn('Gaia query failed, simulating sensor', i + 1, err);
          failedService = true;
          lastFields.results[i] = { state: 'sim', stars: simulateSensor(s, s.lam, rnd), error: String(err.message || err) };
        } finally { clearTimeout(timer); }
        redrawFields();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (run === fieldsRun) { btn.disabled = false; btn.textContent = 'Query Gaia DR3'; redrawFields(); }
  }

  function drawFocalPlane() {
    const T = theme(), cv = $('fpCanvas'), dpr = Math.min(2, window.devicePixelRatio || 1), W = 170;
    cv.width = W * dpr; cv.height = W * dpr;
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = T.field; ctx.fillRect(0, 0, W, W);
    ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = T.muted; ctx.textAlign = 'center';
    const g = geom();
    if (S.layout !== 'ring') { ctx.fillText('independent random fields', W / 2, W / 2); return; }
    const ext = Math.max(S.ring + Math.hypot(g.fx, g.fy) / 120, 0.2) * 1.12, sc = (W / 2 - 8) / ext;
    ctx.strokeStyle = T.grid; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(W / 2, W / 2, S.ring * sc, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillText(`r = ${S.ring}°`, W / 2, W / 2 + 3);
    ctx.textAlign = 'left'; ctx.fillText('N ↑  E ←', 4, 11);
    ctx.textAlign = 'right'; ctx.fillText('to scale', W - 4, W - 5); ctx.textAlign = 'center';
    for (let i = 0; i < S.n; i++) {
      const phi = (i * 2 * Math.PI) / S.n, cx = W / 2 - S.ring * Math.sin(phi) * sc, cy = W / 2 - S.ring * Math.cos(phi) * sc;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(phi);
      const w = Math.max(3, (g.fx / 60) * sc), h = Math.max(3, (g.fy / 60) * sc);
      ctx.fillStyle = T.blue; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.fillStyle = T.ink2; ctx.fillText(String(i + 1), W / 2 - (S.ring * sc + 12) * Math.sin(phi), W / 2 - (S.ring * sc + 12) * Math.cos(phi) + 3);
    }
  }

  function redrawFields() {
    drawFocalPlane();
    const F = lastFields, grid = $('fovGrid');
    if (!F) { grid.innerHTML = ''; $('fovSummary').innerHTML = 'Press <b>Query Gaia DR3</b> to fetch the real star fields for the current sensor layout.'; return; }
    const T = theme();
    if (grid.children.length !== F.sensors.length) {
      grid.innerHTML = F.sensors.map((_, i) => `<div class="fov-cell"><canvas data-i="${i}"></canvas><div class="cap"><span id="cap${i}"></span><span id="src${i}"></span></div></div>`).join('');
    }
    const counts = [];
    F.sensors.forEach((s, i) => {
      const r = F.results[i], cv = grid.querySelector(`canvas[data-i="${i}"]`);
      const cssW = Math.max(150, cv.parentElement.clientWidth), aspect = Math.min(1.8, Math.max(0.3, s.fy / s.fx));
      const cssH = Math.round(cssW * aspect), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = cssW * dpr; cv.height = cssH * dpr; cv.style.height = cssH + 'px';
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = T.dark ? '#0b0b0a' : '#fbfbf9'; ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = T.axis; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
      ctx.font = '600 12px system-ui, sans-serif'; ctx.textBaseline = 'top';
      if (r.state === 'pending') { ctx.fillStyle = T.muted; ctx.textAlign = 'center'; ctx.fillText('querying…', cssW / 2, cssH / 2 - 6); }
      else {
        const span = Math.max(0.1, F.mf - F.mb);
        for (const st of r.stars) {
          const x = (st.u / s.fx + 0.5) * cssW, y = (0.5 - st.v / s.fy) * cssH;
          const t = Math.max(0, Math.min(1, (st.m - F.mb) / span)), rad = 1.4 + 3.6 * (1 - t);
          ctx.fillStyle = T.ink; ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        counts.push({ n: r.stars.length, lam: s.lam, state: r.state });
        ctx.textAlign = 'left'; ctx.fillStyle = T.ink;
        ctx.fillText(`N = ${r.stars.length}`, 6, 6);
        ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = T.ink2; ctx.textAlign = 'right';
        ctx.fillText(`λ ${fmtLam(s.lam)}`, cssW - 6, 6);
      }
      $('cap' + i).textContent = `S${i + 1} · l ${s.l.toFixed(1)}°, b ${s.gb.toFixed(1)}°`;
      const src = r.state === 'gaia' ? 'Gaia DR3' + (r.truncated ? ' (truncated)' : '') : r.state === 'sim' ? 'simulated' : '';
      $('src' + i).innerHTML = src ? `<span class="pill" title="${esc(r.error || '')}">${src}</span>` : '';
    });
    if (counts.length) {
      const tot = counts.reduce((a, c) => a + c.n, 0), lamTot = counts.reduce((a, c) => a + c.lam, 0);
      const withK = counts.filter((c) => c.n >= F.k).length, sim = counts.some((c) => c.state === 'sim');
      $('fovSummary').innerHTML = `${counts.length}/${F.sensors.length} sensors: N = ${counts.map((c) => c.n).join(', ')} · ` +
        `total <b>${tot}</b> vs model <b>${lamTot.toFixed(1)} ± ${Math.sqrt(lamTot).toFixed(1)}</b> (Poisson) · ` +
        `${withK} with ≥ ${F.k} stars. ${BAND_TEXT(F.band)} ${F.mb}–${F.mf}.` +
        (sim ? ' <span class="err">Some fields are simulated: the Gaia TAP service could not be reached.</span>' : '');
    }
  }

  // ===================================================================== method notes
  function renderMethod() {
    const A = geom().area;
    const refs = [['NGP', 0, 90], ['l 180°, b 60°', 180, 60], ['l 180°, b 30°', 180, 30], ['l 180°, b 20°', 180, 20],
      ['l 90°, b 20°', 90, 20], ['l 0°, b 20°', 0, 20], ['l 180°, b 10°', 180, 10], ['l 0°, b 10°', 0, 10]];
    const rows = refs.map(([n, l, b]) => {
      const g = model.densityAt(arr.dens, l, b) * A, v = C.V1.inWindow(S.band, S.mb, S.mf, l, b) * A;
      return `<tr><td>${n}</td><td>${fmtLam(g)}</td><td>${fmtLam(v)}</td><td>${(v / g).toFixed(2)}</td></tr>`;
    }).join('');
    $('methodText').innerHTML = `
<h4>Star counts</h4>
<p>Expected counts come from an all-sky table of Gaia DR3 sources (${(D.totalSources / 1e9).toFixed(2)} billion, built ${D.built}) binned in
HEALPix nside ${D.nside} (${(model.pixArcmin2 / 3600).toFixed(2)} deg² pixels, NESTED, ICRS) × Gaia G (0.5 mag, G ${D.gEdges[0]}–${D.gEdges[D.gEdges.length - 1]}),
with the BP−RP distribution of each G bin taken from nside ${D.nsideColor} pixels and shifted by each fine pixel's mean-colour offset (reddening).
For a band X each colour class is converted with X = G − f<sub>X</sub>(BP−RP); counts inside a 0.5-mag G bin are interpolated linearly.
The value at the pointing is interpolated over neighbouring pixels. No analytic Galaxy model is involved: extinction, the bulge, the disc warp,
the Magellanic Clouds and Gaia's own depth are all in the data.</p>
<h4>Band relations</h4>
<p>f<sub>X</sub> is the running median of G − X versus BP−RP for Gaia DR3 stars with standardised XP synthetic photometry (GSPC, flag = 1):
Johnson–Kron–Cousins U B V R I (Landolt-standardised, Vega) and SDSS u g r i z (Stripe 82-standardised, AB). Outside the colour range where GSPC publishes
U and B they follow the Mamajek dwarf sequence; u follows U. The V, R<sub>C</sub>, I<sub>C</sub>, g, i relations agree with Riello et al. (2021) to ≲ 0.05 mag.
Scatter about the relation is ~0.02–0.05 mag in r, i, z, V, R, I, ~0.1 mag in B and g, and 0.15–0.4 mag in U and u (luminosity class and metallicity).</p>
<h4>Statistics</h4>
<p>Stars on a sensor are Poisson with mean λ = density × sensor area. Sensors are treated as independent fields at the same density (true for clustering
on scales larger than a sensor). P(≥ M of n sensors with ≥ k) is binomial in P(≥ k); the total over n sensors is Poisson(nλ).</p>
<h4>Limits</h4>
<ul>
<li>Gaia DR3 is ~complete to G ≈ 20.7 at high latitude but only to G ≈ 18–19 in the most crowded bulge fields; such pixels are hatched on the map and their counts are lower limits.
The completeness proxy is the G bin where dN/dG turns over.</li>
<li>Gaia also contains compact galaxies and a few spurious sources at G &gt; 20; both are minor (&lt; 5%) at guide-star magnitudes.</li>
<li>Counts ignore saturation, blending, vignetting and edge margins; enter an effective chip size to include them.</li>
<li>One plate scale per sensor; fast correctors change it by several per cent across the field (e.g. DESI 67.5→~73 µm/″).</li>
</ul>
<h4>Audit of v1 (current band, window and sensor)</h4>
<div class="table-scroll"><table class="data" style="max-width:520px"><tr><th>field</th><th>Gaia DR3 (v2)</th><th>v1 analytic</th><th>v1 / v2</th></tr>${rows}</table></div>
<ul>
<li><b>Band conversions:</b> v1's SDSS g′ relation had the sign of its constant and linear terms flipped (0.5 mag wrong at solar colour, 1.1 mag at BP−RP 1.5); u′ inherited it;
at BP−RP = 2.5, U, B, R<sub>C</sub>, I<sub>C</sub>, i′ and z′ were 0.5–2.6 mag off. Catalogue fields were therefore filtered in the wrong band window.</li>
<li><b>Model:</b> a single r′ pole luminosity function scaled by csc|b| with a cos l bulge term — no extinction, no disc longitude structure — and the prediction always used l = 180°.
Band changes shifted the r′ counts by one fixed colour.</li>
<li><b>Input bug:</b> <code>parseFloat(x) || default</code> turned b = 0 and magnitude 0 into the defaults.</li>
<li><b>Catalogue access:</b> the ESA TAP endpoint does not send CORS headers, so browser queries to it always failed and fell back (after a timeout) to VizieR or to
a uniform-magnitude simulation (measured: six simulated fields after 22.8 s); the <code>TOP 2000 … ORDER BY</code> query truncated faint stars in dense fields,
and the ±1.5-mag G padding plus a circumscribed cone fetched 4–7× more rows than needed.</li>
<li><b>Efficiency:</b> per-keystroke full chart redraws with blur shadows, and up to 20 concurrent sync TAP queries without timeouts.</li>
</ul>`;
  }

  // ===================================================================== update loop
  let raf = 0, lastPoint = null;
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  function update() {
    raf = 0;
    computeAll();
    const P = pointStats();
    lastPoint = P;
    renderInputNotes();
    renderTiles(P);
    renderCoverage();
    drawMap();
    drawChartA(P);
    drawChartB(P);
    renderTable();
    if (document.getElementById('methodCard').open) renderMethod();
    if (lastFields) redrawFields(); else drawFocalPlane();
    writeHash();
  }

  // ===================================================================== init
  function init() {
    try {
      const t = localStorage.getItem('starcount-theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch (_) { /* ignore */ }
    $('themeBtn').textContent = document.documentElement.dataset.theme === 'light' ? 'Dark' : 'Light';
    buildSelects();
    readHash();
    writeInputs();
    bindInputs();
    bindMap();
    bindCharts();
    $('methodCard').addEventListener('toggle', () => $('methodCard').open && renderMethod());
    $('dataBadge').textContent = `Gaia DR3 · ${(D.totalSources / 1e9).toFixed(2)} B sources · built ${D.built}`;
    redrawFields();
    update();
  }
  init();
})();
