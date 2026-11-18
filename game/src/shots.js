// Deterministic screenshot staging (?shot=hero|drive|chase|complete, fixed seed) and
// the scripted self-test (?selftest=1). Every shot plays the real systems forward
// from a staged state, so the frame is what the game really looks like.
import { dist2 } from './util.js';
import { MISSION_DEFS } from './missions.js';

/** Step the live systems forward N fixed steps (traffic moves, dust settles). */
function stepWorld(game, seconds) {
  const dt = 1 / 30;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    game.traffic.update(dt, game.world.colliders, { x: game.player.x, z: game.player.z }, game.player.inVehicle);
    game.dust.update(dt);
    game.world.update(dt);
  }
}

function setCamera(game, yaw, pitch, dist, focus) {
  const p = game.player;
  p.camYaw = yaw; p.camPitch = pitch; p.camDist = dist;
  p.snapCamera(focus, !!p.inVehicle);
  p.updateCamera(1, game.camera, focus, !!p.inVehicle);
}

/** Time-of-day preset for this shot. world.setTimeOfDay is the world
 *  agent's API ('golden' | 'day' | 'dusk' | 'night'); guarded so a build
 *  without it still stages with the default golden look. */
function setTime(game, preset) {
  if (game.world && typeof game.world.setTimeOfDay === 'function') game.world.setTimeOfDay(preset);
}

function placePlayerOnFoot(game, x, z, heading) {
  const p = game.player;
  if (p.inVehicle) p.exitVehicle();
  p.x = x; p.z = z; p.heading = heading;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.y = heading + Math.PI / 2;
}

function putPlayerInCar(game, car) {
  const p = game.player;
  if (p.inVehicle) p.exitVehicle();
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  car.driver = 'player';
  p.enterVehicle(car);
}

