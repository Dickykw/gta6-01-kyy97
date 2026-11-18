// Solmara Bay district: 4x4 blocks, sea on the west, Torre Sol lighthouse and the
// Plaza Mar clock tower as landmarks. Sun-soaked late afternoon: warm light, soft
// shadows, pastel facades, canvas-drawn window/sign textures — no external assets.
import * as THREE from 'three';
import { canvasTexture, mulberry32, randRange, randInt, pick, blockSpan, ROAD_CENTERS, ROAD_W, SEA_X, WORLD_MIN, WORLD_MAX } from './util.js';

const MAP_EXTENT = 132; // ground texture covers [-132, 132]^2

function groundTexture() {
  return canvasTexture(2048, 2048, (g, W, H) => {
    const px = (v) => ((v + MAP_EXTENT) / (MAP_EXTENT * 2)) * W;
    const pz = (v) => ((v + MAP_EXTENT) / (MAP_EXTENT * 2)) * H;
    // base: warm concrete
    g.fillStyle = '#b8a894'; g.fillRect(0, 0, W, H);
    // beach sand strip (west)
    const sand = g.createLinearGradient(px(SEA_X - 26), 0, px(SEA_X), 0);
    sand.addColorStop(0, '#e8d5a4'); sand.addColorStop(1, '#dcc48e');
    g.fillStyle = sand; g.fillRect(0, 0, px(SEA_X), H);
    // block interiors: ground colour per district (contract: marina sand, pasar warm
    // brick, downtown grey, perumahan green; plaza/park overpainted below)
    const districtGround = {
      '0,0': '#e0cda0', '0,1': '#a89a86', '0,2': '#b09d88', '0,3': '#b98a5e',
      '1,0': '#a3967f', '1,1': '#c9b391', '1,2': '#b3a28c', '1,3': '#b09d88',
      '2,0': '#8f8f92', '2,1': '#a89a86', '2,2': '#b3a28c', '2,3': '#a3967f',
      '3,0': '#7fae62', '3,1': '#a89a86', '3,2': '#b09d88', '3,3': '#8fae6a',
    };
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
      const s = blockSpan(bx), t = blockSpan(bz);
      g.fillStyle = districtGround[`${bx},${bz}`] || '#a89a86';
      g.fillRect(px(s.lo), pz(t.lo), px(s.hi) - px(s.lo), pz(t.hi) - pz(t.lo));
    }
    // plaza block (1,1): patterned paving
    const p = blockSpan(1);
    g.fillStyle = '#c9b391';
    g.fillRect(px(p.lo), pz(p.lo), px(p.hi) - px(p.lo), pz(p.hi) - pz(p.lo));
    g.strokeStyle = 'rgba(120,90,60,0.5)'; g.lineWidth = 3;
    for (let i = 1; i < 6; i++) {
      g.beginPath(); g.moveTo(px(p.lo + i * 6), pz(p.lo)); g.lineTo(px(p.lo + i * 6), pz(p.hi)); g.stroke();
      g.beginPath(); g.moveTo(px(p.lo), pz(p.lo + i * 6)); g.lineTo(px(p.hi), pz(p.lo + i * 6)); g.stroke();
    }
    g.beginPath(); g.arc(px((p.lo + p.hi) / 2), pz((p.lo + p.hi) / 2), px(9) - px(0), 0, Math.PI * 2);
    g.strokeStyle = '#8a6f4d'; g.lineWidth = 6; g.stroke();
    // park block (3,0): lawn
    const q = blockSpan(3), r = blockSpan(0);
    g.fillStyle = '#7fae62'; g.fillRect(px(q.lo), pz(r.lo), px(q.hi) - px(q.lo), px(r.hi) - pz(r.lo));
    g.fillStyle = '#8cbb6e';
    g.beginPath(); g.arc(px((q.lo + q.hi) / 2), pz((r.lo + r.hi) / 2), px(8) - px(0), 0, Math.PI * 2); g.fill();
    // roads: dark asphalt strips
    g.fillStyle = '#3d4149';
    for (const c of ROAD_CENTERS) {
      g.fillRect(px(c - ROAD_W / 2), 0, px(ROAD_W) - px(0), H);
      g.fillRect(0, pz(c - ROAD_W / 2), W, pz(ROAD_W) - pz(0));
    }
    // sidewalks: light border around each block
    g.strokeStyle = '#cfc4ae'; g.lineWidth = px(3) - px(0);
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
      const s = blockSpan(bx), t = blockSpan(bz);
      g.strokeRect(px(s.lo - 1.5), pz(t.lo - 1.5), px(s.hi) - px(s.lo) + 3, pz(t.hi) - pz(t.lo) + 3);
    }
    // centre dashes + edge lines
    g.fillStyle = '#e8c33c';
    for (const c of ROAD_CENTERS) {
      for (let v = -120; v < 120; v += 8) {
        g.fillRect(px(c - 0.25), pz(v), px(0.5) - px(0), pz(4) - pz(0));
        g.fillRect(px(v), pz(c - 0.25), px(4) - px(0), pz(0.5) - pz(0));
      }
    }
    // crosswalks at every intersection
    g.fillStyle = 'rgba(240,240,235,0.85)';
    for (const cx of ROAD_CENTERS) for (const cz of ROAD_CENTERS) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(px(cx + i * 2 - 0.8), pz(cz - ROAD_W / 2 - 1.5), px(1.6) - px(0), pz(3) - pz(0));
        g.fillRect(px(cx + i * 2 - 0.8), pz(cz + ROAD_W / 2 - 1.5), px(1.6) - px(0), pz(3) - pz(0));
        g.fillRect(px(cx - ROAD_W / 2 - 1.5), pz(cz + i * 2 - 0.8), px(3) - px(0), pz(1.6) - pz(0));
        g.fillRect(px(cx + ROAD_W / 2 - 1.5), pz(cz + i * 2 - 0.8), px(3) - px(0), pz(1.6) - pz(0));
      }
    }
    // parking bays along the main avenue (z = 0 road)
    g.strokeStyle = 'rgba(240,240,235,0.7)'; g.lineWidth = 2;
    for (let v = -84; v < 84; v += 12) {
      g.strokeRect(px(v), pz(ROAD_W / 2 - 5.4), px(10) - px(0), pz(5) - pz(0));
    }
  });
}

/** Window facade texture: floors x columns of lit/unlit windows on a wall colour. */
function facadeTexture(base, win, floors, cols, litRatio) {
  const rng = mulberry32(base.length * 7919 + floors * 131 + cols * 17);
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const cw = W / cols, fh = H / floors;
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : win;
      g.fillRect(c * cw + cw * 0.22, f * fh + fh * 0.22, cw * 0.56, fh * 0.56);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(c * cw + cw * 0.22, f * fh + fh * 0.22 + fh * 0.28, cw * 0.56, fh * 0.28);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, H - 10, W, 10);
  });
}

