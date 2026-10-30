#!/usr/bin/env python3
"""Fit G - X = f(BP-RP) for every calculator band from Gaia DR3 data.

Johnson-Kron-Cousins U B V R I and SDSS u g r i z come from the Gaia XP
standardised synthetic photometry (GSPC; Gaia Collaboration, Montegriffo et al.
2023), restricted to flag == 1. G_BP and G_RP come from gaia_source directly.

f is the running median in 0.05-mag colour bins, smoothed and resampled on a
0.1-mag grid; the robust scatter (1.4826 MAD) is kept for documentation.
Output: tools/cache/bands.json and figures/band_transforms.png, plus a printed
comparison with Riello et al. (2021) and with the v1 page's conversions.
"""
import glob
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache"
GRID = np.round(np.arange(-0.4, 4.5001, 0.1), 2)

BANDS = {  # key: (label, system, GSPC column)
    "U": ("U", "Johnson (Vega)", "u_jkc"),
    "B": ("B", "Johnson (Vega)", "b_jkc"),
    "V": ("V", "Johnson (Vega)", "v_jkc"),
    "Rc": ("R<sub>C</sub>", "Cousins (Vega)", "r_jkc"),
    "Ic": ("I<sub>C</sub>", "Cousins (Vega)", "i_jkc"),
    "u": ("u", "SDSS (AB)", "u_sdss"),
    "g": ("g", "SDSS (AB)", "g_sdss"),
    "r": ("r", "SDSS (AB)", "r_sdss"),
    "i": ("i", "SDSS (AB)", "i_sdss"),
    "z": ("z", "SDSS (AB)", "z_sdss"),
}

# Riello et al. 2021 (A&A 649, A3) Table C.2: G - X polynomials in BP-RP, with validity range.
RIELLO = {
    "V": ([-0.02704, 0.01424, -0.2156, 0.01426], (-0.5, 5.0)),
    "Rc": ([-0.02275, 0.3961, -0.1243, -0.01396, 0.003775], (-0.5, 4.0)),
    "Ic": ([0.01753, 0.76, -0.0991], (-0.5, 4.5)),
    "g": ([0.2199, -0.6365, -0.1548, 0.0064], (0.3, 3.0)),
    "r": ([-0.09837, 0.08592, 0.1907, -0.1701, 0.02263], (0.0, 3.0)),
    "i": ([-0.293, 0.6404, -0.09609, -0.002104], (0.0, 4.5)),
}


def v1_offset(band, c):
    """G - X implied by convertMag() of the v1 page (index.html, 2026-04)."""
    c2, c3 = c * c, c ** 3
    gmv = -0.02704 + 0.01424 * c - 0.2156 * c2 + 0.01426 * c3
    V = -gmv                               # X - G for V
    bmv = -0.0497 + 1.3420 * c - 0.1916 * c2 + 0.0107 * c3
    r = -(-0.12879 + 0.24662 * c - 0.027464 * c2 - 0.049465 * c3)
    rmi = -0.0307 + 0.2540 * c - 0.0012 * c2
    g = -(-0.13518 + 0.46245 * c - 0.25171 * c2 + 0.021349 * c3)
    xmg = {
        "V": V, "B": V + bmv,
        "U": V + bmv + np.where(bmv > 0.3, -0.35 + 1.35 * bmv, 0.65),
        "Rc": V - (0.021 + 0.3711 * c - 0.0413 * c2),
        "Ic": V - (0.0124 + 0.7525 * c - 0.0548 * c2),
        "g": g, "r": r, "i": r - rmi, "z": r - rmi - (0.01 + 0.08 * c), "u": g + 0.78 + 0.55 * c,
    }[band]
    return -xmg


def binned_curve(c, y, width=0.05, nmin=25):
    edges = np.arange(-0.6, 6.0, width)
    idx = np.digitize(c, edges) - 1
    xc, med, sig, n = [], [], [], []
    for k in range(len(edges) - 1):
        sel = idx == k
        if sel.sum() < nmin:
            continue
        yy = y[sel]
        m = np.median(yy)
        xc.append(np.median(c[sel]))
        med.append(m)
        sig.append(1.4826 * np.median(np.abs(yy - m)))
        n.append(sel.sum())
    return np.array(xc), np.array(med), np.array(sig), np.array(n)


