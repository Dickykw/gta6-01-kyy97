// Solmara PD: wanted level 0-3, cruisers spawn out of the camera's view, chase and
// ram the player, block the road ahead at wanted 3. Wanted decays once the player
// breaks line of sight and distance for a while.
import * as THREE from 'three';
import { clamp, dist2, nearestRoadPoint } from './util.js';
import { Vehicle } from './vehicle.js';

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.cars = [];
    this.clearTimer = 0; // seconds without a cop near the player
    this.bustedTimer = 0;
    this.sirenPhase = 0;
    this.busted = false;
  }

  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 3);
    if (this.wanted > 0) this.clearTimer = 0;
  }
  setWanted(n) { this.wanted = clamp(n, 0, 3); this.clearTimer = 0; }

  get activeCount() { return this.cars.length; }

  _spawnPoint(playerPos, camYaw) {
    // a road point 45-70 m away, preferably behind the camera
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 45 + Math.random() * 25;
      const x = clamp(playerPos.x + Math.cos(a) * r, -96, 96);
      const z = clamp(playerPos.z + Math.sin(a) * r, -96, 96);
      const p = nearestRoadPoint(x, z);
      const d = dist2(p.x, p.z, playerPos.x, playerPos.z);
      if (d < 40) continue;
      // behind camera? camera looks along (cos yaw, -sin yaw); behind = opposite
      const toSpawnX = p.x - playerPos.x, toSpawnZ = p.z - playerPos.z;
      const lookX = Math.cos(camYaw), lookZ = -Math.sin(camYaw);
      const dot = (toSpawnX * lookX + toSpawnZ * lookZ) / (d || 1);
      if (dot < 0.25 || tries > 8) return p;
    }
    return nearestRoadPoint(playerPos.x + 50, playerPos.z);
  }

  update(dt, playerPos, camYaw, colliders, allVehicles, onBusted, hold = false) {
    this.sirenPhase += dt * 7;
    const want = this.wanted > 0 ? Math.min(this.wanted + 1, 3) : 0;
    // spawn / despawn to match wanted level
    while (this.cars.length < want) {
      const p = this._spawnPoint(playerPos, camYaw);
      const car = new Vehicle(this.scene, 'police', 0xe8e8e8, p.x, p.z, 0, 'police');
      this.cars.push(car);
      allVehicles.push(car);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      const i = allVehicles.indexOf(car);
      if (i >= 0) allVehicles.splice(i, 1);
      this.scene.remove(car.mesh);
    }
    // chase (frozen in staged shots that hold the scene: lights keep flashing)
    let nearest = 1e9;
    for (const car of this.cars) {
      const d = dist2(car.x, car.z, playerPos.x, playerPos.z);
      nearest = Math.min(nearest, d);
      if (!hold) {
        const input = car.chaseInput(playerPos.x, playerPos.z);
        // at wanted 3 the lead cruiser tries to cut the player off from ahead
        if (this.wanted >= 3 && this.cars.indexOf(car) === 0 && d > 25) {
          const tx = playerPos.x + (playerPos.x - car.x) * 0.4;
          const tz = playerPos.z + (playerPos.z - car.z) * 0.4;
          Object.assign(input, car.chaseInput(tx, tz));
        }
        car.update(dt, input, colliders, allVehicles, null);
      }
      // siren flash: alternate red / blue light bar
      const on = Math.sin(this.sirenPhase) > 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.emissiveIntensity = on ? 3 : 0.15;
        car.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.15 : 3;
      }
    }
    // wanted decay: no cop within 55 m for 8 s -> lose a star
    if (this.wanted > 0) {
      if (nearest > 55) {
        this.clearTimer += dt;
        if (this.clearTimer > 8) { this.wanted -= 1; this.clearTimer = 0; }
      } else this.clearTimer = 0;
    }
    // busted: on foot and a cruiser sits on the player for 3 s
    if (!hold && this.wanted > 0 && nearest < 4.5) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 3 && !this.busted) {
        this.busted = true;
        onBusted && onBusted();
      }
    } else this.bustedTimer = 0;
    return nearest;
  }

  resetBusted() { this.busted = false; this.bustedTimer = 0; this.wanted = 0; this.clearTimer = 0; }
}