function signTexture(text, bg, fg, sub) {
  return canvasTexture(512, 128, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = fg; g.font = 'bold 56px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, W / 2, sub ? H / 2 - 16 : H / 2);
    if (sub) { g.font = 'bold 26px Arial, sans-serif'; g.fillText(sub, W / 2, H / 2 + 34); }
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, W - 8, H - 8);
  });
}

function clockTexture() {
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = '#f5efdd'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2c2c34'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2c2c34';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath(); g.arc(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96, i % 3 === 0 ? 9 : 5, 0, Math.PI * 2); g.fill();
    }
    // hands: 4:35, golden hour
    g.strokeStyle = '#2c2c34'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 52, 128 + 34); g.stroke();
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 62, 128 - 52); g.stroke();
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(128, 128, 10, 0, Math.PI * 2); g.fill();
  });
}

const BUILDING_TYPES = [
  { kind: 'res', base: '#e8c9a0', win: '#5a6b7a', floors: 4, cols: 5, h: [10, 15] },
  { kind: 'res', base: '#d98f6a', win: '#4a5a68', floors: 5, cols: 6, h: [12, 18] },
  { kind: 'res', base: '#f2e3c8', win: '#6b7c8a', floors: 3, cols: 4, h: [9, 13] },
  { kind: 'office', base: '#7fa8c4', win: '#2e4a5e', floors: 8, cols: 6, h: [24, 40] },
  { kind: 'office', base: '#9db8c9', win: '#33505f', floors: 7, cols: 5, h: [20, 32] },
  { kind: 'hotel', base: '#c98a7a', win: '#3a4a58', floors: 9, cols: 7, h: [28, 38] },
  { kind: 'shop', base: '#e6d3a3', win: '#54483a', floors: 2, cols: 5, h: [7, 9] },
  // --- new, clearly distinct types (v3 district pass) ---
  { kind: 'house', base: '#e8d8b0', win: '#7a6a4a', floors: 2, cols: 4, h: [5, 8] },      // 1-2 floors, pitched roof, garden
  { kind: 'tower', base: '#5a7a9a', win: '#1e3245', floors: 14, cols: 8, h: [48, 68] },    // 12+ floors, crown/spire
  { kind: 'market', base: '#d9a05a', win: '#6a4a2e', floors: 1, cols: 6, h: [5, 7] },      // low, wide hall
  { kind: 'marina', base: '#f5f5f0', win: '#3a6a8a', floors: 3, cols: 5, h: [9, 13] },     // white/blue, balconies
  { kind: 'theater', base: '#7a3a4a', win: '#e8c860', floors: 3, cols: 6, h: [10, 14] },  // wide, marquee
  { kind: 'warehouse', base: '#8a8a7a', win: '#4a4a42', floors: 2, cols: 8, h: [7, 10] }, // big footprint, flat
];

// District contract (coordinates/names are relied on by other agents — do not change).
// pool = building kinds allowed in the block; ground matches groundTexture().
const DISTRICTS = {
  '0,0': { name: 'MARINA', sub: 'Pantai Barat', pool: ['marina', 'house', 'shop'] },
  '0,1': { name: 'PELABUHAN', sub: 'Dermaga Lama', pool: ['warehouse', 'shop', 'res'] },
  '0,2': { name: 'KOTA LAMA', sub: 'Gang Tua', pool: ['res', 'shop', 'house'] },
  '0,3': { name: 'PASAR SOL', sub: 'Pasar Pagi', pool: ['market', 'shop', 'warehouse'] },
  '1,0': { name: 'BULEVAR SOL', sub: 'Jalan Raya', pool: ['office', 'shop', 'hotel', 'theater'] },
  '1,1': { name: 'PLAZA MAR', sub: 'Menara Jam', pool: ['shop', 'res'] },
  '1,2': { name: 'DISTRIK SENI', sub: 'Galeri & Kafe', pool: ['theater', 'shop', 'res'] },
  '1,3': { name: 'PERDAGANGAN', sub: 'Ruko Raya', pool: ['shop', 'office', 'warehouse'] },
  '2,0': { name: 'DOWNTOWN', sub: 'Menara Kaca', pool: ['tower', 'office', 'hotel'] },
  '2,1': { name: 'BISNIS', sub: 'Kantor Pusat', pool: ['office', 'hotel', 'tower'] },
  '2,2': { name: 'DISTRIK KACA', sub: 'Gedung Kaca', pool: ['office', 'res', 'hotel'] },
  '2,3': { name: 'KOTA TIMUR', sub: 'Blok Timur', pool: ['res', 'shop', 'office'] },
  '3,0': { name: 'TAMAN SOL', sub: 'Taman & Air Mancur', pool: ['res'] },
  '3,1': { name: 'TAMAN KOTA', sub: 'Tepi Taman', pool: ['res', 'house', 'shop'] },
  '3,2': { name: 'KOTA TIMUR', sub: 'Blok Timur', pool: ['res', 'house', 'shop'] },
  '3,3': { name: 'PERUMAHAN', sub: 'Kampung Halaman', pool: ['house', 'res'] },
};

function districtKey(bx, bz) { return `${bx},${bz}`; }

const SHOP_SIGNS = [
  ['CAFÉ LUMA', '#7a4a2e', '#ffe9c4', 'coffee · pastries'],
  ['KESTREL MOTORS', '#22384a', '#ffd23c', 'sales · service'],
  ['SOL CAB', '#e8a800', '#1c1c22', 'taxi · 24h'],
  ['HOTEL MARINA', '#28455e', '#9fd8e8', 'rooms · sea view'],
  ['VANTARA', '#5e2a68', '#f2d7ff', 'sport cars'],
  ['FISH MARKET', '#2e6b6b', '#dff5ef', 'fresh catch daily'],
  ['BAKERY SOL', '#8a4a2e', '#ffe9c4', 'pan · bread'],
  ['NEON BAR', '#2a1a3a', '#ff5fa2', 'drinks · music'],
  ['PLAZA MAR', '#3a5a7a', '#eaf3ff', 'shopping'],
  ['TORRE SOL', '#8a6f4d', '#fff3d6', 'lighthouse tours'],
];

