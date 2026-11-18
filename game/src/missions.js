// Missions for Madame Luma: a state machine (briefing -> go_to -> objective ->
// return/escape -> complete/failed) with a 3D beacon marker, HUD objective and timer.
// Five story jobs, then repeatable free-roam deliveries.
import * as THREE from 'three';
import { mulberry32, randInt, pick, dist2, clamp, nearestRoadPoint } from './util.js';
import { createPlayerMesh } from './player.js';

export const MISSION_DEFS = [
  {
    id: 'luma-package', title: 'Paket untuk Madame Luma', kind: 'delivery',
    brief: 'Madame Luma: "Dario, ambil paketku di Café Luma, antar ke Hotel Marina. Cepat — dan jangan bikin ribut."',
    pickup: { x: -30, z: -54, label: 'Café Luma' },
    dropoff: { x: 30, z: -54, label: 'Hotel Marina' },
    timer: 110, reward: 350,
  },
  {
    id: 'vantara-order', title: 'Vantara Pesanan', kind: 'steal',
    brief: 'Madame Luma: "Ada Vantara GT merah parkir di Plaza Mar. Itu pesanan klien. Ambil, bawa ke garasi SolCab."',
    carSpot: { x: 0, z: 0, label: 'Plaza Mar' }, // filled in at start: the plaza sport car
    dropoff: { x: -54, z: 54, label: 'Garasi SolCab' },
    timer: 120, reward: 500,
  },
  {
    id: 'chase-courier', title: 'Kejar Kurir', kind: 'chase',
    brief: 'Madame Luma: "Kurirku kabur bawa dokumen. Kejar mobilnya, tempel terus sampai dia menyerah."',
    timer: 120, reward: 450,
  },
  {
    id: 'lose-the-heat', title: 'Kabur dari Polisi', kind: 'escape',
    brief: 'Madame Luma: "Polisi sudah di ekormu, Dario. Hilang dari pandangan mereka — jangan sampai ketangkap."',
    timer: 90, reward: 600,
  },
  {
    id: 'luma-taxi', title: 'Taksi Luma', kind: 'taxi',
    brief: 'Madame Luma: "Dario, ada tamu menunggumu di Pasar Sol. Antar dia ke Marina — sopan, cepat, dan jangan bertanya urusan orang lain."',
    pickup: { x: -48, z: 72, label: 'Pasar Sol' },
    dropoff: { x: -96, z: -48, label: 'Marina' },
    timer: 120, reward: 450,
  },
];

function makeBeacon(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.4, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0xffb800, emissiveIntensity: 1.2, roughness: 0.3 }),
  );
  diamond.position.y = 5.5;
  g.add(beam, ring, diamond);
  g.visible = false;
  scene.add(g);
  return { group: g, diamond, ring, beam };
}

