"""Build js/bands.js: photometric zero points, sky and extinction for every band.

For each band the filter/hardware response S(λ) is normalised to a peak of 1 and

    F0   = ∫ f_λ,ZP(λ) S(λ) λ/(hc) dλ                    photons s⁻¹ m⁻² for a mag-0 source
    W    = ∫ S(λ) dλ                                      equivalent width
    λp   = sqrt(∫ S λ dλ / ∫ S/λ dλ)                       pivot wavelength
    k    = −2.5 log10[∫ S T_atm(X=1) λ dλ / ∫ S λ dλ]      flat-f_λ extinction, mag/airmass
    μsky = −2.5 log10[∫ f_sky S λ dλ / ∫ f_ZP S λ dλ]      dark-sky zenith brightness, mag/arcsec²

The zero-point SED f_ZP is 3631 Jy for AB bands and the CALSPEC Vega spectrum
(with Vega = +0.03 mag Johnson-Cousins, +0.023 mag Gaia) for Vega bands.  The
dark-sky spectrum and the X = 1.0 atmosphere are the Rubin Observatory
Cerro Pachón models from lsst-pst/syseng_throughputs, so every band uses one
consistent site model; the calculator lets the user override sky and k.

The script also checks itself against published numbers: the Gaia DR3 photometric
zero points (Riello et al. 2021) and the Rubin SMTN-002 1-s zero points.

Usage:
    python -I tools/build_bands.py <speclite filter dir> <download dir> js/bands.js
"""
import json
import math
import sys

import numpy as np
from astropy.io import fits
from astropy.table import Table

H = 6.62607015e-27       # erg s
C_A = 2.99792458e18      # Å/s
HC = H * C_A             # erg Å
ABNU = 3631e-23          # erg s⁻¹ cm⁻² Hz⁻¹

FDIR, DDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
GRID = np.arange(2900.0, 11500.0, 1.0)   # Å


def trapz(y, x=GRID):
    return float(np.trapezoid(y, x))


def load_filter(name):
    t = Table.read(f"{FDIR}/{name}.ecsv", format="ascii.ecsv")
    wl = np.asarray(t["wavelength"], float)
    unit = str(t["wavelength"].unit or "Angstrom")
    if unit in ("nm", "nanometer"):
        wl = wl * 10.0
    s = np.interp(GRID, wl, np.asarray(t["response"], float), left=0.0, right=0.0)
    return s


def load_two_col(path):
    a = np.loadtxt(path, comments="#")
    return a[:, 0] * 10.0, a[:, 1]        # nm → Å


# ---- reference spectra
with fits.open(f"{DDIR}/alpha_lyr_stis_012.fits") as h:
    d = h[1].data
    VEGA = np.interp(GRID, d["WAVELENGTH"], d["FLUX"])          # erg s⁻¹ cm⁻² Å⁻¹
AB = ABNU * C_A / GRID**2                                        # erg s⁻¹ cm⁻² Å⁻¹
wl, fl = load_two_col(f"{DDIR}/darksky.dat")
SKY = np.interp(GRID, wl, fl / 10.0)                             # per nm → per Å, per arcsec²
wl, tr = load_two_col(f"{DDIR}/atmos_10_aerosol.dat")
ATM10 = np.interp(GRID, wl, tr, left=tr[0], right=tr[-1])
wl, tr = load_two_col(f"{DDIR}/pachonModtranAtm_12_aerosol.dat")
ATM12 = np.interp(GRID, wl, tr, left=tr[0], right=tr[-1])


def photons(f, s):
    """∫ f S λ/hc dλ in photons s⁻¹ m⁻²."""
    return trapz(f * s * GRID / HC) * 1e4


def band_numbers(s, system, vega_mag):
    s = s / s.max()
    zp = AB if system == "AB" else VEGA * 10 ** (0.4 * vega_mag)
    F0 = photons(zp, s)
    W = trapz(s)
    lp = math.sqrt(trapz(s * GRID) / trapz(s / GRID))
    k = -2.5 * math.log10(trapz(s * ATM10 * GRID) / trapz(s * GRID))
    sky = -2.5 * math.log10(trapz(SKY * s * GRID) / trapz(zp * s * GRID))
    lo, hi = GRID[s > 0.5][[0, -1]]
    return dict(F0=F0, W=W, lam=lp, k=k, sky=sky, lo=lo, hi=hi), s


