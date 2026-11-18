// Vehicles of Solmara Bay: original models (Kestrel S sedan, SolCab taxi, Hauler
// Bison truck, Vantara GT sport, Solmara PD cruiser) and arcade driving — responsive
// acceleration, handbrake drift, skid dust, smooth follow camera.
import * as THREE from 'three';
import { clamp, angleDiff, softDotTexture, canvasTexture } from './util.js';

export const VEHICLE_TYPES = {
  sedan: { name: 'Kestrel S', maxSpeed: 27, accel: 15, turn: 1.9, length: 4.4, width: 1.9, colors: [0x2e5f8a, 0x8a2e2e, 0x3a3f45, 0xc8c2b4, 0x4a6b4f] },
  taxi: { name: 'SolCab', maxSpeed: 26, accel: 14, turn: 1.9, length: 4.4, width: 1.9, colors: [0xe8a800] },
  truck: { name: 'Hauler Bison', maxSpeed: 20, accel: 10, turn: 1.4, length: 6.4, width: 2.3, colors: [0x7a4a2e, 0x4a5a68, 0x5e6b3a] },
  sport: { name: 'Vantara GT', maxSpeed: 35, accel: 19, turn: 2.2, length: 4.2, width: 2.0, colors: [0xc23b2e, 0x2e5f8a, 0xf2d7ff, 0x1c1c22] },
  police: { name: 'Solmara PD', maxSpeed: 33, accel: 17, turn: 2.1, length: 4.5, width: 1.9, colors: [0xe8e8e8] },
};

const paintMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.55 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.6 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.25, metalness: 0.9 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, emissive: 0xc22a2a, emissiveIntensity: 0.6 });

