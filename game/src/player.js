// Dario Voss on foot: realistic-proportioned low-poly humanoid (1.8 m), natural walk/run
// swing, third-person orbit camera with mouse drag + wheel zoom, enter/exit vehicles.
import * as THREE from 'three';
import { clamp, angleDiff, angleLerp } from './util.js';

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.75 });
const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2e4a5e, roughness: 0.85 });
const jeansMat = new THREE.MeshStandardMaterial({ color: 0x33455e, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x22201e, roughness: 0.7 });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 });

/** Build the humanoid. Returns {group, armL, armR, legL, legR, torso}. */
export function createPlayerMesh() {
  const g = new THREE.Group();
  const mk = (mat, w, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  };
  // legs pivot at the hip (y = 0.86)
  const legL = new THREE.Group(); legL.position.set(-0.11, 0.86, 0);
  const legR = new THREE.Group(); legR.position.set(0.11, 0.86, 0);
  const shinL = mk(jeansMat, 0.16, 0.82, 0.19); shinL.position.y = -0.41;
  const shinR = mk(jeansMat, 0.16, 0.82, 0.19); shinR.position.y = -0.41;
  const shoeL = mk(shoeMat, 0.17, 0.09, 0.3); shoeL.position.set(0, -0.82, 0.05);
  const shoeR = mk(shoeMat, 0.17, 0.09, 0.3); shoeR.position.set(0, -0.82, 0.05);
  legL.add(shinL, shoeL); legR.add(shinR, shoeR);
  // torso
  const torso = mk(jacketMat, 0.46, 0.58, 0.26); torso.position.y = 1.16;
  // jacket details: collar + pocket strip
  const collar = mk(new THREE.MeshStandardMaterial({ color: 0x1c2e3c, roughness: 0.85 }), 0.3, 0.08, 0.28);
  collar.position.y = 1.46; g.add(collar);
  // arms pivot at the shoulder (y = 1.4)
  const armL = new THREE.Group(); armL.position.set(-0.29, 1.4, 0);
  const armR = new THREE.Group(); armR.position.set(0.29, 1.4, 0);
  const upperL = mk(jacketMat, 0.13, 0.6, 0.15); upperL.position.y = -0.3;
  const upperR = mk(jacketMat, 0.13, 0.6, 0.15); upperR.position.y = -0.3;
  const handL = mk(skinMat, 0.12, 0.12, 0.13); handL.position.y = -0.64;
  const handR = mk(skinMat, 0.12, 0.12, 0.13); handR.position.y = -0.64;
  armL.add(upperL, handL); armR.add(upperR, handR);
  // head + hair
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), skinMat);
  head.position.y = 1.62; head.castShadow = true;
  const hair = mk(hairMat, 0.26, 0.1, 0.26); hair.position.y = 1.76;
  const nose = mk(skinMat, 0.05, 0.07, 0.05); nose.position.set(0, 1.6, 0.14);
  g.add(legL, legR, torso, armL, armR, head, hair, nose);
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
