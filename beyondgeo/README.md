# beyondgeo

A static reference page on **upper-stage disposal and orbit evolution for
space-exploration missions launched higher than GEO** — lunar, deep space,
and high-Earth-orbit science observatories.

The page is `index.html`; open it directly or visit
`https://exoplanet5.github.io/beyondgeo/`.

## What's on the page

1. **Disposal taxonomy** — five buckets (reentered, heliocentric, cislunar
   resident, future returner, lunar impact) with canonical examples.
2. **Master mission table** — ~90 missions in six categories (lunar,
   Mars/inner-planet, outer-planet/asteroid/comet, Sun-Earth Lagrange, HEO
   science, unidentified deep-space artsats), each row linking to its detail
   entry.
3. **Per-stage Before / Now / Future** — current orbital state for each upper
   stage, sourced from the freshest available record.
4. **Bill Gray's "Warn" calendar** — manually curated list of upcoming Earth
   close-approaches (DART F9 S2 May 2026, Cert-2 Vulcan Centaur Nov 2026 /
   Dec 2027 / Dec 2028, J002E3 Jul 2032, Chang'e-2 booster Dec 2033, JWST
   ESC-D Jun 2047, etc.).

## How the data is gathered

Three independent sources are cross-checked for every object:

- **Bill Gray's TLE archive** — hex TLE files indexed by year-tag suffix.
- **Space-Track SATCAT + GP** — `class/satcat` for `DECAY` date and object
  type, `class/gp` for the most recent SGP4 element set.
- **JPL Horizons** — for deep-space artificial bodies that have escaped
  Earth's Hill sphere (resolved by SPK ID).

Authority rules:

- A SATCAT `DECAY` date is treated as ground truth, regardless of any other
  source.
- If a Space-Track GP element set is more than one year old it is considered
  stale (the "latest" GP for an escaped object is typically a frozen
  launch-day capture); fall back to Bill Gray's most recent TLE, then to
  JPL Horizons.

## Reproducing the page

The page is hand-written HTML (no build step). To regenerate the underlying
data tables, the source repository at `~/ciscluar/rocketdebris/` carries:

| Script | Purpose |
|---|---|
| `query_spacetrack.py` | SATCAT + GP query for all NORAD IDs |
| `verify_status.py` | DECAY-first staleness check, with Bill Gray TLE fallback |
| `query_horizons.py` | JPL Horizons SPK resolution + state-vector pull |

```sh
python query_spacetrack.py > spacetrack_status.tsv
python verify_status.py
python query_horizons.py > horizons_status.tsv
```

Space-Track credentials are read from `ST_USERNAME` / `ST_PASSWORD`
environment variables; JPL Horizons is open and unauthenticated.

## License

Compiled notes; no original data. Source attributions are listed in the
companion markdown document at `~/ciscluar/rocketdebris/beyond_geo_upper_stages.md`.
