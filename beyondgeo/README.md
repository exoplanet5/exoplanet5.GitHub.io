# beyondgeo

A static reference page on **where the upper stages and derelict spacecraft of
missions launched beyond GEO are now** — lunar, planetary, Sun–Earth
Lagrange-point and high-Earth-orbit science — how their orbits evolved, and
when they come back.

The page is `index.html`; open it directly or visit
`https://exoplanet5.github.io/beyondgeo/`. Status as of 2026-10-25.

## What's on the page

1. **Disposal taxonomy and status rules** — five buckets (R reentered, H
   heliocentric, C cislunar resident, W will return, I lunar impact) with
   precise definitions, the source-authority order and the notation.
2. **Master mission table** — about 110 launches in six groups (lunar,
   Mars/inner-planet, outer-planet/asteroid/comet, Sun–Earth Lagrange, HEO
   science, unidentified artsats); every status cell carries a bucket letter
   for each object it describes, and mission names link to chapter 3.
3. **Per-object Before / Now / Future** — current state of each stage and
   derelict spacecraft, each *Now* line tagged with its source and epoch.
4. **Flyby and return calendar** — past flybys and returns since 2024 with
   measured outcomes, then forecast events from Bill Gray's `Warn` lines,
   JPL Horizons and orbit fits.

## How the data is gathered

- **Space-Track SATCAT** `DECAY` + `COMMENT` decides how an object's
  geocentric track ended (reentry, lunar landing/impact, or departure to a
  libration point).
- **JPL Horizons** SPK ephemerides, authoritative up to their last tracking date.
- **Bill Gray's TLE archive** and his `Warn` lines.
- **Space-Track GP** element sets, used only when less than a year old.
- **Amateur astrometry fits** (find_orb on NEOCP / pseudo-MPEC observations)
  for manoeuvring spacecraft and new stages with no Space-Track elements.

After DECAY, the freshest epoch wins. The object list is cross-checked against
the cislunar-eye target catalogue.

## Reproducing the page

The page is generated from the markdown notes in `~/ciscluar/rocketdebris/`
(the markdown is the single source):

```sh
python crosscheck_cislunar_eye.py      # NORAD / bucket check against cislunar-eye
python build_html.py                   # chapters 1-4 -> HTML, with link and text checks
cp beyond_geo_upper_stages.html ~/exoplanet5.github.io/beyondgeo/index.html
```

`query_spacetrack.py`, `verify_status.py` and `query_horizons.py` refresh the
underlying Space-Track and Horizons tables. Space-Track credentials are read
from `ST_USERNAME` / `ST_PASSWORD`; JPL Horizons is open.

## License

Compiled notes; no original data. Source attributions are in the companion
markdown document at `~/ciscluar/rocketdebris/beyond_geo_upper_stages.md`.