/** Stage one named screenshot scene. Called once at load in ?shot= mode. */
export function stageShot(name, game) {
  const plaza = game.world.plaza;
  game.hud.hideOverlay();
  game.money = 0;
  if (name === 'drive') {
    // DOWNTOWN, dusk: Dario driving the red Vantara GT east down avenue
    // z=-48, towers on both sides, Hotel Marina beacon just ahead.
    setTime(game, 'dusk');
    const car = game.plazaSportCar;
    car.x = -24; car.z = -49; car.heading = 0; car.speed = 18; // start 54 m west of
    // the Hotel Marina beacon so it reads as a destination, not a blob in
    // front of the car; z=-49 keeps the DOWNTOWN district label
    putPlayerInCar(game, car);
    game.missions.start(0);
    game.acceptMission();
    game.missions.stage = 'return';
    game.missions.target = { x: 30, z: -54, label: 'Hotel Marina' };
    game.missions._showBeacon();
    stepWorld(game, 2);
    setCamera(game, 0.55, 0.32, 8.5, car); // 3/4 rear angle: the car's side profile reads, not just its roof
    game.hud.toast('Antar paket ke Hotel Marina');
  } else if (name === 'chase') {
    // PASAR SOL, night: mission 4 escape, wanted 2, two cruisers closing
    // in behind the player car on road x=-48 beside the market block.
    // Staged heading north, so the head-on camera (camYaw = heading + PI,
    // tracked every frame in main.js) looks south down the road: player
    // car centre-frame, both cruisers + market blocks behind it.
    setTime(game, 'night');
    const car = game.plazaSportCar; // the red Vantara GT reads at night; a dark sedan is a black blob
    car.x = -49; car.z = 56; car.heading = Math.PI / 2; car.speed = 22; // x=-49, not
    // -48: the road centreline itself reads as PERDAGANGAN in districtAt;
    // 1 m west of it the player is in PASAR SOL while still on road x=-48
    putPlayerInCar(game, car);
    game.missions.index = 3;
    game.missions.start(3);
    game.acceptMission();
    game.police.setWanted(2);
    // force two cruisers right behind, mid-chase
    for (let i = 0; i < 2; i++) {
      game.police.update(0.1, { x: car.x, z: car.z }, 0, game.world.colliders, game.allVehicles, null);
    }
    game.police.cars.forEach((c, i) => {
      c.x = car.x + (i === 0 ? 3 : -3); c.z = car.z + 10 + i * 9; c.heading = Math.PI / 2; c.speed = 24;
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading;
    });
    stepWorld(game, 1.5);
    setCamera(game, (Math.PI * 3) / 2, 0.25, 14, car); // starting pose = heading + PI; the loop then tracks head-on (see main.js)
    // keep the shot-mode autopilot on roads around the market (main.js only
    // initialises shotWps when unset): north up x=-48, then a road loop,
    // so the chase never cuts across blocks after staging
    game.shotWps = [{ x: -48, z: -96 }, { x: 48, z: -96 }, { x: 48, z: 96 }, { x: -48, z: 96 }];
    game.shotWp = 0;
  } else if (name === 'complete') {
    // TAMAN SOL, day: mission complete, +$350, Dario on foot by the red
    // Vantara GT in the park, fountain behind him, a cruiser on the west
    // road (x=48) with lights on. NOTE: def must be a real mission def —
    // the HUD reads def.dropoff.label on every update, and a hand-made def
    // without dropoff threw and blanked the whole frame.
    setTime(game, 'day');
    game.money = 350;
    game.missions.index = 0;
    game.missions.completed = 1;
    game.missions.state = 'complete';
    game.missions.def = MISSION_DEFS[0];
    // park the Vantara GT broadside next to Dario (it lives at the plaza
    // by default — teleport it here, mesh included). Both stand on the
    // avenue's south edge (z=-51): the park's 10 RNG trees can occlude
    // anything inside the block, but nothing stands between this camera
    // and the pair — the fountain + trees are the backdrop, not the cover.
    const gt = game.plazaSportCar;
    gt.x = 66; gt.z = -51; gt.heading = Math.PI;
    gt.mesh.position.set(gt.x, 0, gt.z); gt.mesh.rotation.y = gt.heading;
    placePlayerOnFoot(game, 72, -51, -Math.PI / 2);
    // a cruiser on the avenue west of the pair, facing south (toward
    // camera), lights on, held by shot mode
    game.police.setWanted(1);
    game.police.update(0.1, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null);
    if (game.police.cars[0]) {
      const c = game.police.cars[0];
      c.x = 76; c.z = -54; c.heading = -Math.PI / 2; c.speed = 0; // held by shot mode, lights flashing — 19° right of the view axis, clear of the minimap
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading; // mesh only syncs in update(), which hold skips
    }
    stepWorld(game, 2);
    setCamera(game, Math.PI / 2, 0.22, 9, game.player); // near-level view: less road foreground, more park behind the pair
    game.hud.toast('MISI SELESAI — Paket untuk Madame Luma · +$350', 60000);
  } else {
    // hero (default): MARINA, golden hour — Dario on foot on the sand,
    // facing the camera, boats + sea behind him. Camera ENE of Dario
    // looking WSW (yaw 3.38): the three sailboats spread across the
    // background; the lighthouse stays out of frame (it is 32 m tall and
    // 11 m away — any camera near Dario makes it a cropped column).
    setTime(game, 'golden');
    placePlayerOnFoot(game, -108, -76, 0.24);
    game.missions.start(0);
    game.acceptMission();
    stepWorld(game, 3);
    setCamera(game, 3.38, 0.25, 10, game.player);
    game.hud.setCrosshair(false);
  }
  game.hud.update(0, {
    wanted: game.police.wanted,
    plaza: game.world.plaza,
    lighthouse: game.world.lighthouse,
    trafficCars: game.traffic.cars,
    missionTarget: game.missions.target,
    policeCars: game.police.cars,
    player: { x: game.player.x, z: game.player.z },
    playerHeading: game.player.heading,
  });
}

