"""Reference values for tests/test_core.js (healpy / astropy / scipy)."""
import json, sys
import numpy as np, healpy as hp
from astropy.coordinates import SkyCoord
import astropy.units as u
from scipy.stats import poisson, binom
rng = np.random.default_rng(1)
ra = rng.uniform(0, 360, 4000); dec = np.degrees(np.arcsin(rng.uniform(-1, 1, 4000)))
ra = np.r_[ra, 0, 90, 180, 270, 45, 359.999, 10, 10]; dec = np.r_[dec, 90, -90, 41.81, -41.81, 0, 0, 89.99, -89.99]
out = {"ra": ra.tolist(), "dec": dec.tolist()}
for ns in (8, 32):
    out[f"pix{ns}"] = hp.ang2pix(ns, ra, dec, nest=True, lonlat=True).tolist()
    lon, lat = hp.pix2ang(ns, np.arange(12 * ns * ns), nest=True, lonlat=True)
    out[f"cen{ns}"] = np.c_[lon, lat].tolist()
g = SkyCoord(ra=ra[:200] * u.deg, dec=dec[:200] * u.deg, frame="icrs").galactic
out["l"] = g.l.deg.tolist(); out["b"] = g.b.deg.tolist()
out["pois"] = [[k, lam, float(poisson.sf(k - 1, lam))] for k in (0, 1, 3, 10) for lam in (0.05, 1.0, 3.3, 25.0, 150.0)]
out["binom"] = [[M, n, p, float(binom.sf(M - 1, n, p))] for M in (1, 3, 6) for n in (6, 8) for p in (0.1, 0.5, 0.93)]
json.dump(out, open(sys.argv[1], "w"))