def smooth_resample(xc, med, n, grid):
    """Weighted local-quadratic smoothing (Gaussian kernel, 0.12 mag) evaluated on grid;
    outside the sampled range the curve continues linearly from the last 0.3 mag."""
    out = np.empty_like(grid, dtype=float)
    lo, hi = xc.min(), xc.max()
    for j, x in enumerate(np.clip(grid, lo, hi)):
        w = np.exp(-0.5 * ((xc - x) / 0.12) ** 2) * np.sqrt(n)
        sel = w > 1e-3 * w.max()
        A = np.vander(xc[sel] - x, 3)
        coef = np.linalg.lstsq(A * np.sqrt(w[sel])[:, None], med[sel] * np.sqrt(w[sel]), rcond=None)[0]
        out[j] = coef[-1]
    for side, edge in (("lo", lo), ("hi", hi)):
        sel = grid < edge if side == "lo" else grid > edge
        if not sel.any():
            continue
        ref = (xc <= lo + 0.3) if side == "lo" else (xc >= hi - 0.3)
        slope = np.polyfit(xc[ref], med[ref], 1)[0] if ref.sum() >= 3 else 0.0
        e = np.clip(edge, grid.min(), grid.max())
        base = np.interp(e, grid[~sel], out[~sel])
        out[sel] = base + slope * (grid[sel] - e)
    return out


def mamajek_curves():
    """G - X(BP-RP) for V, B, U from the Mamajek dwarf colour sequence
    (EEM_dwarf_UBVIJHK_colors_Teff.txt, cached in tools/cache/ext)."""
    lines = (CACHE / "ext" / "mamajek_dwarfs.txt").read_text().splitlines()
    hdr = [i for i, s in enumerate(lines) if s.startswith("#SpT")]
    cols = lines[hdr[0]].lstrip("#").split()
    rows = []
    for s in lines[hdr[0] + 1: hdr[1]]:
        parts = s.split()
        if len(parts) < len(cols) or s.startswith("#"):
            continue
        rows.append([np.nan if p.startswith("...") else _num(p) for p in parts[: len(cols)]])
    t = pd.DataFrame(rows, columns=cols)
    c = t["Bp-Rp"].to_numpy()
    gv, bv, ub = t["G-V"].to_numpy(), t["B-V"].to_numpy(), t["U-B"].to_numpy()
    out = {"V": gv, "B": gv - bv, "U": gv - bv - ub}
    curves = {}
    for k, y in out.items():
        ok = np.isfinite(c) & np.isfinite(y)
        order = np.argsort(c[ok])
        curves[k] = (c[ok][order], y[ok][order])
    return curves


def _num(p):
    try:
        return float(p)
    except ValueError:
        return np.nan


def anchor_ends(off, crange, ref):
    """Replace the extrapolated parts of `off` (outside the sampled colour range)
    by the reference curve, shifted to be continuous at the range edges."""
    rc, ry = ref
    lo, hi = crange
    fit_at = lambda x: np.interp(x, GRID, off)
    ref_at = lambda x: np.interp(x, rc, ry)
    out = off.copy()
    for edge, sel in ((hi, GRID > hi), (lo, GRID < lo)):
        if sel.any() and rc.min() <= edge <= rc.max():
            out[sel] = ref_at(GRID[sel]) + (fit_at(edge) - ref_at(edge))
    return out


