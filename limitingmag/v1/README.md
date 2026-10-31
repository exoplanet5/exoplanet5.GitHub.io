# CCD Limiting Magnitude Calculator

A browser-based calculator for estimating CCD imaging detection limits. Supports three solve modes, 15 photometric bands across Johnson-Cousins, SDSS, Gaia, and wide luminance systems, telescope and camera presets for common survey instruments, and a physically correct atmospheric extinction model.

**Live**: [exoplanet5.github.io/limitingmag](https://exoplanet5.github.io/limitingmag/)

---

## Three Calculation Modes

| Mode | Given | Solves for |
|------|-------|------------|
| **Find Limiting Magnitude** | single exposure, frames, SNR | faintest detectable magnitude |
| **Find SNR** | single exposure, frames, target magnitude | achievable signal-to-noise ratio |
| **Find Exposure Time** | frames, SNR, target magnitude | required single-frame exposure |

All modes share the same Sky & Telescope and Camera parameters. Switching modes carries the last result forward as input for the new mode.

---

## CCD Equation

The signal-to-noise ratio for a point source on a CCD is:

```
SNR = Source / sqrt(Source + Sky + Dark + RN)
```

where all quantities are in photoelectrons:

| Term | Expression | Description |
|------|-----------|-------------|
| **Source** | `10^(-0.4*m) * F0 * A * t * Q_eff` | Signal from the star |
| **Sky** | `10^(-0.4*m_sky) * F0 * PSF_area * A * t * Q_eff` | Sky background in the PSF aperture |
| **Dark** | `DC * t * N_pix` | Dark current noise |
| **RN** | `RN_frame^2 * N_frames * N_pix` | Total read noise variance (variances add across frames) |

### Symbols

| Symbol | Definition |
|--------|-----------|
| `m` | Source magnitude |
| `m_sky` | Sky surface brightness (mag/arcsec^2) |
| `F0` | Band zero-point photon flux (ph/m^2/s) for a mag=0 star above the atmosphere |
| `A` | Telescope collecting area = pi * D^2 / 4 (m^2) |
| `t` | Total integration time = single_exposure * N_frames (s) |
| `Q_eff` | Total system efficiency = QE * T_optics * T_atm |
| `PSF_area` | PSF footprint on sky (arcsec^2) = PixScale^2 * N_pix |
| `N_pix` | Number of pixels in PSF = pi * (FWHM/PixScale)^2 / 4 |
| `PixScale` | Plate scale = CamPix / (10^6 * D * f/N) / pi * 648000 (arcsec/pixel) |
| `DC` | Dark current (e-/s/pixel) |
| `RN_frame` | Read noise per frame (e-/pixel) |

### Effective Efficiency

The total system efficiency is the product of three independent factors:

```
Q_eff = QE * T_optics * T_atm
```

| Factor | Description | Typical range |
|--------|-------------|---------------|
| `QE` | Detector quantum efficiency | 0.5 - 0.95 |
| `T_optics` | Telescope + filter optical throughput | 0.3 - 0.8 |
| `T_atm` | Atmospheric transmission (band-dependent) | 0.5 - 0.95 |

Atmospheric transmission is computed from the band extinction coefficient and airmass:

```
T_atm = 10^(-0.4 * k * X)
X = sec(z) = 1 / cos(90 deg - elevation)
```

where `k` is the atmospheric extinction coefficient in mag/airmass and `X` is the airmass.

---

## Solving the CCD Equation

### Mode 1: Find Limiting Magnitude

Rearranging the SNR equation into a quadratic in `x = 10^(-0.4*m)`:

```
Source^2 - SNR^2 * Source - SNR^2 * (Sky + Dark + RN) = 0
```

Substituting `Source = x * A0` where `A0 = F0 * A * t * Q_eff`:

```
(A0/SNR)^2 * x^2  -  A0 * x  -  (Sky + Dark + RN) = 0
```

Solving with the quadratic formula (taking the positive root):

```
x = (A0 + sqrt(A0^2 + 4*(A0/SNR)^2*(Sky+Dark+RN))) / (2*(A0/SNR)^2)

Limiting Magnitude = -2.5 * log10(x)
```

### Mode 2: Find SNR

Given the target magnitude `m`, the source signal is known directly:

```
Source = 10^(-0.4*m) * F0 * A * t * Q_eff
SNR = Source / sqrt(Source + Sky + Dark + RN)
```

No quadratic solve is needed.

### Mode 3: Find Exposure Time

With `t` as the unknown, define rate coefficients:

```
alpha = 10^(-0.4*m) * F0 * A * Q_eff       (source e-/s)
beta  = 10^(-0.4*m_sky) * F0 * PSF_area * A * Q_eff   (sky e-/s)
gamma = DC * N_pix                           (dark e-/s)
delta = RN_frame^2 * N_frames * N_pix        (read noise variance, constant)
```

Then `Source = alpha*t`, `Sky = beta*t`, `Dark = gamma*t`, and `RN = delta`. The SNR equation becomes a quadratic in `t`:

```
alpha^2 * t^2  -  SNR^2 * (alpha + beta + gamma) * t  -  SNR^2 * delta = 0
```

Solving:

```
t = (SNR^2*(alpha+beta+gamma) + sqrt(SNR^4*(alpha+beta+gamma)^2 + 4*alpha^2*SNR^2*delta)) / (2*alpha^2)

Single Exposure = t / N_frames
```

---

## Photometric Bands

### Johnson-Cousins UBVRI (Vega System)

Zero-point fluxes computed from Vega spectral flux densities (Bessell 1979; Bessell, Castelli & Plez 1998):

```
F0 = f_lambda * Delta_lambda * lambda_eff / hc * 10^4   [ph/m^2/s]
```

where `hc = 1.989 x 10^-8 erg*Angstrom`.

| Band | lambda_eff (A) | Delta_lambda (A) | f_lambda (erg/cm^2/s/A) | F0 (ph/m^2/s) | k (mag/airmass) | Dark sky (mag/arcsec^2) |
|------|---------------|-----------------|------------------------|---------------|----------------|------------------------|
| U    | 3663          | 650             | 4.175e-9               | 5.00e9        | 0.55           | 22.0                   |
| B    | 4361          | 890             | 6.320e-9               | 1.23e10       | 0.25           | 22.7                   |
| V    | 5448          | 840             | 3.631e-9               | 8.35e9        | 0.15           | 21.8                   |
| Rc   | 6407          | 1580            | 2.177e-9               | 1.11e10       | 0.09           | 20.9                   |
| Ic   | 7980          | 1540            | 1.126e-9               | 6.96e9        | 0.04           | 19.9                   |

### SDSS ugriz (AB System)

AB magnitude system: all bands have the same zero-point spectral flux density `f_nu = 3631 Jy`. The photon zero-point flux is:

```
F0 = 5.476e10 * Delta_lambda / lambda_eff   [ph/m^2/s]
```

Wavelengths from Fukugita et al. (1996); extinction from Padmanabhan et al. (2008).

| Band | lambda_eff (A) | Delta_lambda (A) | F0 (ph/m^2/s) | k (mag/airmass) | Dark sky (mag/arcsec^2) |
|------|---------------|-----------------|---------------|----------------|------------------------|
| u'   | 3596          | 570             | 8.68e9        | 0.50           | 22.1                   |
| g'   | 4639          | 1280            | 1.51e10       | 0.19           | 22.2                   |
| r'   | 6122          | 1150            | 1.03e10       | 0.10           | 21.1                   |
| i'   | 7439          | 1230            | 9.06e9        | 0.06           | 20.3                   |
| z'   | 8896          | 1070            | 6.59e9        | 0.04           | 19.1                   |

### Gaia G, GBP, GRP (Vega System)

Wide-band passbands from the Gaia spacecraft. Zero-point fluxes estimated from passband-averaged Vega flux densities (Jordi et al. 2010; Riello et al. 2021). Extinction coefficients are approximate effective values for ground-based observation.

| Band | lambda_eff (A) | Delta_lambda (A) | Mean f_lambda (erg/cm^2/s/A) | F0 (ph/m^2/s) | k (mag/airmass) | Dark sky (mag/arcsec^2) |
|------|---------------|-----------------|------------------------------|---------------|----------------|------------------------|
| G    | 6230          | 4400            | 2.50e-9                      | 3.45e10       | 0.13           | 21.4                   |
| GBP  | 5110          | 2530            | 4.00e-9                      | 2.60e10       | 0.22           | 22.0                   |
| GRP  | 7770          | 2960            | 1.30e-9                      | 1.50e10       | 0.06           | 20.3                   |

### Luminance / Wide Bandpass (AB-like)

Unfiltered or broad UV-IR/visible bandpasses for luminance imaging. For wide rectangular bandpasses, the narrow-band approximation breaks down; the exact photon zero-point flux is:

```
F0 = 5.476e10 * ln(lambda_max / lambda_min)   [ph/m^2/s]
```

The photon-weighted effective wavelength is:

```
lambda_eff = (lambda_max - lambda_min) / ln(lambda_max / lambda_min)
```

Using this `lambda_eff`, the standard formula `F0 = 5.476e10 * Delta_lambda / lambda_eff` reproduces the exact integral, so no code changes are needed.

| Band | Wavelength range | lambda_eff (A) | Delta_lambda (A) | F0 (ph/m^2/s) | k (mag/airmass) | Dark sky (mag/arcsec^2) |
|------|-----------------|---------------|-----------------|---------------|----------------|------------------------|
| UV-IR cut | 400 - 800 nm | 5771 | 4000 | 3.80e10 | 0.18 | 21.4 |
| Visible wide | 400 - 900 nm | 6164 | 5000 | 4.44e10 | 0.15 | 21.0 |

Sky brightness estimated by integrating known B+V+R+I sky fluxes across each bandpass and converting back to magnitudes using the wide-band F0. Extinction coefficient is a 1/lambda-weighted average across the bandpass.

### Band Conversion Notes

Each photometric band defines its own magnitude system with a specific zero-point photon flux `F0`. When the user selects a band:

1. `F0` is set to that band's zero-point flux -- this converts magnitude to photon rate
2. The extinction coefficient `k` is set for that band's effective wavelength
3. The sky brightness default updates to the typical dark-sky value in that band's magnitude system
4. The result is expressed in the selected band's magnitude system (Vega or AB)

Conversion between magnitude systems at a given wavelength:

```
m_AB = m_Vega + offset

Offsets (approximate):  U: +0.79  |  B: -0.09  |  V: +0.02  |  R: +0.21  |  I: +0.45
```

Converting a limiting magnitude from one band to another requires knowledge of the source spectrum (color), which is beyond the scope of this calculator.

---

## Presets

### Telescope Presets

| Preset | Aperture (m) | Focal Ratio | Seeing (arcsec) | Elevation (deg) |
|--------|-------------|-------------|-----------------|-----------------|
| MUST 6.5m | 6.5 | f/3.70 | 1.0 | 60 |
| Rubin/LSST 8.4m | 8.4 | f/1.234 | 1.0 | 60 |
| WFST 2.5m | 2.5 | f/2.48 | 1.0 | 60 |
| Mayall/DESI 3.8m | 3.797 | f/3.86 | 1.5 | 60 |

### Camera Presets

| Preset | Pixel (um) | QE | Dark Current (e-/s/pix) | Read Noise (e-) | Source |
|--------|-----------|-----|------------------------|-----------------|--------|
| e2v CCD250-82 | 10.0 | 0.93 | 0.002 @ -100C | 5.0 @ 550 kHz | Teledyne datasheet |
| e2v CCD230-42 | 15.0 | 0.92 | 0.2 @ -25C | 4.0 @ 50 kHz | Teledyne datasheet v5 |
| Sony IMX 455 | 3.76 | 0.80 | 0.0022 @ -20C | 1.2 (HCG mode) | ATIK guide; QHY600 specs |
| GSENSE 1517BSI | 15.0 | 0.92 | 0.008 @ -60C | 1.2 (12-bit HDR) | Gpixel product page |
| GSENSE 1081BSI | 10.0 | 0.95 | 0.004 @ -70C | 5.35 | Gpixel product page |

Note: dark current and read noise depend on operating temperature and readout mode. Values shown are from manufacturer datasheets at the stated conditions. Selecting a preset fills all camera fields; editing any field manually resets the dropdown to "Custom".

---

## Parameters

### Exposure & Detection

| Parameter | Description | Default |
|-----------|-------------|---------|
| Single Exposure | Integration time per frame (s) | 10 |
| Number of Frames | Frames to stack | 10 |
| Detection SNR | Minimum signal-to-noise for detection (sigma) | 4 |
| Target Magnitude | Magnitude to evaluate (modes 2 & 3) | 18 |

### Sky & Telescope

| Parameter | Description | Default |
|-----------|-------------|---------|
| Photometric Band | Filter/passband defining F0, k, and mag system | Johnson V |
| Sky Brightness | Sky surface brightness (mag/arcsec^2 in selected band) | band-dependent |
| Aperture | Telescope primary diameter (m) | 0.3 |
| Focal Ratio | f/N of the optical system | 5 |
| Seeing FWHM | Atmospheric seeing disk (arcsec) | 5.0 |
| Elevation | Target elevation above horizon (degrees) | 40 |
| Throughput | Optical throughput: mirrors * lenses * filter (excludes atmosphere) | 0.50 |

### Camera

| Parameter | Description | Default |
|-----------|-------------|---------|
| Quantum Efficiency | Detector QE at the observing wavelength | 0.80 |
| Pixel Size | Physical pixel dimension (micrometers) | 3.76 |
| Dark Current | Thermal noise rate (e-/s/pixel at operating temperature) | 0.0022 |
| Read Noise | Readout noise per frame (e-/pixel/frame) | 1.2 |

---

## Noise Budget

The diagnostics panel shows the fractional noise variance contribution from each source:

- **Source shot noise** (blue): Poisson noise from the star itself
- **Sky noise** (purple): Poisson noise from sky background
- **Dark noise** (amber): Poisson noise from thermal dark current
- **Read noise** (red): Readout electronics noise (variance = RN^2 * N_pix)

The dominant noise source determines the observing regime:
- **Sky-limited**: deeper exposures help (common for faint targets)
- **Read-noise-limited**: more/longer exposures needed (common for short exposures)
- **Source-limited**: fundamental photon limit reached

---

## References

### Photometric systems
- Bessell, M. S. 1979, PASP, 91, 589 -- UBVRI photometry II
- Bessell, M. S. 1990, PASP, 102, 1181 -- UBVRI passbands
- Bessell, M. S., Castelli, F., & Plez, B. 1998, A&A, 333, 231 -- Model atmospheres broad-band colors
- Fukugita, M., Ichikawa, T., Gunn, J. E., et al. 1996, AJ, 111, 1748 -- The SDSS photometric system
- Padmanabhan, N. et al. 2008, ApJ, 674, 1217 -- SDSS photometric calibration
- Walker, M. F. 1987, PASP, 99, 405 -- Night sky brightness measurements
- Benn, C. R., & Ellison, S. L. 1998, La Palma Technical Note 115 -- Sky brightness at La Palma
- Jordi, C. et al. 2010, A&A, 523, A48 -- Gaia broad band photometry
- Riello, M. et al. 2021, A&A, 649, A3 -- Gaia EDR3 photometric content

### Detector datasheets
- Teledyne e2v, CCD250-82 BSI Datasheet -- LSST/WFST sensor
- Teledyne e2v, CCD230-42 BSI Datasheet v5 (A1A-765138) -- 4MP scientific CCD
- Sony IMX455 -- characterized in QHY600 Pro (QHYCCD) and ATIK Apx60
- Gpixel, GSENSE1517BSI product page -- 16.8MP 15um sCMOS
- Gpixel, GSENSE1081BSI product page -- 81MP 10um sCMOS

### Telescopes
- Ivezic, Z. et al. 2019, ApJ, 873, 111 -- Rubin Observatory LSST
- Lei, L. et al. 2023 -- WFST primary mosaic CCD camera (SPIE 13103)
- DESI Collaboration, Aghamousa, A. et al. 2016, arXiv:1611.00036 -- DESI instrument design

---

## Deployment to GitHub Pages

```bash
# Clone your GitHub Pages repo
git clone https://github.com/exoplanet5/exoplanet5.github.io.git
cd exoplanet5.github.io

# Copy the calculator
mkdir -p limitingmag
cp /path/to/limitingmag/index.html limitingmag/

# Push
git add limitingmag/
git commit -m "Add CCD limiting magnitude calculator"
git push
```

The calculator is a single `index.html` file with no dependencies. It will be live at:

```
https://exoplanet5.github.io/limitingmag/
```
