// Body rig driven by MediaPipe Pose (33 landmarks).
//
// Coordinate conventions (verified against the face model: landmark 33 = subject's right eye at x<0):
//   model space : +x = subject's LEFT, +y = up, +z = anterior (front). Units ≈ cm, origin near head centre.
//   camera space: three.js camera at origin looking -z, unmirrored image (subject's left appears image-right).
//   MediaPipe world landmarks: metres, hip-centred, x = image right, y = down, z = away from camera.
//
// The torso (ribs, heart, lungs, spine, pelvis) moves as one rigid frame built from the shoulder and hip
// landmarks. Arms and legs are separate segments rotated to follow the elbow/wrist/knee/ankle directions.

let THREE;

export const LM = { NOSE: 0, L_SH: 11, R_SH: 12, L_EL: 13, R_EL: 14, L_WR: 15, R_WR: 16,
                    L_HIP: 23, R_HIP: 24, L_KN: 25, R_KN: 26, L_AN: 27, R_AN: 28 };

// Rest-pose joint centres for the +x (left) side; the right side mirrors x. Must match procedural.js.
export const REST = {
  shoulder: [15.8, -14.6, 0.4], elbow: [17.5, -28.5, -0.6], wrist: [18.8, -42.0, 0.3],
  hip: [8.2, -46.5, -0.4], knee: [6.8, -67.5, 0.2], ankle: [6.2, -88.0, -0.2]
};
// Point of the model pinned to the on-screen shoulder midpoint.
export const ANCHOR = [0, -14.6, 0.4];

// Segment chain: parent must come before child.
export const SEGMENTS = [
  { name: "upperArm", from: "shoulder", to: "elbow", a: "SH", b: "EL" },
  { name: "forearm",  from: "elbow",    to: "wrist", a: "EL", b: "WR", parent: "upperArm" },
  { name: "thigh",    from: "hip",      to: "knee",  a: "HIP", b: "KN" },
  { name: "shin",     from: "knee",     to: "ankle", a: "KN", b: "AN", parent: "thigh" }
];
export const segKey = (name, side) => name + (side > 0 ? "L" : "R");

const VIS_MIN = 0.5;       // MediaPipe visibility threshold
const LOST_MS = 400;       // fall back to head-anchored torso after this long without a pose

export function createBodyRig(three) {
  THREE = three;
  const rig = {
    active: false, lastSeen: -1e9,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1,
    matrix: new THREE.Matrix4(),
    seg: {},
    info: { torsoYaw: 0, torsoLean: 0, shoulderTilt: 0, elbowL: null, elbowR: null, kneeL: null, kneeR: null },
    regions: { head: false, thorax: false, armL: false, armR: false, pelvis: false, legL: false, legR: false },
    _v: Array.from({ length: 8 }, () => new THREE.Vector3()),
    _q: new THREE.Quaternion(), _qi: new THREE.Quaternion(), _m: new THREE.Matrix4(), _m2: new THREE.Matrix4()
  };
  for (const s of SEGMENTS) for (const side of [1, -1]) {
    const v = p => new THREE.Vector3(p[0] * side, p[1], p[2]);
    const from = v(REST[s.from]), to = v(REST[s.to]);
    rig.seg[segKey(s.name, side)] = {
      def: s, side, from, to, restDir: to.clone().sub(from).normalize(),
      quat: new THREE.Quaternion(), matrix: new THREE.Matrix4()
    };
  }
  return rig;
}

const toCam = (w, out) => out.set(w.x, -w.y, -w.z);
const visible = (lms, ...ids) => ids.every(i => lms[i] && (lms[i].visibility === undefined || lms[i].visibility >= VIS_MIN));
const angleDeg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 57.29578;

/**
 * Update the rig for one frame.
 * @param rig        from createBodyRig
 * @param pose       { world: [33 landmarks] , image?: [33 landmarks] } or null
 * @param headMatrix headGroup.matrix (legacy anchor; supplies depth and fallback transform)
 * @param headScale  uniform scale of the head model (model units → camera units)
 * @param cam        perspective camera with the screen-fit-corrected projection
 * @param now        ms timestamp
 */
