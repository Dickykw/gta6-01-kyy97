// Traffic and pedestrians of Solmara Bay: NPC cars drive closed waypoint loops on
// the road grid (right-hand lanes, stop for the car ahead); pedestrians walk the
// sidewalks with varied clothes, speed and behaviour — never clones.
import * as THREE from 'three';
import { mulberry32, randRange, randInt, pick, clamp, angleLerp, angleDiff, ROAD_CENTERS, ROAD_W, blockSpan } from './util.js';
import { Vehicle, VEHICLE_TYPES } from './vehicle.js';
import { createPlayerMesh } from './player.js';

const SHIRTS = [0xd95f4b, 0x4b7fd9, 0x5fae5f, 0xe8c33c, 0x9a5fd9, 0xefefef, 0x2e3a45, 0xd98a4b, 0x6ec6c6, 0xc64b7a];
const PANTS = [0x33455e, 0x2e2a26, 0x5a5a5a, 0x7a6a4a, 0x3a3f45];
const SKINS = [0xc98e6a, 0x8a5a3c, 0xe8b98a, 0x6b4226, 0xd9a077];

/** Rectangular loop around one block, on the road, right-hand lane offset. */
function loopWaypoints(bx, bz, dir) {
  const s = blockSpan(bx), t = blockSpan(bz);
  const cx = (s.lo + s.hi) / 2, cz = (t.lo + t.hi) / 2;
  const hx = (s.hi - s.lo) / 2 + ROAD_W / 2;
  const hz = (t.hi - t.lo) / 2 + ROAD_W / 2;
  const lane = 3; // right-hand offset from road centre
  const pts = [
    { x: cx - hx, z: cz - hz + lane },
    { x: cx + hx, z: cz - hz + lane },
    { x: cx + hx - lane, z: cz - hz },
    { x: cx + hx - lane, z: cz + hz },
    { x: cx + hx, z: cz + hz - lane },
    { x: cx - hx, z: cz + hz - lane },
    { x: cx - hx + lane, z: cz + hz },
    { x: cx - hx + lane, z: cz - hz },
  ];
  return dir > 0 ? pts : pts.reverse();
}

export class Traffic {
  constructor(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(seed);
    this.cars = [];
    this.peds = [];
    this._buildCars();
    this._buildPeds();
  }

  _buildCars() {
    const rng = this.rng;
    const types = ['sedan', 'sedan', 'taxi', 'sedan', 'sport', 'taxi', 'truck', 'sedan'];
    for (let i = 0; i < 10; i++) {
      const bx = randInt(rng, 0, 3), bz = randInt(rng, 0, 3);
      if (bx === 1 && bz === 1) continue; // plaza has no road loop
      const type = types[i % types.length];
      const color = pick(rng, VEHICLE_TYPES[type].colors);
      const loop = loopWaypoints(bx, bz, rng() < 0.5 ? 1 : -1);
      const start = loop[randInt(rng, 0, loop.length - 1)];
      const v = new Vehicle(this.scene, type, color, start.x, start.z, 0, 'npc');
      v.loop = loop;
      v.wp = 0;
      v.cruise = randRange(rng, 7, 11);
      this.cars.push(v);
    }
  }

