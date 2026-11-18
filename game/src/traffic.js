// Traffic and pedestrians of Solmara Bay: NPC cars drive closed waypoint loops on
// the road grid (right-hand lanes, stop for the car ahead); pedestrians walk the
// sidewalks with varied clothes, speed and behaviour — never clones.
import * as THREE from 'three';
import { mulberry32, randRange, randInt, pick, clamp, angleLerp, angleDiff, ROAD_CENTERS, ROAD_W, blockSpan } from './util.js';
import { Vehicle, VEHICLE_TYPES } from './vehicle.js';
import { createPlayerMesh } from './player.js';

const SHIRTS = [0xd95f4b, 0x4b7fd9, 0x5fae5f, 0xe8c33c, 0x9a5fd9, 0xefefef, 0x2e3a45, 0xd98a4b, 0x6ec6c6, 0xc64b7a, 0x2e8a6b, 0xe86a9a, 0x4a2e6b, 0x8a6b2e, 0x3a7a8a, 0xd94f30];
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
    const types = ['sedan', 'sedan', 'taxi', 'van', 'sport', 'bus', 'taxi', 'truck', 'sedan', 'pickup', 'van', 'sedan', 'bus', 'taxi'];
    let i = 0;
    while (this.cars.length < 14) {
      const bx = randInt(rng, 0, 3), bz = randInt(rng, 0, 3);
      if (bx === 1 && bz === 1) continue; // plaza has no road loop — retry another block
      const type = types[i % types.length];
      const color = pick(rng, VEHICLE_TYPES[type].colors);
      const loop = loopWaypoints(bx, bz, rng() < 0.5 ? 1 : -1);
      const start = loop[randInt(rng, 0, loop.length - 1)];
      const v = new Vehicle(this.scene, type, color, start.x, start.z, 0, 'npc');
      v.loop = loop;
      v.wp = 0;
      // cruise varies by type: bus slow, sport fast, the rest mid-range
      v.cruise = type === 'bus' ? randRange(rng, 6, 8) : type === 'sport' ? randRange(rng, 10, 12) : randRange(rng, 7, 11);
      this.cars.push(v);
      i++;
    }
  }

  _buildPeds() {
    const rng = this.rng;
    // One pedestrian (or one pair member) at a fixed spot with shared walk params.
    const spawnPed = (px, pz, cx, cz, hx, hz, heading, speed, clockwise, targetCorner, state, idleTimer) => {
      const built = createPlayerMesh();
      // recolour clothes
      built.group.traverse((m) => {
        if (m.isMesh && m.material && m.material.color) {
          if (m.material.color.getHex() === 0x2e4a5e) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 });
          if (m.material.color.getHex() === 0x33455e) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, PANTS), roughness: 0.9 });
          if (m.material.color.getHex() === 0xc98e6a) m.material = new THREE.MeshStandardMaterial({ color: pick(rng, SKINS), roughness: 0.75 });
        }
      });
      // independent width / height scale — bodies differ in build, not just size
      const sx = randRange(rng, 0.9, 1.15), sy = randRange(rng, 0.9, 1.1);
      built.group.scale.set(sx, sy, sx);
      built.group.position.set(px, 0, pz);
      this.scene.add(built.group);
      this.peds.push({
        mesh: built, parts: built,
        x: px, z: pz, cx, cz, hx, hz,
        heading, speed,
        walkPhase: randRange(rng, 0, 6),
        state,
        fleeTimer: 0,
        fleeFrom: null,
        clockwise,
        targetCorner,
        down: false, downTimer: 0,
        idleTimer,
      });
    };
    // nearest sidewalk corner to (px, pz) on the rectangle around (cx, cz)
    const nearestCorner = (px, pz, cx, cz, hx, hz) => {
      const corners = [
        { x: cx - hx, z: cz - hz }, { x: cx + hx, z: cz - hz },
        { x: cx + hx, z: cz + hz }, { x: cx - hx, z: cz + hz },
      ];
      let best = 0, bd = 1e9;
      for (let i = 0; i < 4; i++) {
        const d = Math.hypot(corners[i].x - px, corners[i].z - pz);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };

    // 36 walking pedestrians; ~30% spawn in pairs sharing heading, speed,
    // direction and target corner, walking 1.2 m apart (side by side).
    let spawned = 0;
    while (spawned < 36) {
      const pair = spawned + 1 < 36 && rng() < 0.3;
      const bx = randInt(rng, 0, 3), bz = randInt(rng, 0, 3);
      const s = blockSpan(bx), t = blockSpan(bz);
      // sidewalk rectangle just outside the block
      const hx = (s.hi - s.lo) / 2 + 2, hz = (t.hi - t.lo) / 2 + 2;
      const cx = (s.lo + s.hi) / 2, cz = (t.lo + t.hi) / 2;
      const px = cx + randRange(rng, -hx, hx);
      const pz = cz + (rng() < 0.5 ? -hz : hz);
      const heading = randRange(rng, 0, Math.PI * 2);
      const speed = randRange(rng, 0.8, 1.6);
      const clockwise = rng() < 0.5;
      const targetCorner = nearestCorner(px, pz, cx, cz, hx, hz);
      const idleTimer = randRange(rng, 0, 8);
      spawnPed(px, pz, cx, cz, hx, hz, heading, speed, clockwise, targetCorner, 'walk', idleTimer);
      spawned++;
      if (pair) {
        // partner 1.2 m to the side (perpendicular to the shared heading)
        const ox = px + Math.sin(heading) * 1.2, oz = pz + Math.cos(heading) * 1.2;
        spawnPed(ox, oz, cx, cz, hx, hz, heading, speed, clockwise, targetCorner, 'walk', idleTimer);
        spawned++;
      }
    }

    // 3 market vendors standing still around the market block centre (-72, 72),
    // inside block bx=0, bz=3 (x -90..-42, z 42..90); long idle so they stay put.
    const mkt = blockSpan(0), mktT = blockSpan(3);
    const mcx = (mkt.lo + mkt.hi) / 2, mcz = (mktT.lo + mktT.hi) / 2;
    const mhx = (mkt.hi - mkt.lo) / 2 + 2, mhz = (mktT.hi - mktT.lo) / 2 + 2;
    for (let i = 0; i < 3; i++) {
      const px = -72 + randRange(rng, -4, 4);
      const pz = 72 + randRange(rng, -4, 4);
      spawnPed(px, pz, mcx, mcz, mhx, mhz, randRange(rng, 0, Math.PI * 2),
        randRange(rng, 0.8, 1.6), rng() < 0.5, nearestCorner(px, pz, mcx, mcz, mhx, mhz),
        'idle', randRange(rng, 180, 300));
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