export function updateBodyRig(rig, pose, headMatrix, headScale, cam, now, headFound = true) {
  const [vx, vy, vz, a, b, p, q] = rig._v;
  const world = pose && pose.world;
  const img = pose && pose.image;

  // Detect active anatomical regions in frame
  rig.regions.head = !!headFound || (!!img && visible(img, LM.NOSE));
  rig.regions.thorax = !!(world && visible(world, LM.L_SH, LM.R_SH));
  rig.regions.armL = !!(world && visible(world, LM.L_SH, LM.L_EL));
  rig.regions.armR = !!(world && visible(world, LM.R_SH, LM.R_EL));
  rig.regions.pelvis = !!(world && visible(world, LM.L_HIP, LM.R_HIP));
  rig.regions.legL = !!(world && visible(world, LM.L_HIP, LM.L_KN));
  rig.regions.legR = !!(world && visible(world, LM.R_HIP, LM.R_KN));

  const hasShoulders = world && visible(world, LM.L_SH, LM.R_SH) && (!img || visible(img, LM.L_SH, LM.R_SH));
  const hasSingleArm = !hasShoulders && world && img && (visible(img, LM.L_SH, LM.L_EL) || visible(img, LM.R_SH, LM.R_EL));
  const hasLegsOnly = !hasShoulders && !hasSingleArm && world && img && (visible(img, LM.L_HIP, LM.L_KN) || visible(img, LM.R_HIP, LM.R_KN));

  if (hasShoulders) {
    // ---- torso orientation (camera space) ----
    toCam(world[LM.L_SH], a); toCam(world[LM.R_SH], b);
    vx.subVectors(a, b).normalize();                       // model +x = subject's left
    const shMid = p.addVectors(a, b).multiplyScalar(0.5);
    if (visible(world, LM.L_HIP, LM.R_HIP)) {
      toCam(world[LM.L_HIP], a); toCam(world[LM.R_HIP], b);
      vy.subVectors(shMid, q.addVectors(a, b).multiplyScalar(0.5));
    } else vy.set(0, 1, 0);                                // seated / hips out of frame: assume upright
    vy.addScaledVector(vx, -vy.dot(vx)).normalize();
    vz.crossVectors(vx, vy);
    rig._m.makeBasis(vx, vy, vz);
    rig._q.setFromRotationMatrix(rig._m);

    // ---- anchor position: keep head depth if headFound, else estimate depth from shoulder span ----
    if (headFound) {
      p.fromArray(ANCHOR).applyMatrix4(headMatrix);
    } else if (img) {
      const L = img[LM.L_SH], R = img[LM.R_SH];
      const ndcSpan = Math.hypot((L.x - R.x) * 2, (L.y - R.y) * 2);
      const projX = cam.projectionMatrix.elements[0] || 1.5;
      const dist = Math.max(25, Math.min(260, (31.6 * projX) / Math.max(0.08, ndcSpan)));
      p.set(0, 0, -dist);
    }
    if (img) {
      const L = img[LM.L_SH], R = img[LM.R_SH];
      p.applyMatrix4(cam.projectionMatrix);
      p.x = (L.x + R.x) - 1; p.y = 1 - (L.y + R.y);        // NDC of the midpoint
      p.applyMatrix4(cam.projectionMatrixInverse);
    }

    const fresh = !rig.active;
    if (fresh) { rig.quat.copy(rig._q); rig.pos.copy(p); rig.scale = headScale; }
    else { rig.quat.slerp(rig._q, 0.45); rig.pos.lerp(p, 0.55); rig.scale += (headScale - rig.scale) * 0.3; }
    rig.active = true; rig.lastSeen = now;
  } else if (hasSingleArm) {
    // ---- Single-Arm Regional Anchoring (when face & opposite shoulder are out of frame) ----
    const side = visible(img, LM.L_SH, LM.L_EL) ? 1 : -1;
    const shIdx = side > 0 ? LM.L_SH : LM.R_SH;
    const elIdx = side > 0 ? LM.L_EL : LM.R_EL;
    const shImg = img[shIdx], elImg = img[elIdx];
    const ndcArm = Math.hypot((shImg.x - elImg.x) * 2, (shImg.y - elImg.y) * 2);
    const projX = cam.projectionMatrix.elements[0] || 1.5;
    const dist = Math.max(25, Math.min(220, (14.2 * projX) / Math.max(0.06, ndcArm)));

    rig._q.identity();
    p.set(0, 0, -dist);
    p.applyMatrix4(cam.projectionMatrix);
    // Offset so the shoulder joint aligns with shImg
    p.x = (shImg.x * 2 - 1) - (side * 15.8 * projX) / dist;
    p.y = (1 - shImg.y * 2);
    p.applyMatrix4(cam.projectionMatrixInverse);

    const fresh = !rig.active;
    if (fresh) { rig.quat.copy(rig._q); rig.pos.copy(p); rig.scale = 1.0; }
    else { rig.quat.slerp(rig._q, 0.4); rig.pos.lerp(p, 0.5); rig.scale += (1.0 - rig.scale) * 0.3; }
    rig.active = true; rig.lastSeen = now;
  } else if (hasLegsOnly) {
    // ---- Lower-Limb / Pelvis Regional Anchoring ----
    const side = visible(img, LM.L_HIP, LM.L_KN) ? 1 : -1;
    const hpIdx = side > 0 ? LM.L_HIP : LM.R_HIP;
    const knIdx = side > 0 ? LM.L_KN : LM.R_KN;
    const hpImg = img[hpIdx], knImg = img[knIdx];
    const ndcThigh = Math.hypot((hpImg.x - knImg.x) * 2, (hpImg.y - knImg.y) * 2);
    const projX = cam.projectionMatrix.elements[0] || 1.5;
    const dist = Math.max(30, Math.min(260, (21.0 * projX) / Math.max(0.06, ndcThigh)));

    rig._q.identity();
    p.set(0, 0, -dist);
    p.applyMatrix4(cam.projectionMatrix);
    p.x = (hpImg.x * 2 - 1) - (side * 8.2 * projX) / dist;
    p.y = (1 - hpImg.y * 2) + (31.9 * projX) / dist;
    p.applyMatrix4(cam.projectionMatrixInverse);

    const fresh = !rig.active;
    if (fresh) { rig.quat.copy(rig._q); rig.pos.copy(p); rig.scale = 1.0; }
    else { rig.quat.slerp(rig._q, 0.4); rig.pos.lerp(p, 0.5); rig.scale += (1.0 - rig.scale) * 0.3; }
    rig.active = true; rig.lastSeen = now;
  }

  if (hasShoulders || hasSingleArm || hasLegsOnly) {
    // ---- clinical read-outs ----
    if (hasShoulders) {
      rig.info.torsoYaw = Math.atan2(vx.z, vx.x) * -57.29578;
      rig.info.shoulderTilt = Math.asin(Math.max(-1, Math.min(1, vx.y))) * 57.29578;
      rig.info.torsoLean = Math.atan2(vy.z, vy.y) * 57.29578;
    }

    // ---- limbs: target directions in model space ----
    rig._qi.copy(rig.quat).invert();
    for (const s of SEGMENTS) for (const side of [1, -1]) {
      const sg = rig.seg[segKey(s.name, side)];
      const pre = side > 0 ? "L_" : "R_", ia = LM[pre + s.a], ib = LM[pre + s.b];
      const ok = visible(world, ia, ib) && (!img || visible(img, ia, ib));
      if (ok) {
        toCam(world[ib], a).sub(toCam(world[ia], b)).normalize().applyQuaternion(rig._qi);
        rig._q.setFromUnitVectors(sg.restDir, a);
      } else rig._q.identity();
      sg.quat.slerp(rig._q, ok ? 0.5 : 0.12);
      sg.tracked = ok;
    }
  } else if (rig.active && now - rig.lastSeen > LOST_MS) {
    rig.active = false;
  }

  if (!rig.active) {
    rig.matrix.copy(headMatrix);                            // legacy behaviour: torso hangs from the head
    for (const k in rig.seg) { rig.seg[k].quat.identity(); rig.seg[k].tracked = false; }
  } else {
    rig._m.makeTranslation(-ANCHOR[0], -ANCHOR[1], -ANCHOR[2]);
    rig.matrix.compose(rig.pos, rig.quat, a.set(rig.scale, rig.scale, rig.scale)).multiply(rig._m);
  }

  // segment matrices in model space: T(joint) · R · T(-restJoint); children start at the parent's moved end
  for (const s of SEGMENTS) for (const side of [1, -1]) {
    const sg = rig.seg[segKey(s.name, side)];
    if (s.parent) b.copy(sg.from).applyMatrix4(rig.seg[segKey(s.parent, side)].matrix); else b.copy(sg.from);
    rig._m.makeRotationFromQuaternion(sg.quat).setPosition(b);
    sg.matrix.multiplyMatrices(rig._m, rig._m2.makeTranslation(-sg.from.x, -sg.from.y, -sg.from.z));
  }

  // joint flexion angles (180° = straight) from the rig, for the clinical panel
  const flex = (up, low, side) => {
    const u = rig.seg[segKey(up, side)], l = rig.seg[segKey(low, side)];
    if (!u.tracked || !l.tracked) return null;
    a.copy(u.restDir).applyQuaternion(u.quat); b.copy(l.restDir).applyQuaternion(l.quat);
    return 180 - angleDeg(a, b);
  };
  rig.info.elbowL = flex("upperArm", "forearm", 1); rig.info.elbowR = flex("upperArm", "forearm", -1);
  rig.info.kneeL = flex("thigh", "shin", 1);        rig.info.kneeR = flex("thigh", "shin", -1);
  return rig;
}

