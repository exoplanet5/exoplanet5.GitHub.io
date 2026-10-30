#!/usr/bin/env python3
"""Build data/gaia_dr3_counts.js from the cached Gaia DR3 aggregates.

Inputs (see fetch_gaia.py / fit_bands.py):
  tools/cache/hist/*.csv   counts per (HEALPix-5 pixel, floor(2G), floor(5 BP-RP))
  tools/cache/bands.json   G - X colour relations

Tables written (all-sky, ICRS NESTED HEALPix):
  counts     nside 32, 31 G bins (6.0-21.5, 0.5 mag), uint16 log2 code
  bright     nside 32, stars with G < 6, same code
  colorFrac  nside 8, per G bin: BP-RP class fractions, uint8 summing to 255
  cMean      per G bin and class: mean BP-RP (all-sky)
  dColor     nside 32 x 4 G groups: mean-colour offset from the parent nside-8 pixel, int8 x 0.02 mag
  gLim       nside 32: Gaia completeness proxy (G at the turnover of dN/dG), uint8 x 0.1 mag
"""
import base64
import datetime as dt
import glob
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CACHE = HERE / "cache"

NSIDE, NSIDE_C = 32, 8
NPIX = 12 * NSIDE**2
RATIO = (NSIDE // NSIDE_C) ** 2
G0, GW, NG = 6.0, 0.5, 31                  # G edges 6.0 ... 21.5
G2_LO = int(G0 * 2)                        # floor(2G) of first bin
C5_LO, C5_HI = -3, 30                      # floor(5c) kept: c in [-0.6, 6.2); clamp outside
C_EDGES = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.4, 3.0]   # class boundaries in BP-RP
NC = len(C_EDGES) + 1
COUNT_SCALE = 256.0                        # q = round(log2(1 + n) * COUNT_SCALE): 0.27% steps
DCOL_SCALE = 0.02
DCOL_GROUPS = [15.0, 17.0, 19.0]           # G boundaries of the colour-shift groups


def load_hist():
    files = sorted(glob.glob(str(CACHE / "hist" / "L*.csv")))
    frames = []
    for f in files:
        d = pd.read_csv(f)
        d["src"] = Path(f).stem
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    # coverage: every fine pixel must come from exactly one chunk
    owner = df.groupby("hpx")["src"].nunique()
    dup = owner[owner > 1]
    if len(dup):
        raise SystemExit(f"pixels in more than one chunk: {dup.index[:10].tolist()}")
    missing = np.setdiff1d(np.arange(NPIX), owner.index.to_numpy())
    print(f"{len(files)} chunk files, {len(df)} rows, {df.n.sum():,} sources; missing pixels: {len(missing)}")
    return df, missing


def encode_counts(a):
    q = np.round(np.log2(1.0 + a) * COUNT_SCALE)
    assert q.max() < 65536, q.max()
    return q.astype("<u2")


