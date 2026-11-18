// Shared helpers for SOLMARA HEAT: seeded RNG, math, and runtime canvas textures.
// Every visual texture in the game is drawn here at load time — no image files, no network.
import * as THREE from 'three';

/** Deterministic RNG (mulberry32) so ?shot= scenes reproduce exactly. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return Math.floor(randRange(rng, a, b + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

/** Shortest signed angle difference, for smooth turning. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * t; }

/** Draw on a canvas and return a THREE.CanvasTexture (sRGB, anisotropic). */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft round radial sprite (dust, glow, muzzle flash) as a shared texture. */
let softDot = null;
export function softDotTexture() {
  if (softDot) return softDot;
  softDot = canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  });
  return softDot;
}

// ---- World layout constants (one district, ~4x4 blocks, sea on the west) ----
export const ROAD_CENTERS = [-96, -48, 0, 48, 96];
export const ROAD_W = 12;
export const BLOCK = 36;
export const HALF = 102;          // district edge (road centre +- half road)
export const SEA_X = -108;        // water starts west of this line
export const WORLD_MIN = -102;
export const WORLD_MAX = 102;

/** Block i (0..3) spans [lo, hi] on one axis. */
export function blockSpan(i) {
  return { lo: ROAD_CENTERS[i] + ROAD_W / 2, hi: ROAD_CENTERS[i + 1] - ROAD_W / 2 };
}

/** Is (x,z) on a road (within the road strips)? */
export function onRoad(x, z) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < ROAD_W / 2 + 0.5) return true;
    if (Math.abs(z - c) < ROAD_W / 2 + 0.5) return true;
  }
  return false;
}

/** Nearest point on the road grid (used for spawns and police). */
export function nearestRoadPoint(x, z) {
  let best = null, bd = 1e9;
  for (const cx of ROAD_CENTERS) {
    for (const cz of ROAD_CENTERS) {
      // snap to the closer of the two crossing roads
      const px = Math.abs(x - cx) < Math.abs(z - cz) ? cx : x;
      const pz = Math.abs(x - cx) < Math.abs(z - cz) ? z : cz;
      const d = dist2(x, z, px, pz);
      if (d < bd) { bd = d; best = { x: px, z: pz }; }
    }
  }
  // also snap onto the nearest road line itself
  let bx = x, bz = z;
  let dc = 1e9;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < dc) { dc = Math.abs(x - c); bx = c; bz = z; }
    if (Math.abs(z - c) < dc) { dc = Math.abs(z - c); bx = x; bz = c; }
  }
  if (best && bd < dist2(x, z, bx, bz)) return best;
  return { x: bx, z: bz };
}
