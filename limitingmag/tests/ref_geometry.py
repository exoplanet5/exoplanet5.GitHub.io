"""Brute-force reference for the PSF / pixel / trail geometry in js/core.js.

Each case renders the PSF on a 16× supersampled grid, smears it along x by the trail
(box filter), bins it into pixels, and averages over 4×4 random sub-pixel phases:

    NEA   = 1 / Σ P_ij²                      (noise-equivalent pixels, PSF-fit photometry)
    peak  = max P_ij at the centred phase    (saturation)
    fap   = flux fraction in a stadium aperture of radius r around the trail

Writes JSON to stdout; tests/test_core.mjs compares js/core.js against it.
Usage:  python -I tests/ref_geometry.py > tests/ref_geometry.json
"""
import json
import math

import numpy as np
from scipy.ndimage import uniform_filter1d

SUB = 16
CASES = [
    # profile, beta, FWHM (px), trail L (px), aperture radius (× FWHM)
    ("gauss", 0, 4.0, 0.0, 1.0),
    ("gauss", 0, 1.2, 0.0, 1.0),
    ("gauss", 0, 0.6, 0.0, 1.0),
    ("gauss", 0, 3.0, 12.0, 1.0),
    ("gauss", 0, 2.0, 60.0, 0.7),
    ("moffat", 4.765, 4.0, 0.0, 1.0),
    ("moffat", 4.765, 1.5, 0.0, 1.0),
    ("moffat", 4.765, 3.0, 12.0, 1.0),
    ("moffat", 4.765, 2.5, 40.0, 0.7),
    ("moffat", 2.5, 4.0, 0.0, 1.0),
]


def psf(profile, beta, fwhm, x, y):
    r2 = x * x + y * y
    if profile == "gauss":
        s = fwhm / (2 * math.sqrt(2 * math.log(2)))
        return np.exp(-r2 / (2 * s * s)) / (2 * math.pi * s * s)
    a = fwhm / (2 * math.sqrt(2 ** (1 / beta) - 1))
    return (beta - 1) / (math.pi * a * a) * (1 + r2 / (a * a)) ** (-beta)


def render(profile, beta, fwhm, L, px, py, halfw):
    """Pixel image of the trailed PSF whose trail centre sits at (px, py) within the central pixel."""
    hx = int(math.ceil(L / 2 + halfw)) + 1
    hy = int(math.ceil(halfw)) + 1
    xs = (np.arange(-hx * SUB, hx * SUB) + 0.5) / SUB - px
    ys = (np.arange(-hy * SUB, hy * SUB) + 0.5) / SUB - py
    X, Y = np.meshgrid(xs, ys)
    img = psf(profile, beta, fwhm, X, Y) / SUB**2
    w = int(round(L * SUB))
    if w > 1:   # box-average along x over the trail
        img = uniform_filter1d(img, size=w, axis=1, mode="constant")
    return img.reshape(2 * hy, SUB, 2 * hx, SUB).sum(axis=(1, 3)), X, Y, img


out = []
for profile, beta, fwhm, L, apR in CASES:
    halfw = 14 * fwhm if profile == "moffat" else 6 * fwhm
    nea = []
    for ix in range(4):
        for iy in range(4):
            P, *_ = render(profile, beta, fwhm, L, (ix + 0.5) / 4 - 0.5, (iy + 0.5) / 4 - 0.5, halfw)
            nea.append(1 / np.sum(P**2))
    P0, X, Y, fine = render(profile, beta, fwhm, L, 0.5, 0.5, halfw)   # trail centred on a pixel centre
    r = apR * fwhm
    h = L / 2
    inside = (np.abs(Y) <= r) & (np.abs(X) <= h) | ((np.abs(X) - h) ** 2 + Y**2 <= r * r)
    out.append(dict(profile=profile, beta=beta, fwhm=fwhm, L=L, apR=apR,
                    nea=float(np.mean(nea)), peak=float(P0.max()), fap=float(fine[inside].sum()),
                    total=float(P0.sum())))
print(json.dumps(out, indent=1))
