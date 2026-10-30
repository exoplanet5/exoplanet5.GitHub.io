#!/usr/bin/env python3
"""Fetch the Gaia DR3 aggregates used to build the star-count tables.

The ESA Gaia archive caps anonymous queries at ~60 s, so every query is
restricted to one HEALPix pixel through a source_id range (Gaia source_ids
embed the level-12 nested HEALPix index, so ranges are partition-pruned).
A chunk that times out is split into its four children and retried.

  python tools/fetch_gaia.py hist   # (HEALPix-5, G/0.5 mag, BP-RP/0.2 mag) counts, all sky
  python tools/fetch_gaia.py gspc   # random sample with XP standardised photometry (GSPC)

Output: tools/cache/hist/L<level>_<pix>.csv, tools/cache/gspc/L5_<pix>.csv
Re-running skips chunks already on disk.
"""
import concurrent.futures as cf
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

SYNC = "https://gea.esac.esa.int/tap-server/tap/sync"
CACHE = Path(__file__).resolve().parent / "cache"
WORKERS = 3          # be polite to the archive
MAXREC = 3_000_000

HIST_SQL = """SELECT GAIA_HEALPIX_INDEX(5, source_id) AS hpx, FLOOR(phot_g_mean_mag*2) AS g2,
FLOOR(bp_rp*5) AS c5, COUNT(*) AS n FROM gaiadr3.gaia_source
WHERE source_id >= {lo} AND source_id < {hi} GROUP BY hpx, g2, c5"""

GSPC_SQL = """SELECT g.phot_g_mean_mag AS g, g.bp_rp, g.l, g.b,
s.u_jkc_mag, s.u_jkc_flag, s.b_jkc_mag, s.b_jkc_flag, s.v_jkc_mag, s.v_jkc_flag,
s.r_jkc_mag, s.r_jkc_flag, s.i_jkc_mag, s.i_jkc_flag,
s.u_sdss_mag, s.u_sdss_flag, s.g_sdss_mag, s.g_sdss_flag, s.r_sdss_mag, s.r_sdss_flag,
s.i_sdss_mag, s.i_sdss_flag, s.z_sdss_mag, s.z_sdss_flag
FROM gaiadr3.synthetic_photometry_gspc AS s
JOIN gaiadr3.gaia_source AS g ON g.source_id = s.source_id
WHERE s.source_id >= {lo} AND s.source_id < {hi} AND MOD(g.random_index, {thin}) = 0"""


def id_range(level, pix):
    shift = 35 + 2 * (12 - level)
    return pix << shift, (pix + 1) << shift


def run_sql(sql, timeout=150):
    body = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv",
                                   "MAXREC": MAXREC, "QUERY": " ".join(sql.split())}).encode()
    last = None
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(SYNC, data=body), timeout=timeout) as r:
                text = r.read().decode()
            if text.lstrip().startswith("<"):           # VOTable error document
                raise RuntimeError(text[:400])
            return text
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if "execution time" in msg.lower():
                raise TimeoutError(msg)
            last = RuntimeError(f"HTTP {e.code}: {msg}")
        except (TimeoutError, OSError) as e:             # includes socket timeouts / TLS resets
            if isinstance(e, TimeoutError) or "timed out" in str(e):
                raise TimeoutError(str(e))
            last = e
        time.sleep(5 * (k + 1))
    raise last


def fetch_hist(level, pix, outdir):
    out = outdir / f"L{level}_{pix}.csv"
    if out.exists():
        return [out]
    lo, hi = id_range(level, pix)
    t0 = time.time()
    try:
        text = run_sql(HIST_SQL.format(lo=lo, hi=hi))
    except TimeoutError:
        if level >= 5:
            raise
        print(f"  L{level}:{pix} timed out -> split", flush=True)
        return [p for c in range(4) for p in fetch_hist(level + 1, 4 * pix + c, outdir)]
    nrow = text.count("\n") - 1
    if nrow >= MAXREC:
        raise RuntimeError(f"L{level}:{pix} truncated at MAXREC")
    out.write_text(text)
    print(f"  L{level}:{pix} rows={nrow} {time.time() - t0:.0f}s", flush=True)
    return [out]


def fetch_gspc(pix, thin, outdir):
    out = outdir / f"L5_{pix}.csv"
    if out.exists():
        return out
    lo, hi = id_range(5, pix)
    text = run_sql(GSPC_SQL.format(lo=lo, hi=hi, thin=thin))
    out.write_text(text)
    print(f"  gspc L5:{pix} rows={text.count(chr(10)) - 1}", flush=True)
    return out


def main(what):
    if what == "hist":
        outdir = CACHE / "hist"
        outdir.mkdir(parents=True, exist_ok=True)
        jobs = [(2, p) for p in range(192)]
        fn = lambda j: fetch_hist(*j, outdir)
    elif what == "bprp":
        # G, BP, RP sample for the G_BP / G_RP band relations (GAVO DC mirror, CORS-enabled,
        # keeps load off the ESA archive). 0.5-deg cones over a range of latitudes.
        outdir = CACHE / "bprp"
        outdir.mkdir(parents=True, exist_ok=True)
        cones = ["192.86,27.13", "30,0", "100,20", "300,-60", "60,60", "270,66", "200,-20", "120,-35"]
        for cone in cones:
            out = outdir / f"cone_{cone.replace(',', '_')}.csv"
            if out.exists():
                continue
            sql = ("SELECT phot_g_mean_mag AS g, phot_bp_mean_mag AS bp, phot_rp_mean_mag AS rp "
                   "FROM gaia.dr3lite WHERE 1=CONTAINS(POINT('ICRS',ra,dec), CIRCLE('ICRS'," + cone + ",0.5)) "
                   "AND phot_g_mean_mag < 19 AND phot_bp_mean_mag IS NOT NULL AND phot_rp_mean_mag IS NOT NULL")
            body = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv",
                                           "MAXREC": 200000, "QUERY": sql}).encode()
            with urllib.request.urlopen(urllib.request.Request("https://dc.g-vo.org/tap/sync", data=body),
                                        timeout=120) as r:
                out.write_bytes(r.read())
            print("  bprp", cone, flush=True)
        return
    elif what == "gspc":
        outdir = CACHE / "gspc"
        outdir.mkdir(parents=True, exist_ok=True)
        rng = np.random.default_rng(20261030)
        jobs = sorted(rng.choice(12 * 4**5, size=120, replace=False).tolist())
        fn = lambda p: fetch_gspc(p, 6, outdir)
    else:
        sys.exit(__doc__)
    t0 = time.time()
    failed = []
    with cf.ThreadPoolExecutor(WORKERS) as ex:
        futs = {ex.submit(fn, j): j for j in jobs}
        for f in cf.as_completed(futs):
            try:
                f.result()
            except Exception as e:  # keep going; rerun picks up the gaps
                failed.append(futs[f])
                print("  FAILED", futs[f], str(e)[:300], flush=True)
    print(f"done {what}: {len(jobs) - len(failed)}/{len(jobs)} ok in {time.time() - t0:.0f}s; failed={failed}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