/** Build a realistic-proportioned car mesh for a type + colour. Returns {group, wheels, steerWheels}. */
export function createCarMesh(type, color) {
  const spec = VEHICLE_TYPES[type];
  const g = new THREE.Group();
  const paint = paintMat(color);
  const L = spec.length, W = spec.width;
  const bodyH = type === 'sport' ? 0.55 : type === 'truck' ? 0.9 : 0.7;
  const bodyY = type === 'sport' ? 0.42 : 0.55;
  const isTruck = type === 'truck';
  const isSport = type === 'sport';
  const wx = L * 0.32, wz = W / 2 + 0.02;

  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };
  // Half-cylinder shell, axis along Z, dome on top (theta PI/2..3PI/2 -> y >= 0
  // after rotateX). Used for wheel-arch fenders and police light lenses.
  const archGeo = (r, len, open = true) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 14, 1, open, Math.PI / 2, Math.PI);
    geo.rotateX(Math.PI / 2);
    return geo;
  };
  const fenderMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55, side: THREE.DoubleSide });
  const bodyBaseY = bodyY - bodyH / 2; // world y of the body shell bottom
  const sideX = W * 0.42 + 0.05; // half-width of the bevelled body shell side
  // Side-profile shape extruded across the width, bevelled edges -> a sculpted
  // body shell (sloped hood, beltline, rear deck) instead of a plain box.
  // pts are [x, y] in the shape plane; the mesh is centred on z = 0.
  const profileShell = (pts, depth, mat, bevel = 0.05) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
    geo.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  // sculpted lower body: side profile with sloped hood + rear deck, bevelled sides
  const prof = isTruck
    ? [[0.5 * L, 0.05 * bodyH], [0.5 * L, 0.55 * bodyH], [0.3 * L, 0.95 * bodyH], [-0.5 * L, 0.95 * bodyH], [-0.5 * L, 0.05 * bodyH]]
    : isSport
      ? [[0.5 * L, 0.04 * bodyH], [0.5 * L, 0.38 * bodyH], [0.1 * L, 0.82 * bodyH], [-0.32 * L, 0.88 * bodyH], [-0.5 * L, 0.78 * bodyH], [-0.5 * L, 0.04 * bodyH]]
      : [[0.5 * L, 0.04 * bodyH], [0.5 * L, 0.45 * bodyH], [0.18 * L, 0.9 * bodyH], [-0.3 * L, 0.95 * bodyH], [-0.5 * L, 0.85 * bodyH], [-0.5 * L, 0.04 * bodyH]];
  const bodyShell = profileShell(prof, W * 0.84, paint);
  bodyShell.position.y = bodyBaseY;
  g.add(bodyShell);
  // hood lid: thin panel hugging the sloped hood line (front edge dipped)
  if (!isTruck) {
    const hoodLen = isSport ? L * 0.34 : L * 0.27;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(hoodLen, 0.04, W * 0.88), paint);
    hood.rotation.z = -0.2;
    add(hood, L * 0.33, bodyY + 0.19 * bodyH + 0.01, 0);
  }

  // wheel-arch fenders: open half-cylinder shells curving over each wheel
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const fender = new THREE.Mesh(archGeo(0.43, 0.34), fenderMat);
    fender.position.set(sx * wx, 0.36, sz * wz);
    g.add(fender);
  }

  if (isTruck) {
    // sculpted cab: side profile with sloped front, flat roof, vertical back
    const cabProf = [[0.75, 0.02], [0.75, 0.55], [0.45, 1.08], [-0.75, 1.08], [-0.75, 0.02]];
    const cab = profileShell(cabProf, W * 0.86, paint);
    cab.position.set(L * 0.32, bodyY + 0.3, 0);
    g.add(cab);
    // sloped windshield: thin glass panel on the cab's front slope (~29 deg)
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.66, W * 0.78), glassMat);
    shield.rotation.z = 0.51;
    add(shield, L * 0.32 + 0.62, bodyY + 1.15, 0);
    // bed + curved tarp cover: half-cylinder dome, squashed flat, over the bed
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 1.0, W * 0.98), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.7, metalness: 0.2 }));
    add(cargo, -L * 0.2, bodyY + 0.7, 0);
    const domeGeo = new THREE.CylinderGeometry(W * 0.44, W * 0.44, L * 0.52, 16, 1, false, 0, Math.PI);
    domeGeo.rotateZ(Math.PI / 2); // axis along X, dome on top
    const dome = new THREE.Mesh(domeGeo, new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 0.8, side: THREE.DoubleSide }));
    dome.scale.y = 0.55;
    add(dome, -L * 0.2, bodyY + 1.2, 0);
    // truck mirrors on stalks (cab half-width = W*0.43 + bevel)
    const cabSide = W * 0.43 + 0.05;
    for (const sz of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.2), darkMat);
      add(stalk, L * 0.32 + 0.6, bodyY + 1.05, sz * (cabSide + 0.06));
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.05), paint);
      add(mirror, L * 0.32 + 0.6, bodyY + 1.1, sz * (cabSide + 0.16));
    }
  } else {
    const cabLen = isSport ? L * 0.42 : L * 0.48;
    const cabH = isSport ? 0.45 : 0.55;
    const cabX = isSport ? -L * 0.1 : -L * 0.04;
    const cabBaseY = bodyY + bodyH / 2 - 0.03;
    // greenhouse: glass side profile — sloped windshield (~29 deg from vertical),
    // flat roof, sloped rear window — extruded across the width, bevelled
    const ghProf = [[0.5 * cabLen, 0], [0.36 * cabLen, cabH], [-0.3 * cabLen, cabH], [-0.5 * cabLen, 0]];
    const cab = profileShell(ghProf, W * 0.76, glassMat, 0.04);
    cab.position.set(cabX, cabBaseY, 0);
    g.add(cab);
    // roof plate on the flat top of the greenhouse
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabLen * 0.66, 0.06, W * 0.78), paint);
    add(roof, cabX + 0.03 * cabLen, cabBaseY + cabH + 0.03, 0);
    // side mirrors on thin stalks (greenhouse half-width = W*0.38 + bevel)
    const cabSide = W * 0.38 + 0.04;
    for (const sz of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.16), darkMat);
      add(stalk, cabX + cabLen / 2 - 0.12, cabBaseY + cabH / 2 - 0.12, sz * (cabSide + 0.06));
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.05), paint);
      add(mirror, cabX + cabLen / 2 - 0.12, cabBaseY + cabH / 2 - 0.08, sz * (cabSide + 0.15));
    }
    // door seams (thin dark vertical insets) + side skirts, on the shell side
    for (const sz of [-1, 1]) {
      for (const dx of [-0.55, 0.45]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.02), darkMat);
        seam.position.set(cabX + dx, bodyY + 0.02, sz * (sideX + 0.006));
        g.add(seam);
      }
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 0.1, 0.05), darkMat);
      add(skirt, -L * 0.03, bodyY - bodyH / 2 + 0.03, sz * (sideX + 0.005));
    }
  }

  // wheels with hubcaps (pivot children MUST stay exactly [tire, hub])
  const wheels = [], steerWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateX(Math.PI / 2);
  for (const [sx, sz, front] of [[1, 1, true], [1, -1, true], [-1, 1, false], [-1, -1, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.36, sz * wz);
    const tire = new THREE.Mesh(wheelGeo, tireMat); tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    // rim: ring + 5 spokes as children of the hub (they spin with the wheel;
    // pivot children stay exactly [tire, hub])
    const spokeGeo = new THREE.BoxGeometry(0.05, 0.2, 0.03);
    spokeGeo.translate(0, 0.1, 0);
    const rimGeo = new THREE.TorusGeometry(0.2, 0.035, 8, 20);
    for (const rz of [-0.16, 0.16]) {
      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.position.z = rz;
      hub.add(rim);
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(spokeGeo, chromeMat);
        spoke.position.z = rz;
        spoke.rotation.z = (i / 5) * Math.PI * 2;
        hub.add(spoke);
      }
    }
    pivot.add(tire, hub);
    g.add(pivot);
    wheels.push(pivot);
    if (front) steerWheels.push(pivot);
  }
  // headlights + taillights + grille + rounded bumpers
  // (body front face sits at L/2 + bevel, so lights sit proud of it)
  for (const sz of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.42), lightMat);
    hl.position.set(L / 2 + 0.06, bodyY + 0.08, sz * (W / 2 - 0.35)); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), tailMat);
    tl.position.set(-L / 2 - 0.06, bodyY + 0.08, sz * (W / 2 - 0.35)); g.add(tl);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, W * 0.5), chromeMat);
  grille.position.set(L / 2 + 0.07, bodyY - 0.12, 0); g.add(grille);
  // rounded bumpers: horizontal cylinders across the car width, not flat boxes
  const bumpGeo = new THREE.CylinderGeometry(0.09, 0.09, W * 0.98, 12);
  bumpGeo.rotateX(Math.PI / 2);
  const bumperF = new THREE.Mesh(bumpGeo, darkMat);
  add(bumperF, L / 2 + 0.02, bodyY - 0.22, 0);
  const bumperR = new THREE.Mesh(bumpGeo, darkMat);
  add(bumperR, -L / 2 - 0.02, bodyY - 0.22, 0);

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x1c1c22, emissive: 0xe8a800, emissiveIntensity: 0.7 }));
    sign.position.set(-0.1, bodyY + bodyH / 2 + 0.66, 0); g.add(sign);
    // checker band along both doors
    const checkerTex = canvasTexture(128, 16, (ctx, w, h) => {
      const cell = 16;
      for (let i = 0; i < w / cell; i++) {
        ctx.fillStyle = i % 2 ? '#111111' : '#f5f5f5';
        ctx.fillRect(i * cell, 0, cell, h);
      }
    });
    const checkerMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.6 });
    for (const sz of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.85, 0.18), checkerMat);
      band.position.set(0, bodyY + 0.05, sz * (sideX + 0.012));
      if (sz < 0) band.rotation.y = Math.PI;
      g.add(band);
    }
  }
  if (type === 'sport') {
    // bigger wing: wider blade, higher, on taller fins
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, W * 0.98), darkMat);
    add(spoiler, -L / 2 + 0.02, bodyY + 0.58, 0);
    for (const sz of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.06), darkMat);
      add(fin, -L / 2 + 0.02, bodyY + 0.38, sz * (W * 0.44));
    }
  }
  if (type === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.16, W * 0.84 + 0.12), new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.5 }));
    stripe.position.set(0, bodyY - 0.05, 0); g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 1.35), darkMat);
    bar.position.set(-0.1, bodyY + bodyH / 2 + 0.62, 0); g.add(bar);
    // half-cylinder dome lenses over the bar (red left, blue right) — oversized
    // so the flash reads at pursuit distance, not just up close
    const lensGeo = archGeo(0.16, 0.62, false);
    const red = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.set(-0.1, bodyY + bodyH / 2 + 0.69, -0.32); g.add(red);
    const blue = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.set(-0.1, bodyY + bodyH / 2 + 0.69, 0.32); g.add(blue);
    // additive glow sprite above the bar, colour-driven by the siren flash in
    // police.update — the flash halo is what reads as "police" from 40 m away
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xff2222, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.8, 2.8, 1);
    glow.position.set(-0.1, bodyY + bodyH / 2 + 1.0, 0);
    g.add(glow);
    g.userData.lightRed = red; g.userData.lightBlue = blue; g.userData.lightGlow = glow;
  }
  g.userData.spec = spec;
  return { group: g, wheels, steerWheels };
}

