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
    this.heli = null; // police helicopter (separate from police.cars)
    this.heliAngle = 0;
    this._unitNames = ['PATROL-7', 'KITE-2', 'BAY-5'];
  }

  /** Rounded, non-boxy police helicopter: capsule body, cylinder tail boom,
   *  disc main rotor + tail rotor, additive spotlight cone aimed at the player. */
  _buildHeli() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.6 });
    // rounded body: capsule along X
    const bodyGeo = new THREE.CapsuleGeometry(1.1, 2.6, 6, 14);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, paint);
    body.position.y = 0; body.castShadow = true; g.add(body);
    // glass nose: squashed sphere at the front
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), glass);
    nose.scale.set(1.1, 0.75, 0.95); nose.position.set(1.9, -0.1, 0); g.add(nose);
    // belly stripe (torus ring around the capsule)
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.09, 8, 24), dark);
    stripe.rotation.y = Math.PI / 2; stripe.position.x = -0.4; g.add(stripe);
    // tail boom: tapered cylinder + rounded tail fin cone
    const boomGeo = new THREE.CylinderGeometry(0.18, 0.42, 3.6, 10);
    boomGeo.rotateZ(Math.PI / 2);
    const boom = new THREE.Mesh(boomGeo, paint);
    boom.position.set(-3.4, 0.25, 0); g.add(boom);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 4), dark);
    fin.rotation.z = -Math.PI / 2; fin.position.set(-5.3, 0.5, 0); g.add(fin);
    // tail rotor: small disc on a stalk
    const tailRotor = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 12), dark);
    tailRotor.rotation.x = Math.PI / 2; tailRotor.position.set(-5.0, 0.35, 0.45); g.add(tailRotor);
    // skids: two bent tubes (torus arcs) under the body
    for (const sz of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 16, Math.PI), dark);
      skid.rotation.y = Math.PI / 2; skid.rotation.z = Math.PI;
      skid.position.set(0, -1.25, sz * 0.8); g.add(skid);
    }
    // main rotor mast + spinning disc (thin cylinder, semi-transparent)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), dark);
    mast.position.y = 1.35; g.add(mast);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, transparent: true, opacity: 0.55 }));
    rotor.position.y = 1.75; g.add(rotor);
    // spotlight cone (additive, like the lighthouse beam) + real spotlight
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    cone.position.y = -17; cone.rotation.x = Math.PI; g.add(cone);
    const spot = new THREE.SpotLight(0xfff2b0, 350, 60, 0.35, 0.5, 1.1);
    spot.position.y = -0.5; g.add(spot); g.add(spot.target);
    spot.target.position.set(0, -34, 0);
    g.userData = { rotor, spot };
    g.visible = false;
    this.scene.add(g);
    return { group: g, rotor, spot, x: 0, z: 0, y: 40 };
  }

  _updateHeli(dt, playerPos) {
    if (this.wanted >= 2) {
      if (!this.heli) this.heli = this._buildHeli();
      const h = this.heli;
      h.group.visible = true;
      this.heliAngle += dt * 0.25;
      const r = 26;
      h.x = playerPos.x + Math.cos(this.heliAngle) * r;
      h.z = playerPos.z + Math.sin(this.heliAngle) * r;
      h.y = 38 + Math.sin(this.heliAngle * 0.7) * 4;
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = Math.atan2(-(playerPos.z - h.z), playerPos.x - h.x);
      h.rotor.rotation.y += dt * 22;
      // spotlight tracks the player
      h.spot.target.position.set(playerPos.x - h.x, -h.y, playerPos.z - h.z);
      h.spot.target.updateMatrixWorld();
    } else if (this.heli) {
      this.scene.remove(this.heli.group);
      this.heli = null;
    }
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
      car.unitName = this._unitNames[this.cars.length % this._unitNames.length];
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
    this._updateHeli(dt, playerPos);
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
      // siren flash: alternate red / blue light bar (+ glow halo colour)
      const on = Math.sin(this.sirenPhase) > 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.emissiveIntensity = on ? 3 : 0.15;
        car.mesh.userData.lightBlue.material.emissiveIntensity = on ? 0.15 : 3;
        const glow = car.mesh.userData.lightGlow;
        if (glow) glow.material.color.setHex(on ? 0xff2222 : 0x2244ff);
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
