# lunarmissions

A static reference page: **every lunar launch from Pioneer 0 (1958) to
Artemis II (2026), and every trackable object each one produced** — spacecraft,
landers, rovers, ascent stages, return capsules, sub-satellites, cubesats,
upper stages, kick motors, adapters — with what it did *then* and where it is
*now*. Companion to `../beyondgeo/`.

The page is `index.html`; open it directly or visit
`https://exoplanet5.github.io/lunarmissions/`.

## What's on the page

1. **Where-are-they-now taxonomy** — twelve buckets (on the surface, lunar
   impact, lunar orbit, heliocentric, cislunar, reentered, returned, …) with
   object counts.
2. **Master timeline** — 146 launches 1958–2026 in date order, including the
   Space-Race failures and the Apollo / N1 / LK test flights, each linking to
   its ledger entry.
3. **Mission-by-mission object ledger** — ~890 objects, each with its GCAT
   status, Space-Track decay/GP record and JPL Horizons or Bill Gray TLE
   evidence.
4. **Lunar swing-bys by non-lunar missions** (ISEE-3, Geotail, WIND, STEREO,
   TESS, JUICE, …).
5. **Roll-ups** — what is still in lunar orbit, the cislunar residents, Bill
   Gray's Earth-return calendar, upcoming launches.
6. **Surface map** — every located lander, rover, impactor and stage on the
   LRO LROC-WAC mosaic (global, near/far side, south pole, equatorial zoom)
   with a numbered site key and the list of objects whose site is unknown.
   `lunar_surface_map.jpg` is the 2400 px version shown on the page,
   `lunar_surface_map_7200.jpg` the 7200 px one.
7. **Open questions** — Apollo 11's Eagle, Snoopy, the untracked 1960s
   orbiters and escape stages, J002E3's return year.

## How the data is gathered

- **Jonathan McDowell's GCAT** (deep-space, lunar/planetary and heliocentric
  registers, lander catalogue) — the per-object backbone.
- **Space-Track SATCAT + GP** — decay dates and latest element sets.
- **JPL Horizons** — ephemerides for the 41 lunar bodies it carries.
- **Bill Gray's TLE archive** — fresh fits for cislunar residents and the
  return calendar.
- **NASA Moon Trek** — LRO WAC tiles for the base map.

Generated 2026-08-23; the build scripts live outside this repository.
