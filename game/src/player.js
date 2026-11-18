// Dario Voss on foot: realistic-proportioned low-poly humanoid (1.8 m), natural walk/run
// swing, third-person orbit camera with mouse drag + wheel zoom, enter/exit vehicles.
import * as THREE from 'three';
import { clamp, angleDiff, angleLerp, blobTexture } from './util.js';

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.75 });
const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2e4a5e, roughness: 0.85 });
const jeansMat = new THREE.MeshStandardMaterial({ color: 0x33455e, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x22201e, roughness: 0.7 });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 });

/** Build the humanoid. Returns {group, armL, armR, legL, legR, torso, head}. */
export function createPlayerMesh() {
  const g = new THREE.Group();
  const mesh = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };
  // legs pivot at the hip (y = 0.86): capsule shin + shoe with a toe
  const legL = new THREE.Group(); legL.position.set(-0.11, 0.86, 0);
  const legR = new THREE.Group(); legR.position.set(0.11, 0.86, 0);
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.62, 4, 10);
  const shinL = mesh(legGeo, jeansMat); shinL.position.y = -0.42;
  const shinR = mesh(legGeo, jeansMat); shinR.position.y = -0.42;
  const shoeGeo = new THREE.BoxGeometry(0.17, 0.09, 0.26);
  const toeGeo = new THREE.BoxGeometry(0.16, 0.07, 0.12);
  const shoeL = mesh(shoeGeo, shoeMat); shoeL.position.set(0, -0.82, 0.03);
  const shoeR = mesh(shoeGeo, shoeMat); shoeR.position.set(0, -0.82, 0.03);
  const toeL = mesh(toeGeo, shoeMat); toeL.position.set(0, -0.83, 0.19);
  const toeR = mesh(toeGeo, shoeMat); toeR.position.set(0, -0.83, 0.19);
  legL.add(shinL, shoeL, toeL); legR.add(shinR, shoeR, toeR);
  // torso: tapered 8-sided cylinder (jacket, shoulders narrower than waist),
  // squashed front-to-back so it reads as a torso, not a tube
  const torso = mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.58, 8), jacketMat);
  torso.scale.set(1, 1, 0.6);
  torso.position.y = 1.16;
  // jacket details: ring collar + two thin front pockets
  const collar = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), new THREE.MeshStandardMaterial({ color: 0x1c2e3c, roughness: 0.85 }));
  collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.72, 1); collar.position.y = 1.46;
  const pocketGeo = new THREE.BoxGeometry(0.12, 0.14, 0.02);
  const pocketL = mesh(pocketGeo, jacketMat); pocketL.position.set(-0.1, 1.05, 0.15);
  const pocketR = mesh(pocketGeo, jacketMat); pocketR.position.set(0.1, 1.05, 0.15);
  // neck
  const neck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 10), skinMat);
  neck.position.y = 1.5;
  // arms pivot at the shoulder (y = 1.4): shoulder ball + capsule + round hand
  const armL = new THREE.Group(); armL.position.set(-0.29, 1.4, 0);
  const armR = new THREE.Group(); armR.position.set(0.29, 1.4, 0);
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.48, 4, 10);
  const ballGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const handGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const upperL = mesh(armGeo, jacketMat); upperL.position.y = -0.31;
  const upperR = mesh(armGeo, jacketMat); upperR.position.y = -0.31;
  const ballL = mesh(ballGeo, jacketMat);
  const ballR = mesh(ballGeo, jacketMat);
  const handL = mesh(handGeo, skinMat); handL.position.y = -0.64; handL.scale.set(1, 1.2, 1);
  const handR = mesh(handGeo, skinMat); handR.position.y = -0.64; handR.scale.set(1, 1.2, 1);
  armL.add(ballL, upperL, handL); armR.add(ballR, upperR, handR);
  // head: slightly oval sphere + half-sphere hair cap + small cone nose
  const head = mesh(new THREE.SphereGeometry(0.13, 16, 12), skinMat);
  head.scale.set(0.92, 1.08, 0.98);
  head.position.y = 1.62;
  const hair = mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
  hair.position.y = 1.63; hair.rotation.x = -0.15;
  const noseGeo = new THREE.ConeGeometry(0.025, 0.07, 8);
  noseGeo.rotateX(Math.PI / 2); // point forward (+Z)
  const nose = mesh(noseGeo, skinMat);
  nose.position.set(0, 1.6, 0.14);
  g.add(legL, legR, torso, collar, pocketL, pocketR, neck, armL, armR, head, hair, nose);
  // contact shadow: dark ellipse under the feet so the figure never looks
  // afloat (pedestrians share this mesh; the blob is cheap and follows the walk)
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.scale.set(0.55, 0.55, 1);
  contact.position.y = 0.02;
  g.add(contact);
  return { group: g, armL, armR, legL, legR, torso, head };
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
      x += dx * push; z += dz * push;
    }
  }
  return { x, z };
}

