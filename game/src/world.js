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
    // block interiors: slightly varied warm tones
    const blockTones = ['#a89a86', '#b09d88', '#a3967f', '#b3a28c'];
    let bi = 0;
    for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
      const s = blockSpan(bx), t = blockSpan(bz);
      g.fillStyle = blockTones[bi++ % blockTones.length];
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
];

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

  // ---- sky dome (warm sunset gradient) + sun disc + clouds ----
  const skyTex = canvasTexture(1024, 512, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#6fb3dd');
    grad.addColorStop(0.45, '#a8d3e8');
    grad.addColorStop(0.72, '#ffd9a0');
    grad.addColorStop(0.88, '#ffb37a');
    grad.addColorStop(1, '#f2a06a');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 14; i++) {
      const cx = rng() * W, cy = 40 + rng() * 160, w = 60 + rng() * 140;
      g.beginPath(); g.ellipse(cx, cy, w, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    }
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, transparent: true, opacity: 0.95 }),
  );
  sun.position.set(-420, 95, -60); sun.lookAt(0, 60, 0);
  group.add(sun);
  scene.fog = new THREE.Fog(0xf2c491, 180, 520);

  // ---- lighting ----
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x8a6f52, 0.75);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffe3b3, 2.4);
  sunLight.position.set(-160, 140, 60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 500;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffe8cc, 0.25));

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

  function addBox(mat, w, h, d, x, y, z, ry = 0, shadow = true) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = shadow; m.receiveShadow = true;
    group.add(m); return m;
  }
  function addCollider(x, z, hx, hz) { colliders.push({ x, z, hx, hz }); }

  // ---- buildings ----
  const plazaBlock = { bx: 1, bz: 1 };
  const parkBlock = { bx: 3, bz: 0 };
  for (let bx = 0; bx < 4; bx++) for (let bz = 0; bz < 4; bz++) {
    if (bx === plazaBlock.bx && bz === plazaBlock.bz) continue;
    if (bx === parkBlock.bx && bz === parkBlock.bz) continue;
    const s = blockSpan(bx), t = blockSpan(bz);
    const n = randInt(rng, 2, 4);
    for (let i = 0; i < n; i++) {
      const typeIdx = Math.floor(rng() * BUILDING_TYPES.length);
      const type = BUILDING_TYPES[typeIdx];
      const w = randRange(rng, 9, 14), d = randRange(rng, 9, 14);
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
      const b = addBox(mat, w, h, d, cx, h / 2, cz);
      b.material = mat;
      // parapet roof + rooftop props
      addBox(i % 2 ? roofMat : roofMat2, w + 0.4, 0.5, d + 0.4, cx, h + 0.25, cz);
      if (rng() < 0.7) addBox(acMat, 1.6, 0.9, 1.2, cx + randRange(rng, -w / 4, w / 4), h + 0.9, cz + randRange(rng, -d / 4, d / 4));
      if (rng() < 0.35) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), acMat);
        tank.position.set(cx - w / 4, h + 1.4, cz - d / 4); tank.castShadow = true; group.add(tank);
      }
      // ground-floor shop front + sign on some buildings
      if (type.kind === 'shop' || rng() < 0.3) {
        const sign = pick(rng, SHOP_SIGNS);
        const sm = new THREE.Mesh(
          new THREE.PlaneGeometry(7, 1.75),
          new THREE.MeshStandardMaterial({ map: signTexture(sign[0], sign[1], sign[2], sign[3]), emissive: 0xffffff, emissiveMap: signTexture(sign[0], sign[1], sign[2], sign[3]), emissiveIntensity: 0.25, roughness: 0.6 }),
        );
        sm.position.set(cx, 3.4, cz + d / 2 + 0.06);
        group.add(sm);
        addBox(new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.8 }), w * 0.8, 0.35, 1.2, cx, 2.9, cz + d / 2 + 0.3);
      }
      addCollider(cx, cz, w / 2, d / 2);
    }
  }

  // ---- Plaza Mar clock tower (landmark, centre of plaza block) ----
  const plaza = blockSpan(1);
  const pcx = (plaza.lo + plaza.hi) / 2, pcz = (plaza.lo + plaza.hi) / 2;
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.85 });
  addBox(towerMat, 6, 20, 6, pcx, 10, pcz);
  const clockTex = clockTexture();
  for (const [dx, dz, ry] of [[0, 3.06, 0], [0, -3.06, Math.PI], [3.06, 0, Math.PI / 2], [-3.06, 0, -Math.PI / 2]]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 }));
    face.position.set(pcx + dx, 15.5, pcz + dz); face.rotation.y = ry; group.add(face);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 4.4, 4), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 }));
  roof.position.set(pcx, 22.2, pcz); roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xff5f6d, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(pcx + 1.2, 25.5, pcz); group.add(flag);
  addCollider(pcx, pcz, 3.2, 3.2);
  // plaza benches + bollards
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx2 = pcx + Math.cos(a) * 12, bz2 = pcz + Math.sin(a) * 12;
    addBox(benchMat, 2.4, 0.35, 0.8, bx2, 0.55, bz2, -a);
    addBox(poleMat, 0.25, 0.5, 0.25, bx2 - 1, 0.25, bz2);
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
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }),
  );
  lampRoom.position.set(lx, 28.4, lz); group.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x2e3438, roughness: 0.6 }));
  cap.position.set(lx, 31, lz); group.add(cap);
  // rotating beam (additive cone)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 12, 1, true), beamMat);
  beam.position.set(lx, 28.4, lz);
  beam.rotation.z = Math.PI / 2;
  beam.geometry.translate(0, 17, 0);
  group.add(beam);
  addCollider(lx, lz, 3.6, 3.6);
  // beach palms near the lighthouse
  for (let i = 0; i < 5; i++) {
    const px2 = SEA_X - 4 - rng() * 8, pz2 = -84 + i * 12 + rng() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.5, 8), trunkMat);
    trunk.position.set(px2, 2.75, pz2); trunk.rotation.z = 0.12; trunk.castShadow = true; group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 6), leafMats[i % 3]);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(px2 + Math.cos(a) * 1.4, 5.6, pz2 + Math.sin(a) * 1.4);
      frond.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9);
      group.add(frond);
    }
  }

  // ---- park block: trees, benches, fountain ----
  const pk = blockSpan(3), pr = blockSpan(0);
  const pkx = (pk.lo + pk.hi) / 2, pkz = (pr.lo + pr.hi) / 2;
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 1, 20), new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.8 }));
  fountain.position.set(pkx, 0.5, pkz); fountain.castShadow = true; group.add(fountain);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4, 20), new THREE.MeshStandardMaterial({ color: 0x4fb8c8, roughness: 0.15, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(pkx, 1.05, pkz); group.add(water);
  addCollider(pkx, pkz, 5, 5);
  for (let i = 0; i < 10; i++) {
    const tx = randRange(rng, pk.lo + 3, pk.hi - 3), tz = randRange(rng, pr.lo + 3, pr.hi - 3);
    if (Math.abs(tx - pkx) < 7 && Math.abs(tz - pkz) < 7) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 8), trunkMat);
    trunk.position.set(tx, 1.3, tz); trunk.castShadow = true; group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 1.6, 2.4), 10, 8), pick(rng, leafMats));
    crown.position.set(tx, 3.6, tz); crown.castShadow = true; group.add(crown);
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
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 8), trunkMat);
      trunk.position.set(tx, 1.1, tz); trunk.castShadow = true; group.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 1.3, 1.9), 10, 8), pick(rng, leafMats));
      crown.position.set(tx, 3, tz); crown.castShadow = true; group.add(crown);
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
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
    arm.position.set(lx2 - 0.8, 5.1, lz2); group.add(arm);
    const head = new THREE.Mesh(headGeo, lampGlowMat);
    head.position.set(lx2 - 1.6, 5.05, lz2); group.add(head);
    lampPositions.push({ x: lx2 - 1.6, z: lz2 });
  }

  // ---- billboards (original ads) ----
  const billboards = [
    { x: 48, z: -102.5, ry: 0, text: 'SOLMARA BAY', bg: '#28455e', fg: '#ffd23c', sub: 'the coast is calling' },
    { x: -48, z: 102.5, ry: Math.PI, text: 'VANTARA GT', bg: '#5e2a68', fg: '#f2d7ff', sub: '0–100 in 3.1s' },
    { x: 102.5, z: 0, ry: -Math.PI / 2, text: 'CAFÉ LUMA', bg: '#7a4a2e', fg: '#ffe9c4', sub: 'open all night' },
  ];
  for (const b of billboards) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.5),
      new THREE.MeshStandardMaterial({ map: signTexture(b.text, b.bg, b.fg, b.sub), emissive: 0xffffff, emissiveMap: signTexture(b.text, b.bg, b.fg, b.sub), emissiveIntensity: 0.3, roughness: 0.6, side: THREE.DoubleSide }),
    );
    board.position.set(b.x, 7.5, b.z); board.rotation.y = b.ry; group.add(board);
    addBox(poleMat, 0.5, 6, 0.5, b.x, 3, b.z);
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
  }

  // ---- perimeter low wall / hedges on the land sides ----
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xa89880, roughness: 1 });
  addBox(wallMat, 2, 2.2, 210, WORLD_MAX + 2, 1.1, 0);
  addBox(wallMat, 210, 2.2, 2, 0, 1.1, WORLD_MAX + 2);
  addBox(wallMat, 210, 2.2, 2, 0, 1.1, -WORLD_MAX - 2);

  let beamAngle = 0;
  return {
    colliders,
    parkedSpots,
    lampPositions,
    plaza: { x: pcx, z: pcz },
    lighthouse: { x: lx, z: lz },
    update(dt) {
      beamAngle += dt * 0.9;
      beam.rotation.y = beamAngle;
    },
  };
}
