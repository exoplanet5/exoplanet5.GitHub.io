# NanoSat & CubeSat Catalog + Wiki

A catalog of small artificial satellites (**payload mass ≤ 12 kg** — nanosat / CubeSat class,
all-time) merged from four sources, plus a self-contained static wiki page.

## Quick start

Open **`index.html`** in any browser (it loads `data.js` locally — no server needed).
Search, filter (status / launch year / size / launch country / vehicle / live-only),
sort any column, and click a row to expand full per-satellite detail with external links.

Raw catalog: **`catalog.csv`** and **`catalog.json`** (3,631 records).

## What's in each record

| Field group | Fields |
|---|---|
| Identity | `norad_id`, `intl_designator` (COSPAR), `name`, `alt_names`, `object_type` |
| Size | `size_class` (U-class / dimensions / mass), `size_source`, `mass_kg`, `length_m`, `width_m`, `height_m`, `deployed_span_m`, `shape`, `equiv_sphere_radius_m`, `rcs_m2` |
| Status | `status` (In orbit / Reentered), `gcat_status`, `decay_date` |
| Launch | `launch_date`, `launch_vehicle`, `launch_site`, `launch_site_country`, `launch_pad`, `operator`, `operator_country` |
| Orbit (latest epoch) | `orbit_source`, `orbit_epoch`, `inclination_deg`, `raan_deg`, `eccentricity`, `arg_perigee_deg`, `mean_anomaly_deg`, `mean_motion_rev_day`, `period_min`, `sma_km`, `apogee_km`, `perigee_km`, `op_orbit` |
| nanosats.eu | `ns_org`, `ns_nation`, `ns_status`, `ns_desc`, `ns_url` |

## Sources & how they join

| Source | Provides | Join key |
|---|---|---|
| **GCAT** `satcat.tsv` (J. McDowell, upd. 2026-05-25) | spine: NORAD, COSPAR, name, type, launch date, owner, **mass**, span, shape, status | — |
| **GCAT** `launch.tsv` + `sites.tsv` / `lv.tsv` / `orgs.tsv` | launch **vehicle**, **site** (+country), pad, readable operator names | `Launch_Tag`, code lookups |
| **Local 3LE TLE catalog** (epoch **2026-05-28**) | live orbit elements at latest epoch | NORAD |
| **`current_in_orbit_morphology_lambert_sphere.csv`** | detailed L×W×H, deployed span, equiv-sphere radius, RCS | NORAD |
| **nanosats.eu/database** | U-class, organisation, nation, mission description | normalised name |

- **Membership** = GCAT payloads with `0 < Mass ≤ 12 kg` (3,631 objects). 12U+ CubeSats
  (~16–24 kg) fall outside this mass cut by design.
- **Orbit elements** come from the 2026-05-28 TLE snapshot when the object is still tracked
  (`orbit_source = "TLE 2026-05-28"`, 857 objects); otherwise GCAT's initial apogee/perigee/inc
  is shown (`orbit_source = "GCAT (initial)"`).
- Derived orbit quantities (period, semi-major axis, apogee/perigee altitude) are computed from
  TLE mean motion with μ = 398600.4418 km³/s², R⊕ = 6378.137 km.

## Coverage (current build)

- 3,631 nanosat/cubesat payloads · 1,028 in orbit · 2,603 reentered
- 857 with live orbit elements · 3,336 with NORAD id
- 100% with launch vehicle & site · 1,678 matched to nanosats.eu

## Rebuild

```bash
# (re)download GCAT tables if you want a fresher pull:
#   curl -sL https://planet4589.org/space/gcat/tsv/cat/satcat.tsv      -o gcat_satcat.tsv
#   curl -sL https://planet4589.org/space/gcat/tsv/launch/launch.tsv   -o gcat_launch.tsv
#   curl -sL https://planet4589.org/space/gcat/tsv/tables/sites.tsv    -o gcat_sites.tsv
#   curl -sL https://planet4589.org/space/gcat/tsv/tables/lv.tsv       -o gcat_lv.tsv
#   curl -sL https://planet4589.org/space/gcat/tsv/tables/orgs.tsv     -o gcat_orgs.tsv
# refresh the TLE snapshot (copy the latest dated catalog) and morphology csv as needed.

~/.venvs/astro313/bin/python build_catalog.py   # -> catalog.json + catalog.csv
~/.venvs/astro313/bin/python build_wiki.py       # -> data.js (consumed by index.html)
```

## Files

```
index.html              static wiki page (open directly)
data.js                 catalog embedded for the page (generated)
catalog.csv / .json     the merged catalog
build_catalog.py        merge pipeline (sources -> catalog)
build_wiki.py           catalog.json -> data.js
gcat_*.tsv              cached GCAT tables
morphology.csv          cached morphology/size source
catalog_20260528.tle    cached latest-epoch TLE snapshot
nanosats_eu_database.html  cached nanosats.eu table
```