/** Build the whole district. Returns colliders, spawn spots, loops and an update fn. */
export function createWorld(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = []; // {x, z, hx, hz}
  const parkedSpots = []; // {x, z, heading, type}
  const lampPositions = [];
  const group = new THREE.Group();
  scene.add(group);

  const signMats = []; // {mat, mult} — every sign/billboard/neon emissive material, for setTimeOfDay
  let lampRoomMat = null;
  let beamMat = null;

  // ---- sky dome: 4 time-of-day textures, 'golden' is the v2 default ----
  function makeSkyTexture(stops, clouds, stars) {
    return canvasTexture(1024, 512, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      for (const [o, c] of stops) grad.addColorStop(o, c);
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      if (stars) {
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 90; i++) {
          g.beginPath(); g.arc(rng() * W, rng() * H * 0.55, 0.8 + rng() * 1.4, 0, Math.PI * 2); g.fill();
        }
      }
      if (clouds) {
        g.fillStyle = clouds;
        for (let i = 0; i < 14; i++) {
          const cx = rng() * W, cy = 40 + rng() * 160, w = 60 + rng() * 140;
          g.beginPath(); g.ellipse(cx, cy, w, w * 0.22, 0, 0, Math.PI * 2); g.fill();
        }
      }
    });
  }
  const skyTextures = {
    golden: makeSkyTexture([[0, '#5a6fc0'], [0.38, '#9a7ec4'], [0.6, '#e8937a'], [0.78, '#ffb37a'], [0.92, '#ff8f5e'], [1, '#f2703f']], 'rgba(255,255,255,0.75)', false),
    day: makeSkyTexture([[0, '#2f6fd0'], [0.45, '#6fb0e8'], [0.75, '#a8d4f0'], [1, '#d8ecf8']], 'rgba(255,255,255,0.9)', false),
    dusk: makeSkyTexture([[0, '#2a2350'], [0.35, '#6a3a78'], [0.6, '#c65a6a'], [0.8, '#ff8a5e'], [1, '#e86a3f']], 'rgba(255,200,180,0.5)', false),
    night: makeSkyTexture([[0, '#04060f'], [0.5, '#0a1428'], [0.8, '#12233d'], [1, '#1a2f4d']], 'rgba(200,210,230,0.12)', true),
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTextures.golden, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(38, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, transparent: true, opacity: 0.95 }),
  );
  sun.position.set(-420, 55, -60); sun.lookAt(0, 40, 0);
  group.add(sun);
  scene.fog = new THREE.Fog(0xef9e63, 180, 520);

  // ---- lighting (golden values = v2 defaults; setTimeOfDay rewrites them) ----
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x8a6f52, 0.75);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sunLight.position.set(-170, 110, 70); // lower sun: longer sunset shadows
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  const ambient = new THREE.AmbientLight(0xffe8cc, 0.25);
  scene.add(ambient);

  // Time-of-day presets. 'golden' reproduces the v2 look exactly.
  const TIME_PRESETS = {
    golden: { fog: [0xef9e63, 180, 520], sun: [0xffe3b3, 2.4, [-170, 110, 70]], hemi: [0xbfd9ee, 0x8a6f52, 0.75], ambient: [0xffe8cc, 0.25], disc: [0xfff2c0, [-420, 55, -60]], lamp: 1.6, sign: 0.25, beam: 0.22 },
    day: { fog: [0xa8c8e8, 200, 600], sun: [0xfff5e0, 2.8, [80, 180, 60]], hemi: [0xcfe8ff, 0x9a8a6a, 0.9], ambient: [0xffffff, 0.35], disc: [0xfff8d0, [200, 220, 40]], lamp: 0.2, sign: 0.1, beam: 0.12 },
    dusk: { fog: [0x8a5a7a, 150, 450], sun: [0xff9a5a, 2.0, [-220, 40, 40]], hemi: [0x8a7ab8, 0x5a4a3a, 0.7], ambient: [0xffd0b0, 0.28], disc: [0xff8a4a, [-430, 28, -40]], lamp: 2.2, sign: 0.6, beam: 0.3 },
    night: { fog: [0x0a1428, 120, 380], sun: [0x9ab8e8, 0.8, [60, 180, -40]], hemi: [0x2a3a5a, 0x1a1a22, 0.5], ambient: [0x334466, 0.22], disc: [0xe8eef8, [140, 230, 90]], lamp: 3.0, sign: 1.0, beam: 0.38 },
  };
  function setTimeOfDay(preset) {
    const p = TIME_PRESETS[preset];
    if (!p) return;
    sky.material.map = skyTextures[preset];
    sky.material.needsUpdate = true;
    scene.fog.color.setHex(p.fog[0]); scene.fog.near = p.fog[1]; scene.fog.far = p.fog[2];
    sunLight.color.setHex(p.sun[0]); sunLight.intensity = p.sun[1];
    sunLight.position.set(p.sun[2][0], p.sun[2][1], p.sun[2][2]);
    hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]); hemi.intensity = p.hemi[2];
    ambient.color.setHex(p.ambient[0]); ambient.intensity = p.ambient[1];
    sun.material.color.setHex(p.disc[0]);
    sun.position.set(p.disc[1][0], p.disc[1][1], p.disc[1][2]);
    sun.lookAt(0, 40, 0);
    lampGlowMat.emissiveIntensity = p.lamp;
    if (lampRoomMat) lampRoomMat.emissiveIntensity = p.lamp * 1.4;
    if (beamMat) beamMat.opacity = p.beam;
    for (const s of signMats) s.mat.emissiveIntensity = p.sign * s.mult;
  }

  function districtAt(x, z) {
    if (x < SEA_X) return { name: 'LAUT', sub: 'Teluk Solmara' };
    const bx = x < -48 ? 0 : x < 0 ? 1 : x < 48 ? 2 : 3;
    const bz = z < -48 ? 0 : z < 0 ? 1 : z < 48 ? 2 : 3;
    const d = DISTRICTS[districtKey(bx, bz)];
    return d ? { name: d.name, sub: d.sub } : { name: 'SOLMARA', sub: 'Kota' };
  }

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_EXTENT * 2, MAP_EXTENT * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  // ---- sea (west) ----
  const seaTex = canvasTexture(512, 512, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#1d7f8c'); grad.addColorStop(0.6, '#2fa8a0'); grad.addColorStop(1, '#7fd4c8');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const y = rng() * H, x = rng() * W, w = 30 + rng() * 90;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
    }
  });
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, MAP_EXTENT * 2 + 120),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X - 90, -0.15, 0);
  sea.receiveShadow = true;
  group.add(sea);

  // ---- shared geometries / materials ----
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = BUILDING_TYPES.map((t) => {
    const tex = facadeTexture(t.base, t.win, t.floors, t.cols, 0.28);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.02 });
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, roughness: 0.95 });
  const roofMat2 = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.7, metalness: 0.3 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const leafMats = [0x4f8a3d, 0x5f9a44, 0x3f7a35].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3438, roughness: 0.6, metalness: 0.5 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc95e, emissiveIntensity: 1.6 });
  const prismGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1); // triangular prism (gable roof), scaled per roof
  const crownGeo = new THREE.IcosahedronGeometry(1, 0); // leafy crown lobe, scaled per tree
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x9a5a44, roughness: 0.85 });
  const gardenMat = new THREE.MeshStandardMaterial({ color: 0x5f8f46, roughness: 1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a4a5e, roughness: 0.15, metalness: 0.5 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.8 });
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
  const awningMats = [0xc0392b, 0x2e6b6b, 0xe8a800, 0x28455e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const ventGeo = new THREE.CylinderGeometry(0.3, 0.38, 0.6, 10);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8);

  function addBox(mat, w, h, d, x, y, z, ry = 0, shadow = true) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = shadow; m.receiveShadow = true;
    group.add(m); return m;
  }
  function addCollider(x, z, hx, hz) { colliders.push({ x, z, hx, hz }); }

  // leafy crown: 2-3 overlapping icosahedra of different sizes, not one ball
  function addTree(tx, tz, s) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.36 * s, 2.4 * s, 8), trunkMat);
    trunk.position.set(tx, 1.2 * s, tz); trunk.castShadow = true; group.add(trunk);
    const n = randInt(rng, 2, 3);
    for (let k = 0; k < n; k++) {
      const crown = new THREE.Mesh(crownGeo, pick(rng, leafMats));
      crown.scale.setScalar(randRange(rng, 1.1, 1.8) * s);
      crown.position.set(tx + randRange(rng, -0.7, 0.7) * s, (2.9 + k * 0.55) * s, tz + randRange(rng, -0.7, 0.7) * s);
      crown.castShadow = true; group.add(crown);
    }
  }

  // slatted bench: 3 seat slats with gaps, tilted backrest slats, cylinder legs
  function addBench(bx2, bz2, ry) {
    const b = new THREE.Group();
    b.position.set(bx2, 0, bz2); b.rotation.y = ry;
    const slat = (w, h, d, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(boxGeo, benchMat);
      m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.x = rx;
      m.castShadow = true; m.receiveShadow = true; b.add(m);
    };
    slat(2.4, 0.07, 0.22, 0, 0.55, -0.27);
    slat(2.4, 0.07, 0.22, 0, 0.55, 0);
    slat(2.4, 0.07, 0.22, 0, 0.55, 0.27);
    slat(2.4, 0.16, 0.06, 0, 0.85, -0.44, -0.32);
    slat(2.4, 0.16, 0.06, 0, 1.08, -0.51, -0.32);
    for (const sx of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(legGeo, poleMat);
      leg.position.set(sx, 0.25, 0); leg.castShadow = true; b.add(leg);
      const post = new THREE.Mesh(boxGeo, benchMat);
      post.scale.set(0.08, 0.62, 0.08); post.position.set(sx, 0.85, -0.42); post.castShadow = true; b.add(post);
    }
    group.add(b);
  }

  // palm: leaning trunk + drooping frond cones (never a box)
  function addPalm(px2, pz2, s = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 5.5 * s, 8), trunkMat);
    trunk.position.set(px2, 2.75 * s, pz2); trunk.rotation.z = 0.12; trunk.castShadow = true; group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 3.4 * s, 6), leafMats[f % 3]);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(px2 + Math.cos(a) * 1.4 * s, 5.6 * s, pz2 + Math.sin(a) * 1.4 * s);
      frond.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9);
      group.add(frond);
    }
  }

  // ---- buildings ----
  const plazaBlock = { bx: 1, bz: 1 };
  const parkBlock = { bx: 3, bz: 0 };
  let neonCount = 0; // downtown vertical neon signs (max 2)
  for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
    if (bx === plazaBlock.bx && bz === plazaBlock.bz) continue;
    if (bx === parkBlock.bx && bz === parkBlock.bz) continue;
    const s = blockSpan(bx), t = blockSpan(bz);
    const district = DISTRICTS[districtKey(bx, bz)] || { pool: ['res', 'office', 'shop', 'hotel'] };
    const poolIdx = BUILDING_TYPES.map((t, i) => (district.pool.includes(t.kind) ? i : -1)).filter((i) => i >= 0);
    const n = randInt(rng, 2, 4);
    let prevTypeIdx = -1;
    for (let i = 0; i < n; i++) {
      // pool per district; never two adjacent buildings with the same type
      let typeIdx = poolIdx[Math.floor(rng() * poolIdx.length)];
      for (let tries = 0; tries < 6 && typeIdx === prevTypeIdx && poolIdx.length > 1; tries++) {
        typeIdx = poolIdx[Math.floor(rng() * poolIdx.length)];
      }
      prevTypeIdx = typeIdx;
      const type = BUILDING_TYPES[typeIdx];
      const wide = type.kind === 'warehouse' || type.kind === 'theater' || type.kind === 'market';
      const w = wide ? randRange(rng, 14, 20) : type.kind === 'house' ? randRange(rng, 8, 11) : randRange(rng, 9, 14);
      const d = wide ? randRange(rng, 14, 20) : type.kind === 'house' ? randRange(rng, 8, 11) : randRange(rng, 9, 14);
      const h = randRange(rng, type.h[0], type.h[1]);
      const cx = randRange(rng, s.lo + w / 2 + 1, s.hi - w / 2 - 1);
      const cz = randRange(rng, t.lo + d / 2 + 1, t.hi - d / 2 - 1);
      // keep buildings from overlapping each other in the same block
      let clash = false;
      for (const c of colliders) {
        if (Math.abs(c.x - cx) < (c.hx + w / 2 + 1.5) && Math.abs(c.z - cz) < (c.hz + d / 2 + 1.5)) { clash = true; break; }
      }
      if (clash) continue;
      const mat = facadeMats[typeIdx];
      const tex = mat.map;
      tex.repeat.set(Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 7)));
      // tiered massing: distinct silhouette per kind, setbacks + cornice bands
      const tierDefs =
        type.kind === 'tower' ? [{ wf: 1, hf: 0.5 }, { wf: 0.75, hf: 0.3 }, { wf: 0.5, hf: 0.2 }]
        : type.kind === 'office' ? [{ wf: 1, hf: 0.55 }, { wf: 0.78, hf: 0.3 }, { wf: 0.55, hf: 0.15 }]
        : type.kind === 'hotel' ? [{ wf: 1, hf: 0.35 }, { wf: 0.72, hf: 0.65 }]
        : type.kind === 'marina' ? [{ wf: 1, hf: 0.6 }, { wf: 0.8, hf: 0.4 }]
        : type.kind === 'shop' || type.kind === 'market' || type.kind === 'warehouse' || type.kind === 'theater' || type.kind === 'house' ? [{ wf: 1, hf: 1 }]
        : [{ wf: 1, hf: 0.6 }, { wf: 0.75, hf: 0.4 }];
      let y = 0;
      let topW = w, topD = d;
      for (let ti = 0; ti < tierDefs.length; ti++) {
        const tw = w * tierDefs[ti].wf, td = d * tierDefs[ti].wf, th = h * tierDefs[ti].hf;
        addBox(mat, tw, th, td, cx, y + th / 2, cz);
        y += th;
        topW = tw; topD = td;
        if (ti < tierDefs.length - 1) {
          // cornice band protruding at the setback
          addBox(roofMat2, tw + 0.5, 0.45, td + 0.5, cx, y - 0.1, cz);
        }
      }
      // roof: flat + parapet, pitched prism, rooftop garden, or office crown
      const roofRoll = rng();
      const roofStyle =
        type.kind === 'house' ? 'pitched'
        : type.kind === 'tower' ? (roofRoll < 0.6 ? 'crown' : 'spire')
        : type.kind === 'market' || type.kind === 'warehouse' || type.kind === 'theater' ? 'flat'
        : type.kind === 'shop' ? (roofRoll < 0.6 ? 'pitched' : 'flat')
        : type.kind === 'office' ? (roofRoll < 0.7 ? 'flat' : 'crown')
        : type.kind === 'marina' ? (roofRoll < 0.5 ? 'pitched' : 'flat')
        : (roofRoll < 0.5 ? 'flat' : roofRoll < 0.75 ? 'pitched' : 'garden');
      if (roofStyle === 'pitched') {
        const roofH = randRange(rng, 1.8, 3);
        const prism = new THREE.Mesh(prismGeo, i % 2 ? roofMat : tileMat);
        if (topW >= topD) {
          prism.rotation.z = Math.PI / 2;
          prism.scale.set(roofH / 1.5, topW + 0.4, (topD + 0.4) / 1.732);
        } else {
          prism.rotation.set(0, Math.PI / 2, Math.PI / 2);
          prism.scale.set(roofH / 1.5, topD + 0.4, (topW + 0.4) / 1.732);
        }
        prism.position.set(cx, h + roofH / 3, cz);
        prism.castShadow = true; group.add(prism);
      } else {
        // thin roof slab + parapet strips around the edge
        addBox(roofMat, topW + 0.2, 0.18, topD + 0.2, cx, h + 0.09, cz);
        addBox(roofMat2, topW + 0.4, 0.55, 0.3, cx, h + 0.45, cz + topD / 2 + 0.05);
        addBox(roofMat2, topW + 0.4, 0.55, 0.3, cx, h + 0.45, cz - topD / 2 - 0.05);
        addBox(roofMat2, 0.3, 0.55, topD + 0.4, cx + topW / 2 + 0.05, h + 0.45, cz);
        addBox(roofMat2, 0.3, 0.55, topD + 0.4, cx - topW / 2 - 0.05, h + 0.45, cz);
        if (roofStyle === 'garden') {
          addBox(gardenMat, topW - 1.5, 0.3, topD - 1.5, cx, h + 0.32, cz);
          for (let k = 0; k < 3; k++) {
            const shrub = new THREE.Mesh(crownGeo, pick(rng, leafMats));
            shrub.scale.setScalar(randRange(rng, 0.5, 0.8));
            shrub.position.set(cx + randRange(rng, -topW / 4, topW / 4), h + 0.7, cz + randRange(rng, -topD / 4, topD / 4));
            shrub.castShadow = true; group.add(shrub);
          }
        } else if (roofStyle === 'crown') {
          addBox(mat, topW * 0.5, 1.6, topD * 0.5, cx, h + 0.8, cz);
          addBox(roofMat2, topW * 0.5 + 0.4, 0.35, topD * 0.5 + 0.4, cx, h + 1.7, cz);
        } else if (roofStyle === 'spire') {
          // tower spire: thin cylinder + ball tip
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7, 8), roofMat2);
          spire.position.set(cx, h + 3.5, cz); spire.castShadow = true; group.add(spire);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), glassMat);
          tip.position.set(cx, h + 7.4, cz); group.add(tip);
        }
      }
      // rooftop props (flat roofs only, so nothing pokes through a prism or spire)
      if (roofStyle !== 'pitched' && roofStyle !== 'spire' && rng() < 0.7) {
        const ax = cx + randRange(rng, -w / 4, w / 4), az = cz + randRange(rng, -d / 4, d / 4);
        addBox(acMat, 1.6, 0.9, 1.2, ax, h + 0.9, az);
        const vent = new THREE.Mesh(ventGeo, acMat);
        vent.position.set(ax, h + 1.6, az); vent.castShadow = true; group.add(vent);
      }
      if (roofStyle !== 'pitched' && rng() < 0.35) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), acMat);
        tank.position.set(cx - w / 4, h + 1.4, cz - d / 4); tank.castShadow = true; group.add(tank);
      }
      // balcony on the base tier front (res / hotel / marina)
      if ((type.kind === 'res' || type.kind === 'hotel' || type.kind === 'marina') && rng() < 0.5) {
        const bw = w * tierDefs[0].wf, bd = d * tierDefs[0].wf;
        const by = h * tierDefs[0].hf - 1.6;
        const bxOff = randRange(rng, -bw / 4, bw / 4);
        addBox(frameMat, 2.4, 0.12, 1.0, cx + bxOff, by, cz + bd / 2 + 0.5);
        addBox(frameMat, 2.4, 0.5, 0.07, cx + bxOff, by + 0.35, cz + bd / 2 + 0.95);
        addBox(frameMat, 0.07, 0.5, 1.0, cx + bxOff - 1.16, by + 0.35, cz + bd / 2 + 0.5);
        addBox(frameMat, 0.07, 0.5, 1.0, cx + bxOff + 1.16, by + 0.35, cz + bd / 2 + 0.5);
      }
      // ground-floor storefront: glass + door frame + mullions + tilted awning
      if (type.kind === 'shop' || type.kind === 'market' || type.kind === 'theater' || rng() < 0.3) {
        const sign = pick(rng, SHOP_SIGNS);
        const signTex = signTexture(sign[0], sign[1], sign[2], sign[3]);
        const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25, roughness: 0.6 });
        signMats.push({ mat: signMat, mult: 1 });
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), signMat);
        sm.position.set(cx, 4.5, cz + d / 2 + 0.06);
        group.add(sm);
        addBox(glassMat, w * 0.62, 2.4, 0.14, cx - w * 0.12, 1.5, cz + d / 2 + 0.08);
        addBox(doorMat, 1.3, 2.4, 0.12, cx + w * 0.32, 1.5, cz + d / 2 + 0.08);
        addBox(frameMat, 0.12, 2.55, 0.14, cx + w * 0.32 - 0.71, 1.5, cz + d / 2 + 0.08);
        addBox(frameMat, 0.12, 2.55, 0.14, cx + w * 0.32 + 0.71, 1.5, cz + d / 2 + 0.08);
        addBox(frameMat, 1.54, 0.12, 0.14, cx + w * 0.32, 2.78, cz + d / 2 + 0.08);
        addBox(frameMat, 0.12, 2.4, 0.1, cx - w * 0.12, 1.5, cz + d / 2 + 0.16);
        addBox(frameMat, w * 0.8, 0.18, 0.14, cx, 0.32, cz + d / 2 + 0.08);
        const awn = new THREE.Mesh(boxGeo, pick(rng, awningMats));
        awn.scale.set(w * 0.8, 0.08, 1.5);
        awn.position.set(cx, 3.15, cz + d / 2 + 0.75);
        awn.rotation.x = 0.5;
        awn.castShadow = true; awn.receiveShadow = true; group.add(awn);
      }
      // downtown neon: vertical glowing sign on towers (2 max, tracked for setTimeOfDay)
      if (bx === 2 && bz === 0 && (type.kind === 'tower' || type.kind === 'office') && neonCount < 2) {
        neonCount++;
        const neonTex = signTexture(neonCount === 1 ? 'SOL' : 'NEON', neonCount === 1 ? '#ff2e7e' : '#00d8ff', '#ffffff');
        const neonMat = new THREE.MeshStandardMaterial({ map: neonTex, emissive: 0xffffff, emissiveMap: neonTex, emissiveIntensity: 1.0, roughness: 0.4 });
        signMats.push({ mat: neonMat, mult: 4 }); // 4x brighter than a shop sign
        const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.2, h * 0.55), neonMat);
        neon.position.set(cx, h * 0.55, cz + d / 2 + 0.08);
        group.add(neon);
      }
      // theater marquee: protruding canopy + glowing title strip
      if (type.kind === 'theater') {
        addBox(frameMat, w * 0.7, 0.3, 2.2, cx, 3.4, cz + d / 2 + 1.0);
        const mqTex = signTexture('TEATER SOL', '#2a1a3a', '#ff5fa2', 'malam ini');
        const mqMat = new THREE.MeshStandardMaterial({ map: mqTex, emissive: 0xffffff, emissiveMap: mqTex, emissiveIntensity: 0.25, roughness: 0.6 });
        signMats.push({ mat: mqMat, mult: 1.5 });
        const mq = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), mqMat);
        mq.position.set(cx, 4.4, cz + d / 2 + 0.08);
        group.add(mq);
      }
      // house garden: ball shrubs + low fence (perumahan identity)
      if (type.kind === 'house') {
        for (let k = 0; k < 2; k++) {
          const shrub = new THREE.Mesh(crownGeo, pick(rng, leafMats));
          shrub.scale.setScalar(randRange(rng, 0.5, 0.8));
          shrub.position.set(cx + (k === 0 ? -w / 2 - 0.8 : w / 2 + 0.8), 0.5, cz + d / 2 - 1);
          shrub.castShadow = true; group.add(shrub);
        }
        if (rng() < 0.6) {
          addBox(frameMat, w + 2.4, 0.8, 0.12, cx, 0.4, cz + d / 2 + 1.6);
          addBox(frameMat, 0.12, 0.8, d / 2 + 1, cx - w / 2 - 1.2, 0.4, cz + d / 4);
          addBox(frameMat, 0.12, 0.8, d / 2 + 1, cx + w / 2 + 1.2, 0.4, cz + d / 4);
        }
      }
      addCollider(cx, cz, w / 2, d / 2);
    }
  }

  // ---- Plaza Mar clock tower (landmark, centre of plaza block) ----
  const plaza = blockSpan(1);
  const pcx = (plaza.lo + plaza.hi) / 2, pcz = (plaza.lo + plaza.hi) / 2;
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.85 });
  // stepped tower: wide low plinth, slimmer shaft with two setbacks + cornices
  addBox(towerMat, 8, 3, 8, pcx, 1.5, pcz); // plinth (0-3)
  addBox(towerMat, 5, 8, 5, pcx, 7, pcz); // shaft, lower tier (3-11)
  addBox(roofMat2, 5.6, 0.5, 5.6, pcx, 11.25, pcz); // cornice
  addBox(towerMat, 4, 6, 4, pcx, 14.5, pcz); // shaft, upper tier (11.5-17.5)
  addBox(roofMat2, 4.6, 0.5, 4.6, pcx, 17.75, pcz); // cornice
  const clockTex = clockTexture();
  for (const [dx, dz, ry] of [[0, 2.06, 0], [0, -2.06, Math.PI], [2.06, 0, Math.PI / 2], [-2.06, 0, -Math.PI / 2]]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 }));
    face.position.set(pcx + dx, 15.5, pcz + dz); face.rotation.y = ry; group.add(face);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 3.6, 4), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 }));
  roof.position.set(pcx, 19.8, pcz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), poleMat);
  mast.position.set(pcx, 22, pcz); group.add(mast);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xff5f6d, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(pcx + 1.2, 22.6, pcz); group.add(flag);
  addCollider(pcx, pcz, 4.2, 4.2);
  // plaza benches (slatted, facing the tower)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addBench(pcx + Math.cos(a) * 12, pcz + Math.sin(a) * 12, -a - Math.PI / 2);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const boll = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), poleMat);
    boll.position.set(pcx + Math.cos(a) * 16, 0.45, pcz + Math.sin(a) * 16); boll.castShadow = true; group.add(boll);
  }

  // ---- Torre Sol lighthouse (coast, west) ----
  const lx = SEA_X - 6, lz = -60;
  const stripeTex = canvasTexture(128, 256, (g, W, H) => {
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c23b2e' : '#f5efdd'; g.fillRect(0, i * (H / 6), W, H / 6); }
  });
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 26, 16),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }),
  );
  tower.position.set(lx, 13, lz); tower.castShadow = true; group.add(tower);
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.8, 16), poleMat);
  gallery.position.set(lx, 26.4, lz); group.add(gallery);
  lampRoomMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
    lampRoomMat,
  );
  lampRoom.position.set(lx, 28.4, lz); group.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x2e3438, roughness: 0.6 }));
  cap.position.set(lx, 31, lz); group.add(cap);
  // rotating beam (additive cone)
  beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 12, 1, true), beamMat);
  beam.position.set(lx, 28.4, lz);
  beam.rotation.z = Math.PI / 2;
  beam.geometry.translate(0, 17, 0);
  group.add(beam);
  addCollider(lx, lz, 3.6, 3.6);
  // beach palms near the lighthouse
  for (let i = 0; i < 5; i++) {
    addPalm(SEA_X - 4 - rng() * 8, -84 + i * 12 + rng() * 4, 1);
  }

  // ---- MARINA props: 3 boats at sea + wooden pier + extra beach palms ----
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5efdd, roughness: 0.85, side: THREE.DoubleSide });
  const boatSpots = [[-120, -78], [-128, -66], [-124, -60]];
  for (let bi2 = 0; bi2 < boatSpots.length; bi2++) {
    const [bx2, bz2] = boatSpots[bi2];
    const boat = new THREE.Group();
    boat.position.set(bx2 + randRange(rng, -1.5, 1.5), 0, bz2 + randRange(rng, -1.5, 1.5));
    boat.rotation.y = randRange(rng, -0.5, 0.5);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), woodMat);
    hull.scale.set(3.4, 0.9, 1.5); hull.position.y = 0.25; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8), poleMat);
    mast.position.y = 3.1; boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 4.2); sailShape.lineTo(2.4, 0.4); sailShape.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
    sail.position.set(0.1, 0.9, 0); boat.add(sail);
    const stern = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), woodMat);
    stern.rotation.z = -Math.PI / 2; stern.position.set(-3.2, 0.5, 0); boat.add(stern);
    group.add(boat);
  }
  // pier planks from the beach (x -102..-112, z -72), cylinder posts — no collider (over water)
  for (let px2 = -102; px2 >= -112; px2 -= 1.6) {
    addBox(woodMat, 1.5, 0.12, 2.6, px2, 0.35, -72);
  }
  for (let px2 = -103; px2 >= -111; px2 -= 4) {
    for (const pz2 of [-73.1, -70.9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.7, 8), woodMat);
      post.position.set(px2, 0.45, pz2); post.castShadow = true; group.add(post);
    }
  }
  // extra palms along the marina beach (x ~-100, z -84..60)
  for (const pz2 of [-40, -10, 20, 50]) {
    addPalm(-100 + randRange(rng, -1.5, 1.5), pz2 + randRange(rng, -2, 2), randRange(rng, 0.9, 1.1));
  }

  // ---- PASAR SOL props: 6 market stalls + crates ----
  const fruitMats = [0xe86a3f, 0xe8c33c, 0x7a3a8a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  const stallBase = [[-84, 62], [-72, 62], [-60, 62], [-84, 78], [-72, 78], [-60, 78]];
  for (let si = 0; si < stallBase.length; si++) {
    let kx = stallBase[si][0], kz = stallBase[si][1];
    let clash = true;
    for (let att = 0; att < 6 && clash; att++) {
      kx = stallBase[si][0] + randRange(rng, -3, 3);
      kz = stallBase[si][1] + randRange(rng, -3, 3);
      clash = false;
      for (const c of colliders) {
        if (Math.abs(c.x - kx) < c.hx + 2.2 && Math.abs(c.z - kz) < c.hz + 2.2) { clash = true; break; }
      }
    }
    if (clash) continue;
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 12), woodMat);
    tableTop.position.set(kx, 0.95, kz); tableTop.castShadow = true; group.add(tableTop);
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.95, 8), poleMat);
    tableLeg.position.set(kx, 0.48, kz); group.add(tableLeg);
    for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), poleMat);
      pole.position.set(kx + ox, 2.1, kz + oz); group.add(pole);
    }
    // tilted pyramid canopy (4-sided cone, not a box)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 4), pick(rng, awningMats));
    canopy.position.set(kx, 3.4, kz); canopy.rotation.y = Math.PI / 4 + randRange(rng, -0.15, 0.15);
    canopy.castShadow = true; group.add(canopy);
    // goods on the table: fruit spheres + small jars (cylinders)
    for (let gi = 0; gi < 3; gi++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), pick(rng, fruitMats));
      fruit.position.set(kx + randRange(rng, -0.9, 0.9), 1.16, kz + randRange(rng, -0.9, 0.9));
      fruit.castShadow = true; group.add(fruit);
    }
    for (let gi = 0; gi < 2; gi++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), pick(rng, fruitMats));
      jar.position.set(kx + randRange(rng, -0.9, 0.9), 1.2, kz + randRange(rng, -0.9, 0.9));
      group.add(jar);
    }
    addCollider(kx, kz, 2, 2);
  }
  // small crates near the stalls
  for (const [cx2, cz2] of [[-78, 70], [-66, 70], [-78, 84], [-66, 84]]) {
    addBox(woodMat, 0.9, 0.9, 0.9, cx2 + randRange(rng, -1, 1), 0.45, cz2 + randRange(rng, -1, 1), randRange(rng, 0, 0.6));
  }

  // ---- park block: trees, benches, fountain ----
  const pk = blockSpan(3), pr = blockSpan(0);
  const pkx = (pk.lo + pk.hi) / 2, pkz = (pr.lo + pr.hi) / 2;
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1, 20), new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.8 }));
  fountain.position.set(pkx, 0.5, pkz); fountain.castShadow = true; group.add(fountain);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshStandardMaterial({ color: 0x4fb8c8, roughness: 0.15, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(pkx, 1.05, pkz); group.add(water);
  // centre jet column + ball tip
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.8 }));
  jet.position.set(pkx, 1.9, pkz); jet.castShadow = true; group.add(jet);
  const jetTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4fb8c8, roughness: 0.15, metalness: 0.2 }));
  jetTop.position.set(pkx, 3.05, pkz); group.add(jetTop);
  addCollider(pkx, pkz, 5, 5);
  // park benches facing the fountain
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    addBench(pkx + Math.cos(a) * 8.5, pkz + Math.sin(a) * 8.5, -a - Math.PI / 2);
  }
  for (let i = 0; i < 10; i++) {
    const tx = randRange(rng, pk.lo + 3, pk.hi - 3), tz = randRange(rng, pr.lo + 3, pr.hi - 3);
    if (Math.abs(tx - pkx) < 7 && Math.abs(tz - pkz) < 7) continue;
    addTree(tx, tz, randRange(rng, 0.9, 1.3));
  }

  // ---- street trees along sidewalks ----
  for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
    if (bx === 1 && bz === 1) continue;
    const s = blockSpan(bx), t = blockSpan(bz);
    for (let i = 0; i < 3; i++) {
      const tx = randRange(rng, s.lo + 1, s.hi - 1), tz = randRange(rng, t.lo + 1, t.hi - 1);
      let clash = false;
      for (const c of colliders) if (Math.abs(c.x - tx) < c.hx + 1 && Math.abs(c.z - tz) < c.hz + 1) { clash = true; break; }
      if (clash) continue;
      addTree(tx, tz, randRange(rng, 0.8, 1.1));
    }
  }

  // ---- street lamps (on every intersection corner) ----
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  for (const cx of ROAD_CENTERS) for (const cz of ROAD_CENTERS) {
    const lx2 = cx + ROAD_W / 2 + 0.8, lz2 = cz + ROAD_W / 2 + 0.8;
    if (lx2 > WORLD_MAX || lz2 > WORLD_MAX) continue;
    const pole = new THREE.Mesh(lampGeo, poleMat);
    pole.position.set(lx2, 2.6, lz2); pole.castShadow = true; group.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.6, 8), poleMat);
    arm.rotation.z = Math.PI / 2; // tapered: thin end at the lamp head
    arm.position.set(lx2 - 0.8, 5.1, lz2); group.add(arm);
    const head = new THREE.Mesh(headGeo, lampGlowMat);
    head.position.set(lx2 - 1.6, 5.05, lz2); group.add(head);
    lampPositions.push({ x: lx2 - 1.6, z: lz2 });
  }

  // palms lining the main avenue (z = 0), both sidewalks — sunset boulevard
  for (let v = -84; v <= 84; v += 24) {
    for (const pz2 of [-8.5, 8.5]) {
      let clash = false;
      for (const c of colliders) if (Math.abs(c.x - v) < c.hx + 1 && Math.abs(c.z - pz2) < c.hz + 1) { clash = true; break; }
      if (clash) continue;
      addPalm(v + randRange(rng, -1.5, 1.5), pz2, randRange(rng, 0.9, 1.15));
    }
  }

  // ---- billboards (original ads) ----
  const billboards = [
    { x: 48, z: -102.5, ry: 0, text: 'SOLMARA BAY', bg: '#28455e', fg: '#ffd23c', sub: 'the coast is calling' },
    { x: -48, z: 102.5, ry: Math.PI, text: 'VANTARA GT', bg: '#5e2a68', fg: '#f2d7ff', sub: '0–100 in 3.1s' },
    { x: 102.5, z: 0, ry: -Math.PI / 2, text: 'CAFÉ LUMA', bg: '#7a4a2e', fg: '#ffe9c4', sub: 'open all night' },
    { x: -102.5, z: -48, ry: Math.PI / 2, text: 'BAKERY SOL', bg: '#8a4a2e', fg: '#ffe9c4', sub: 'pan · bread · dawn' },
    { x: 0, z: 102.5, ry: Math.PI, text: 'NEON BAR', bg: '#2a1a3a', fg: '#ff5fa2', sub: 'drinks · music' },
    { x: 102.5, z: 48, ry: -Math.PI / 2, text: 'FISH MARKET', bg: '#2e6b6b', fg: '#dff5ef', sub: 'fresh catch daily' },
  ];
  for (const b of billboards) {
    const boardTex = signTexture(b.text, b.bg, b.fg, b.sub);
    const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.3, roughness: 0.6, side: THREE.DoubleSide });
    signMats.push({ mat: boardMat, mult: 1.2 }); // golden: 0.25 * 1.2 = 0.3 (v2 value)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), boardMat);
    board.position.set(b.x, 7.5, b.z); board.rotation.y = b.ry; group.add(board);
    const pax = Math.cos(b.ry), paz = -Math.sin(b.ry); // board width axis in world
    for (const s of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 6, 10), poleMat);
      post.position.set(b.x + pax * s, 3, b.z + paz * s); post.castShadow = true; group.add(post);
    }
  }

  // ---- parked car spots (along the main avenue + plaza edges) ----
  for (let v = -84; v <= 84; v += 24) {
    parkedSpots.push({ x: v, z: ROAD_W / 2 - 2.8, heading: 0, type: 'sedan' });
    parkedSpots.push({ x: v + 12, z: -ROAD_W / 2 + 2.8, heading: Math.PI, type: 'taxi' });
  }
  parkedSpots.push({ x: pcx + 14, z: pcz + 2, heading: Math.PI / 2, type: 'sport' }); // the Vantara GT at the plaza
  parkedSpots.push({ x: -84, z: -ROAD_W / 2 + 2.8, heading: Math.PI, type: 'truck' });

  // ---- distant skyline silhouettes beyond the district ----
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = 190 + rng() * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x < SEA_X - 40) continue; // open sea to the west
    const w = randRange(rng, 14, 26), h = randRange(rng, 22, 70);
    const m = new THREE.Mesh(boxGeo, skylineMat);
    m.scale.set(w, h, w); m.position.set(x, h / 2 - 2, z);
    group.add(m);
    const roll = rng();
    if (roll < 0.4) {
      // setback cap on top
      const cw = w * randRange(rng, 0.45, 0.65), ch = randRange(rng, 5, 12);
      const cap2 = new THREE.Mesh(boxGeo, skylineMat);
      cap2.scale.set(cw, ch, cw); cap2.position.set(x, h - 2 + ch / 2, z);
      group.add(cap2);
    } else if (roll < 0.65) {
      // spire: thin cylinder + ball tip
      const sh = randRange(rng, 8, 16);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, sh, 8), skylineMat);
      spire.position.set(x, h - 2 + sh / 2, z); group.add(spire);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), skylineMat);
      tip.position.set(x, h - 2 + sh + 1, z); group.add(tip);
    }
  }

  // ---- perimeter low wall / hedges on the land sides ----
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xa89880, roughness: 1 });
  addBox(wallMat, 2, 2.2, 210, WORLD_MAX + 2, 1.1, 0);
  addBox(wallMat, 210, 2.2, 2, 0, 1.1, WORLD_MAX + 2);
  addBox(wallMat, 210, 2.2, 2, 0, 1.1, -WORLD_MAX - 2);
  // coping: wider cap plate along each wall top
  addBox(wallMat, 2.7, 0.35, 212, WORLD_MAX + 2, 2.35, 0);
  addBox(wallMat, 212, 0.35, 2.7, 0, 2.35, WORLD_MAX + 2);
  addBox(wallMat, 212, 0.35, 2.7, 0, 2.35, -WORLD_MAX - 2);
  // pillars with pyramid caps every ~30 m
  const pillarGeo = new THREE.ConeGeometry(1.9, 1.2, 4);
  for (let v = -90; v <= 90; v += 30) {
    for (const [px3, pz3] of [[WORLD_MAX + 2, v], [v, WORLD_MAX + 2], [v, -WORLD_MAX - 2]]) {
      addBox(wallMat, 2.8, 3, 2.8, px3, 1.5, pz3);
      const cap3 = new THREE.Mesh(pillarGeo, wallMat);
      cap3.position.set(px3, 3.6, pz3); cap3.rotation.y = Math.PI / 4; cap3.castShadow = true; group.add(cap3);
    }
  }

  let beamAngle = 0;
  return {
    colliders,
    parkedSpots,
    lampPositions,
    plaza: { x: pcx, z: pcz },
    lighthouse: { x: lx, z: lz },
    setTimeOfDay,
    districtAt,
    update(dt) {
      beamAngle += dt * 0.9;
      beam.rotation.y = beamAngle;
    },
  };
}