  _buildPeds() {
    const rng = this.rng;
    for (let i = 0; i < 24; i++) {
      const bx = randInt(rng, 0, 3), bz = randInt(rng, 0, 3);
      const s = blockSpan(bx), t = blockSpan(bz);
      // sidewalk rectangle just outside the block
      const hx = (s.hi - s.lo) / 2 + 2, hz = (t.hi - t.lo) / 2 + 2;
      const cx = (s.lo + s.hi) / 2, cz = (t.lo + t.hi) / 2;
      const built = createPlayerMesh();
      // recolour clothes
      built.group.traverse((m) => {
        if (m.isMesh && m.material && m.material.color) {
          if (m.material.color.getHex() === 0x2e4a5e) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 });
          if (m.material.color.getHex() === 0x33455e) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
          if (m.material.color.getHex() === 0xc98e6a) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, SKINS), roughness: 0.75 });
        }
      });
      const scale = randRange(rng, 0.92, 1.06);
      built.group.scale.setScalar(scale);
      const px = cx + randRange(rng, -hx, hx);
      const pz = cz + (rng() < 0.5 ? -hz : hz);
      built.group.position.set(px, 0, pz);
      this.scene.add(built.group);
      this.peds.push({
        mesh: built, parts: built,
        x: px, z: pz, cx, cz, hx, hz,
        heading: randRange(rng, 0, Math.PI * 2),
        speed: randRange(rng, 0.8, 1.6),
        walkPhase: randRange(rng, 0, 6),
        state: 'walk',
        fleeTimer: 0,
        fleeFrom: null,
        clockwise: rng() < 0.5,
        down: false, downTimer: 0,
        idleTimer: randRange(rng, 0, 8),
      });
    }
  }

  /** Pedestrians near (x,z) flee from a gunshot. */
  scare(x, z, radius = 16) {
    for (const p of this.peds) {
      if (p.down) continue;
      const dx = p.x - x, dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        p.state = 'flee'; p.fleeTimer = 3;
        p.fleeFrom = { x, z };
      }
    }
  }

  /** Knock a pedestrian down (they get up after a while and walk off). */
  knockDown(p) {
    if (p.down) return;
    p.down = true; p.downTimer = 4;
    p.mesh.group.rotation.x = -Math.PI / 2;
    p.mesh.group.position.y = 0.25;
  }

  update(dt, colliders, playerPos, playerCar) {
    // ---- NPC cars on loops ----
    const allCars = this.cars;
    for (const v of this.cars) {
      const wp = v.loop[v.wp];
      const dx = wp.x - v.x, dz = wp.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < 3) v.wp = (v.wp + 1) % v.loop.length;
      const want = Math.atan2(-dz, dx);
      const diff = angleDiff(v.heading, want);
      // stop if a car (or the player car) is close ahead
      let blocked = false;
      for (const o of allCars) {
        if (o === v) continue;
        const ox = o.x - v.x, oz = o.z - v.z;
        const ahead = ox * Math.cos(v.heading) + oz * -Math.sin(v.heading);
        const side = Math.abs(ox * Math.sin(v.heading) + oz * Math.cos(v.heading));
        if (ahead > 0 && ahead < 9 && side < 2.6) { blocked = true; break; }
      }
      if (playerCar) {
        const ox = playerCar.x - v.x, oz = playerCar.z - v.z;
        const ahead = ox * Math.cos(v.heading) + oz * -Math.sin(v.heading);
        const side = Math.abs(ox * Math.sin(v.heading) + oz * Math.cos(v.heading));
        if (ahead > 0 && ahead < 9 && side < 2.6) blocked = true;
      }
      const input = {
        throttle: blocked ? 0 : 1,
        brake: blocked ? 1 : 0,
        steer: clamp(diff * 1.8, -1, 1),
        handbrake: false,
        reverse: false,
      };
      v.speed = clamp(v.speed, 0, v.cruise);
      v.update(dt, input, colliders, allCars, null);
      // loop cars never reverse: keep a floor on forward speed when unblocked
      if (!blocked && v.speed < 2) v.speed = 2;
    }
    // ---- pedestrians ----
    for (const p of this.peds) {
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.down = false;
          p.mesh.group.rotation.x = 0;
          p.mesh.group.position.y = 0;
          p.state = 'flee'; p.fleeTimer = 2; p.fleeFrom = { x: playerPos.x, z: playerPos.z };
        }
        continue;
      }
      let speed = p.speed;
      if (p.state === 'flee') {
        p.fleeTimer -= dt;
        speed = 3.4;
        if (p.fleeFrom) {
          const dx = p.x - p.fleeFrom.x, dz = p.z - p.fleeFrom.z;
          p.heading = angleLerp(p.heading, Math.atan2(-dz, dx), Math.min(1, dt * 6));
        }
        if (p.fleeTimer <= 0) p.state = 'walk';
      } else if (p.state === 'idle') {
        p.idleTimer -= dt;
        if (p.idleTimer <= 0) { p.state = 'walk'; p.idleTimer = randRange(this.rng, 4, 12); }
        p.parts.legL.rotation.x *= 0.9; p.parts.legR.rotation.x *= 0.9;
        p.parts.armL.rotation.x *= 0.9; p.parts.armR.rotation.x *= 0.9;
        continue;
      } else {
        // walk the sidewalk rectangle: head to the next corner, then the next
        const corners = [
          { x: p.cx - p.hx, z: p.cz - p.hz }, { x: p.cx + p.hx, z: p.cz - p.hz },
          { x: p.cx + p.hx, z: p.cz + p.hz }, { x: p.cx - p.hx, z: p.cz + p.hz },
        ];
        if (p.targetCorner === undefined) {
          let best = 0, bd = 1e9;
          for (let i = 0; i < 4; i++) {
            const d = Math.hypot(corners[i].x - p.x, corners[i].z - p.z);
            if (d < bd) { bd = d; best = i; }
          }
          p.targetCorner = best;
        }
        const target = corners[p.targetCorner];
        const dx = target.x - p.x, dz = target.z - p.z;
        if (Math.hypot(dx, dz) < 1.5) {
          p.targetCorner = (p.targetCorner + (p.clockwise === false ? 3 : 1)) % 4;
          if (Math.random() < 0.06) { p.state = 'idle'; p.idleTimer = randRange(this.rng, 2, 6); continue; }
        }
        p.heading = angleLerp(p.heading, Math.atan2(-dz, dx), Math.min(1, dt * 4));
      }
      p.x += Math.cos(p.heading) * speed * dt;
      p.z += -Math.sin(p.heading) * speed * dt;
      p.x = clamp(p.x, -100, 100); p.z = clamp(p.z, -100, 100);
      p.walkPhase += dt * speed * 2.4;
      const swing = Math.sin(p.walkPhase) * 0.55;
      p.parts.legL.rotation.x = swing; p.parts.legR.rotation.x = -swing;
      p.parts.armL.rotation.x = -swing * 0.8; p.parts.armR.rotation.x = swing * 0.8;
      p.mesh.group.position.set(p.x, 0, p.z);
      p.mesh.group.rotation.y = p.heading + Math.PI / 2;
    }
  }
}