BANDS = [
    # id,            label,          group,                system, source curve,          Vega mag
    ("Johnson_U", "U", "Johnson–Cousins", "Vega", "bessell-U", 0.03),
    ("Johnson_B", "B", "Johnson–Cousins", "Vega", "bessell-B", 0.03),
    ("Johnson_V", "V", "Johnson–Cousins", "Vega", "bessell-V", 0.03),
    ("Cousins_Rc", "Rc", "Johnson–Cousins", "Vega", "bessell-R", 0.03),
    ("Cousins_Ic", "Ic", "Johnson–Cousins", "Vega", "bessell-I", 0.03),
    ("SDSS_u", "u′", "SDSS", "AB", "sdss2010noatm-u", 0),
    ("SDSS_g", "g′", "SDSS", "AB", "sdss2010noatm-g", 0),
    ("SDSS_r", "r′", "SDSS", "AB", "sdss2010noatm-r", 0),
    ("SDSS_i", "i′", "SDSS", "AB", "sdss2010noatm-i", 0),
    ("SDSS_z", "z′", "SDSS", "AB", "sdss2010noatm-z", 0),
    ("LSST_u", "u", "Rubin LSST", "AB", "lsst2023-u", 0),
    ("LSST_g", "g", "Rubin LSST", "AB", "lsst2023-g", 0),
    ("LSST_r", "r", "Rubin LSST", "AB", "lsst2023-r", 0),
    ("LSST_i", "i", "Rubin LSST", "AB", "lsst2023-i", 0),
    ("LSST_z", "z", "Rubin LSST", "AB", "lsst2023-z", 0),
    ("LSST_y", "y", "Rubin LSST", "AB", "lsst2023-y", 0),
    ("Gaia_G", "G", "Gaia DR3", "Vega", "gaiadr3-G", 0.023),
    ("Gaia_BP", "G_BP", "Gaia DR3", "Vega", "gaiadr3-BP", 0.023),
    ("Gaia_RP", "G_RP", "Gaia DR3", "Vega", "gaiadr3-RP", 0.023),
    ("Lum_400_700", "L 400–700 nm", "Luminance (top-hat)", "AB", (4000, 7000), 0),
    ("Lum_400_800", "L 400–800 nm", "Luminance (top-hat)", "AB", (4000, 8000), 0),
    ("Lum_400_900", "L 400–900 nm", "Luminance (top-hat)", "AB", (4000, 9000), 0),
]

out, curves = {}, {}
for bid, label, group, system, src, vmag in BANDS:
    if isinstance(src, tuple):
        s = ((GRID >= src[0]) & (GRID <= src[1])).astype(float)
        cite = f"top-hat {src[0] / 10:.0f}–{src[1] / 10:.0f} nm"
    else:
        s = load_filter(src)
        if src.startswith("lsst2023"):          # remove the X = 1.2 atmosphere baked into the curve
            s = np.where(ATM12 > 0.05, s / np.maximum(ATM12, 1e-6), 0.0)
        cite = f"speclite {src}"
    nums, s = band_numbers(s, system, vmag)
    curves[bid] = s
    out[bid] = dict(label=label, group=group, sys=system,
                    lam=round(nums["lam"]), W=round(nums["W"]),
                    F0=float(f"{nums['F0']:.4g}"), k=round(nums["k"], 3), sky=round(nums["sky"], 2),
                    curve=cite)
    print(f"{bid:12s} λp={nums['lam']:6.0f} W={nums['W']:5.0f} F0={nums['F0']:.3e} "
          f"k={nums['k']:.3f} sky={nums['sky']:.2f}  FWHM {nums['lo']:.0f}–{nums['hi']:.0f} Å")

# ---- self-checks against published numbers
print("\nGaia DR3 zero points (Vega, e⁻/s, pupil 0.7278 m²) vs Riello et al. 2021:")
for bid, src, pub in [("Gaia_G", "gaiadr3-G", 25.6874), ("Gaia_BP", "gaiadr3-BP", 25.3385),
                      ("Gaia_RP", "gaiadr3-RP", 24.7479)]:
    s = load_filter(src)                    # absolute response, not peak-normalised
    zp = 2.5 * math.log10(photons(VEGA * 10 ** (0.4 * 0.023), s) * 0.7278)
    print(f"  {bid}: computed {zp:.4f}  published {pub:.4f}  diff {zp - pub:+.4f}")

print("\nRubin 1-s zero points at X = 1.0 (AB, e⁻/s, clear aperture 6.423 m) vs SMTN-002:")
A_RUBIN = math.pi / 4 * 6.423**2
for b, pub in zip("ugrizy", [26.52, 28.51, 28.36, 28.17, 27.78, 26.82]):
    s = load_filter(f"lsst2023-{b}")
    hw = np.where(ATM12 > 0.05, s / np.maximum(ATM12, 1e-6), 0.0)
    zp = 2.5 * math.log10(photons(AB, hw * ATM10) * A_RUBIN)
    o = out[f"LSST_{b}"]
    o["zpRubin"] = round(zp, 3)
    # hardware peak (telescope + camera + filter): the calculator's T_optics × QE for this band
    o["hwPeakRubin"] = round(float(hw.max()), 3)
    print(f"  {b}: computed {zp:.3f}  published {pub:.2f}  diff {zp - pub:+.3f}  "
          f"k {o['k']:.3f}  sky {o['sky']:.2f}  hw peak {hw.max():.3f}")

with open(OUT, "w") as f:
    f.write("/* Generated by tools/build_bands.py — do not edit by hand.\n"
            " * F0: photons s⁻¹ m⁻² for a mag-0 source through the peak-normalised band response.\n"
            " * lam: pivot wavelength (Å); W: equivalent width (Å); k: extinction (mag/airmass);\n"
            " * sky: dark-sky zenith brightness (mag/arcsec²), Rubin Cerro Pachón sky model. */\n")
    f.write("(function (root) {\n  'use strict';\n  const BANDS = {\n")
    f.write(",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in out.items()))
    f.write("\n  };\n  if (typeof module !== 'undefined' && module.exports) module.exports = BANDS;\n"
            "  else root.LIM_BANDS = BANDS;\n})(typeof globalThis !== 'undefined' ? globalThis : this);\n")
print(f"\nwrote {OUT}")