export class Missions {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.rng = mulberry32(20261118);
    this.index = 0; // current story mission
    this.completed = 0;
    this.state = 'idle'; // idle | briefing | active | complete | failed
    this.stage = ''; // go_to | objective | return | escape | chase
    this.def = null;
    this.target = null; // {x, z, label}
    this.timer = 0;
    this.stageTimer = 0;
    this.chaseHold = 0;
    this.escapeClear = 0;
    this.courier = null;
    this.passenger = null; // taxi passenger mesh (kind 'taxi' only)
    this.beacon = makeBeacon(scene);
    this.onEvent = null; // (event, data) -> hud/audio hooks
  }

  get active() { return this.state === 'active'; }
  get currentTitle() { return this.def ? this.def.title : 'Free Roam'; }

  start(index = this.index) {
    this.index = index;
    this._removePassenger();
    if (index >= MISSION_DEFS.length) return this.startFreeRoam();
    this.def = MISSION_DEFS[index];
    this.state = 'briefing';
    this.stage = 'go_to';
    this.timer = this.def.timer;
    this.chaseHold = 0; this.escapeClear = 0;
    if (this.def.kind === 'steal') {
      const spot = this.game.plazaSportCar;
      this.target = { x: spot.x, z: spot.z, label: 'Vantara GT — Plaza Mar' };
    } else if (this.def.kind === 'chase') {
      this._spawnCourier();
      this.target = { x: this.courier.x, z: this.courier.z, label: 'Kurir — kejar!' };
    } else if (this.def.kind === 'escape') {
      this.game.police.setWanted(3);
      this.target = { x: this.game.player.x, z: this.game.player.z, label: 'Kabur dari polisi!' };
    } else {
      this.target = { ...this.def.pickup, label: this.def.pickup.label };
    }
    // escape has no fixed target: the beacon would sit on the player
    if (!this.def || this.def.kind !== 'escape') this._showBeacon();
    if (this.def && this.def.kind === 'taxi') this._spawnPassenger();
    this.onEvent && this.onEvent('briefing', this.def);
  }

  startFreeRoam() {
    this.def = null;
    this.state = 'briefing';
    this.stage = 'go_to';
    const a = nearestRoadPoint(randInt(this.rng, -80, 80), randInt(this.rng, -80, 80));
    const b = nearestRoadPoint(randInt(this.rng, -80, 80), randInt(this.rng, -80, 80));
    this.freeJob = { pickup: a, dropoff: b, reward: 200 + randInt(this.rng, 0, 4) * 50 };
    this.timer = 120;
    this.target = { x: a.x, z: a.z, label: 'Ambil paket' };
    this._showBeacon();
    this.onEvent && this.onEvent('briefing-free', this.freeJob);
  }

  accept() {
    if (this.state !== 'briefing') return;
    this.state = 'active';
    this.onEvent && this.onEvent('accepted', this.def || this.freeJob);
  }

  _spawnCourier() {
    const p = this.game.player;
    const spot = nearestRoadPoint(p.x + 40, p.z + 20);
    const car = new (this.game.VehicleClass)(this.scene, 'sedan', 0x8a2e2e, spot.x, spot.z, 0, 'npc');
    car.cruise = 13;
    car.loop = null;
    this.game.allVehicles.push(car);
    this.courier = car;
  }

  _removeCourier() {
    if (!this.courier) return;
    const i = this.game.allVehicles.indexOf(this.courier);
    if (i >= 0) this.game.allVehicles.splice(i, 1);
    this.scene.remove(this.courier.mesh);
    this.courier = null;
  }

  /** Taxi passenger waiting at the pickup point (kind 'taxi' only). */
  _spawnPassenger() {
    this._removePassenger();
    const built = createPlayerMesh();
    // recolour the jacket so the passenger does not read as a Dario clone
    built.group.traverse((m) => {
      if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x2e4a5e) {
        m.material = new THREE.MeshStandardMaterial({ color: 0xd98a2b, roughness: 0.9 });
      }
    });
    built.group.position.set(this.target.x, 0, this.target.z);
    built.group.rotation.y = Math.PI * 0.75; // facing the road, waiting
    this.scene.add(built.group);
    this.passenger = built.group;
  }

  _removePassenger() {
    if (!this.passenger) return;
    this.scene.remove(this.passenger);
    this.passenger = null;
  }

  _showBeacon() {
    if (!this.target) return;
    this.beacon.group.visible = true;
    this.beacon.group.position.set(this.target.x, 0, this.target.z);
  }
  _hideBeacon() { this.beacon.group.visible = false; }

  _complete() {
    const reward = this.def ? this.def.reward : this.freeJob.reward;
    this.state = 'complete';
    this._hideBeacon();
    this._removeCourier();
    this._removePassenger();
    this.completed += 1;
    this.game.money += reward;
    this.onEvent && this.onEvent('complete', { reward, title: this.currentTitle });
    this.game.saveGame();
    if (this.def) this.index = Math.min(this.index + 1, MISSION_DEFS.length);
  }

  _fail(reason) {
    this.state = 'failed';
    this._hideBeacon();
    this._removeCourier();
    this._removePassenger();
    this.onEvent && this.onEvent('failed', { reason });
  }

  /** Distance from the player to the current target. */
  distanceToTarget() {
    if (!this.target) return 0;
    return dist2(this.game.player.x, this.game.player.z, this.target.x, this.target.z);
  }

  objectiveText() {
    if (this.state === 'briefing') return 'Baca briefing — tekan ENTER untuk mulai';
    if (this.state !== 'active') return '';
    const d = Math.round(this.distanceToTarget());
    if (this.def && this.def.kind === 'delivery') {
      return this.stage === 'go_to' ? `Ambil paket di ${this.target.label} — ${d}m` : `Antar paket ke ${this.target.label} — ${d}m`;
    }
    if (this.def && this.def.kind === 'steal') {
      return this.stage === 'go_to' ? `Curi Vantara GT di ${this.target.label} — ${d}m` : `Bawa ke ${this.target.label} — ${d}m`;
    }
    if (this.def && this.def.kind === 'chase') {
      return `Tempel kurir! Tahan ${Math.max(0, 5 - this.chaseHold).toFixed(0)} detik lagi — ${d}m`;
    }
    if (this.def && this.def.kind === 'escape') {
      return `Kabur! Jangan terlihat polisi ${Math.max(0, 20 - this.escapeClear).toFixed(0)} detik`;
    }
    if (this.def && this.def.kind === 'taxi') {
      return this.stage === 'go_to' ? `Jemput penumpang di ${this.target.label} — ${d}m` : `Antar penumpang ke ${this.target.label} — ${d}m`;
    }
    return this.stage === 'go_to' ? `Ambil paket — ${d}m` : `Antar paket ke tujuan — ${d}m`;
  }

  update(dt) {
    // beacon animation
    if (this.beacon.group.visible) {
      this.beacon.diamond.rotation.y += dt * 2;
      this.beacon.diamond.position.y = 5.5 + Math.sin(performance.now() * 0.002) * 0.5;
      const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.25;
      this.beacon.ring.material.opacity = pulse;
    }
    if (this.state !== 'active') return;
    this.timer -= dt;
    if (this.timer <= 0) { this._fail('Waktu habis'); return; }
    const p = this.game.player;
    const d = this.distanceToTarget();

    if (this.def && this.def.kind === 'chase' && this.courier) {
      // courier flees from the player along the roads
      const c = this.courier;
      const dx = c.x - p.x, dz = c.z - p.z;
      const dd = Math.hypot(dx, dz) || 1;
      const fleeX = c.x + (dx / dd) * 30, fleeZ = c.z + (dz / dd) * 30;
      const near = nearestRoadPoint(fleeX, fleeZ);
      const input = c.chaseInput(near.x, near.z);
      c.update(dt, input, this.game.world.colliders, this.game.allVehicles, null);
      this.target = { x: c.x, z: c.z, label: 'Kurir — kejar!' };
      this.beacon.group.position.set(c.x, 0, c.z);
      if (d < 12) {
        this.chaseHold += dt;
        if (this.chaseHold >= 5) { this._complete(); return; }
      } else this.chaseHold = Math.max(0, this.chaseHold - dt * 0.5);
      return;
    }

    if (this.def && this.def.kind === 'escape') {
      const nearestCop = this.game.policeNearest ?? 999;
      if (nearestCop > 50) {
        this.escapeClear += dt;
        if (this.escapeClear >= 20) { this._complete(); return; }
      } else this.escapeClear = Math.max(0, this.escapeClear - dt);
      return;
    }

    // delivery / steal / free-roam: reach the ring
    if (d < 4.5) {
      this.stageTimer += dt;
      if (this.stageTimer > 0.4) {
        this.stageTimer = 0;
        if (this.stage === 'go_to') {
          if (this.def && this.def.kind === 'steal') {
            // must be in the Vantara GT itself
            const inCar = p.inVehicle;
            if (inCar && inCar.type === 'sport') {
              this.stage = 'return';
              this.target = { ...this.def.dropoff, label: this.def.dropoff.label };
              this._showBeacon();
              this.onEvent && this.onEvent('stage', 'Vantara GT didapat — bawa ke garasi!');
            } else {
              this.onEvent && this.onEvent('hint', 'Masuk ke Vantara GT-nya dulu (tekan E)!');
            }
          } else {
            this.stage = 'return';
            const dest = this.def ? this.def.dropoff : this.freeJob.dropoff;
            this.target = { x: dest.x, z: dest.z, label: this.def ? this.def.dropoff.label : 'Tujuan antar' };
            this._showBeacon();
            if (this.def && this.def.kind === 'taxi') {
              this._removePassenger(); // passenger "boards" at pickup
              this.onEvent && this.onEvent('stage', 'Penumpang naik — antar ke Marina!');
            } else {
              this.onEvent && this.onEvent('stage', 'Paket didapat — antar ke tujuan!');
            }
            this.game.audio && this.game.audio.pickup();
          }
        } else if (this.stage === 'return') {
          this._complete();
        }
      }
    } else this.stageTimer = 0;
  }
}