/** Simple dust / smoke particle pool (sprites that rise and fade). */
export class DustPool {
  constructor(scene, max = 90) {
    this.sprites = [];
    const tex = softDotTexture();
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xcbb98f, transparent: true, opacity: 0, depthWrite: false }));
      s.scale.set(1, 1, 1); s.visible = false;
      scene.add(s);
      this.sprites.push({ s, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
    }
    this.next = 0;
  }
  spawn(x, y, z, big = false) {
    const p = this.sprites[this.next]; this.next = (this.next + 1) % this.sprites.length;
    p.s.visible = true;
    p.s.position.set(x, y, z);
    p.life = 0; p.maxLife = big ? 1.1 : 0.7;
    p.vx = (Math.random() - 0.5) * 1.2; p.vy = 0.8 + Math.random() * 0.8; p.vz = (Math.random() - 0.5) * 1.2;
    const sc = big ? 1.6 + Math.random() : 0.8 + Math.random() * 0.6;
    p.s.scale.set(sc, sc, 1);
  }
  update(dt) {
    for (const p of this.sprites) {
      if (!p.s.visible) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.s.visible = false; p.s.material.opacity = 0; continue; }
      const k = p.life / p.maxLife;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.s.material.opacity = 0.45 * (1 - k);
      const sc = p.s.scale.x * (1 + dt * 1.4);
      p.s.scale.set(sc, sc, 1);
    }
  }
}

