# Guide Camera Star Count Calculator

Browser-based tool for evaluating guide/wavefront sensor star availability across the sky. Given a camera sensor and telescope configuration, it predicts how many guide stars each sensor will see and visualizes real star fields from Gaia DR3.

**Open**: [`index.html`](index.html) (single file, no dependencies)

Part of the MUST 6.5m telescope focal plane GFA (Guide, Focus & Alignment) design study.

---

## Project Files

| File | Description |
|------|-------------|
| `index.html` | Interactive star count calculator (this tool) |
| `desi_gfa_star_counts.py` | Python reference: DESI GFA star count analysis (Bahcall & Soneira model, all-sky map, Poisson statistics) |
| `desi_gfa_star_counts.png` | Output of the Python analysis (4-panel figure) |
| `gaia_dr2_*.csv` | Local Gaia DR2 bright-star catalogs (G < 7) |
| `GFAarea_20230619.pptx` | GFA sensor area trade study presentation |
| `starcnts_*.png` | Star count maps at various FOV areas and magnitude limits |
| `StarCounttvsSensorArea.png` | Star counts vs sensor area summary plot |
| `programing/` | Python scripts for guide star PSF simulation and centroid detection |
| `30_jsession2013.pdf`, `class_IV-2005.pdf` | Reference papers on stellar density models |

---

## Calculator Features

### Inputs

**Camera Sensor**

| Parameter | Unit | Default | Description |
|-----------|------|---------|-------------|
| Chip X, Y | pixels | 2048 x 2048 | Sensor format |
| Pixel Size | um | 15 | Physical pixel pitch |
| Plate Scale | um/arcsec | 117 | Focal plane scale (MUST 6.5m f/3.70 = 117) |

Derived quantities:

```
Pixel angular scale  = PixelSize / PlateScale           [arcsec/pix]
FOV_x                = Chip_X x PixelScale / 60         [arcmin]
FOV_y                = Chip_Y x PixelScale / 60         [arcmin]
Effective area       = FOV_x x FOV_y                    [arcmin^2]
```

**Sky & Observation**

| Parameter | Default | Options |
|-----------|---------|---------|
| Photometric Band | SDSS r' | Johnson U B V Rc Ic, SDSS u' g' r' i' z', Gaia G G_BP G_RP |
| Galactic Latitude | 80 deg | -90 to 90 |
| Magnitude Range | 17 -- 19 | bright and faint limits |
| Number of Sensors | 6 | 1 -- 20 |

### Outputs

1. **Model Prediction** -- expected stars per FOV, P(>=1), P(>=3) from Poisson statistics
2. **Cumulative Star Count Chart** -- stars/FOV vs magnitude (12--22 mag) for multiple Galactic latitudes, selected latitude highlighted
3. **Sensor FOV Star Fields** -- N canvases showing real Gaia DR3 stars at random Galactic longitudes; canvas aspect ratio matches chip X/Y

---

## Star Count Model

Cumulative star counts per deg^2 brighter than magnitude m at Galactic (l, b):

```
N(m, l, b) = N_disk(pole) x csc|b| x (1 + f_bulge) + N_sph
```

| Term | Expression |
|------|-----------|
| `N_disk(pole)` | Thin-disk counts at b=90, tabulated in r'-band, log-interpolated |
| `csc\|b\|` | Disk latitude scaling (clamped at \|b\| >= 2 deg, capped at 25) |
| `f_bulge` | `2.5 x max(cos l, 0) x exp(-(b/12)^2)` -- enhancement toward Galactic center |
| `N_sph` | Spheroid component, fraction = 0.05 + 0.015(m-14), clamped to [0.05, 0.35] |

### Pole reference counts (r'-band, per deg^2)

| r' mag | 12 | 14 | 16 | 17 | 18 | 19 | 20 | 22 |
|--------|-----|-----|------|------|------|-------|-------|--------|
| N_cum  | 7   | 28  | 120  | 250  | 520  | 1200  | 2800  | 11500  |

