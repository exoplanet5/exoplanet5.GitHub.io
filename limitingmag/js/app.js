/* Limiting-magnitude calculator UI: presets, example situations, URL state, results and charts.
 * Depends on js/bands.js (LIM_BANDS) and js/core.js (LimCore).
 */
(function () {
  'use strict';
  const C = window.LimCore, BANDS = window.LIM_BANDS;
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- presets
  // Telescope presets set only the optics; seeing, elevation and sky stay with the conditions.
  const TELESCOPES = [
    { id: 'custom', name: 'Custom' },
    { id: 'must', name: 'MUST 6.5 m · f/3.70', D: 6.5, obsc: 0, fNum: 3.70, topt: 0.50,
      note: 'MUST: f = 24.1 m. The central obscuration is not published — enter the design value.' },
    { id: 'rubin', name: 'Rubin Observatory 8.4 m · f/1.234', D: 8.36, obsc: 0.640, fNum: 1.2336, topt: 0.70,
      note: 'Obscuration 0.640 gives the 6.423 m effective clear aperture of SMTN-002; 0.20″ per 10 µm pixel. In zero-point mode the Rubin 1-s zero point of the selected LSST band is used.' },
    { id: 'wfst', name: 'WFST 2.5 m · f/2.48', D: 2.5, obsc: 0.40, fNum: 2.48, topt: 0.50,
      note: 'WFST: the 1.0 m prime-focus assembly sets the obscuration (effective aperture 2.29 m).' },
    { id: 'desi', name: 'Mayall/DESI 3.8 m · f/3.86', D: 3.797, obsc: 0.485, fNum: 3.86, topt: 0.50,
      note: 'Mayall: 1.8 m obscuration plus spider → 8.66 m² geometric area (desimodel desi.yaml); mean DESI corrector focal ratio.' },
  ];
  const CAMERAS = [
    { id: 'custom', name: 'Custom' },
    { id: 'ccd250', name: 'e2v CCD250-82 · 10 µm (Rubin LSSTCam)', qe: 0.93, pix: 10, dark: 0.02, rn: 5.0, fullWell: 135000,
      note: 'Teledyne e2v datasheet: read noise 5–8 e⁻, dark 0.02 e⁻/s typical at 178 K, full well 135 ke⁻ (non-inverted).' },
    { id: 'ccd290', name: 'e2v CCD290-99 · 10 µm (WFST)', qe: 0.90, pix: 10, dark: 0.0011, rn: 4.0, fullWell: 90000,
      note: 'Datasheet: read noise 4 e⁻ at 0.5 MHz (2.5 e⁻ at 50 kHz), dark 4 e⁻/px/h at −100 °C, full well 90 ke⁻.' },
    { id: 'ccd230', name: 'e2v CCD230-42 · 15 µm (DESI GFA)', qe: 0.92, pix: 15, dark: 0.2, rn: 4.0, fullWell: 150000,
      note: 'Dark current at −25 °C and read noise at 50 kHz as in v1; full well 150 ke⁻ from the inverted-mode listing.' },
    { id: 'imx455', name: 'Sony IMX455 · 3.76 µm (QHY600, ASI6200)', qe: 0.80, pix: 3.76, dark: 0.0022, rn: 1.2, fullWell: 51400,
      note: 'Peak QE 91 %; read noise 1.2 e⁻ in high-gain mode; dark at −20 °C. Full well 51.4 ke⁻ is the low-gain value — smaller at high gain.' },
    { id: 'gs1517', name: 'Gpixel GSENSE1517BSI · 15 µm', qe: 0.92, pix: 15, dark: 0.008, rn: 1.2, fullWell: 70000,
      note: 'Gpixel: read noise 1.2 e⁻ (12-bit HDR), full well 70 ke⁻, dark < 0.008 e⁻/s at −70 °C, peak QE 92 %.' },
    { id: 'gs1081', name: 'Gpixel GSENSE1081BSI · 10 µm', qe: 0.95, pix: 10, dark: 0.0037, rn: 5.35, fullWell: 90680,
      note: 'Gpixel: temporal noise 5.35 e⁻, full well 90.7 ke⁻, dark 0.0037 e⁻/s at −70 °C, peak QE 97 %.' },
    { id: 'gs9016', name: 'Gpixel GSENSE9016BSI · 9 µm', qe: 0.95, pix: 9, dark: 0.04, rn: 0.7, fullWell: 118000,
      note: 'Gpixel: read noise 0.7 e⁻, full well 118 ke⁻, dark 0.04 e⁻/s at −30 °C, peak QE 95 %.' },
  ];
  const TEL_FIELDS = ['D', 'obsc', 'fNum', 'topt'], CAM_FIELDS = ['qe', 'pix', 'dark', 'rn', 'fullWell'];
  // SMTN-002 fiducial zenith FWHM_eff per LSST band (″)
  const RUBIN_FWHM = { LSST_u: 0.92, LSST_g: 0.87, LSST_r: 0.83, LSST_i: 0.80, LSST_z: 0.78, LSST_y: 0.76 };

  const BASE = {
    mode: 'mag', t: 10, n: 10, snr: 4, mag: 18, rate: 0,
    telSel: 'custom', D: 0.3, obsc: 0, fNum: 5, topt: 0.5,
    camSel: 'imx455', qe: 0.80, pix: 3.76, dark: 0.0022, rn: 1.2, fullWell: 51400,
    band: 'Johnson_V', moon: '0', k: BANDS.Johnson_V.k, sky: BANDS.Johnson_V.sky, elev: 40, fwhm: 5,
    scaleSky: true, scaleSeeing: false, phot: 'psf', apR: 0.7, psf: 'moffat', beta: 4.765, tpMode: 'components', zp: 22,
  };
  const SCENARIOS = [
    { id: 'cmos', name: 'Small telescope · CMOS stack', state: {},
      note: '0.3 m f/5 with an IMX455 stacking 10 × 10 s in V under 5″ seeing — the v1 default. Read noise and sky share the variance.' },
    { id: 'rubin', name: 'Survey telescope · Rubin LSST 30-s visit', state: {
        mode: 'mag', t: 30, n: 1, snr: 5, mag: 24.5, telSel: 'rubin', D: 8.36, obsc: 0.640, fNum: 1.2336, topt: 0.70,
        camSel: 'custom', qe: 0.93, pix: 10, dark: 0.2, rn: 8.8, fullWell: 100000, band: 'LSST_r', sky: BANDS.LSST_r.sky,
        k: BANDS.LSST_r.k, elev: 90, fwhm: 0.83, psf: 'gauss', tpMode: 'zp', zp: BANDS.LSST_r.zpRubin },
      note: 'Rubin SMTN-002 reference: 1 × 30 s, dark sky at the zenith, FWHM_eff with a Gaussian NEA, 8.8 e⁻ read noise. Published m5: u 23.70 · g 24.97 · r 24.52 · i 24.13 · z 23.56 · y 22.55 — switch the LSST band to compare (the FWHM follows the band).' },
    { id: 'geo', name: 'Moving target · GEO satellite, sidereal tracking', state: {
        mode: 'mag', t: 2, n: 1, snr: 5, mag: 15, rate: 15.04, telSel: 'custom', D: 0.4, obsc: 0.35, fNum: 3, topt: 0.6,
        camSel: 'imx455', band: 'Lum_400_800', sky: BANDS.Lum_400_800.sky, k: BANDS.Lum_400_800.k, elev: 45, fwhm: 2.5 },
      note: 'A geostationary object drifts at 15.04″/s against sidereal tracking, so it trails over 30″ in 2 s. Longer exposures barely help once the trail is many FWHM long — compare the single-exposure curve on the right.' },
  ];

  const NUM_IDS = ['t', 'n', 'snr', 'mag', 'rate', 'D', 'obsc', 'fNum', 'topt', 'qe', 'pix', 'dark', 'rn', 'fullWell',
    'sky', 'k', 'elev', 'fwhm', 'apR', 'beta', 'zp'];
  const SEL_IDS = ['telSel', 'camSel', 'band', 'moon', 'phot', 'psf', 'tpMode'];
  const CHK_IDS = ['scaleSky', 'scaleSeeing'];
  const LIMITS = { t: [1e-4, 1e7], n: [1, 1e6], snr: [0.1, 1e5], mag: [-30, 40], rate: [0, 1e6], D: [0.01, 100],
    obsc: [0, 0.95], fNum: [0.3, 200], topt: [0.001, 1], qe: [0.001, 1], pix: [0.1, 1000], dark: [0, 1e4], rn: [0, 1e4],
    fullWell: [0, 1e9], sky: [5, 30], k: [0, 5], elev: [1, 90], fwhm: [0.01, 100], apR: [0.1, 5], beta: [1.6, 50], zp: [0, 50] };
  const SOLVED = { mag: 'mag', snr: 'snr', exp: 't' };
  const MODE_LABEL = { mag: 'Limiting magnitude', snr: 'Signal-to-noise ratio', exp: 'Single-exposure time' };
  let mode = 'mag';

  // ---------------------------------------------------------------- formatting
  function fmtTime(s) {
    if (!isFinite(s)) return '—';
    if (s < 1e-3) return `${(s * 1e6).toPrecision(3)} µs`;
    if (s < 1) return `${(s * 1e3).toPrecision(3)} ms`;
    if (s < 120) return `${+s.toPrecision(3)} s`;
    if (s < 7200) return `${+(s / 60).toPrecision(3)} min`;
    if (s < 172800) return `${+(s / 3600).toPrecision(3)} h`;
    return `${+(s / 86400).toPrecision(3)} d`;
  }
  function fmtTimeTick(s) {
    if (s < 1) return `${+(s * 1e3).toPrecision(2)} ms`;
    if (s < 60) return `${+s.toPrecision(2)} s`;
    if (s < 3600) return `${+(s / 60).toPrecision(2)} min`;
    if (s < 86400) return `${+(s / 3600).toPrecision(2)} h`;
    return `${+(s / 86400).toPrecision(2)} d`;
  }
  function fmtE(x) {
    if (!isFinite(x)) return '—';
    if (x >= 1e7) return x.toExponential(2).replace('e+', '×10^');
    if (x >= 100) return Math.round(x).toLocaleString('en-US');
    if (x >= 1) return x.toPrecision(3);
    if (x === 0) return '0';
    return x.toPrecision(2);
  }
  const pct = (x) => (x >= 0.995 ? (100 * x).toFixed(0) : (100 * x).toFixed(1)) + ' %';
  const signed = (x, d) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  const bandName = (b) => `${b.label} (${b.sys})`;

  // ---------------------------------------------------------------- build selects
  function fillSelect(sel, items) { sel.innerHTML = items.map((o) => `<option value="${o.id}">${o.name}</option>`).join(''); }
  fillSelect($('telSel'), TELESCOPES);
  fillSelect($('camSel'), CAMERAS);
  $('scenario').innerHTML = '<option value="">Custom setup</option>' + SCENARIOS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  {
    const groups = {};
    for (const [id, b] of Object.entries(BANDS)) (groups[b.group] = groups[b.group] || []).push([id, b]);
    $('band').innerHTML = Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">` +
      list.map(([id, b]) => `<option value="${id}">${b.label} · ${(b.lam / 10).toFixed(0)} nm · ${b.sys}</option>`).join('') + '</optgroup>').join('');
  }

  // ---------------------------------------------------------------- state
  function setVal(id, v) {
    const el = $(id);
    if (!el || v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = String(v);
  }
  function applyState(st) {
    for (const k of [...NUM_IDS, ...SEL_IDS, ...CHK_IDS]) if (k in st) setVal(k, st[k]);
    setMode(st.mode || 'mag', true);
  }
  function readState() {
    const st = { mode };
    for (const k of NUM_IDS) st[k] = $(k).value;
    for (const k of SEL_IDS) st[k] = $(k).value;
    for (const k of CHK_IDS) st[k] = $(k).checked ? 1 : 0;
    return st;
  }
  function encodeState() {
    const st = readState(), parts = [];
    for (const k in st) parts.push(`${k}=${encodeURIComponent(st[k])}`);
    const sc = $('scenario').value;
    if (sc) parts.push(`scenario=${sc}`);
    return parts.join('&');
  }
  function decodeHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return null;
    const st = {};
    for (const kv of h.split('&')) {
      const [k, v] = kv.split('=');
      if (k) st[k] = decodeURIComponent(v || '');
    }
    for (const k of CHK_IDS) if (k in st) st[k] = st[k] === '1' || st[k] === 'true';
    return st;
  }

  function setMode(m, silent) {
    if (!SOLVED[m]) m = 'mag';
    mode = m;
    document.querySelectorAll('.seg button[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    for (const [md, id] of Object.entries(SOLVED)) {
      const on = md === m;
      $('f-' + id).classList.toggle('solved', on);
      $(id).readOnly = on;
      $(id).tabIndex = on ? -1 : 0;
      if (on) $(id).removeAttribute('aria-invalid');
    }
    if (!silent) schedule();
  }

  function applyScenario(id) {
    const sc = SCENARIOS.find((s) => s.id === id);
    const st = Object.assign({}, BASE, sc ? sc.state : {});
    applyState(st);
    $('scenario').value = sc ? id : '';
    $('scenarioNote').textContent = sc ? sc.note : '';
    syncPresetNotes();
    schedule();
  }

  // ---------------------------------------------------------------- input wiring
  function moonDelta() {
    const v = $('moon').value;
    return v === 'custom' ? null : C.moonBrightening(BANDS[$('band').value].lam, +v);
  }
  function syncSkyFromBand() {
    const b = BANDS[$('band').value], d = moonDelta();
    if (d !== null) $('sky').value = (b.sky - d).toFixed(2);
  }
  function syncRubinZp() {
    const b = BANDS[$('band').value];
    if ($('telSel').value === 'rubin' && $('tpMode').value === 'zp' && b.zpRubin) $('zp').value = b.zpRubin;
  }
  function syncPresetNotes() {
    const t = TELESCOPES.find((x) => x.id === $('telSel').value), c = CAMERAS.find((x) => x.id === $('camSel').value);
    $('telNote').textContent = (t && t.note) || '';
    $('camNote').textContent = (c && c.note) || '';
  }
  function markCustomScenario() {
    if ($('scenario').value) { $('scenario').value = ''; $('scenarioNote').textContent = ''; }
  }

  $('telSel').addEventListener('change', () => {
    const t = TELESCOPES.find((x) => x.id === $('telSel').value);
    if (t && t.D) for (const f of TEL_FIELDS) setVal(f, t[f]);
    syncRubinZp(); syncPresetNotes(); markCustomScenario(); schedule();
  });
  $('camSel').addEventListener('change', () => {
    const c = CAMERAS.find((x) => x.id === $('camSel').value);
    if (c && c.pix) for (const f of CAM_FIELDS) setVal(f, c[f]);
    syncPresetNotes(); markCustomScenario(); schedule();
  });
  $('band').addEventListener('change', () => {
    const id = $('band').value, b = BANDS[id];
    $('k').value = b.k;
    syncSkyFromBand(); syncRubinZp();
    // the Rubin example follows SMTN-002 band by band: keep it selected and use that band's FWHM_eff
    if ($('scenario').value === 'rubin' && RUBIN_FWHM[id]) $('fwhm').value = RUBIN_FWHM[id];
    else markCustomScenario();
    schedule();
  });
  $('moon').addEventListener('change', () => { syncSkyFromBand(); markCustomScenario(); schedule(); });
  $('tpMode').addEventListener('change', () => { syncRubinZp(); markCustomScenario(); schedule(); });
  $('scenario').addEventListener('change', () => { if ($('scenario').value) applyScenario($('scenario').value); else $('scenarioNote').textContent = ''; });
  for (const id of NUM_IDS) {
    $(id).addEventListener('input', () => {
      if (TEL_FIELDS.includes(id)) $('telSel').value = 'custom';
      if (CAM_FIELDS.includes(id)) $('camSel').value = 'custom';
      if (id === 'sky') $('moon').value = 'custom';
      if (TEL_FIELDS.includes(id) || CAM_FIELDS.includes(id)) syncPresetNotes();
      markCustomScenario();
      schedule();
    });
  }
  for (const id of ['phot', 'psf', ...CHK_IDS]) $(id).addEventListener('change', () => { markCustomScenario(); schedule(); });
  document.querySelectorAll('.seg button[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // ---------------------------------------------------------------- compute
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; compute(); });
  }

  function readInputs() {
    const v = {}, bad = [];
    for (const id of NUM_IDS) {
      const el = $(id), x = parseFloat(el.value), [lo, hi] = LIMITS[id];
      const skip = id === SOLVED[mode] || (id === 'zp' && $('tpMode').value !== 'zp') || (id === 'apR' && $('phot').value !== 'aper') ||
        (id === 'beta' && $('psf').value !== 'moffat');
      const ok = skip || (isFinite(x) && x >= lo && x <= hi);
      if (!skip) el.setAttribute('aria-invalid', String(!ok));
      if (!ok) bad.push(id);
      v[id] = x;
    }
    v.n = Math.max(1, Math.round(v.n));
    return { v, bad };
  }

  let last = null;
  function compute() {
    const { v, bad } = readInputs();
    const band = BANDS[$('band').value];
    const tpMode = $('tpMode').value, phot = $('phot').value, psf = $('psf').value;
    $('f-zp').hidden = tpMode !== 'zp';
    $('f-apR').hidden = phot !== 'aper';
    $('f-beta').hidden = psf !== 'moffat';
    for (const id of ['obsc', 'topt', 'qe']) $(id).disabled = tpMode === 'zp';
    updateBandNote(band);
    if (bad.length) return showError('Check the highlighted inputs.');

    const p = { band, tpMode, D: v.D, obsc: v.obsc, fNum: v.fNum, topt: v.topt, qe: v.qe, zp: v.zp, pix: v.pix, dark: v.dark,
      rn: v.rn, fullWell: v.fullWell, sky: v.sky, k: v.k, elev: v.elev, fwhm: v.fwhm, scaleSky: $('scaleSky').checked,
      scaleSeeing: $('scaleSeeing').checked, psf, beta: v.beta, phot, apR: v.apR, rate: v.rate };
    const m = C.prepare(p);
    let t = v.t, n = v.n, snr = v.snr, mag = v.mag, res, note = '';
    if (mode === 'mag') {
      res = C.solveMag(m, t, n, snr);
      if (!res) return showError('No solution for these inputs.');
      mag = res.mag;
      $('mag').value = mag.toFixed(2);
    } else if (mode === 'snr') {
      res = C.solveSNR(m, t, n, mag);
      if (!res) return showError('No solution for these inputs.');
      snr = res.snr;
      $('snr').value = +snr.toPrecision(4);
    } else {
      res = C.solveExp(m, n, snr, mag);
      if (!res) return showError('No solution for these inputs.');
      if (res.unreachable) {
        t = res.tBest;
        note = `${snr}σ is out of reach: a trailed target peaks at SNR ${res.snrMax.toPrecision(3)} near ${fmtTime(res.tBest)} per frame. ` +
          'Add frames, use a larger aperture, or track at the target rate.';
        $('t').value = '';
      } else {
        t = res.t;
        if (res.clipped) note = 'Reached at the shortest exposure considered (0.1 ms).';
        $('t').value = +t.toPrecision(4);
      }
    }
    // consistent state at the solution
    const sol = C.solveSNR(m, t, n, mag);
    const lim = C.solveMag(m, t, n, snr);
    last = { m, p, v, band, t, n, snr, mag, b: sol.b, lim, unreachable: !!res.unreachable };
    showResult(last, note);
    drawCharts();
    history.replaceState(null, '', '#' + encodeState());
  }

  function showError(msg) {
    $('heroV').textContent = '–';
    $('heroErr').hidden = false;
    $('heroErr').textContent = msg;
    $('tiles').innerHTML = '';
    $('condLine').innerHTML = '';
    last = null;
    drawCharts();
  }

  function updateBandNote(b) {
    $('bandNote').innerHTML = `${b.group} ${b.label} · ${b.sys} magnitudes · pivot ${(b.lam / 10).toFixed(0)} nm · width ${(b.W / 10).toFixed(0)} nm · ` +
      `F<sub>0</sub> = ${b.F0.toExponential(2)} ph s⁻¹ m⁻² · dark sky ${b.sky.toFixed(2)} · k ${b.k.toFixed(2)} <span class="sub">(${b.curve})</span>`;
  }

  function tile(k, v, s, cls) {
    return `<div class="tile"><div class="k">${k}</div><div class="v">${cls ? `<span class="dot ${cls}"></span>` : ''}${v}</div><div class="s">${s || ''}</div></div>`;
  }

  function showResult(r, note) {
    const { m, b, band, t, n, snr, mag, p } = r;
    $('heroErr').hidden = !note;
    $('heroErr').textContent = note;
    $('heroK').textContent = MODE_LABEL[mode];
    const tStr = `${n} × ${fmtTime(t)}`;
    if (mode === 'mag') {
      $('heroV').innerHTML = `${mag.toFixed(2)}<small>${bandName(band)}</small>`;
      $('heroS').textContent = `${+snr.toPrecision(4)}σ detection in ${tStr}`;
    } else if (mode === 'snr') {
      $('heroV').innerHTML = `${snr >= 1000 ? Math.round(snr).toLocaleString('en-US') : +snr.toPrecision(3)}<small>σ</small>`;
      $('heroS').textContent = `${band.label} = ${mag} in ${tStr}`;
    } else {
      $('heroV').innerHTML = r.unreachable ? 'unreachable' : fmtTime(t);
      $('heroS').textContent = r.unreachable ? '' : `per frame · ${n} frame${n > 1 ? 's' : ''} → ${fmtTime(n * t)} total for ${snr}σ at ${band.label} = ${mag}`;
    }

    const totVar = b.S + b.bg;
    const reg = C.regime(b);
    const regName = { source: 'Source limited', sky: 'Sky limited', dark: 'Dark limited', read: 'Read limited' }[reg];
    const regShare = { source: b.S, sky: b.sky, dark: b.dark, read: b.read }[reg] / totVar;
    const ideal = C.solveMag(m, t, n, snr, { ideal: true });
    const penalty = ideal.mag - r.lim.mag;
    const sat = C.saturationMag(m, t);
    const tBL = C.backgroundLimitedSub(m, 10);
    const g = b.g, fwhmPx = m.fwhm / m.scale;

    let satV, satS, satCls = '';
    if (!(p.fullWell > 0)) { satV = '—'; satS = 'enter the full well'; }
    else if (sat.skySaturates) { satV = 'sky'; satS = 'background alone fills the well'; satCls = 'crit'; }
    else {
      satV = `${sat.mag.toFixed(2)}`;
      satS = `saturates in one ${fmtTime(t)} frame`;
      if (mode !== 'mag' && mag < sat.mag) satCls = 'crit';
    }
    const sampling = fwhmPx < 2 ? ['warn', 'undersampled'] : fwhmPx > 8 ? ['', 'oversampled'] : ['good', 'well sampled'];
    const tiles = [
      tile('Total integration', fmtTime(n * t), tStr),
      tile('Noise regime', regName, `${pct(regShare)} of the variance`, reg === 'sky' || reg === 'source' ? 'good' : 'warn'),
      tile('Bright limit', satV, satS, satCls),
      tile('Detector penalty', `${penalty.toFixed(2)} mag`, 'vs zero read noise and dark', penalty > 0.3 ? 'warn' : penalty > 0.05 ? '' : 'good'),
      tile('Sky-limited sub-exposure', isFinite(tBL) ? `≥ ${fmtTime(tBL)}` : '—', 'sky + dark ≥ 10 RN² per pixel',
        isFinite(tBL) ? (t >= tBL ? 'good' : 'warn') : ''),
      tile('PSF sampling', `${fwhmPx.toFixed(2)} px`, `FWHM, ${sampling[1]}`, sampling[0]),
    ];
    $('tiles').innerHTML = tiles.join('');

    const cond = [
      `Air mass <b>${m.X.toFixed(3)}</b>`,
      `Atmosphere <b>${pct(m.Tatm)}</b>`,
      `Sky at target <b>${m.mu.toFixed(2)}</b> mag/″²`,
      `FWHM at target <b>${m.fwhm.toFixed(2)}″</b>`,
      `Source <b>${fmtE(m.src0 * g.fSrc * Math.pow(10, -0.4 * mag))}</b> e⁻/s`,
    ];
    if (p.rate > 0) cond.push(`Trail <b>${(p.rate * t).toPrecision(3)}″</b> (${g.trailPx.toPrecision(3)} px, ${(p.rate * t / m.fwhm).toPrecision(3)} FWHM) per frame`);
    if (mode !== 'mag' && p.fullWell > 0) {
      const pk = C.peakElectrons(m, t, mag), f = pk / p.fullWell;
      cond.push(`<span class="${f >= 1 ? 'flag crit' : f > 0.7 ? 'flag' : ''}">Peak pixel <b>${fmtE(pk)}</b> e⁻ (${pct(f)} of full well)</span>`);
    }
    if (m.X > 3) cond.push('<span class="flag">Low elevation: extinction and seeing are uncertain</span>');
    $('condLine').innerHTML = cond.map((c) => `<span>${c}</span>`).join('');

    // noise budget
    const parts = [
      ['Source', 'c-src', b.S, b.S, `${fmtE(g.peakFrac * m.src0 * Math.pow(10, -0.4 * mag) * t)} peak`],
      ['Sky', 'c-sky', b.sky, b.sky, fmtE(m.skyArc * m.scale * m.scale * t)],
      ['Dark current', 'c-dark', b.dark, b.dark, fmtE(p.dark * t)],
      ['Read noise', 'c-read', NaN, b.read, `σ = ${p.rn}`],
    ];
    $('nbar').innerHTML = parts.map(([l, c, , vv]) => `<div class="${c}" style="width:${(100 * vv / totVar).toFixed(3)}%" title="${l}: ${pct(vv / totVar)}"></div>`).join('');
    $('budgetTable').innerHTML = '<tr><th>Term</th><th>Electrons</th><th>Variance (e⁻²)</th><th>Share</th><th>Per pixel, per frame (e⁻)</th></tr>' +
      parts.map(([l, c, e, vv, pp]) => `<tr><td><span class="swatch ${c}"></span>${l}</td><td>${isFinite(e) ? fmtE(e) : '—'}</td><td>${fmtE(vv)}</td>` +
        `<td>${pct(vv / totVar)}</td><td>${pp}</td></tr>`).join('') +
      `<tr class="total"><td>Total</td><td>noise ${fmtE(Math.sqrt(totVar))}</td><td>${fmtE(totVar)}</td><td>SNR ${(b.S / Math.sqrt(totVar)).toPrecision(4)}</td><td></td></tr>`;
    $('budgetSub').textContent = p.phot === 'aper'
      ? `aperture r = ${(p.apR * m.fwhm).toFixed(2)}″, ${g.nPix.toFixed(1)} px, holds ${pct(g.fSrc)} of the flux`
      : `PSF fit · noise-equivalent area ${g.nPix.toFixed(1)} px`;
    $('photNote').textContent = (p.phot === 'aper'
      ? `The aperture holds ${pct(g.fSrc)} of the PSF flux. `
      : 'PSF fitting reaches the matched-filter limit; aperture photometry is typically 0.1–0.2 mag shallower. ') +
      (p.tpMode === 'zp' ? 'The zero point replaces obscuration, throughput and QE; aperture and f/N still set the pixel scale.' : '');

    // derived lines
    const F = p.D * p.fNum;
    $('telDerived').innerHTML = `<span>Focal length</span><span>${F.toFixed(3)} m · ${(C.ARCSEC_PER_RAD / (F * 1000)).toFixed(2)}″/mm</span>` +
      (p.tpMode === 'zp' ? '' : `<span>Collecting area</span><span>${m.area.toFixed(m.area < 1 ? 4 : 2)} m² (${pct(1 - p.obsc * p.obsc)} of the full disc)</span>`) +
      `<span>Photons → e⁻</span><span>${p.tpMode === 'zp' ? `ZP ${p.zp}` : `${(p.topt * p.qe * 100).toFixed(1)} % × atmosphere`}</span>`;
    $('camDerived').innerHTML = `<span>Pixel scale</span><span>${m.scale.toFixed(3)}″/px</span>` +
      `<span>Background</span><span>${fmtE(m.bgPix)} e⁻/s/px (sky + dark)</span>`;
  }

  // ---------------------------------------------------------------- charts
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const charts = {};

  function niceTicks(lo, hi, n) {
    const span = hi - lo, step0 = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= step0) || 10 * mag;
    const out = [];
    for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9 * span; x += step) out.push(+x.toPrecision(12));
    return out;
  }
  function logTicks(lo, hi) {
    const out = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const f of [1, 2, 5]) { const x = f * Math.pow(10, e); if (x >= lo * 0.999 && x <= hi * 1.001) out.push({ x, major: f === 1 }); }
    }
    return out;
  }
  function timeTicks(lo, hi) {
    const cands = [1e-3, 1e-2, 0.1, 1, 10, 60, 600, 3600, 36000, 86400, 864000];
    const t = cands.filter((x) => x >= lo && x <= hi);
    return t.length >= 3 ? t.map((x) => ({ x, major: true })) : logTicks(lo, hi);
  }

  function drawChart(cv, spec) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 50, r: 12, t: 10, b: 34 };
    const X = spec.x, Y = spec.y;
    const fx = X.log ? Math.log10 : (x) => x, fy = Y.log ? Math.log10 : (y) => y;
    const x0 = fx(X.min), x1 = fx(X.max), y0 = fy(Y.min), y1 = fy(Y.max);
    const px = (x) => pad.l + (fx(x) - x0) / (x1 - x0) * (w - pad.l - pad.r);
    const py = (y) => h - pad.b - (fy(y) - y0) / (y1 - y0) * (h - pad.t - pad.b);
    spec._px = px; spec._py = py; spec._pad = pad; spec._w = w; spec._h = h;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.lineWidth = 1;
    // bands (shaded x ranges)
    for (const bnd of spec.bands || []) {
      const a = px(Math.max(X.min, bnd.x0)), z = px(Math.min(X.max, bnd.x1));
      if (z <= a) continue;
      ctx.fillStyle = bnd.color; ctx.globalAlpha = 0.13;
      ctx.fillRect(a, pad.t, z - a, h - pad.t - pad.b);
      ctx.globalAlpha = 1;
      if (bnd.label && z - a > 50) { ctx.fillStyle = css('--ink-2'); ctx.textAlign = 'left'; ctx.fillText(bnd.label, a + 5, pad.t + 13); }
    }
    // grid + ticks
    const xt = X.ticks ? X.ticks(X.min, X.max) : niceTicks(X.min, X.max, 6).map((x) => ({ x, major: true }));
    const yt = Y.ticks ? Y.ticks(Y.min, Y.max) : niceTicks(Y.min, Y.max, 5).map((y) => ({ x: y, major: true }));
    ctx.strokeStyle = css('--grid'); ctx.fillStyle = css('--muted');
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const t of xt) {
      const x = px(t.x);
      ctx.globalAlpha = t.major ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke();
      ctx.globalAlpha = 1;
      if (t.major || xt.length < 10) ctx.fillText(X.fmt(t.x), x, h - pad.b + 5);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const t of yt) {
      const y = py(t.x);
      ctx.globalAlpha = t.major ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.globalAlpha = 1;
      if (t.major || yt.length < 10) ctx.fillText(Y.fmt(t.x), pad.l - 6, y);
    }
    ctx.strokeStyle = css('--axis');
    ctx.strokeRect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b);
    ctx.fillStyle = css('--ink-2'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(X.label, pad.l + (w - pad.l - pad.r) / 2, h - 3);
    ctx.save(); ctx.translate(12, pad.t + (h - pad.t - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(Y.label, 0, 0); ctx.restore();
    // clip to plot area
    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); ctx.clip();
    const line = (pts, color, dash, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.setLineDash(dash || []);
      ctx.beginPath();
      let pen = false;
      for (const [x, y] of pts) {
        if (!isFinite(y) || !isFinite(x)) { pen = false; continue; }
        const X_ = px(x), Y_ = py(Math.max(Y.min * (Y.log ? 0.5 : 1), Math.min(Y.max * 2, y)));
        if (pen) ctx.lineTo(X_, Y_); else { ctx.moveTo(X_, Y_); pen = true; }
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    };
    for (const hl of spec.hlines || []) line([[X.min, hl.y], [X.max, hl.y]], hl.color, hl.dash, 1.2);
    for (const vl of spec.vlines || []) {
      ctx.strokeStyle = vl.color; ctx.setLineDash(vl.dash || []); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px(vl.x), pad.t); ctx.lineTo(px(vl.x), h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const s of spec.series) line(s.pts, s.color, s.dash, s.width);
    for (const pt of spec.points || []) {
      ctx.fillStyle = pt.color; ctx.strokeStyle = css('--surface'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px(pt.x), py(pt.y), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    if (spec.hover != null) {
      ctx.strokeStyle = css('--muted'); ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px(spec.hover), pad.t); ctx.lineTo(px(spec.hover), h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    // labels for horizontal lines
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    for (const hl of spec.hlines || []) if (hl.label) { ctx.fillStyle = hl.color; ctx.fillText(hl.label, w - pad.r - 4, py(hl.y) - 3); }
  }

  function legend(el, items) {
    el.innerHTML = items.map((it) => `<span class="legend-item">${it.box ? `<span class="box-swatch" style="background:${it.color};opacity:.35"></span>`
      : `<span class="line-swatch ${it.dash || ''}" style="border-color:${it.color}"></span>`}${it.label}</span>`).join('');
  }

  function drawCharts() {
    const cA = $('chartA'), cB = $('chartB');
    if (!last) {
      for (const cv of [cA, cB]) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); }
      return;
    }
    const { m, t, n, snr, lim } = last;
    const blue = css('--blue'), ink2 = css('--ink-2'), accent = css('--accent'), crit = css('--crit'), aqua = css('--aqua'), warn = css('--warn');
    const mRef = lim.mag;

    // A: SNR vs magnitude at the current exposure
    const mLo = mRef - 7, mHi = mRef + 1.5, ptsA = [], ptsI = [];
    for (let i = 0; i <= 200; i++) {
      const mm = mLo + (mHi - mLo) * i / 200;
      ptsA.push([mm, C.solveSNR(m, t, n, mm).snr]);
      ptsI.push([mm, C.solveSNR(m, t, n, mm, { ideal: true }).snr]);
    }
    const sat = C.saturationMag(m, t);
    const yMax = Math.pow(10, Math.ceil(Math.log10(Math.max(ptsI[0][1], snr * 3))));
    const specA = {
      x: { min: mLo, max: mHi, label: `${last.band.label} magnitude (${last.band.sys})`, fmt: (x) => x.toFixed(0) },
      y: { min: 0.3, max: yMax, log: true, label: 'SNR', fmt: (y) => (y >= 1000 ? `${y / 1000}k` : String(+y.toPrecision(2))), ticks: logTicks },
      bands: isFinite(sat.mag) && sat.mag > mLo ? [{ x0: mLo, x1: sat.mag, color: crit, label: 'saturated' }] : [],
      hlines: [{ y: snr, color: accent, dash: [5, 4], label: `${+snr.toPrecision(3)}σ` }],
      vlines: [{ x: mRef, color: ink2, dash: [2, 3] }],
      series: [{ pts: ptsI, color: aqua, dash: [6, 4], width: 1.6 }, { pts: ptsA, color: blue, width: 2.2 }],
      points: [{ x: mRef, y: snr, color: blue }],
      tip: (x) => {
        const s = C.solveSNR(m, t, n, x).snr, si = C.solveSNR(m, t, n, x, { ideal: true }).snr;
        return `<b>${last.band.label} = ${x.toFixed(2)}</b><br><span class="t">SNR</span> ${s.toPrecision(3)} <span class="t">· ideal detector</span> ${si.toPrecision(3)}` +
          (isFinite(sat.mag) && x < sat.mag ? '<br><span class="flag crit">saturated in one frame</span>' : '');
      },
    };
    $('chartASub').textContent = `${n} × ${fmtTime(t)} · limit ${mRef.toFixed(2)} at ${+snr.toPrecision(3)}σ`;
    legend($('legendA'), [{ color: blue, label: 'this system' }, { color: aqua, dash: 'dash', label: 'ideal detector (no read noise or dark)' },
      { color: accent, dash: 'dash', label: 'detection threshold' }].concat(specA.bands.length ? [{ color: crit, box: true, label: 'saturates in one frame' }] : []));

    // B: limiting magnitude vs total integration (N = T / t at fixed sub-exposure t)
    const Tc = t * n, Tlo = Math.max(1e-4, Tc / 1000), Thi = Math.min(1e8, Tc * 1000), ptsS = [], ptsL = [], ptsD = [];
    const split = (T) => (T >= t ? [t, T / t] : [T, 1]);
    for (let i = 0; i <= 160; i++) {
      const T = Tlo * Math.pow(Thi / Tlo, i / 160), [ts, ns] = split(T);
      ptsS.push([T, C.solveMag(m, ts, ns, snr).mag]);
      ptsD.push([T, C.solveMag(m, ts, ns, snr, { ideal: true }).mag]);
      ptsL.push([T, C.solveMag(m, T, 1, snr).mag]);
    }
    const all = ptsS.concat(ptsD, ptsL).map((q) => q[1]).filter(isFinite);
    const yLo = Math.floor(Math.min(...all)), yHi = Math.ceil(Math.max(...all) + 0.2);
    const specB = {
      x: { min: Tlo, max: Thi, log: true, label: 'total integration time', fmt: fmtTimeTick, ticks: timeTicks },
      y: { min: yLo, max: yHi, label: `limiting ${last.band.label} at ${+snr.toPrecision(3)}σ`, fmt: (y) => String(+y.toFixed(1)) },
      hlines: mode === 'mag' ? [] : [{ y: last.mag, color: accent, dash: [5, 4], label: `target ${last.mag}` }],
      vlines: [{ x: Tc, color: ink2, dash: [2, 3] }],
      series: [{ pts: ptsD, color: aqua, dash: [6, 4], width: 1.6 }, { pts: ptsL, color: warn, dash: [2, 3], width: 1.8 },
        { pts: ptsS, color: blue, width: 2.2 }],
      points: [{ x: Tc, y: lim.mag, color: blue }],
      tip: (T) => {
        const [ts, ns] = split(T);
        return `<b>${fmtTime(T)}</b> <span class="t">(${ns >= 1.5 ? `${ns.toPrecision(3)} × ${fmtTime(ts)}` : 'one frame'})</span><br>` +
          `<span class="t">stack</span> ${C.solveMag(m, ts, ns, snr).mag.toFixed(2)} <span class="t">· one exposure</span> ${C.solveMag(m, T, 1, snr).mag.toFixed(2)}` +
          ` <span class="t">· ideal</span> ${C.solveMag(m, ts, ns, snr, { ideal: true }).mag.toFixed(2)}`;
      },
    };
    $('chartBSub').textContent = `sub-exposures of ${fmtTime(t)}; current total ${fmtTime(Tc)}`;
    legend($('legendB'), [{ color: blue, label: `stack of ${fmtTime(t)} frames` }, { color: warn, dash: 'dot', label: 'one exposure of the full time' },
      { color: aqua, dash: 'dash', label: 'ideal detector' }]);

    charts.A = specA; charts.B = specB;
    drawChart(cA, specA);
    drawChart(cB, specB);
  }

  // hover tooltips
  const tip = $('tip');
  for (const [key, id] of [['A', 'chartA'], ['B', 'chartB']]) {
    const cv = $(id);
    cv.addEventListener('mousemove', (e) => {
      const spec = charts[key];
      if (!spec || !spec._px) return;
      const r = cv.getBoundingClientRect(), xPix = e.clientX - r.left, pad = spec._pad;
      if (xPix < pad.l || xPix > spec._w - pad.r) { tip.style.display = 'none'; spec.hover = null; drawChart(cv, spec); return; }
      const f = (xPix - pad.l) / (spec._w - pad.l - pad.r);
      const x = spec.x.log ? spec.x.min * Math.pow(spec.x.max / spec.x.min, f) : spec.x.min + f * (spec.x.max - spec.x.min);
      spec.hover = x;
      drawChart(cv, spec);
      tip.innerHTML = spec.tip(x);
      tip.style.display = 'block';
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(window.innerWidth - tw - 8, e.clientX + 14)}px`;
      tip.style.top = `${e.clientY + 14}px`;
    });
    cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; if (charts[key]) { charts[key].hover = null; drawChart(cv, charts[key]); } });
  }
  if (window.ResizeObserver) {
    let rq = false;
    new ResizeObserver(() => {
      if (rq) return;
      rq = true;
      requestAnimationFrame(() => { rq = false; if (charts.A) drawChart($('chartA'), charts.A); if (charts.B) drawChart($('chartB'), charts.B); });
    }).observe($('chartA'));
  }

  // ---------------------------------------------------------------- header buttons
  function setTheme(th) {
    document.documentElement.dataset.theme = th;
    $('themeBtn').textContent = th === 'dark' ? 'Light' : 'Dark';
    try { localStorage.setItem('limitingmag-theme', th); } catch (e) { /* private mode */ }
    if (last) drawCharts();
  }
  $('themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('linkBtn').addEventListener('click', () => {
    const done = () => { $('linkBtn').textContent = 'Copied'; setTimeout(() => { $('linkBtn').textContent = 'Copy link'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, () => prompt('Copy this link:', location.href));
    else prompt('Copy this link:', location.href);
  });
  $('resetBtn').addEventListener('click', () => { history.replaceState(null, '', location.pathname); applyScenario('cmos'); });

  // ---------------------------------------------------------------- init
  let theme = 'dark';
  try { theme = localStorage.getItem('limitingmag-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); } catch (e) { /* ignore */ }
  setTheme(theme);
  const fromHash = decodeHash();
  if (fromHash && !fromHash.band && SCENARIOS.some((s) => s.id === fromHash.scenario)) {
    applyScenario(fromHash.scenario);                      // short links: #scenario=rubin[&mode=exp]
    if (fromHash.mode) setMode(fromHash.mode);
  } else if (fromHash && fromHash.band in BANDS) {
    applyState(Object.assign({}, BASE, fromHash));
    if (fromHash.scenario && SCENARIOS.some((s) => s.id === fromHash.scenario)) {
      $('scenario').value = fromHash.scenario;
      $('scenarioNote').textContent = SCENARIOS.find((s) => s.id === fromHash.scenario).note;
    }
    syncPresetNotes();
    schedule();
  } else {
    applyScenario('cmos');
  }
  window.LimApp = { compute, applyScenario, setMode, state: () => last };
})();
