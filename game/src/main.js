// SOLMARA HEAT — bootstrap, game loop, input, entity registry. One Game owns every
// system (world, player, vehicles, traffic, police, missions, combat, HUD, audio,
// save) and drives them in dependency order each frame.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { Vehicle, VEHICLE_TYPES, DustPool } from './vehicle.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { loadSave, saveGameData, clearSave } from './save.js';
import { stageShot, runSelfTest } from './shots.js';
import { clamp, mulberry32, pick, dist2, nearestRoadPoint } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || null;
const SEED = Number(params.get('seed') || 7);
const SELFTEST = params.get('selftest') === '1';

class Game {
  constructor() {
    this.VehicleClass = Vehicle;
    this.money = 0;
    this.elapsed = 0;
    this.started = false;
    this.paused = false;
    this.shotMode = !!SHOT;
    this.shotName = SHOT;
    this.keys = {};
    this.policeNearest = 999;
    this.save = loadSave();

    // renderer / scene / camera
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.body.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
    this.camera.position.set(30, 20, 30);

    // world + systems
    this.world = createWorld(this.scene, SEED);
    this.dust = new DustPool(this.scene);
    this.player = new Player(this.scene, this.world.plaza.x + 16, this.world.plaza.z + 14);
    this.traffic = new Traffic(this.scene, this.world, SEED + 11);
    this.police = new Police(this.scene, this.world);
    this.missions = new Missions(this.scene, this);
    this.missions.onEvent = (ev, data) => this._onMissionEvent(ev, data);
    this.combat = new Combat(this.scene, this.camera);
    this.audio = new AudioEngine();
    this.hud = new HUD(this);

    // parked cars from the world's spots (stealable)
    this.allVehicles = [];
    this.parkedCars = [];
    const rng = mulberry32(SEED + 23);
    for (const spot of this.world.parkedSpots) {
      const color = spot.type === 'sport' ? 0xc23b2e : pick(rng, VEHICLE_TYPES[spot.type].colors); // the Vantara GT is always red
      const car = new Vehicle(this.scene, spot.type, color, spot.x, spot.z, spot.heading, 'parked');
      this.allVehicles.push(car);
      this.parkedCars.push(car);
      if (spot.type === 'sport') this.plazaSportCar = car;
    }
    for (const v of this.traffic.cars) this.allVehicles.push(v);

    // player headlight (one spotlight, only while driving)
    this.headlight = new THREE.SpotLight(0xffe9a8, 0, 40, 0.6, 0.5, 1.2);
    this.scene.add(this.headlight);
    this.scene.add(this.headlight.target);

    this._bindInput();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    if (SELFTEST) {
      this.startGame(true);
      this.hud.hideOverlay();
      setTimeout(() => runSelfTest(this), 100);
    } else if (SHOT) {
      this.startGame(true);
      this.hud.hideOverlay();
      stageShot(SHOT, this);
      this._renderOnce();
    } else {
      this.hud.showStart(!!this.save);
    }
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ---- flow ----
  startGame(fresh) {
    if (fresh) {
      clearSave();
      this.money = 0;
      this.missions.index = 0;
      this.missions.completed = 0;
      this.save = null;
    } else if (this.save) {
      this.money = this.save.money;
      this.missions.index = this.save.missionIndex;
      this.missions.completed = this.save.completed;
      if (this.save.player) {
        this.player.x = this.save.player.x;
        this.player.z = this.save.player.z;
        this.player.mesh.position.set(this.player.x, 0, this.player.z);
      }
    }
    this.started = true;
    this.audio.init();
    this.hud.hideOverlay();
    this.missions.start(this.missions.index);
  }
  acceptMission() { this.audio.click(); this.missions.accept(); this.hud.hideOverlay(); }
  nextMission() {
    this.hud.hideOverlay();
    if (this.missions.index < 4) this.missions.start(this.missions.index);
    else this.missions.startFreeRoam();
  }
  retryMission() { this.hud.hideOverlay(); this.missions.start(this.missions.index); }
  freeRoam() {
    this.hud.hideOverlay();
    this.missions.state = 'idle';
    this.missions.target = null;
    this.missions._hideBeacon();
    this.hud.toast('Free roam — tekan M untuk kerja berikutnya');
  }
  afterBusted() {
    this.hud.hideOverlay();
    this.police.resetBusted();
    this.money = Math.max(0, this.money - 50);
    if (this.player.inVehicle) this.player.exitVehicle();
    this.player.x = this.world.plaza.x + 10;
    this.player.z = this.world.plaza.z + 10;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.snapCamera(this.player, false);
    this.saveGame();
    this.hud.toast('Dibebaskan di Plaza Mar — denda $50');
  }
  togglePause() {
    if (!this.started) return;
    if (this.paused) { this.paused = false; this.hud.hideOverlay(); return; }
    if (this.hud.overlayVisible) return;
    this.paused = true;
    this.saveGame();
    this.hud.showPaused();
  }
  saveGame() {
    saveGameData({
      money: this.money,
      missionIndex: this.missions.index,
      completed: this.missions.completed,
      player: { x: Math.round(this.player.x), z: Math.round(this.player.z) },
    });
  }

  _onMissionEvent(ev, data) {
    if (ev === 'briefing') this.hud.showBriefing(data);
    else if (ev === 'briefing-free') this.hud.showBriefingFree(data);
    else if (ev === 'complete') {
      this.audio.missionComplete();
      this.hud.showComplete(data.reward, data.title);
    } else if (ev === 'failed') {
      this.audio.missionFailed();
      this.hud.showFailed(data.reason);
    } else if (ev === 'stage' || ev === 'hint') this.hud.toast(data);
  }

  // ---- input ----
  _bindInput() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Enter') {
        if (!this.started && !this.hud.overlayVisible) return;
        if (this.missions.state === 'briefing') this.acceptMission();
        else if (!this.started) this.startGame(false);
      }
      if (!this.started) return;
      if (e.code === 'KeyE') this._toggleVehicle();
      if (e.code === 'KeyM' && !this.hud.overlayVisible && this.missions.state !== 'active' && this.missions.state !== 'briefing') this.nextMission();
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyF' && !this.hud.overlayVisible) this._shoot();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    let dragging = false, downPos = null, downTime = 0, moved = 0;
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', (e) => {
      dragging = true; moved = 0;
      downPos = { x: e.clientX, y: e.clientY };
      downTime = performance.now();
    });
    addEventListener('mousemove', (e) => {
      if (!dragging || !downPos) return;
      const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved > 6) {
        this.player.camYaw -= dx * 0.004;
        this.player.camPitch = clamp(this.player.camPitch + dy * 0.003, 0.08, 1.1);
        downPos = { x: e.clientX, y: e.clientY };
      }
    });
    addEventListener('mouseup', (e) => {
      if (dragging && downPos && moved <= 6 && performance.now() - downTime < 350) this._shoot();
      dragging = false; downPos = null;
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.player.camDist = clamp(this.player.camDist + Math.sign(e.deltaY) * 1.2, 5, 14);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _shoot() {
    if (!this.started || this.paused || this.hud.overlayVisible) return;
    if (this.player.inVehicle) return; // shoot on foot only
    const hit = this.combat.shoot(this);
    if (hit && hit.kind === 'ped') this.police.addWanted(1);
    else if (hit && hit.kind === 'car' && hit.police) this.police.addWanted(1);
    else if (hit && hit.kind === 'car') this.police.addWanted(1);
  }

  _nearestEnterable() {
    const p = this.player;
    let best = null, bd = 4.2;
    for (const v of this.allVehicles) {
      if (v.type === 'police' || v === this.missions.courier) continue;
      if (v.driver === 'npc' && Math.abs(v.speed) > 3) continue;
      const d = dist2(p.x, p.z, v.x, v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  _toggleVehicle() {
    if (this.hud.overlayVisible || this.paused) return;
    const p = this.player;
    if (p.inVehicle) {
      p.exitVehicle();
      this.hud.toast('Keluar dari mobil');
      return;
    }
    const v = this._nearestEnterable();
    if (!v) return;
    if (v.driver === 'parked' || v.driver === 'npc') {
      if (!v.stolen) {
        v.stolen = true;
        this.police.addWanted(1);
        this.hud.toast(`Mencuri ${v.spec.name}! Wanted +1 ★`, 3200);
        this.audio.pickup();
      }
      if (v.driver === 'npc') {
        const i = this.traffic.cars.indexOf(v);
        if (i >= 0) this.traffic.cars.splice(i, 1);
      }
      v.driver = 'player';
    }
    p.enterVehicle(v);
    this.hud.toast(`${v.spec.name} — WASD nyetir, Space rem tangan, E keluar`);
  }

  // ---- frame ----
  _renderOnce() {
    this.renderer.render(this.scene, this.camera);
    window.__shotReady = true;
  }

  _frame() {
    const now = performance.now();
    const dt = clamp((now - this._last) / 1000, 0.001, 0.05);
    this._last = now;
    if (!this.started) {
      // slow attract orbit behind the start screen
      const t = now * 0.00005;
      this.camera.position.set(this.world.plaza.x + Math.cos(t) * 55, 26, this.world.plaza.z + Math.sin(t) * 55);
      this.camera.lookAt(this.world.plaza.x, 8, this.world.plaza.z);
      this.world.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this.elapsed += dt;
    const p = this.player;

    // player / vehicle
    let driving = false, speed = 0, drifting = false;
    if (p.inVehicle) {
      const v = p.inVehicle;
      const input = {
        throttle: (this.keys['KeyW'] || this.keys['ArrowUp']) ? 1 : 0,
        brake: (this.keys['KeyS'] || this.keys['ArrowDown']) ? 1 : 0,
        steer: ((this.keys['KeyA'] || this.keys['ArrowLeft']) ? 1 : 0) - ((this.keys['KeyD'] || this.keys['ArrowRight']) ? 1 : 0),
        handbrake: !!this.keys['Space'],
        reverse: !!(this.keys['KeyS'] || this.keys['ArrowDown']) && Math.abs(v.speed) < 0.5,
      };
      if (this.shotMode) {
        // autopilot for staged screenshots: cruise a loop of the main avenues
        if (!this.shotWps) {
          this.shotWps = [{ x: 80, z: 0 }, { x: 80, z: -48 }, { x: -80, z: -48 }, { x: -80, z: 0 }];
          this.shotWp = 0;
        }
        const wp = this.shotWps[this.shotWp];
        if (dist2(v.x, v.z, wp.x, wp.z) < 10) this.shotWp = (this.shotWp + 1) % this.shotWps.length;
        const auto = v.chaseInput(wp.x, wp.z);
        input.throttle = auto.throttle; input.steer = auto.steer; input.brake = 0; input.reverse = false;
      }
      v.update(dt, input, this.world.colliders, this.allVehicles, this.dust);
      if (this.shotMode && v.speed < 8) v.speed = 10; // never stall mid-shot
      p.x = v.x; p.z = v.z; p.heading = v.heading;
      driving = true; speed = v.speed; drifting = v.drifting;
      // headlight follows the car
      const f = v.forward;
      this.headlight.position.set(v.x + f.x * 2, 1.2, v.z + f.z * 2);
      this.headlight.target.position.set(v.x + f.x * 14, 0.4, v.z + f.z * 14);
      this.headlight.intensity = 60;
    } else {
      const mv = p.moveVectorFromKeys(this.keys);
      speed = p.updateOnFoot(dt, mv, !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'], this.world.colliders);
      this.headlight.intensity = 0;
    }

    // world life
    this.traffic.update(dt, this.world.colliders, { x: p.x, z: p.z }, p.inVehicle);
    this.policeNearest = this.police.update(dt, { x: p.x, z: p.z }, p.camYaw, this.world.colliders, this.allVehicles,
      () => { if (!this.shotMode) this.hud.showBusted(); },
      this.shotMode && this.shotName === 'complete'); // complete shot holds the cruiser in frame
    if (!this.shotMode) this.missions.update(dt);
    else this.missions.update(0); // frozen timers in shot mode, beacon still animates
    this.combat.update(dt);
    this.dust.update(dt);
    this.world.update(dt);

    // camera
    const focus = p.inVehicle ? p.inVehicle : p;
    p.updateCamera(dt, this.camera, focus, !!p.inVehicle);
    this.combat.applyShake(this.camera);

    // HUD prompt (contextual)
    if (!p.inVehicle) {
      const near = this._nearestEnterable();
      if (near) this.hud.setPrompt(`[E] ${near.driver === 'parked' || near.driver === 'npc' ? 'Curi' : 'Naik'} ${near.spec.name}`);
      else this.hud.setPrompt('');
      this.hud.setCrosshair(!this.shotMode); // staged shots keep a clean frame
    } else {
      this.hud.setPrompt('[E] Keluar mobil · [Space] Rem tangan');
      this.hud.setCrosshair(false);
    }

    this.hud.update(dt, {
      wanted: this.police.wanted,
      plaza: this.world.plaza,
      lighthouse: this.world.lighthouse,
      trafficCars: this.traffic.cars,
      missionTarget: (this.missions.state === 'active' || this.missions.state === 'briefing') ? this.missions.target : null,
      policeCars: this.police.cars,
      player: { x: p.x, z: p.z },
      playerHeading: p.heading,
    });
    this.audio.update({
      speed, driving, drifting,
      wanted: this.police.wanted,
      nearestCop: this.policeNearest,
    });
    this.renderer.render(this.scene, this.camera);
    if (SHOT) window.__shotReady = true;
  }
}

window.__game = new Game();