### Band conversion

Other bands mapped from r' via typical stellar color offset:

```
N(<m, band) = N_r'(m + Delta)
```

| Band | Delta (r'-band) | Band | Delta |
|------|--------|------|--------|
| U    | -1.35  | u'   | -1.65  |
| B    | -0.85  | g'   | -0.50  |
| V    | -0.15  | r'   |  0.00  |
| Rc   | +0.20  | i'   | +0.30  |
| Ic   | +0.60  | z'   | +0.40  |
| G    | -0.10  | G_BP | -0.40  |
| G_RP | +0.35  |      |        |

### Differential count in a FOV

```
N_FOV = [N_cum(m_faint) - N_cum(m_bright)] x A_FOV / 3600
```

where A_FOV is in arcmin^2, and 3600 converts deg^2 to arcmin^2.

---

## Catalog Query

### Source: Gaia DR3

~1.8 billion sources with G, G_BP, G_RP photometry to G ~ 21. Complete for the guide-star magnitude range.

### TAP endpoint

```
POST https://gea.esac.esa.int/tap-server/tap/sync
     REQUEST=doQuery & LANG=ADQL & FORMAT=csv
```

Fallback: `https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync` (table `"I/355/gaiadr3"`).
Final fallback: Poisson-simulated star field from the analytical model.

### ADQL query

```sql
SELECT TOP 2000 ra, dec, l, b,
       phot_g_mean_mag  AS gmag,
       phot_bp_mean_mag AS bpmag,
       phot_rp_mean_mag AS rpmag
FROM gaiadr3.gaia_source
WHERE 1=CONTAINS(
    POINT('ICRS', ra, dec),
    CIRCLE('ICRS', <ra>, <dec>, <radius>))
  AND phot_g_mean_mag BETWEEN <gMin> AND <gMax>
```

- Search radius = FOV diagonal / 2 x 1.1 (circumscribing circle with 10% margin)
- G magnitude range padded +/-1.5 mag beyond the target band range to capture color spread

### Gaia-to-band conversion

Polynomial relations in color index c = G_BP - G_RP (Riello+ 2021, Evans+ 2018):

```
G - V  = -0.027 + 0.014c - 0.216c^2 + 0.014c^3
G - r' = -0.129 + 0.247c - 0.027c^2 - 0.049c^3
```

Johnson B, Rc, Ic and SDSS u', g', i', z' use similar polynomials. Typical accuracy sigma ~ 0.05--0.15 mag.

---

## Coordinate Conversion

Galactic (l, b) to equatorial (RA, Dec) J2000 via the IAU rotation matrix:

```
[x_eq]   [-0.05488  +0.49411  -0.86767] [cos(b) cos(l)]
[y_eq] = [-0.87344  -0.44483  -0.19808] [cos(b) sin(l)]
[z_eq]   [-0.48383  +0.74698  +0.45598] [sin(b)       ]

RA  = atan2(y_eq, x_eq)
Dec = asin(z_eq)
```

Star positions projected onto the sensor FOV via gnomonic (tangent-plane) projection from the field center.

---

## References

- Bahcall, J. N. & Soneira, R. M. 1980, ApJS, 44, 73 -- Star count model
- Robin, A. C. et al. 2003, A&A, 409, 523 -- Besancon Galaxy model
- Juric, M. et al. 2008, ApJ, 673, 864 -- SDSS stellar number density
- Riello, M. et al. 2021, A&A, 649, A3 -- Gaia EDR3/DR3 photometric calibration
- Evans, D. W. et al. 2018, A&A, 616, A4 -- Gaia DR2 photometric calibration
- Gaia Collaboration, 2023, A&A, 674, A1 -- Gaia DR3 summary
- ESA Gaia Archive: https://gea.esac.esa.int/archive/
