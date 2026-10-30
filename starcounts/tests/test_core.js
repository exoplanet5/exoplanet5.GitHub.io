// Node test of js/core.js against healpy / astropy / scipy reference values.
const C = require('../js/core.js');
const ref = require(process.argv[2]);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; if (fails < 15) console.log('FAIL', msg); } };
for (const ns of [8, 32]) {
  ref.ra.forEach((ra, i) => check(C.ang2pixNest(ns, ra, ref.dec[i]) === ref[`pix${ns}`][i], `ang2pix ns=${ns} ${ra},${ref.dec[i]}`));
  ref[`cen${ns}`].forEach(([lon, lat], p) => {
    const [a, b] = C.pix2angNest(ns, p);
    check(Math.abs(((a - lon + 540) % 360) - 180) < 1e-9 && Math.abs(b - lat) < 1e-9, `pix2ang ns=${ns} p=${p} ${a},${b} vs ${lon},${lat}`);
  });
}
let maxd = 0;
ref.l.forEach((l, i) => {
  const [L, B] = C.eqToGal(ref.ra[i], ref.dec[i]);
  const d = Math.hypot(((L - l + 540) % 360 - 180) * Math.cos(B * Math.PI / 180), B - ref.b[i]) * 3600;
  maxd = Math.max(maxd, d);
  const [r2, d2] = C.galToEq(L, B);
  check(Math.hypot(((r2 - ref.ra[i] + 540) % 360 - 180) * Math.cos(d2 * Math.PI / 180), d2 - ref.dec[i]) < 1e-9, 'gal round trip');
});
check(maxd < 0.05, `ICRS->Gal max diff ${maxd} arcsec`);
console.log(`ICRS->Galactic vs astropy: max ${maxd.toExponential(2)} arcsec`);
for (const [k, lam, p] of ref.pois) check(Math.abs(C.poissonTail(k, lam) - p) < 1e-9, `poissonTail ${k} ${lam}: ${C.poissonTail(k, lam)} vs ${p}`);
for (const [M, n, q, p] of ref.binom) check(Math.abs(C.binomTail(M, n, q) - p) < 1e-12, `binomTail ${M} ${n} ${q}`);
for (let i = 0; i < 2000; i++) {   // Mollweide round trip
  const lon = Math.random() * 358 - 179, lat = Math.random() * 178 - 89;
  const [x, y] = C.mollweideFwd(lon, lat), back = C.mollweideInv(x, y);
  check(back && Math.abs(back[0] - lon) < 1e-6 && Math.abs(back[1] - lat) < 1e-6, `mollweide ${lon},${lat}`);
}
for (let i = 0; i < 2000; i++) {   // gnomonic round trip
  const ra0 = Math.random() * 360, dec0 = Math.random() * 170 - 85, xi = Math.random() * 4 - 2, eta = Math.random() * 4 - 2;
  const [ra, dec] = C.gnomonicInv(xi, eta, ra0, dec0), [x2, y2] = C.gnomonic(ra, dec, ra0, dec0);
  check(Math.abs(x2 - xi) < 1e-9 && Math.abs(y2 - eta) < 1e-9, `gnomonic ${xi},${eta} @ ${ra0},${dec0}`);
}
console.log(fails ? `${fails} FAILURES` : 'all geometry/statistics tests passed');
process.exit(fails ? 1 : 0);
