"""Exact per-pixel band counts from the full-resolution cache (tools/cache/hist), for
tests/test_model.mjs. Each star class (0.2-mag BP-RP bin) is converted with the band
relation at its bin centre; sources without BP-RP are distributed like those with.
    python tests/ref_pixels.py out.json
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_data as B  # noqa: E402

df, _ = B.load_hist()
hpx = df.hpx.to_numpy(); n = df.n.to_numpy().astype(float)
has_g = df.g2.notna().to_numpy(); g2 = np.where(has_g, df.g2.fillna(0), 0).astype(int)
has_c = df.c5.notna().to_numpy(); c5 = np.clip(np.where(has_c, df.c5.fillna(0), 0).astype(int), B.C5_LO, B.C5_HI)
gi = g2 - B.G2_LO
in_g = has_g & (gi >= 0) & (gi < B.NG)
nc5 = B.C5_HI - B.C5_LO + 1
ccen = (np.arange(B.C5_LO, B.C5_HI + 1) + 0.5) / 5
counts = np.zeros((B.NPIX, B.NG)); np.add.at(counts, (hpx[in_g], gi[in_g]), n[in_g])
H = np.zeros((B.NPIX, B.NG, nc5)); sel = in_g & has_c
np.add.at(H, (hpx[sel], gi[sel], c5[sel] - B.C5_LO), n[sel])
tot = H.sum(axis=2, keepdims=True)
frac = np.where(tot > 0, H / np.maximum(tot, 1e-300), 1.0 / nc5)
bands = json.loads((ROOT / "tools/cache/bands.json").read_text())
lo = B.G0 + np.arange(B.NG) * B.GW

rng = np.random.default_rng(7)
pix = np.sort(rng.choice(B.NPIX, 400, replace=False))
cases = [("G", 15, 19), ("r", 15, 19), ("r", 17, 19.5), ("V", 15, 19), ("g", 15, 19), ("i", 16, 20),
         ("z", 15, 19), ("B", 15, 19), ("U", 14, 18), ("Rc", 14, 18.5), ("BP", 15, 19)]
out = {"pix": pix.tolist(), "cases": []}
for band, m1, m2 in cases:
    off = np.zeros(nc5) if band == "G" else np.interp(ccen, bands[band]["c"], bands[band]["off"])
    def cum(m):
        F = np.clip((m + off[None, None, :] - lo[None, :, None]) / B.GW, 0, 1)
        return (counts[pix][:, :, None] * frac[pix] * F).sum(axis=(1, 2))
    out["cases"].append({"band": band, "m1": m1, "m2": m2, "n": (cum(m2) - cum(m1)).round(2).tolist()})
Path(sys.argv[1]).write_text(json.dumps(out))
print("wrote", sys.argv[1])
