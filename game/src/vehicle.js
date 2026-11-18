// Vehicles of Solmara Bay: original models (Kestrel S sedan, SolCab taxi, Hauler
// Bison truck, Vantara GT sport, Solmara PD cruiser) and arcade driving — responsive
// acceleration, handbrake drift, skid dust, smooth follow camera.
import * as THREE from 'three';
import { clamp, angleDiff, softDotTexture } from './util.js';

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

  const body = new THREE.Mesh(new THREE.BoxGeometry(L, bodyH, W), paint);
  body.position.y = bodyY; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  // hood / trunk shaping: a lower front nose box
  const nose = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, bodyH * 0.7, W * 0.96), paint);
  nose.position.set(L * 0.5, bodyY - 0.05, 0); nose.castShadow = true; g.add(nose);

  if (type === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, W * 0.94), paint);
    cab.position.set(L * 0.32, bodyY + 0.85, 0); cab.castShadow = true; g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, W * 0.8), glassMat);
    shield.position.set(L * 0.32 + 0.72, bodyY + 0.85, 0); g.add(shield);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 1.5, W * 0.98), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.7, metalness: 0.2 }));
    cargo.position.set(-L * 0.2, bodyY + 0.95, 0); cargo.castShadow = true; g.add(cargo);
  } else {
    const cabLen = type === 'sport' ? L * 0.42 : L * 0.48;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabLen, 0.55, W * 0.86), glassMat);
    cab.position.set(type === 'sport' ? -L * 0.06 : -L * 0.04, bodyY + bodyH / 2 + 0.24, 0);
    cab.castShadow = true; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabLen * 0.92, 0.08, W * 0.8), paint);
    roof.position.set(cab.position.x, bodyY + bodyH / 2 + 0.55, 0); g.add(roof);
  }

  // wheels with hubcaps
  const wheels = [], steerWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateX(Math.PI / 2);
  const wx = L * 0.32, wz = W / 2 + 0.02;
  for (const [sx, sz, front] of [[1, 1, true], [1, -1, true], [-1, 1, false], [-1, -1, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.36, sz * wz);
    const tire = new THREE.Mesh(wheelGeo, tireMat); tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    pivot.add(tire, hub);
    g.add(pivot);
    wheels.push(pivot);
    if (front) steerWheels.push(pivot);
  }
  // headlights + taillights + grille + bumpers
  for (const sz of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.42), lightMat);
    hl.position.set(L / 2 + 0.02, bodyY + 0.08, sz * (W / 2 - 0.35)); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), tailMat);
    tl.position.set(-L / 2 - 0.02, bodyY + 0.08, sz * (W / 2 - 0.35)); g.add(tl);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, W * 0.5), chromeMat);
  grille.position.set(L / 2 + 0.03, bodyY - 0.12, 0); g.add(grille);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, W), darkMat);
  bumperF.position.set(L / 2 - 0.02, bodyY - 0.22, 0); g.add(bumperF);
  const bumperR = bumperF.clone(); bumperR.position.x = -L / 2 + 0.02; g.add(bumperR);

  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x1c1c22, emissive: 0xe8a800, emissiveIntensity: 0.7 }));
    sign.position.set(-0.1, bodyY + bodyH / 2 + 0.66, 0); g.add(sign);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x1c1c22 }));
    door.position.set(0.2, bodyY, W / 2 + 0.01); g.add(door);
  }
  if (type === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, W * 0.9), darkMat);
    spoiler.position.set(-L / 2 + 0.05, bodyY + 0.42, 0); g.add(spoiler);
    for (const sz of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.06), darkMat);
      fin.position.set(-L / 2 + 0.05, bodyY + 0.26, sz * (W * 0.42)); g.add(fin);
    }
  }
  if (type === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.98, 0.16, W + 0.02), new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.5 }));
    stripe.position.set(0, bodyY - 0.05, 0); g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.1), darkMat);
    bar.position.set(-0.1, bodyY + bodyH / 2 + 0.62, 0); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.set(-0.1, bodyY + bodyH / 2 + 0.62, -0.28); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.set(-0.1, bodyY + bodyH / 2 + 0.62, 0.28); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
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