def quantize_fracs(f):
    """Rows of fractions -> uint8 summing exactly to 255 (largest remainder)."""
    out = np.zeros(f.shape, dtype=np.uint8)
    flat = f.reshape(-1, f.shape[-1])
    o = out.reshape(-1, f.shape[-1])
    for i, row in enumerate(flat):
        s = row.sum()
        if s <= 0:
            continue
        x = row / s * 255
        base = np.floor(x).astype(int)
        rem = 255 - base.sum()
        if rem:
            base[np.argsort(-(x - base))[:rem]] += 1
        o[i] = base
    return out


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def main():
    df, missing = load_hist()
    hpx = df.hpx.to_numpy()
    n = df.n.to_numpy().astype(np.float64)
    has_g = df.g2.notna().to_numpy()
    g2 = np.where(has_g, df.g2.fillna(0), 0).astype(int)
    has_c = df.c5.notna().to_numpy()
    c5 = np.clip(np.where(has_c, df.c5.fillna(0), 0).astype(int), C5_LO, C5_HI)

    gi = g2 - G2_LO
    in_g = has_g & (gi >= 0) & (gi < NG)
    bright_sel = has_g & (gi < 0)
    print(f"no G: {n[~has_g].sum():,.0f}; G<6: {n[bright_sel].sum():,.0f}; "
          f"G>=21.5: {n[has_g & (gi >= NG)].sum():,.0f}; in table: {n[in_g].sum():,.0f}")

    # ---- fine counts (all colours, incl. sources without BP-RP)
    counts = np.zeros((NPIX, NG))
    np.add.at(counts, (hpx[in_g], gi[in_g]), n[in_g])
    bright = np.zeros(NPIX)
    np.add.at(bright, hpx[bright_sel], n[bright_sel])

    # ---- colour histograms at 0.2-mag resolution (sources with BP-RP only)
    nc5 = C5_HI - C5_LO + 1
    ccen = (np.arange(C5_LO, C5_HI + 1) + 0.5) / 5.0           # bin centres in BP-RP
    sel = in_g & has_c
    H = np.zeros((NPIX, NG, nc5), dtype=np.float64)
    np.add.at(H, (hpx[sel], gi[sel], c5[sel] - C5_LO), n[sel])
    Hc = H.reshape(NPIX // RATIO, RATIO, NG, nc5).sum(axis=1)  # coarse (nested children are contiguous)

    # colour classes
    cls_of_c5 = np.searchsorted(np.array(C_EDGES) - 1e-9, ccen, side="right")
    Hcls = np.zeros((NPIX // RATIO, NG, NC))
    for k in range(NC):
        Hcls[:, :, k] = Hc[:, :, cls_of_c5 == k].sum(axis=2)
    allsky = Hcls.sum(axis=0)                                     # (NG, NC)
    frac = Hcls / np.maximum(Hcls.sum(axis=2, keepdims=True), 1e-300)
    empty = Hcls.sum(axis=2) == 0
    # empty (coarse pixel, G bin): borrow the all-sky mix of that G bin
    allfrac = allsky / np.maximum(allsky.sum(axis=1, keepdims=True), 1e-300)
    frac[empty] = np.broadcast_to(allfrac, frac.shape)[empty]
    # coarse cells with only a handful of stars: shrink toward the all-sky mix (prior of 20 stars)
    nn = Hcls.sum(axis=2, keepdims=True)
    frac = (frac * nn + allfrac[None] * 20) / (nn + 20)
    frac_q = quantize_fracs(frac)

    # mean colour per (G bin, class), all sky
    Hall = Hc.sum(axis=0)                                          # (NG, nc5)
    cmean = np.zeros((NG, NC))
    for k in range(NC):
        w = Hall[:, cls_of_c5 == k]
        cc = ccen[cls_of_c5 == k]
        tot = w.sum(axis=1)
        cmean[:, k] = np.where(tot > 0, (w * cc).sum(axis=1) / np.maximum(tot, 1e-300), cc.mean())

    # fine-pixel mean-colour offset relative to its coarse parent, per G group (reddening and
    # population differences at nside-32 scale); groups split at DCOL_GROUPS
    def mean_shift(gs):
        Hf = H[:, gs, :]
        nf = Hf.sum(axis=2)
        mf = (Hf * ccen).sum(axis=2) / np.maximum(nf, 1e-300)
        Hcp = Hc[:, gs, :]
        mc = (Hcp * ccen).sum(axis=2) / np.maximum(Hcp.sum(axis=2), 1e-300)
        w = nf.sum(axis=1)
        return (nf * (mf - np.repeat(mc, RATIO, axis=0))).sum(axis=1) / np.maximum(w, 1e-300), w
    glo = G0 + np.arange(NG) * GW
    grp = np.searchsorted(np.array(DCOL_GROUPS), glo, side="right")
    dall, _ = mean_shift(slice(int((12 - G0) / GW), int((20.5 - G0) / GW)))
    dcol = np.zeros((NPIX, len(DCOL_GROUPS) + 1))
    for k in range(dcol.shape[1]):
        d, w = mean_shift(grp == k)
        dcol[:, k] = np.where(w > 0, d, dall)                     # empty group: pixel-wide shift
    dcol_q = np.clip(np.round(dcol / DCOL_SCALE), -127, 127).astype(np.int8)

    # completeness proxy: G at the turnover of the differential counts (bin centre)
    d = counts.copy()
    d[:, : int((15 - G0) / GW)] = 0                                # ignore bright noise
    peak = d.argmax(axis=1)
    glim = G0 + (peak + 0.5) * GW
    glim_q = np.clip(np.round(glim * 10), 0, 255).astype(np.uint8)

    bands = json.loads((CACHE / "bands.json").read_text())
    data = {
        "version": "2.0",
        "built": dt.date.today().isoformat(),
        "source": "Gaia DR3 gaia_source (ESA archive), aggregated by tools/fetch_gaia.py",
        "nside": NSIDE, "nsideColor": NSIDE_C, "nest": True, "frame": "ICRS",
        "gEdges": [round(G0 + i * GW, 2) for i in range(NG + 1)],
        "cEdges": C_EDGES,
        "cMean": np.round(cmean, 3).tolist(),
        "countScale": COUNT_SCALE, "dColorScale": DCOL_SCALE, "dColorGroups": DCOL_GROUPS,
        "missingPixels": missing.tolist(),
        "totalSources": int(counts.sum() + bright.sum()),
        "counts": b64(encode_counts(counts)),
        "brightCounts": b64(encode_counts(bright)),
        "colorFrac": b64(frac_q),
        "dColor": b64(dcol_q),
        "gLim": b64(glim_q),
        "bands": bands,
    }
    out = ROOT / "data" / "gaia_dr3_counts.js"
    out.parent.mkdir(exist_ok=True)
    text = ("/* Gaia DR3 star-count tables for the guide-camera star-count calculator.\n"
            " * Generated by tools/build_data.py - do not edit. */\n"
            "window.STARCOUNT_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
    out.write_text(text)
    print(f"wrote {out} ({len(text) / 1024:.0f} KiB)")

    # quick-look numbers
    import healpy as hp
    for name, (l, b) in {"NGP": (0, 90), "b=60,l=180": (180, 60), "b=30,l=180": (180, 30),
                         "b=20,l=180": (180, 20), "b=10,l=0": (0, 10)}.items():
        from astropy.coordinates import SkyCoord
        c = SkyCoord(l=l, b=b, unit="deg", frame="galactic").icrs
        p = hp.ang2pix(NSIDE, c.ra.deg, c.dec.deg, nest=True, lonlat=True)
        area = hp.nside2pixarea(NSIDE, degrees=True)
        cum = np.cumsum(counts[p]) + bright[p]
        def at(gmag):
            x = (gmag - G0) / GW
            k = int(x)
            return (cum[k - 1] if k > 0 else bright[p]) + (x - k) * counts[p, k]
        print(f"  {name:12s} G<17: {at(17) / area:7.0f}/deg2  G<19: {at(19) / area:7.0f}/deg2  "
              f"G<20: {at(20) / area:8.0f}/deg2  gLim={glim[p]:.2f}  dcol={np.array2string(dcol[p], precision=2)}")


if __name__ == "__main__":
    main()