function collideCircleAABB(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = clamp(x, c.x - c.hx, c.x + c.hx);
    const cz = clamp(z, c.z - c.hz, c.z + c.hz);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) / d;
      return { x: dx * push, z: dz * push, hit: true };
    }
  }
  return { x: 0, z: 0, hit: false };
}

/** One drivable car. `driver` is 'player' | 'npc' | 'police' | 'parked'. */
export class Vehicle {
  constructor(scene, type, color, x, z, heading, driver = 'npc') {
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    const built = createCarMesh(type, color);
    this.mesh = built.group;
    this.wheels = built.wheels;
    this.steerWheels = built.steerWheels;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.driver = driver;
    this.drifting = false;
    this.stolen = false;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading; // model forward is +X; Ry(h) maps +X to (cos h, -sin h)
    scene.add(this.mesh);
  }
  get position() { return { x: this.x, z: this.z }; }
  get forward() { return { x: Math.cos(this.heading), z: -Math.sin(this.heading) }; }

  /** Arcade step. input: {throttle, brake, steer (-1..1), handbrake}. */
  update(dt, input, colliders, others, dust) {
    const s = this.spec;
    const fwd = this.forward;
    if (input.throttle > 0) this.speed += s.accel * input.throttle * dt;
    if (input.brake > 0) this.speed -= (input.brake > 0.5 ? 32 : 12) * dt * Math.sign(this.speed || 1);
    if (input.throttle === 0 && input.brake === 0) this.speed -= this.speed * 0.6 * dt; // rolling drag
    if (input.reverse) this.speed -= s.accel * 0.7 * dt;
    this.speed = clamp(this.speed, -s.maxSpeed * 0.45, s.maxSpeed);
    if (Math.abs(this.speed) < 0.05 && input.throttle === 0 && input.brake === 0) this.speed = 0;

    // steering: less bite at high speed, more when slow; handbrake = drift
    const steerTarget = clamp(input.steer, -1, 1) * s.turn * clamp(1.15 - Math.abs(this.speed) / s.maxSpeed * 0.55, 0.45, 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const grip = input.handbrake ? 0.45 : 1;
    this.heading += this.steer * clamp(this.speed / 6, -1, 1) * dt * grip;
    this.drifting = input.handbrake && Math.abs(this.speed) > 8;

    let nx = this.x + Math.cos(this.heading) * this.speed * dt;
    let nz = this.z + -Math.sin(this.heading) * this.speed * dt;
    // drift: extra sideways slide
    if (this.drifting) {
      const side = Math.PI / 2;
      nx += Math.cos(this.heading + side) * this.steer * this.speed * 0.22 * dt;
      nz += -Math.sin(this.heading + side) * this.steer * this.speed * 0.22 * dt;
      if (dust && Math.random() < 0.6) dust.spawn(nx - Math.cos(this.heading) * 1.4, 0.3, nz + Math.sin(this.heading) * 1.4);
    }
    // world bounds + building collision
    nx = clamp(nx, -100, 100); nz = clamp(nz, -100, 100);
    const hit = collideCircleAABB(nx, nz, s.length * 0.42, colliders);
    if (hit.hit) {
      nx += hit.x; nz += hit.z;
      if (Math.abs(this.speed) > 6) {
        this.speed *= 0.55;
        if (dust) { dust.spawn(nx, 0.5, nz, true); dust.spawn(nx, 0.5, nz, true); }
      } else this.speed *= 0.8;
    }
    // soft car-car push
    for (const o of others) {
      if (o === this) continue;
      const dx = nx - o.x, dz = nz - o.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const min = (s.length + o.spec.length) * 0.38;
      if (d > 0.01 && d < min) {
        const push = (min - d) * 0.5;
        nx += (dx / d) * push; nz += (dz / d) * push;
        this.speed *= 0.92;
      }
    }
    this.x = nx; this.z = nz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // body roll + pitch for feel
    this.mesh.rotation.z = -this.steer * 0.05 * clamp(Math.abs(this.speed) / 10, 0, 1);
    this.mesh.rotation.x = clamp(-this.speed * 0.0012, -0.03, 0.03);
    for (const w of this.wheels) w.rotation.y = 0;
    for (const w of this.steerWheels) w.rotation.y = -this.steer * 0.42;
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.wheels) { w.children[0].rotation.z -= spin; w.children[1].rotation.z -= spin; }
    return hit.hit;
  }

  /** Simple autopilot: steer toward a target point (used by police + courier). */
  chaseInput(tx, tz, maxSpeedMul = 1) {
    const dx = tx - this.x, dz = tz - this.z;
    const want = Math.atan2(-dz, dx);
    const diff = angleDiff(this.heading, want);
    return {
      throttle: Math.abs(diff) < 1.2 ? 1 : 0.3,
      brake: 0,
      steer: clamp(diff * 1.6, -1, 1),
      handbrake: false,
      reverse: false,
      _mul: maxSpeedMul,
    };
  }
}
