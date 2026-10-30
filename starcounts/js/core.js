/* Star-count calculator core: geometry, HEALPix, Gaia-table count model, statistics.
 * Plain script (no build step); attaches `StarCore` to the global object so it
 * runs from file:// and GitHub Pages alike, and can be require()d by Node tests.
 */
(function (root) {
  'use strict';

  const DEG = Math.PI / 180;
  const ARCSEC_PER_RAD = 206264.80624709636;

  // ---------------------------------------------------------------- frames
  // Galactic -> ICRS rotation (transpose of the Hipparcos A_G matrix, ESA 1997).
  const G2E = [
    [-0.0548755604162154, 0.4941094278755837, -0.8676661490190047],
    [-0.8734370902348850, -0.4448296299600112, -0.1980763734312015],
    [-0.4838350155487132, 0.7469822444972189, 0.4559837761750669],
  ];

  function lonlatToVec(lon, lat) {
    const cl = Math.cos(lat * DEG);
    return [cl * Math.cos(lon * DEG), cl * Math.sin(lon * DEG), Math.sin(lat * DEG)];
  }
  function vecToLonLat(v) {
    let lon = Math.atan2(v[1], v[0]) / DEG;
    if (lon < 0) lon += 360;
    const lat = Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG;
    return [lon, lat];
  }
  function rot(M, v, transpose) {
    return transpose
      ? [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2],
         M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2],
         M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]]
      : [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
         M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
         M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
  }
  const galToEq = (l, b) => vecToLonLat(rot(G2E, lonlatToVec(l, b), false));
  const eqToGal = (ra, dec) => vecToLonLat(rot(G2E, lonlatToVec(ra, dec), true));

  // Gnomonic (tangent-plane) projection about (ra0, dec0); offsets in degrees.
  function gnomonic(ra, dec, ra0, dec0) {
    const d = dec * DEG, d0 = dec0 * DEG, da = (ra - ra0) * DEG;
    const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(da);
    if (cosc <= 0) return null;
    return [Math.cos(d) * Math.sin(da) / cosc / DEG,
            (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(da)) / cosc / DEG];
  }
  function gnomonicInv(xi, eta, ra0, dec0) {
    const x = xi * DEG, y = eta * DEG, d0 = dec0 * DEG;
    const rho = Math.hypot(x, y);
    if (rho === 0) return [ra0, dec0];
    const c = Math.atan(rho);
    const dec = Math.asin(Math.cos(c) * Math.sin(d0) + y * Math.sin(c) * Math.cos(d0) / rho);
    const ra = ra0 * DEG + Math.atan2(x * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - y * Math.sin(d0) * Math.sin(c));
    return [((ra / DEG) % 360 + 360) % 360, dec / DEG];
  }

  // ---------------------------------------------------------------- HEALPix (NESTED)
  // Port of healpix_base loc2pix / pix2loc for the nested scheme.
  const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
  const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];
  function spread(v) { let r = 0; for (let i = 0; v; i++, v >>= 1) r |= (v & 1) << (2 * i); return r; }
  function compress(v) { let r = 0; for (let i = 0; v; i++, v >>= 2) r |= (v & 1) << i; return r; }

  function ang2pixNest(nside, lonDeg, latDeg) {
    const order = Math.log2(nside) | 0;
    const z = Math.sin(latDeg * DEG), za = Math.abs(z);
    let tt = ((lonDeg % 360 + 360) % 360) / 90;          // in [0,4)
    if (tt >= 4) tt -= 4;
    let face, ix, iy;
    if (za <= 2 / 3) {
      const t1 = nside * (0.5 + tt), t2 = nside * z * 0.75;
      const jp = Math.floor(t1 - t2), jm = Math.floor(t1 + t2);
      const ifp = jp >> order, ifm = jm >> order;
      face = ifp === ifm ? (ifp | 4) : (ifp < ifm ? ifp : ifm + 8);
      ix = jm & (nside - 1);
      iy = nside - (jp & (nside - 1)) - 1;
    } else {
      const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt;
      const tmp = nside * Math.sqrt(3 * (1 - za));
      const jp = Math.min(nside - 1, Math.floor(tp * tmp));
      const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
      if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; }
      else { face = ntt + 8; ix = jp; iy = jm; }
    }
    return face * nside * nside + spread(ix) + 2 * spread(iy);
  }

  function pix2angNest(nside, pix) {
    const order = Math.log2(nside) | 0, npface = nside * nside, npix = 12 * npface;
    const face = Math.floor(pix / npface), ipf = pix % npface;
    const ix = compress(ipf), iy = compress(ipf >> 1);
    const jr = (JRLL[face] << order) - ix - iy - 1;
    const fact2 = 4 / npix, fact1 = 2 * nside * fact2;
    let nr, z;
    if (jr < nside) { nr = jr; z = 1 - nr * nr * fact2; }
    else if (jr > 3 * nside) { nr = 4 * nside - jr; z = nr * nr * fact2 - 1; }
    else { nr = nside; z = (2 * nside - jr) * fact1; }
    let tmp = JPLL[face] * nr + ix - iy;
    if (tmp < 0) tmp += 8 * nr;
    const phi = nr === nside ? 0.75 * (Math.PI / 2) * tmp * fact1 : (0.5 * (Math.PI / 2) * tmp) / nr;
    return [phi / DEG, Math.asin(z) / DEG];
  }

  // ---------------------------------------------------------------- Mollweide
  // Inverse projection; x in [-2√2, 2√2], y in [-√2, √2]. Returns [lon, lat] (deg,
  // lon measured from the central meridian, positive to the left on screen) or null.
  function mollweideInv(x, y) {
    const s2 = Math.SQRT2;
    if ((x * x) / 8 + (y * y) / 2 > 1) return null;
    const th = Math.asin(Math.max(-1, Math.min(1, y / s2)));
    const lat = Math.asin(Math.max(-1, Math.min(1, (2 * th + Math.sin(2 * th)) / Math.PI)));
    const c = Math.cos(th);
    const lon = c < 1e-12 ? 0 : (Math.PI * x) / (2 * s2 * c);
    if (Math.abs(lon) > Math.PI) return null;
    return [lon / DEG, lat / DEG];
  }
  function mollweideFwd(lonDeg, latDeg) {
    const lat = latDeg * DEG, lon = lonDeg * DEG;
    let th = lat;
    if (Math.abs(lat) < Math.PI / 2 - 1e-9) {
      for (let i = 0; i < 50; i++) {
        const d = (2 * th + Math.sin(2 * th) - Math.PI * Math.sin(lat)) / (2 + 2 * Math.cos(2 * th));
        th -= d;
        if (Math.abs(d) < 1e-10) break;
      }
    }
    return [(2 * Math.SQRT2 / Math.PI) * lon * Math.cos(th), Math.SQRT2 * Math.sin(th)];
  }

  // ---------------------------------------------------------------- statistics
  // P(X >= k) for X ~ Poisson(lam), k integer >= 0.
  function poissonTail(k, lam) {
    if (k <= 0) return 1;
    if (!(lam > 0)) return 0;
    if (lam > 700) return 1;                 // e^-lam underflows; tail is 1 for any sane k
    let term = Math.exp(-lam), cdf = term;
    for (let i = 1; i < k; i++) { term *= lam / i; cdf += term; }
    return Math.max(0, Math.min(1, 1 - cdf));
  }
  // P(at least M of n independent trials succeed), success prob p.
  function binomTail(M, n, p) {
    if (M <= 0) return 1;
    if (M > n) return 0;
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let s = 0, c = 1;                        // c = C(n, j)
    for (let j = 0; j <= n; j++) {
      if (j >= M) s += c * Math.pow(p, j) * Math.pow(1 - p, n - j);
      c = (c * (n - j)) / (j + 1);
    }
    return Math.max(0, Math.min(1, s));
  }
  function poissonSample(lam, rnd) {
    if (lam > 50) {                          // normal approximation is plenty for drawing fields
      let u = 0, v = 0;
      while (u === 0) u = rnd();
      v = rnd();
      return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
    }
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- data decoding
  function b64ToBytes(s) {
    if (typeof atob === 'function') {
      const bin = atob(s), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(s, 'base64'));   // Node (tests)
  }

  // ---------------------------------------------------------------- count model
  /**
   * Gaia DR3 star-count model built from tools/build_data.py output.
   *
   * counts[p][g]   stars in fine pixel p (HEALPix nside D.nside, NESTED, ICRS) and G bin g
   * frac[P][g][c]  BP-RP distribution (colour bin c) in coarse pixel P, G bin g
   * dcol[p][grp]   mean-colour offset of fine pixel p from its coarse pixel, per G group
   * Band magnitude of a star: X = G - f_X(BP-RP), f_X tabulated from Gaia XP (GSPC).
   */
  class CountModel {
    constructor(D) {
      this.D = D;
      this.nside = D.nside;
      this.npix = 12 * D.nside * D.nside;
      this.nsideC = D.nsideColor;
      this.ratio = (D.nside / D.nsideColor) ** 2;         // fine pixels per coarse pixel
      this.gEdges = D.gEdges;                              // ascending, length nG+1
      this.nG = D.gEdges.length - 1;
      this.nC = D.cEdges.length + 1;                       // BP-RP classes
      this.pixArcmin2 = (4 * Math.PI / this.npix) * (180 / Math.PI) ** 2 * 3600;

      // counts: uint16 log2 code q -> n = 2^(q/scale) - 1
      const q = new Uint16Array(b64ToBytes(D.counts).buffer);
      this.counts = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) this.counts[i] = q[i] ? Math.round(Math.pow(2, q[i] / D.countScale) - 1) : 0;
      this.bright = new Float32Array(this.npix);           // stars brighter than gEdges[0]
      const qb = new Uint16Array(b64ToBytes(D.brightCounts).buffer);
      for (let i = 0; i < qb.length; i++) this.bright[i] = qb[i] ? Math.round(Math.pow(2, qb[i] / D.countScale) - 1) : 0;

      const fb = b64ToBytes(D.colorFrac);                  // uint8, rows sum to 255 per (P,g)
      this.frac = new Float32Array(fb.length);
      for (let i = 0; i < fb.length; i++) this.frac[i] = fb[i] / 255;
      // colour offset of each fine pixel from its coarse parent, per G group
      const dc = new Int8Array(b64ToBytes(D.dColor).buffer);
      this.dcol = new Float32Array(dc.length);
      for (let i = 0; i < dc.length; i++) this.dcol[i] = dc[i] * D.dColorScale;
      this.nGrp = D.dColorGroups.length + 1;
      this.gGroup = new Uint8Array(this.nG);
      for (let g = 0; g < this.nG; g++) {
        const lo = this.gEdges[g];
        this.gGroup[g] = D.dColorGroups.filter((e) => lo >= e).length;
      }
      const gl = b64ToBytes(D.gLim);
      this.gLim = new Float32Array(gl.length);
      for (let i = 0; i < gl.length; i++) this.gLim[i] = gl[i] / 10;

      // Pixel centres (ICRS and Galactic)
      this.ra = new Float32Array(this.npix); this.dec = new Float32Array(this.npix);
      this.gl = new Float32Array(this.npix); this.gb = new Float32Array(this.npix);
      for (let p = 0; p < this.npix; p++) {
        const [ra, dec] = pix2angNest(this.nside, p);
        const [l, b] = eqToGal(ra, dec);
        this.ra[p] = ra; this.dec[p] = dec; this.gl[p] = l; this.gb[p] = b;
      }
      this.bands = D.bands;
      this._offCache = {};
    }

    // G - X offset table for a band, sampled on the colour grid.
    bandOffset(band, c) {
      const B = this.bands[band];
      if (!B.c) return B.const || 0;
      const xs = B.c, ys = B.off;
      if (c <= xs[0]) return ys[0];
      if (c >= xs[xs.length - 1]) return ys[ys.length - 1];
      const t = (c - xs[0]) / (xs[1] - xs[0]);
      const i = Math.min(xs.length - 2, Math.floor(t));
      const f = t - i;
      return ys[i] * (1 - f) + ys[i + 1] * f;
    }
    // Range of G - X over the plausible colour range (for catalogue query limits).
    bandOffsetRange(band) {
      let lo = Infinity, hi = -Infinity;
      for (let c = -0.4; c <= 4.0001; c += 0.05) {
        const v = this.bandOffset(band, c);
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      return [lo, hi];
    }
    toBand(band, g, bp, rp) {
      if (band === 'G') return g;
      if (band === 'BP') return bp != null ? bp : null;
      if (band === 'RP') return rp != null ? rp : null;
      const c = bp != null && rp != null ? bp - rp : null;
      if (c == null) return null;
      return g - this.bandOffset(band, c);
    }

    // Per-band lookup: G - X at each (G bin, colour class) mean colour, and its
    // colour derivative (used to apply the fine-pixel colour offset linearly).
    prepareBand(band) {
      if (this._band === band) return;
      const nG = this.nG, nC = this.nC, cm = this.D.cMean;
      this._off = new Float32Array(nG * nC);
      this._slope = new Float32Array(nG * nC);
      for (let g = 0; g < nG; g++) {
        for (let c = 0; c < nC; c++) {
          const x = cm[g][c];
          this._off[g * nC + c] = this.bandOffset(band, x);
          this._slope[g * nC + c] = (this.bandOffset(band, x + 0.05) - this.bandOffset(band, x - 0.05)) / 0.1;
        }
      }
      this._brightOff = this.bandOffset(band, 0.8);
      this._band = band;
    }

    // Cumulative count N(X < m) in fine pixel p (call prepareBand first).
    // Within a 0.5-mag G bin the stars are taken as uniformly distributed.
    cumulative(p, m) {
      const nG = this.nG, nC = this.nC, g0 = this.gEdges[0], w = this.gEdges[1] - this.gEdges[0];
      const P = Math.floor(p / this.ratio), dbase = p * this.nGrp, grp = this.gGroup;
      const cnt = this.counts, fr = this.frac, off = this._off, slope = this._slope, dcol = this.dcol;
      const cbase = p * nG, fbase = P * nG * nC;
      let total = m + this._brightOff > g0 ? this.bright[p] : 0;
      for (let g = 0; g < nG; g++) {
        const n = cnt[cbase + g];
        if (n === 0) continue;
        const lo = g0 + g * w, k0 = g * nC, f0 = fbase + k0, dc = dcol[dbase + grp[g]];
        let s = 0;
        for (let c = 0; c < nC; c++) {
          const gt = m + off[k0 + c] + slope[k0 + c] * dc;   // G threshold for this colour class
          if (gt <= lo) continue;
          s += fr[f0 + c] * (gt >= lo + w ? 1 : (gt - lo) / w);
        }
        total += n * s;
      }
      return total;
    }

    // Stars per arcmin^2 with mBright <= X < mFaint, for every fine pixel.
    densityMap(band, mBright, mFaint, out) {
      this.prepareBand(band);
      out = out || new Float32Array(this.npix);
      const inv = 1 / this.pixArcmin2;
      for (let p = 0; p < this.npix; p++) {
        out[p] = Math.max(0, this.cumulative(p, mFaint) - this.cumulative(p, mBright)) * inv;
      }
      return out;
    }

    // Cumulative counts per arcmin^2 at magnitudes `mags` for pixel p.
    cumulativeCurve(band, p, mags) {
      this.prepareBand(band);
      const inv = 1 / this.pixArcmin2;
      return mags.map((m) => this.cumulative(p, m) * inv);
    }

    // Draw n magnitudes in [m1, m2) from pixel p's own luminosity function.
    sampleMags(band, p, m1, m2, n, rnd) {
      this.prepareBand(band);
      const steps = 60, xs = [], cs = [];
      for (let i = 0; i <= steps; i++) {
        const m = m1 + (m2 - m1) * i / steps;
        xs.push(m); cs.push(this.cumulative(p, m));
      }
      const c0 = cs[0], span = cs[steps] - c0, out = [];
      for (let j = 0; j < n; j++) {
        if (!(span > 0)) { out.push(m1 + rnd() * (m2 - m1)); continue; }
        const u = c0 + rnd() * span;
        let i = 1;
        while (i < steps && cs[i] < u) i++;
        const f = cs[i] > cs[i - 1] ? (u - cs[i - 1]) / (cs[i] - cs[i - 1]) : 0.5;
        out.push(xs[i - 1] + f * (xs[i] - xs[i - 1]));
      }
      return out;
    }

    // Faintest G the query needs (for the completeness flag).
    faintG(band, mFaint) {
      return mFaint + this.bandOffset(band, 1.0);
    }

    // Pixel index for a Galactic position.
    pixAtGal(l, b) {
      const [ra, dec] = galToEq(l, b);
      return ang2pixNest(this.nside, ra, dec);
    }

    // Interpolation weights at a Galactic position: the containing pixel and its
    // neighbours, weighted by a tent of ~1.25 pixel radii in angular distance, so
    // values at a pointing vary smoothly instead of jumping at pixel borders.
    weightsAt(l, b) {
      const [ra, dec] = galToEq(l, b);
      const v0 = lonlatToVec(ra, dec);
      const step = Math.sqrt(4 * Math.PI / this.npix) / DEG;   // ~pixel size, deg
      const seen = new Map();
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
        const [r2, d2] = gnomonicInv(dx * step, dy * step, ra, dec);
        const p = ang2pixNest(this.nside, r2, d2);
        if (seen.has(p)) continue;
        const v = lonlatToVec(this.ra[p], this.dec[p]);
        const ang = Math.acos(Math.max(-1, Math.min(1, v[0] * v0[0] + v[1] * v0[1] + v[2] * v0[2]))) / DEG;
        seen.set(p, Math.max(0, 1 - ang / (1.25 * step)));
      }
      let sw = 0;
      for (const w of seen.values()) sw += w;
      if (!(sw > 0)) return [[ang2pixNest(this.nside, ra, dec), 1]];
      return [...seen].filter(([, w]) => w > 0).map(([p, w]) => [p, w / sw]);
    }
    densityAt(map, l, b) {
      let s = 0;
      for (const [p, w] of this.weightsAt(l, b)) s += w * map[p];
      return s;
    }
  }

  // ---------------------------------------------------------------- legacy (v1) model
  // The analytic disk+spheroid model of the original page, kept only for comparison.
  const V1 = (function () {
    const MAGS = [8, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    const LOGN = [0.3, 1.5, 7, 28, 55, 120, 250, 520, 1200, 2800, 6200, 11500, 20000, 33000].map(Math.log10);
    function pole(r) {
      if (r <= MAGS[0]) return 10 ** LOGN[0];
      for (let i = 0; i < MAGS.length - 1; i++) {
        if (r <= MAGS[i + 1]) return 10 ** (LOGN[i] + (r - MAGS[i]) / (MAGS[i + 1] - MAGS[i]) * (LOGN[i + 1] - LOGN[i]));
      }
      return 10 ** LOGN[LOGN.length - 1];
    }
    function perDeg2(r, l, b) {
      const gb = Math.abs(b), N0 = pole(r);
      const fs = Math.min(0.35, Math.max(0.05, 0.05 + 0.015 * (r - 14)));
      const disk = Math.min(1 / Math.sin(Math.max(gb, 2) * DEG), 25);
      const bulge = 2.5 * Math.max(Math.cos(l * DEG), 0) * Math.exp(-((gb / 12) ** 2));
      return (1 - fs) * N0 * disk * (1 + bulge) + fs * N0;
    }
    // v1 mapped every band onto r' with one typical colour: N(<m, X) = N_r(m + rOffset).
    const R_OFFSET = { U: -1.35, B: -0.85, V: -0.15, Rc: 0.2, Ic: 0.6, u: -1.65, g: -0.5, r: 0, i: 0.3, z: 0.4,
                       G: -0.1, BP: -0.4, RP: 0.35 };
    // Stars per arcmin^2 with mBright <= X < mFaint.
    function inWindow(band, mBright, mFaint, l, b) {
      const o = R_OFFSET[band] || 0;
      return Math.max(0, perDeg2(mFaint + o, l, b) - perDeg2(mBright + o, l, b)) / 3600;
    }
    return { perDeg2, inWindow };
  })();

  const api = {
    DEG, ARCSEC_PER_RAD, galToEq, eqToGal, gnomonic, gnomonicInv, lonlatToVec,
    ang2pixNest, pix2angNest, mollweideInv, mollweideFwd,
    poissonTail, binomTail, poissonSample, mulberry32, CountModel, V1,
  };
  root.StarCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