export class Player {
  constructor(scene, x, z) {
    const built = createPlayerMesh();
    this.mesh = built.group;
    this.parts = built;
    this.x = x; this.z = z;
    this.heading = 0; // facing +X when 0
    this.speed = 0;
    this.walkPhase = 0;
    this.inVehicle = null;
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    // hero light: a small warm point light riding with Dario so the player
    // never goes black at night and separates from the background at
    // thumbnail size (rim/fill in one cheap light; distance-limited, no
    // shadow). Only on the real player — pedestrians share createPlayerMesh
    // and must NOT each get a light.
    this.heroLight = new THREE.PointLight(0xffd9a0, 5, 9, 2);
    this.heroLight.position.set(0, 2.6, 0);
    this.mesh.add(this.heroLight);
    // camera orbit state
    this.camYaw = Math.PI * 0.75;
    this.camPitch = 0.32;
    this.camDist = 8;
    this.camPos = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
  }

  get position() { return { x: this.x, z: this.z }; }

  /** On-foot step. move: {x, z} in camera space, run bool. Returns speed. */
  updateOnFoot(dt, move, run, colliders) {
    const targetSpeed = (move.x || move.z) ? (run ? 5.6 : 3.1) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
    if (this.speed > 0.1) {
      const want = Math.atan2(-move.z, move.x);
      this.heading = angleLerp(this.heading, want, Math.min(1, dt * 10));
      let nx = this.x + Math.cos(this.heading) * this.speed * dt;
      let nz = this.z + -Math.sin(this.heading) * this.speed * dt;
      nx = clamp(nx, -100, 100); nz = clamp(nz, -100, 100);
      const fixed = collideCircleAABB(nx, nz, 0.45, colliders);
      this.x = fixed.x; this.z = fixed.z;
      this.walkPhase += dt * this.speed * 2.1;
      const swing = Math.sin(this.walkPhase) * clamp(this.speed / 5.6, 0.2, 1) * 0.65;
      this.parts.legL.rotation.x = swing;
      this.parts.legR.rotation.x = -swing;
      this.parts.armL.rotation.x = -swing * 0.8;
      this.parts.armR.rotation.x = swing * 0.8;
      this.parts.torso.position.y = 1.16 + Math.abs(Math.sin(this.walkPhase)) * 0.03;
    } else {
      this.parts.legL.rotation.x *= 0.85; this.parts.legR.rotation.x *= 0.85;
      this.parts.armL.rotation.x *= 0.85; this.parts.armR.rotation.x *= 0.85;
      // idle breathing
      this.parts.torso.position.y = 1.16 + Math.sin(performance.now() * 0.0016) * 0.008;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading + Math.PI / 2; // model faces +Z; Ry(h+PI/2) maps +Z to (cos h, -sin h)
    return this.speed;
  }

  enterVehicle(vehicle) {
    this.inVehicle = vehicle;
    this.mesh.visible = false;
    this.speed = 0;
  }
  exitVehicle() {
    const v = this.inVehicle;
    if (!v) return;
    this.inVehicle = null;
    // step out to the left side of the car
    const side = v.heading + Math.PI / 2;
    this.x = v.x + Math.cos(side) * 1.8;
    this.z = v.z + -Math.sin(side) * 1.8;
    this.heading = v.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  /** Smooth third-person camera. target: {x, z, heading?, speed?} or a Vehicle. */
  updateCamera(dt, camera, focus, inCar) {
    const fx = focus.x, fz = focus.z;
    const dist = inCar ? this.camDist + 2.5 : this.camDist;
    const height = inCar ? 3.4 : 2.6;
    const cx = fx - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = fz + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = height + Math.sin(this.camPitch) * dist;
    const k = 1 - Math.exp(-dt * (inCar ? 5 : 8));
    this.camPos.x += (cx - this.camPos.x) * k;
    this.camPos.y += (cy - this.camPos.y) * k;
    this.camPos.z += (cz - this.camPos.z) * k;
    camera.position.copy(this.camPos);
    this.lookTarget.set(fx, inCar ? 1.2 : 1.5, fz);
    camera.lookAt(this.lookTarget);
  }

  snapCamera(focus, inCar) {
    const dist = inCar ? this.camDist + 2.5 : this.camDist;
    const height = inCar ? 3.4 : 2.6;
    this.camPos.set(
      focus.x - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist,
      height + Math.sin(this.camPitch) * dist,
      focus.z + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist,
    );
  }

  /** Camera-space move vector from WASD keys. */
  moveVectorFromKeys(keys) {
    let fx = 0, fz = 0;
    const cy = this.camYaw;
    // camera forward on the ground plane: (cos yaw, -sin yaw) in world x/z
    const fwdX = Math.cos(cy), fwdZ = -Math.sin(cy);
    const rightX = Math.sin(cy), rightZ = Math.cos(cy);
    if (keys['KeyW'] || keys['ArrowUp']) { fx += fwdX; fz += fwdZ; }
    if (keys['KeyS'] || keys['ArrowDown']) { fx -= fwdX; fz -= fwdZ; }
    if (keys['KeyA'] || keys['ArrowLeft']) { fx += rightX; fz += rightZ; }
    if (keys['KeyD'] || keys['ArrowRight']) { fx -= rightX; fz -= rightZ; }
    const len = Math.hypot(fx, fz);
    if (len > 0.01) { fx /= len; fz /= len; }
    return { x: fx, z: fz };
  }
}