/** Scripted playtest (?selftest=1): fixed steps, logs SELFTEST lines to console. */
export function runSelfTest(game) {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`SELFTEST ${ok ? 'OK' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  try {
    check('world-built', game.world.colliders.length > 20, `${game.world.colliders.length} colliders`);
    check('traffic', game.traffic.cars.length >= 6 && game.traffic.peds.length >= 10,
      `${game.traffic.cars.length} cars, ${game.traffic.peds.length} peds`);
    check('parked-cars', game.parkedCars.length >= 6, `${game.parkedCars.length} parked`);

    // walk: W for 1s moves the player
    const x0 = game.player.x, z0 = game.player.z;
    game.keys['KeyW'] = true;
    for (let i = 0; i < 30; i++) game.player.updateOnFoot(1 / 30, game.player.moveVectorFromKeys(game.keys), false, game.world.colliders);
    game.keys['KeyW'] = false;
    check('walk', dist2(x0, z0, game.player.x, game.player.z) > 1.5,
      `moved ${dist2(x0, z0, game.player.x, game.player.z).toFixed(1)}m`);

    // enter the nearest parked car and drive
    const car = game.parkedCars[0];
    game.player.x = car.x + 1; game.player.z = car.z;
    game._toggleVehicle();
    check('enter-car', !!game.player.inVehicle, game.player.inVehicle ? game.player.inVehicle.spec.name : 'not in car');
    const cx0 = car.x;
    game.keys['KeyW'] = true;
    for (let i = 0; i < 60; i++) {
      const v = game.player.inVehicle;
      v.update(1 / 30, { throttle: 1, brake: 0, steer: 0, handbrake: false, reverse: false }, game.world.colliders, game.allVehicles, game.dust);
      game.player.x = v.x; game.player.z = v.z;
    }
    game.keys['KeyW'] = false;
    check('drive', Math.abs(car.x - cx0) + Math.abs(car.z - car.z) > 5, `car moved ${(Math.abs(car.x - cx0)).toFixed(1)}m`);
    game._toggleVehicle();
    check('exit-car', !game.player.inVehicle, 'on foot again');

    // wanted + police spawn (stealing the car earlier already added 1 star)
    game.police.addWanted(2);
    for (let i = 0; i < 60; i++) game.police.update(1 / 30, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null);
    check('wanted-police', game.police.wanted >= 2 && game.police.cars.length >= 2,
      `wanted ${game.police.wanted}, ${game.police.cars.length} cruisers`);
    // police close in
    const copD0 = dist2(game.police.cars[0].x, game.police.cars[0].z, game.player.x, game.player.z);
    check('police-chase', copD0 < 80, `nearest cop ${copD0.toFixed(0)}m`);

    // shoot (aims through crosshair; may hit ground)
    const hit = game.combat.shoot(game);
    check('shoot', hit !== null, hit ? hit.kind : 'no hit');

    // mission 1 full cycle, staged by teleport
    const money0 = game.money;
    game.missions.start(0);
    game.acceptMission();
    game.player.x = game.missions.target.x; game.player.z = game.missions.target.z;
    for (let i = 0; i < 30; i++) game.missions.update(1 / 30);
    check('mission-pickup', game.missions.stage === 'return', `stage ${game.missions.stage}`);
    game.player.x = game.missions.target.x; game.player.z = game.missions.target.z;
    for (let i = 0; i < 30; i++) game.missions.update(1 / 30);
    check('mission-complete', game.missions.state === 'complete' && game.money === money0 + 350,
      `state ${game.missions.state}, money $${game.money}`);

    // save round-trip
    game.saveGame();
    const loaded = JSON.parse(localStorage.getItem('solmara-heat-save-v1') || 'null');
    check('save', !!loaded && loaded.money === game.money && loaded.missionIndex === game.missions.index,
      loaded ? `money $${loaded.money}` : 'no save');

    // wanted decay: cops held far away for 9s -> lose a star (hold freezes the chase)
    const wantedBefore = game.police.wanted;
    game.police.cars.forEach((c) => { c.x = game.player.x + 90; c.z = game.player.z + 90; });
    for (let i = 0; i < 300; i++) game.police.update(1 / 30, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null, true);
    check('wanted-decay', game.police.wanted < wantedBefore, `wanted ${wantedBefore} -> ${game.police.wanted}`);
  } catch (e) {
    console.log(`SELFTEST FAIL exception — ${e.message}`);
    console.log('SELFTEST FAIL');
    return;
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? 'SELFTEST PASS' : `SELFTEST FAIL: ${failed.map((r) => r.name).join(', ')}`);
}