def main():
    gspc = pd.concat([pd.read_csv(f) for f in sorted(glob.glob(str(CACHE / "gspc/*.csv")))], ignore_index=True)
    bprp = pd.concat([pd.read_csv(f) for f in sorted(glob.glob(str(CACHE / "bprp/*.csv")))], ignore_index=True)
    print(f"GSPC sample {len(gspc)} stars; BP/RP sample {len(bprp)} stars")

    result = {}
    curves = {}
    mam = mamajek_curves()
    for key, (label, system, col) in BANDS.items():
        ok = (gspc[col + "_flag"] == 1) & np.isfinite(gspc[col + "_mag"]) & np.isfinite(gspc.bp_rp)
        c = gspc.bp_rp[ok].to_numpy()
        y = (gspc.g - gspc[col + "_mag"])[ok].to_numpy()
        xc, med, sig, n = binned_curve(c, y)
        off = smooth_resample(xc, med, n, GRID)
        crange = (round(float(np.percentile(c, 0.5)), 2), round(float(np.percentile(c, 99.5)), 2))
        source = "Gaia DR3 GSPC (XP standardised)"
        if key in ("U", "B"):
            # GSPC publishes U/B only where the XP standardisation is valid; outside that
            # colour range follow the Mamajek dwarf sequence (continuous at the edges).
            off = anchor_ends(off, crange, mam[key])
            source += f"; Mamajek dwarf sequence outside BP-RP {crange[0]}-{crange[1]}"
        elif key == "u":
            # u follows the (anchored) U curve's colour slope outside its sampled range
            Uoff = np.array(result["U"]["off"])
            off = anchor_ends(off, crange, (GRID, Uoff))
            source += f"; follows U slope outside BP-RP {crange[0]}-{crange[1]}"
        sg = np.interp(GRID, xc, sig)
        result[key] = {"label": label, "system": system, "c": GRID.tolist(),
                       "off": np.round(off, 4).tolist(), "sig": np.round(sg, 3).tolist(),
                       "cRange": list(crange), "n": int(ok.sum()), "source": source}
        curves[key] = (c, y, xc, med, off)

    for key, label, num in (("BP", "G<sub>BP</sub>", "bp"), ("RP", "G<sub>RP</sub>", "rp")):
        c = (bprp.bp - bprp.rp).to_numpy()
        y = (bprp.g - bprp[num]).to_numpy()
        ok = np.isfinite(c) & np.isfinite(y)
        xc, med, sig, n = binned_curve(c[ok], y[ok])
        off = smooth_resample(xc, med, n, GRID)
        sg = np.interp(GRID, xc, sig)
        result[key] = {"label": label, "system": "Gaia (Vega)", "c": GRID.tolist(),
                       "off": np.round(off, 4).tolist(), "sig": np.round(sg, 3).tolist(),
                       "cRange": [round(float(np.percentile(c[ok], 0.5)), 2), round(float(np.percentile(c[ok], 99.5)), 2)],
                       "n": int(ok.sum()), "source": "Gaia DR3 gaia_source"}
        curves[key] = (c[ok], y[ok], xc, med, off)
    result["G"] = {"label": "G", "system": "Gaia (Vega)", "const": 0.0, "source": "Gaia DR3 gaia_source"}

    # ---- validation printout
    print("\nG - X at BP-RP = 0.5 / 0.82 (Sun) / 1.5 / 2.5    [this fit | Riello+2021 | v1 page]")
    for key in BANDS:
        row = []
        for cc in (0.5, 0.82, 1.5, 2.5):
            fit = np.interp(cc, GRID, result[key]["off"])
            ri = np.polyval(RIELLO[key][0][::-1], cc) if key in RIELLO else np.nan
            row.append(f"{fit:+.3f}|{ri:+.3f}|{v1_offset(key, cc):+.3f}")
        print(f"  {key:3s} " + "   ".join(row))
    for key in RIELLO:
        lo, hi = RIELLO[key][1]
        cc = GRID[(GRID >= max(lo, 0.3)) & (GRID <= min(hi, 3.0))]
        d = np.interp(cc, GRID, result[key]["off"]) - np.polyval(RIELLO[key][0][::-1], cc)
        print(f"  {key:3s} max |fit - Riello| over {cc[0]:.1f}..{cc[-1]:.1f}: {np.abs(d).max():.3f} mag")

    (CACHE / "bands.json").write_text(json.dumps(result))
    print("\nwrote", CACHE / "bands.json")

    # ---- figure
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    keys = list(BANDS) + ["BP", "RP"]
    fig, axs = plt.subplots(3, 4, figsize=(15, 10), sharex=True)
    for ax, key in zip(axs.flat, keys):
        c, y, xc, med, off = curves[key]
        sel = np.random.default_rng(0).choice(len(c), min(len(c), 15000), replace=False)
        ax.plot(c[sel], y[sel], ",", color="0.6", alpha=0.5)
        ax.plot(GRID, off, "-", color="#2a78d6", lw=2, label="this fit (median)")
        cc = np.linspace(-0.3, 4.3, 200)
        if key in BANDS:
            ax.plot(cc, v1_offset(key, cc), "--", color="#e34948", lw=1.5, label="v1 page")
        if key in RIELLO:
            lo, hi = RIELLO[key][1]
            c2 = cc[(cc >= lo) & (cc <= hi)]
            ax.plot(c2, np.polyval(RIELLO[key][0][::-1], c2), ":", color="k", lw=1.5, label="Riello+2021")
        ax.set_title(f"G − {key}")
        ax.set_xlim(-0.4, 4.5)
        lo, hi = np.percentile(y, [0.5, 99.5])
        ax.set_ylim(lo - 0.3, hi + 0.3)
        ax.grid(alpha=0.3)
    h, lab = axs.flat[2].get_legend_handles_labels()     # the V panel has all three curves
    fig.legend(h, lab, loc="upper right", fontsize=9, ncol=3, frameon=False)
    for ax in axs.flat[len(keys):]:
        ax.axis("off")
    for ax in axs[-1]:
        ax.set_xlabel("BP − RP")
    fig.suptitle("Gaia G → band transformations (Gaia DR3 GSPC / gaia_source)")
    fig.tight_layout()
    out = HERE.parent / "figures" / "band_transforms.png"
    out.parent.mkdir(exist_ok=True)
    fig.savefig(out, dpi=110)
    print("wrote", out)


if __name__ == "__main__":
    main()
