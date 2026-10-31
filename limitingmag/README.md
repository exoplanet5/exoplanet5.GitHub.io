# Telescope Limiting Magnitude Calculator

Static web calculator for CCD and CMOS imaging. It solves the CCD equation three ways — **limiting magnitude**,
**signal-to-noise ratio**, or **exposure time** — for stars and for targets moving relative to the tracking
(satellites, NEOs), with 22 photometric bands built from published filter curves, telescope and detector
presets, saturation, moonlight and a measured-zero-point mode.

**Open:** [`index.html`](index.html) — no build step, no external requests; works from `file://` and from GitHub Pages
(<https://exoplanet5.github.io/limitingmag/>).

v1 (April 2026) is in the git history of this folder; this README documents v2 (October 2026).

---

## What changed in v2

| | v1 | v2 |
|---|---|---|
| Source flux | 100 % of the star counted inside an aperture of diameter FWHM (which holds ≈ 50 %) | PSF-fit noise-equivalent area, or an aperture with its true enclosed flux |
| PSF | implicit top-hat | Moffat (β = 4.765, Kolmogorov seeing) or Gaussian, integrated over pixels and sub-pixel phase |
| Sky | multiplied by the atmospheric transmission | measured at the ground, not extinguished; brightens with air mass (Krisciunas & Schaefer 1991) |
| Air mass | sec z (diverges at the horizon) | Pickering (2002) |
| Bands | 15 hand-entered rows; Gaia G/G_RP sky 0.5–0.6 mag too dark, SDSS u 0.8 mag too bright | 22 bands integrated from filter curves, CALSPEC Vega and the Rubin site model; adds Rubin LSST ugrizy and a 400–700 nm luminance band |
| Mode switching | copied stale results of earlier sessions into the inputs | the unknown is shown in place in its own field; nothing hidden |
| Moving targets | — | trailed PSF for any rate; numerical exposure solver; flags an SNR that no exposure can reach |
| Detector | QE, pixel, dark, read noise | + full well → bright (saturation) limit and peak-pixel check |
| Telescope | aperture, f/N; presets also overwrote seeing and elevation | + central obscuration; presets set optics only |
| Photon budget | components only | components, or a measured instrumental zero point |
| Sky conditions | one dark-sky value | + Moon age (UBVRI table interpolated in wavelength) |
| Output | one number, noise bar, 12 tiles | result + regime, bright limit, detector penalty, sky-limited sub-exposure, sampling; electron budget table; SNR-vs-mag and depth-vs-time charts with tooltips |
| Presets | 4 telescopes, 6 sensors (two mislabelled, one with wrong noise) | 4 telescopes with obscuration, 7 sensors from current datasheets, 3 worked situations |
| Validation | none | reproduces Rubin SMTN-002 m5 to ≤ 0.02 mag in all six bands; 1287 automated checks |
| Page | KaTeX from a CDN; recomputed on every keystroke | MathML, no dependencies; `requestAnimationFrame`-coalesced updates (1–15 ms incl. charts); light/dark theme; shareable link |

---

## Audit of v1

### Defects

| # | v1 behaviour | Consequence | Fix |
|---|---|---|---|
| 1 | Source = full stellar flux, but sky, dark and read noise taken over N<sub>pix</sub> = π/4 (FWHM/pixel)², a disc of **radius FWHM/2**, which encloses only 50 % of a Gaussian | limiting magnitudes **0.75 mag too deep** in every regime; SNR overstated, exposure understated | count only the enclosed flux, or use the PSF-fit noise-equivalent area (default) |
| 2 | Sky = 10<sup>−0.4μ</sup> F<sub>0</sub> Ω A t QE T<sub>opt</sub> **T<sub>atm</sub>** — the ground-measured sky was dimmed again by the atmosphere | sky too faint by k·X (0.2 mag at X = 1.5 in V); limits up to 0.06 mag too deep | sky not extinguished |
| 3 | `setMode()` wrote *every* stored past result (`lastCalc.mag/snr/exp`) back into the inputs | e.g. edit SNR in mode 1, switch to mode 3 → the SNR you just typed is replaced by an old mode-2 result | the solved quantity is displayed read-only in its own field; switching mode makes it editable with that value |
| 4 | Air mass = sec z; elevation field allowed 5° but nothing prevented 0° | X → ∞; no change of sky brightness with elevation | Pickering (2002); K&S sky; optional X<sup>0.6</sup> seeing |
| 5 | Band table hand-typed: dark sky Gaia G 21.4 / G<sub>RP</sub> 20.3 (model 20.84 / 19.70), SDSS u 22.1 (22.87); F<sub>0</sub> off by up to 12 % (B, V, i, z, G<sub>BP</sub>) | band-dependent biases of 0.1–0.3 mag | every band recomputed from its filter curve (table below) |
| 6 | Presets: “e2v CCD250-82 (WFST)” — WFST uses CCD290-99; “e2v CCD230-42 (Rubin)” — Rubin uses CCD250-82/ITL, the CCD230-42 is the DESI GFA sensor; GSENSE9016BSI read noise 0.5 e⁻ and dark 0.004 e⁻/s (Gpixel: 0.7 e⁻, 0.04 e⁻/s at −30 °C); GSENSE1517BSI dark quoted at −60 °C (Gpixel: < 0.008 e⁻/s at −70 °C) | wrong hardware | presets corrected and sourced |
| 7 | No central obscuration | Rubin collecting area overstated 1.7× (55.4 vs 32.4 m²), Mayall 1.3× | obscuration field and per-preset values |
| 8 | Telescope presets also set seeing (1.0–1.5″), elevation (60°) and throughput | changing telescope silently changed the site | presets set optics only |
| 9 | Results shown with fixed decimals (an exposure of 2 ms showed as “0.00”) | unreadable at extremes | adaptive units (µs … d) |
| 10 | README said “single index.html with no dependencies” but the page loaded KaTeX from jsDelivr; `limitingmag/.claude/settings.local.json` was published with the site | offline use broken; local tool settings public | MathML; `.claude/` removed from the site |

### Three situations × three modes

Reproduce with `node tests/audit_v1.js`. Each row removes one v1 defect cumulatively, then switches to the v2 models.

**1 · Small telescope + CMOS stack** (v1 default: V, 0.3 m f/5, IMX455, 5″ FWHM, 40° elevation, 10 × 10 s, 4σ)

| Mode 1 — limiting magnitude | m<sub>lim</sub> | Δ vs v1 |
|---|---|---|
| v1 as published | 20.08 | — |
| + only the enclosed flux counts | 19.33 | −0.75 |
| + sky not dimmed by extinction | 19.28 | −0.80 |
| + band zero point, sky and k recomputed | 19.33 | −0.75 |
| v2, Gaussian, PSF fit | 19.52 | −0.55 |
| **v2 default** (Moffat β = 4.765, PSF fit, zenith sky scaled to X = 1.55) | **19.28** | **−0.80** |

Mode 2 (V = 18): SNR 21.98 → **12.42**. Mode 3 (V = 18, 4σ, 10 frames): 1.19 s → **2.31 s** per frame.
Regime: sky 55 % / read noise 40 % of the variance.

**2 · Survey telescope + CCD, sky limited** (SDSS r, 8.4 m f/1.234, CCD250-82, 1.0″, 60°, 1 × 30 s, 5σ)

| Mode 1 | m<sub>lim</sub> | Δ vs v1 |
|---|---|---|
| v1 as published | 24.97 | — |
| + enclosed flux | 24.22 | −0.75 |
| + sky not extinguished | 24.16 | −0.81 |
| **v2 default** (no obscuration, as in v1) | **24.12** | **−0.85** |

Mode 2 (r = 24): SNR 11.93 → **5.58**. Mode 3 (r = 24, 5σ): 5.75 s → **24.2 s**. Regime: sky 96 %.
(With the Rubin obscuration preset the area drops a further 41 %, another ≈ −0.29 mag.)

**3 · Short exposure, read-noise limited** (Gaia G, Mayall 3.8 m f/3.86, CCD230-42, 1.5″, 60°, 1 × 0.2 s, 10σ)

| Mode 1 | m<sub>lim</sub> | Δ vs v1 |
|---|---|---|
| v1 as published | 19.93 | — |
| + enclosed flux | 19.17 | −0.75 |
| + sky not extinguished, new band data | 19.15 | −0.78 |
| **v2 default** | **19.23** | **−0.69** |

Mode 2 (G = 17): SNR 65.4 → **55.0**. Mode 3 (G = 17, 10σ): 12.4 ms → **21.5 ms**. Regime: read noise 55 %.

v1 was optimistic by ≈ 0.7–0.85 mag in all three regimes, and by about 2× in SNR and 4× in exposure time when the sky dominates.
The three solve modes were mutually consistent in v1 (the quadratics are correct); the errors were in the inputs to them.

---

## Using the calculator

**Solve for** picks the unknown. The other three of {single exposure, frames, SNR, magnitude} are inputs; the unknown
is filled in, highlighted and marked *solved*. Switching mode keeps that value, so a limit found in mode 1 becomes
the target of modes 2 and 3 and they agree.

**Example situations** load a complete setup:

| Situation | What it shows |
|---|---|
| Small telescope · CMOS stack | the v1 default; read noise and sky share the variance; sky-limited sub-exposures would need ≥ 72 s |
| Survey telescope · Rubin LSST 30-s visit | SMTN-002 reference (zero-point mode, Gaussian NEA, FWHM<sub>eff</sub>, 8.8 e⁻). Switching the LSST band also switches to that band's FWHM<sub>eff</sub>, so all six published m5 can be checked |
| Moving target · GEO satellite, sidereal tracking | 0.4 m f/3 + IMX455, 15.04″/s: a 2-s frame trails over 12 FWHM; the single-exposure curve flattens because longer exposures add sky but no peak signal |

Short links: `index.html#scenario=rubin`, `#scenario=geo&mode=exp`. **Copy link** stores the full configuration in the URL.

### Inputs

| Card | Field | Notes |
|---|---|---|
| Exposure & detection | single exposure, frames, SNR, magnitude | magnitude in the selected band's system (Vega or AB) |
| | target motion vs tracking (″/s) | 0 for a star or a rate-tracked target; GEO under sidereal tracking 15.04″/s |
| Telescope | aperture D, obscuration D<sub>obs</sub>/D, f/N, throughput | throughput = peak of mirrors × lenses × filter; excludes atmosphere and QE. Obscuration is area-equivalent (include spiders) |
| Camera | QE, pixel, dark, read noise, full well | QE is band-averaged; presets give the peak |
| Band, sky & seeing | band, sky at zenith, Moon, k, elevation, FWHM | band choice fills the dark-sky value and k; the Moon menu adds lunar brightening; editing the sky switches the Moon to *manual* |
| | “sky is a zenith value” (default on) | brightens μ to the target air mass |
| | “FWHM is a zenith value” (default off) | scales the FWHM as X<sup>0.6</sup> |
| Photometry model | PSF fit / aperture (radius × FWHM) | PSF fit is the matched-filter optimum |
| | Moffat β / Gaussian | β = 4.765 matches Kolmogorov seeing |
| | from components / measured zero point | ZP = magnitude giving 1 e⁻/s at X = 1, atmosphere included; replaces obscuration, throughput and QE |

### Outputs

- **Result** with context, and tiles: total integration; **noise regime** (largest variance term);
  **bright limit** (magnitude whose peak pixel reaches full well in one frame); **detector penalty** (depth lost to read noise
  and dark compared with an ideal detector at the same exposure); **sky-limited sub-exposure** (shortest frame for which
  sky + dark per pixel ≥ 10 RN², i.e. read noise costs ≤ 5 % in SNR); **PSF sampling** (FWHM in pixels).
- Conditions line: air mass, atmospheric transmission, sky and FWHM at the target, source rate, trail length, and the
  target's peak pixel against full well.
- **Noise budget**: electrons, variance and share for source, sky, dark and read noise; per-pixel, per-frame levels.
- **SNR vs magnitude** at the current exposure, with the ideal-detector curve, the threshold and the saturated range.
- **Limiting magnitude vs total integration**: stacking the current sub-exposure, one exposure of the full time, and an
  ideal detector — shows where read noise or trailing stops paying.

---

## Model

All quantities are electrons in the stack of N frames of t seconds (T = Nt):

```
SNR = S / sqrt( S + n_pix · ( b_sky·T + I_dark·T + N·σ_RN² ) )

S     = 10^(−0.4 m) · F0 · A_eff · T_opt · QE · 10^(−0.4 k X) · f_ap · T        (source)
b_sky = 10^(−0.4 μ) · F0 · A_eff · T_opt · QE · s²                              (sky, e⁻/s/px; no extinction)
A_eff = π D² (1 − ε²) / 4,   s = 206265 · pixel / (D · f/N)   [″/px]
```

With a measured zero point: `S = 10^(0.4 (ZP − m)) · 10^(−0.4 k (X − 1)) · f_ap · T` and
`b_sky = 10^(0.4 (ZP + k − μ)) · s²` (the sky sees the instrument but not the atmosphere's extinction).

**PSF fit** (default): f<sub>ap</sub> = 1 and n<sub>pix</sub> = 1/Σ P<sub>ij</sub>², the noise-equivalent area of the
pixel-integrated, trailed PSF averaged over sub-pixel phase. Continuous limits: Gaussian 2.266 FWHM²; Moffat
π α² (2β − 1)/(β − 1)² = 3.02 FWHM² for β = 4.765. Pixel and trail integrals are exact for a Gaussian
(error-function closed forms; long trails sum only the end pixels). A Moffat is mapped onto the Gaussian with the same
noise-equivalent area (for n<sub>pix</sub>) or the same peak (for saturation).

**Aperture**: radius r = k·FWHM; a stadium of length L around a trail. n<sub>pix</sub> = (π r² + 2 r L)/s²,
f<sub>ap</sub> = enclosed flux (Gaussian 1 − e<sup>−r²/2σ²</sup>, Moffat 1 − (1 + r²/α²)<sup>1−β</sup>; trailed Gaussian
by 1-D quadrature; trailed Moffat interpolated between its circle and strip limits with the Gaussian's weight).

**Solving**

| Mode | Method |
|---|---|
| Limiting magnitude | background variance B fixed → S = [SNR² + √(SNR⁴ + 4 SNR² B)]/2, m = −2.5 log(S / S₀) |
| SNR | direct |
| Exposure | point source: S = αT, B = βT + δ with δ = N σ²<sub>RN</sub> n<sub>pix</sub> → α²T² − SNR²(α + β)T − SNR² δ = 0. Moving target: n<sub>pix</sub> grows with t, so log-grid scan + bisection; reports the best reachable SNR if the request is impossible |

**Atmosphere and sky.** X from Pickering (2002). Away from the zenith the dark sky is
μ(z) = μ<sub>zen</sub> − 2.5 log[X<sub>sky</sub> · 10<sup>−0.4k(X<sub>sky</sub>−1)</sup>] with
X<sub>sky</sub> = (1 − 0.96 sin² z)<sup>−1/2</sup> (Krisciunas & Schaefer 1991). Lunar brightening by age
(0, 3, 7, 10, 14 d): the Kitt Peak UBVRI table (e.g. V: 0, 0.1, 0.4, 1.1, 1.8 mag), linearly interpolated in pivot
wavelength.

**Saturation.** Peak pixel = 10<sup>−0.4m</sup> S₀ t P<sub>max</sub> + (b<sub>sky</sub> + I<sub>dark</sub>) t with
P<sub>max</sub> the pixel-integrated peak at the best-centred phase (trailing included).

### Assumptions and limits

- One QE and one throughput per band (no colour terms); magnitudes are in the selected band's own system.
  Converting a limit between bands needs the source colour.
- No scintillation, flat-field or other systematic noise floor — these cap the SNR of bright stars in short exposures,
  not the faint limit. No cosmic rays, gain quantisation or binning.
- CMOS read noise is treated as Gaussian (real sensors have a long RTS tail).
- Moffat trailing and pixelisation use an equivalent Gaussian: n<sub>pix</sub> within 2.5 % of brute force; extremely
  undersampled PSFs (FWHM < 1 px) within 8 %.
- The Moon table is an average for moderate Moon–target separations; dark-sky values are for a dark site near solar minimum.
- Dark current and read noise depend on temperature and readout mode — check the preset note.

---

## Photometric bands

Computed by [`tools/build_bands.py`](tools/build_bands.py). For each band the filter (hardware) response S(λ) is
normalised to a peak of 1 and

```
F0   = ∫ f_λ,ZP S λ/(hc) dλ                      photons s⁻¹ m⁻², mag-0 source
λp   = sqrt(∫ S λ dλ / ∫ S/λ dλ),   W = ∫ S dλ
k    = −2.5 log[∫ S T_atm(X=1) λ dλ / ∫ S λ dλ]
μsky = −2.5 log[∫ f_sky S λ dλ / ∫ f_ZP S λ dλ]
```

f<sub>ZP</sub> is 3631 Jy (AB) or CALSPEC `alpha_lyr_stis_012` with Vega = +0.03 mag (Johnson–Cousins) and +0.023 mag
(Gaia). The dark-sky spectrum (`darksky.dat`) and the X = 1.0 atmosphere (`atmos_10_aerosol.dat`) are Rubin's Cerro
Pachón models from [lsst-pst/syseng_throughputs](https://github.com/lsst-pst/syseng_throughputs). Filter curves are from
[speclite](https://github.com/desihub/speclite): Bessell (1990), SDSS 2010 without atmosphere (Doi et al. 2010),
Rubin LSST throughputs 1.9 with the X = 1.2 atmosphere divided out, Gaia DR3 passbands (Riello et al. 2021).

| Band | System | Pivot (nm) | Width (nm) | F₀ (ph s⁻¹ m⁻²) | k | Dark sky (mag/″²) | Curve |
|---|---|---|---|---|---|---|---|
| Johnson–Cousins U | Vega | 360 | 64 | 4.967e9 | 0.523 | 22.16 | bessell-U |
| Johnson–Cousins B | Vega | 440 | 96 | 1.378e10 | 0.253 | 22.64 | bessell-B |
| Johnson–Cousins V | Vega | 550 | 89 | 9.124e9 | 0.153 | 21.72 | bessell-V |
| Johnson–Cousins Rc | Vega | 656 | 159 | 1.139e10 | 0.114 | 20.82 | bessell-R |
| Johnson–Cousins Ic | Vega | 805 | 150 | 6.946e9 | 0.078 | 19.64 | bessell-I |
| SDSS u′ | AB | 355 | 57 | 8.807e9 | 0.554 | 22.87 | sdss2010noatm-u |
| SDSS g′ | AB | 468 | 123 | 1.447e10 | 0.212 | 22.33 | sdss2010noatm-g |
| SDSS r′ | AB | 617 | 113 | 1.005e10 | 0.124 | 21.18 | sdss2010noatm-r |
| SDSS i′ | AB | 750 | 112 | 8.224e9 | 0.097 | 20.52 | sdss2010noatm-i |
| SDSS z′ | AB | 893 | 117 | 7.166e9 | 0.099 | 19.29 | sdss2010noatm-z |
| Rubin LSST u | AB | 370 | 46 | 6.804e9 | 0.461 | 23.05 | lsst2023-u |
| Rubin LSST g | AB | 476 | 143 | 1.650e10 | 0.204 | 22.25 | lsst2023-g |
| Rubin LSST r | AB | 620 | 136 | 1.208e10 | 0.124 | 21.20 | lsst2023-r |
| Rubin LSST i | AB | 755 | 130 | 9.419e9 | 0.095 | 20.46 | lsst2023-i |
| Rubin LSST z | AB | 868 | 101 | 6.402e9 | 0.069 | 19.61 | lsst2023-z |
| Rubin LSST y | AB | 971 | 79 | 4.450e9 | 0.164 | 18.60 | lsst2023-y |
| Gaia DR3 G | Vega | 622 | 442 | 3.638e10 | 0.130 | 20.84 | gaiadr3-G |
| Gaia DR3 G<sub>BP</sub> | Vega | 511 | 262 | 2.848e10 | 0.184 | 21.82 | gaiadr3-BP |
| Gaia DR3 G<sub>RP</sub> | Vega | 777 | 286 | 1.463e10 | 0.099 | 19.70 | gaiadr3-RP |
| Luminance 400–700 nm | AB | 543 | 300 | 3.068e10 | 0.159 | 21.68 | top-hat |
| Luminance 400–800 nm | AB | 588 | 400 | 3.799e10 | 0.140 | 21.33 | top-hat |
| Luminance 400–900 nm | AB | 633 | 500 | 4.445e10 | 0.118 | 20.91 | top-hat |

The Moon menu and the sky field override the dark-sky value; the k field overrides the extinction. Real sites differ:
La Palma and Paranal dark skies are ≈ 21.9 V; light-polluted sites can be 3–5 mag brighter.

---

## Presets

### Telescopes (optics only)

| Preset | D (m) | Obscuration | f/N | Throughput | Basis |
|---|---|---|---|---|---|
| MUST 6.5 m | 6.5 | 0 (not published — enter yours) | 3.70 | 0.50 | f = 24.1 m |
| Rubin Observatory | 8.36 | 0.640 | 1.2336 | 0.70 | 6.423 m effective clear aperture (SMTN-002); 0.20″ per 10 µm |
| WFST 2.5 m | 2.5 | 0.40 | 2.48 | 0.50 | 1.0 m prime-focus assembly; 2.29 m effective aperture |
| Mayall/DESI | 3.797 | 0.485 | 3.86 | 0.50 | 1.8 m obscuration + spider → 8.66 m² (desimodel `desi.yaml`) |

### Detectors

| Preset | Pixel (µm) | QE | Dark (e⁻/s/px) | Read noise (e⁻) | Full well (e⁻) | Source |
|---|---|---|---|---|---|---|
| e2v CCD250-82 (Rubin LSSTCam) | 10 | 0.93 | 0.02 at 178 K | 5.0 | 135 k | Teledyne e2v datasheet (RN 5–8 e⁻, FW non-inverted) |
| e2v CCD290-99 (WFST) | 10 | 0.90 | 0.0011 at −100 °C | 4.0 at 0.5 MHz | 90 k | Teledyne e2v datasheet (2.5 e⁻ at 50 kHz) |
| e2v CCD230-42 (DESI GFA) | 15 | 0.92 | 0.2 at −25 °C | 4.0 at 50 kHz | 150 k | v1 values; FW from the inverted-mode listing |
| Sony IMX455 (QHY600, ASI6200) | 3.76 | 0.80 | 0.0022 at −20 °C | 1.2 (high gain) | 51.4 k (low gain) | ZWO / QHY specifications; peak QE 91 % |
| Gpixel GSENSE1517BSI | 15 | 0.92 | < 0.008 at −70 °C | 1.2 (12-bit HDR) | 70 k | Gpixel product page |
| Gpixel GSENSE1081BSI | 10 | 0.95 | 0.0037 at −70 °C | 5.35 | 90.7 k | Gpixel product page and datasheet; peak QE 97 % |
| Gpixel GSENSE9016BSI | 9 | 0.95 | 0.04 at −30 °C | 0.7 | 118 k | Gpixel product page |

QE values are the peak; enter the band average for accurate results. Selecting a preset fills its fields; editing any
field switches the menu to *Custom*.

---

## Validation

| Check | Result |
|---|---|
| Rubin SMTN-002 (2026-08-12) m5, 1 × 30 s, zenith, dark sky | u 23.687 (23.70) · g 24.962 (24.97) · r 24.504 (24.52) · i 24.111 (24.13) · z 23.542 (23.56) · y 22.537 (22.55); all within 0.02 mag. The residual is the pixel-integration term SMTN-002 omits |
| Rubin 1-s zero points from the band pipeline | 26.524, 28.508, 28.361, 28.171, 27.782, 26.818 vs 26.52, 28.51, 28.36, 28.17, 27.78, 26.82 |
| Gaia DR3 Vega zero points (pupil 0.7278 m²) | G 25.698, BP 25.355, RP 24.747 vs 25.687, 25.339, 24.748 (Riello et al. 2021) |
| PSF geometry vs 16× supersampled brute force (`tests/ref_geometry.py`) | Gaussian n<sub>pix</sub> ≤ 0.2 %, Moffat ≤ 2.5 %, peak pixel ≤ 4 %, aperture fraction ≤ 0.006 |
| Trailing loss, L = 20 FWHM | 1.25 log(n<sub>pix</sub>(L)/n<sub>pix</sub>(0)) = Veres & Chesley (2017) SNR-loss fit to < 0.01 mag |
| Three-mode round trips, 400 random systems (incl. trailing, apertures, ZP mode) | mag → SNR ≤ 10⁻¹⁴, mag → exposure ≤ 2 × 10⁻¹¹ |
| Regime scaling laws | read-limited dm/dlog t = 2.5, sky-limited 1.25, source-limited t ∝ SNR² |

```bash
node tests/test_core.js            # 1287 checks
node tests/audit_v1.js             # v1 vs v2 tables above
python -I tests/ref_geometry.py > tests/ref_geometry.json   # regenerate the brute-force reference
```

---

## Files

```
index.html            page, styles, method notes (MathML)
js/bands.js           generated band table
js/core.js            physics: atmosphere, PSF / pixel / trail integrals, noise budget, the three solvers
js/app.js             UI: presets, situations, URL state, results, charts
tools/build_bands.py  builds js/bands.js and checks it against Rubin and Gaia zero points
tests/                Node tests, v1 audit, brute-force geometry reference
```

Rebuild the band table (needs numpy, astropy and the speclite filter files):

```bash
pip install --target /tmp/pylib speclite
mkdir -p /tmp/bandsrc && cd /tmp/bandsrc
curl -O https://archive.stsci.edu/hlsps/reference-atlases/cdbs/calspec/alpha_lyr_stis_012.fits
for f in darksky.dat atmos_10_aerosol.dat pachonModtranAtm_12_aerosol.dat; do
  curl -O https://raw.githubusercontent.com/lsst-pst/syseng_throughputs/main/siteProperties/$f; done
cd - && python -I tools/build_bands.py /tmp/pylib/speclite/data/filters /tmp/bandsrc js/bands.js
```

---

## References

- Bessell, M. S. 1990, PASP, 102, 1181 — UBVRI passbands
- Bohlin, R. C., Hubeny, I., & Rauch, T. 2020, AJ, 160, 21 — CALSPEC Vega
- Doi, M. et al. 2010, AJ, 139, 1628 — SDSS response functions
- Riello, M. et al. 2021, A&A, 649, A3 — Gaia EDR3 photometry and zero points
- Rubin Observatory technote SMTN-002 (updated 2026-08-12) — Calculating LSST limiting magnitudes and SNR
- Ivezić, Ž. et al. 2019, ApJ, 873, 111 — LSST overview
- Krisciunas, K., & Schaefer, B. E. 1991, PASP, 103, 1033 — Moonlight and sky brightness model
- Pickering, K. A. 2002, DIO, 12, 1 — Air-mass formula
- Trujillo, I. et al. 2001, MNRAS, 328, 977 — Moffat β = 4.765 for Kolmogorov seeing
- Veres, P., & Chesley, S. R. 2017, AJ, 154, 12 — Trailing losses
- Walker, M. F. 1987, NOAO Newsletter 10 — UBVRI sky brightness vs lunar age (the table used by NOAO exposure-time calculators)
- DESI Collaboration 2016, arXiv:1611.00037; desimodel `desi.yaml` — Mayall geometry
- WFST Collaboration 2023, arXiv:2306.07590 — Sciences with the 2.5-m Wide Field Survey Telescope
- Teledyne e2v CCD250-82, CCD290-99, CCD230-42 datasheets; Gpixel GSENSE1517BSI, 1081BSI, 9016BSI product pages; ZWO ASI6200 / QHY600 specifications

---

## Deployment

The page is plain static files. To update GitHub Pages:

```bash
git clone https://github.com/exoplanet5/exoplanet5.github.io.git
rsync -a --delete --exclude .claude /path/to/limitingmag/ exoplanet5.github.io/limitingmag/
cd exoplanet5.github.io && git add -A limitingmag && git commit -m "limitingmag: …" && git push
```
