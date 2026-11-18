// Deterministic screenshot staging (?shot=hero|drive|chase|complete, fixed seed) and
// the scripted self-test (?selftest=1). Every shot plays the real systems forward
// from a staged state, so the frame is what the game really looks like.
import { dist2 } from './util.js';

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
    // Dario driving the Vantara GT down the main avenue, traffic ahead
    const car = game.plazaSportCar;
    car.x = -58; car.z = 0; car.heading = 0; car.speed = 18;
    putPlayerInCar(game, car);
    game.missions.start(0);
    game.missions.accept();
    game.missions.stage = 'return';
    game.missions.target = { x: 30, z: -54, label: 'Hotel Marina' };
    game.missions._showBeacon();
    stepWorld(game, 2);
    setCamera(game, 0.15, 0.3, 9, car);
    game.hud.toast('Antar paket ke Hotel Marina — 88m');
  } else if (name === 'chase') {
    // mission 4 escape: wanted 2, two cruisers closing in behind the player car
    const car = game.parkedCars.find((c) => c.type === 'sedan');
    car.x = -20; car.z = 0; car.heading = 0; car.speed = 22;
    putPlayerInCar(game, car);
    game.missions.index = 3;
    game.missions.start(3);
    game.missions.accept();
    game.police.setWanted(2);
    // force two cruisers right behind, mid-chase
    for (let i = 0; i < 2; i++) {
      game.police.update(0.1, { x: car.x, z: car.z }, 0, game.world.colliders, game.allVehicles, null);
    }
    game.police.cars.forEach((c, i) => {
      c.x = car.x - 14 - i * 9; c.z = (i === 0 ? 3 : -3); c.heading = 0; c.speed = 24;
    });
    stepWorld(game, 1.5);
    setCamera(game, 0.1, 0.34, 10, car);
  } else if (name === 'complete') {
    // mission complete: money in, toast + panel proof, Dario by the Vantara GT
    game.money = 350;
    game.missions.index = 1;
    game.missions.completed = 1;
    game.missions.state = 'complete';
    game.missions.def = { title: 'Paket untuk Madame Luma', reward: 350 };
    placePlayerOnFoot(game, plaza.x + 6, plaza.z + 10, Math.PI * 0.75);
    // a cruiser passing with lights on, traffic around the plaza
    game.police.setWanted(1);
    game.police.update(0.1, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null);
    if (game.police.cars[0]) {
      const c = game.police.cars[0];
      c.x = plaza.x + 22; c.z = -48; c.heading = Math.PI / 2; c.speed = 8;
    }
    stepWorld(game, 2);
    setCamera(game, 2.4, 0.32, 9, game.player);
    game.hud.toast('MISI SELESAI — Paket untuk Madame Luma · +$350', 9000);
  } else {
    // hero (default): Dario on foot at Plaza Mar, clock tower + lighthouse behind,
    // mission 1 active with beacon, traffic and pedestrians in frame
    placePlayerOnFoot(game, plaza.x + 16, plaza.z + 16, Math.PI * 0.8);
    game.missions.start(0);
    game.missions.accept();
    stepWorld(game, 3);
    setCamera(game, 2.35, 0.3, 8.5, game.player);
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

    // wanted + police spawn
    game.police.addWanted(2);
    for (let i = 0; i < 60; i++) game.police.update(1 / 30, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null);
    check('wanted-police', game.police.wanted === 2 && game.police.cars.length >= 2,
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
    game.missions.accept();
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

    // wanted decay: cops far away for 9s -> lose a star
    game.police.cars.forEach((c) => { c.x = game.player.x + 90; c.z = game.player.z + 90; });
    for (let i = 0; i < 300; i++) game.police.update(1 / 30, { x: game.player.x, z: game.player.z }, 0, game.world.colliders, game.allVehicles, null);
    check('wanted-decay', game.police.wanted < 2, `wanted ${game.police.wanted}`);
  } catch (e) {
    console.log(`SELFTEST FAIL exception — ${e.message}`);
    console.log('SELFTEST FAIL');
    return;
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? 'SELFTEST PASS' : `SELFTEST FAIL: ${failed.map((r) => r.name).join(', ')}`);
}
