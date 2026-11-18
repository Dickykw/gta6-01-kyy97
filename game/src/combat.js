// Combat: hitscan pistol with raycast, muzzle flash, tracer, impact particles,
// screen shake and consequences — targets react (pedestrians fall/flee, drivers
// swerve, police raise wanted).
import * as THREE from 'three';
import { softDotTexture } from './util.js';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
    this.shake = 0;
    this.weapon = 'Pistol'; // the only firearm; second slot is bare hands
    this.ammo = 48; // live rounds for the pistol
    this.ammoReserve = 96;
    this.flash = new THREE.PointLight(0xffc860, 0, 14);
    this.scene.add(this.flash);
    // tracer line (reused, fades fast)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
    this.tracerLife = 0;
    // impact particles (small sprite pool)
    this.particles = [];
    const tex = softDotTexture();
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.particles.push({ s, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    this.nextP = 0;
  }

  _burst(x, y, z, color = 0xffd76a, n = 6) {
    for (let i = 0; i < n; i++) {
      const p = this.particles[this.nextP]; this.nextP = (this.nextP + 1) % this.particles.length;
      p.s.visible = true;
      p.s.material.color.setHex(color);
      p.s.position.set(x, y, z);
      p.s.material.opacity = 1;
      p.s.scale.set(0.5, 0.5, 1);
      p.life = 0;
      p.vx = (Math.random() - 0.5) * 6; p.vy = Math.random() * 4 + 1; p.vz = (Math.random() - 0.5) * 6;
    }
  }

  get canShoot() { return this.cooldown <= 0; }

  /** Fire from the camera through the crosshair. Returns a hit description or null. */
  shoot(game) {
    if (this.cooldown > 0) return null;
    if (this.ammo <= 0) {
      // auto-reload from reserve when the magazine is empty
      if (this.ammoReserve > 0) {
        const take = Math.min(12, this.ammoReserve);
        this.ammoReserve -= take; this.ammo += take;
        this.cooldown = 0.6;
        game.audio && game.audio.click();
        return null;
      }
      return null;
    }
    this.ammo -= 1;
    this.cooldown = 0.28;
    this.shake = Math.max(this.shake, 0.35);
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(origin, dir);
    // sprites in the targets (police light-bar glow) need the camera for their
    // raycast — without it Sprite.raycast throws reading camera.matrixWorld
    this.raycaster.camera = this.camera;
    this.raycaster.far = 90;

    // muzzle flash at the camera + tracer to the hit point
    const muzzle = origin.clone().add(dir.clone().multiplyScalar(1.2));
    muzzle.y -= 0.15;
    this.flash.position.copy(muzzle);
    this.flash.intensity = 26;
    setTimeout(() => { this.flash.intensity = 0; }, 60);

    // collect shootable meshes: pedestrians, cars, buildings (world colliders are boxes)
    const targets = [];
    for (const ped of game.traffic.peds) {
      if (!ped.down) targets.push({ obj: ped.mesh.group, kind: 'ped', ref: ped });
    }
    for (const v of game.allVehicles) targets.push({ obj: v.mesh, kind: 'car', ref: v });
    const hits = this.raycaster.intersectObjects(targets.map((t) => t.obj), true);
    let end = origin.clone().add(dir.clone().multiplyScalar(90));
    let result = null;
    if (hits.length > 0) {
      const h = hits[0];
      end = h.point.clone();
      let root = h.object;
      while (root.parent && root.parent !== this.scene) root = root.parent;
      const t = targets.find((x) => x.obj === root || x.obj === h.object);
      if (t) {
        if (t.kind === 'ped') {
          this._burst(end.x, end.y + 0.4, end.z, 0xff6a5a, 8);
          game.traffic.knockDown(t.ref);
          game.traffic.scare(end.x, end.z, 20);
          result = { kind: 'ped', point: end };
        } else {
          this._burst(end.x, end.y, end.z, 0xffd76a, 7);
          t.ref.speed = Math.max(t.ref.speed, 10);
          t.ref.heading += (Math.random() - 0.5) * 0.3; // swerve
          result = { kind: 'car', point: end, police: t.ref.type === 'police' };
        }
      }
    } else {
      // hit the world: spark where the ray meets the ground plane
      const t = -origin.y / dir.y;
      if (t > 0 && t < 90) {
        end = origin.clone().add(dir.clone().multiplyScalar(t));
        this._burst(end.x, 0.3, end.z, 0xcfd8dc, 5);
        result = { kind: 'ground', point: end };
      }
    }
    // tracer
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    this.tracer.material.opacity = 0.9;
    this.tracerLife = 0.08;
    game.audio && game.audio.gunshot();
    return result;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0) this.tracer.material.opacity = 0;
    }
    for (const p of this.particles) {
      if (!p.s.visible) continue;
      p.life += dt;
      if (p.life > 0.5) { p.s.visible = false; continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.vy -= 9 * dt;
      p.s.material.opacity = 1 - p.life / 0.5;
    }
  }

  /** Apply the current shake to the camera (call after lookAt). */
  applyShake(camera) {
    if (this.shake <= 0) return;
    const s = this.shake * 0.12;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.2;
  }
}
