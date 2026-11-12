// Procedural thorax, heart, lungs and full-skeleton geometry with High-Fidelity Anatomical Realism.
// THREE is loaded dynamically at boot, so it is injected via setThree().
let THREE;
export function setThree(t) { THREE = t; }

// Mirror a geometry across the sagittal plane (x -> -x) and restore triangle winding.
export function mirrorX(geo) {
  geo.scale(-1, 1, 1);
  const idx = geo.index;
  if (idx) for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); }
  geo.computeVertexNormals();
  return geo;
}

export function mergeGeos(list) {
  let totalPos = 0, totalNorm = 0, totalIdx = 0;
  for (const g of list) {
    const geo = g.index ? g : g.toNonIndexed();
    totalPos += geo.attributes.position.array.length;
    if (geo.attributes.normal) totalNorm += geo.attributes.normal.array.length;
    if (geo.index) totalIdx += geo.index.array.length;
  }
  const posArr = new Float32Array(totalPos);
  const normArr = new Float32Array(totalNorm);
  const idxArr = totalIdx > 0 ? new Uint32Array(totalIdx) : null;

  let posOff = 0, normOff = 0, idxOff = 0, vertCount = 0;
  for (const g of list) {
    const geo = g.index ? g : g.toNonIndexed();
    posArr.set(geo.attributes.position.array, posOff);
    if (geo.attributes.normal) normArr.set(geo.attributes.normal.array, normOff);
    if (geo.index) {
      const idx = geo.index.array;
      for (let j = 0; j < idx.length; j++) idxArr[idxOff + j] = idx[j] + vertCount;
      idxOff += idx.length;
    }
    posOff += geo.attributes.position.array.length;
    normOff += geo.attributes.normal ? geo.attributes.normal.array.length : 0;
    vertCount += geo.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  if (totalNorm > 0) merged.setAttribute("normal", new THREE.BufferAttribute(normArr, 3));
  if (idxArr) merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
  merged.computeVertexNormals();
  return merged;
}

// ------------------------------ 1. Anatomical Bony Thorax Geometry ------------------------------
export function buildBonyThoraxGeometry() {
  const geos = [];

  // 1.1 Thoracic Vertebrae T1 to T12 with heart-shaped body, transverse processes & spinous process
  for (let i = 0; i < 12; i++) {
    const y = -14.2 - i * 1.35;
    const z = -4.9;
    const r = 1.35 + (i > 6 ? 0.35 : 0.0);

    // Heart-shaped vertebral body
    const body = new THREE.CylinderGeometry(r * 0.9, r, 1.05, 16);
    body.rotateX(0.08);
    body.translate(0, y, z);
    geos.push(body);

    // Spinous process angled postero-inferiorly
    const spinLen = 1.8 + i * 0.1;
    const spin = new THREE.BoxGeometry(0.45, 0.55, spinLen);
    spin.rotateX(0.42 + i * 0.035);
    spin.translate(0, y + 0.1, z - 1.1);
    geos.push(spin);

    // Transverse processes (bilateral wings for rib tubercle articulation)
    for (const side of [-1, 1]) {
      const tp = new THREE.BoxGeometry(1.4, 0.45, 0.5);
      tp.rotateY(side * 0.35);
      tp.translate(side * 1.8, y + 0.2, z - 0.4);
      geos.push(tp);
    }
  }

  // 1.2 Flat Ribs (12 Pairs with anatomical flat ribbon profile and physiological drop/torsion)
  for (let i = 0; i < 12; i++) {
    const vertY = -14.2 - i * 1.35;
    const vertZ = -4.9;
    const spanFrac = Math.sin(((i + 1) / 13) * Math.PI);
    const halfWidth = 8.6 * spanFrac + 3.8;
    const dropY = -1.1 - i * 0.18;

    // Rib thickness & width: 1st rib is broadest and flattest
    const ribW = i === 0 ? 0.85 : 0.58;
    const ribT = 0.25;

    for (const side of [-1, 1]) {
      const p0 = new THREE.Vector3(side * 1.4, vertY, vertZ);                              // Head at vertebra
      const p1 = new THREE.Vector3(side * 3.2, vertY + 0.1, vertZ - 0.3);                  // Tubercle
      const p2 = new THREE.Vector3(side * (halfWidth * 0.72), vertY - 0.45, vertZ - 0.3);  // Angle of rib
      const p3 = new THREE.Vector3(side * halfWidth, vertY + dropY, 0.0);                  // Lateral shaft
      const p4 = new THREE.Vector3(side * (halfWidth * 0.72), vertY + dropY - 1.3, 1.8);   // Anterior costochondral junction

      const pts = i >= 10 ? [p0, p1, p2, p3] : [p0, p1, p2, p3, p4]; // Floating ribs (11 & 12)
      const curve = new THREE.CatmullRomCurve3(pts);

      // Create flat rib using TubeGeometry with elliptical cross-section scaling
      const tube = new THREE.TubeGeometry(curve, 18, (ribW + ribT) * 0.5, 8, false);
      tube.scale(ribT / ((ribW + ribT) * 0.5), ribW / ((ribW + ribT) * 0.5), 1.0);
      geos.push(tube);
    }
  }

  // 1.3 Anatomical Sternum
  // Manubrium with Suprasternal / Jugular notch
  const man = new THREE.BoxGeometry(3.6, 3.2, 0.75);
  man.translate(0, -15.2, 3.2);
  geos.push(man);

  // Sternal body (Corpus sterni) with transverse ridges
  const sternBody = new THREE.BoxGeometry(2.3, 9.4, 0.65);
  sternBody.translate(0, -21.4, 2.9);
  geos.push(sternBody);

  // Xiphoid process
  const xiphoid = new THREE.ConeGeometry(0.8, 1.8, 8);
  xiphoid.rotateX(Math.PI);
  xiphoid.translate(0, -27.0, 2.8);
  geos.push(xiphoid);

  // Clavicles (S-shaped Collarbones)
  for (const side of [-1, 1]) {
    const cp0 = new THREE.Vector3(side * 1.6, -14.0, 3.1);
    const cp1 = new THREE.Vector3(side * 7.5, -13.6, 2.3);
    const cp2 = new THREE.Vector3(side * 14.5, -13.2, 0.4);
    const cCurve = new THREE.CatmullRomCurve3([cp0, cp1, cp2]);
    const cTube = new THREE.TubeGeometry(cCurve, 14, 0.58, 8, false);
    geos.push(cTube);
  }

  return mergeGeos(geos);
}

// ------------------------------ 2. Costal Cartilage Geometry ------------------------------
export function buildCostalCartilageGeometry() {
  const geos = [];
  const cartR = 0.32;

  for (let i = 0; i < 10; i++) {
    const vertY = -14.2 - i * 1.35;
    const spanFrac = Math.sin(((i + 1) / 13) * Math.PI);
    const halfWidth = 8.6 * spanFrac + 3.8;
    const dropY = -1.1 - i * 0.18;
    const sternY = -15.5 - Math.min(i, 6) * 1.55;
    const sternZ = 3.2 - (i > 6 ? (i - 6) * 0.55 : 0.0);

    for (const side of [-1, 1]) {
      const p3 = new THREE.Vector3(side * (halfWidth * 0.72), vertY + dropY - 1.3, 1.8);
      // Ribs 1-7 attach directly to sternum; ribs 8-10 angle up to form costal margin arch
      const p4 = i < 7
        ? new THREE.Vector3(side * 1.3, sternY, sternZ)
        : new THREE.Vector3(side * (2.2 + (i - 6) * 0.9), -24.8 - (i - 6) * 0.8, sternZ);

      const curve = new THREE.CatmullRomCurve3([p3, p4]);
      const tube = new THREE.TubeGeometry(curve, 10, cartR, 6, false);
      geos.push(tube);
    }
  }
  return mergeGeos(geos);
}

// ------------------------------ 3. Anatomical 4-Chamber Heart & Great Vessels ------------------------------
export function buildRealisticHeartGeometry() {
  const geos = [];

  // 3.1 Left Ventricle (LV): Conical thick muscle; Apex points to subject's LEFT (+x), anterior, inferior
  const lv = new THREE.ConeGeometry(2.7, 5.0, 20);
  lv.rotateZ(-0.42); lv.rotateX(0.18); lv.translate(2.4, -22.2, 0.8);
  geos.push(lv);

  // 3.2 Right Ventricle (RV): Crescentic cavity anterior to interventricular septum
  const rv = new THREE.SphereGeometry(2.5, 18, 14);
  rv.scale(0.85, 1.15, 0.72); rv.rotateZ(0.15); rv.translate(0.4, -20.6, 1.2);
  geos.push(rv);

  // 3.3 Right Atrium (RA) & Right Auricle
  const ra = new THREE.SphereGeometry(2.1, 16, 12); ra.translate(-1.2, -18.6, -0.2); geos.push(ra);
  const rAur = new THREE.ConeGeometry(0.8, 1.6, 8); rAur.rotateZ(0.6); rAur.translate(-0.8, -17.8, 0.9); geos.push(rAur);

  // 3.4 Left Atrium (LA) & Left Auricle
  const la = new THREE.SphereGeometry(2.0, 16, 12); la.translate(2.8, -18.2, -0.6); geos.push(la);
  const lAur = new THREE.ConeGeometry(0.75, 1.4, 8); lAur.rotateZ(-0.5); lAur.translate(2.2, -17.5, 0.8); geos.push(lAur);

  // 3.5 Ascending Aorta & Curved Aortic Arch with 3 Supra-Aortic Branches
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.8, -18.5, 0.4),
    new THREE.Vector3(0.6, -15.2, 0.6),
    new THREE.Vector3(1.4, -14.2, 0.0),
    new THREE.Vector3(2.6, -14.8, -1.0),
    new THREE.Vector3(2.9, -19.5, -1.8)
  ]);
  const aorta = new THREE.TubeGeometry(aortaCurve, 20, 0.82, 10, false);
  geos.push(aorta);

  // 3 Branches: Brachiocephalic trunk, Left common carotid, Left subclavian artery
  const b1 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.9, -14.6, 0.4), new THREE.Vector3(0.5, -12.5, 0.8)]), 8, 0.35, 6, false);
  const b2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.6, -14.3, 0.1), new THREE.Vector3(1.6, -12.4, 0.3)]), 8, 0.30, 6, false);
  const b3 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(2.2, -14.4, -0.3), new THREE.Vector3(2.6, -12.5, -0.2)]), 8, 0.30, 6, false);
  geos.push(b1, b2, b3);

  // 3.6 Pulmonary Trunk & Bifurcation (Crosses anterior to Ascending Aorta)
  const pulmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.1, -18.8, 1.0),
    new THREE.Vector3(1.7, -16.6, 0.7),
    new THREE.Vector3(2.8, -16.2, -0.2)
  ]);
  const pulm = new THREE.TubeGeometry(pulmCurve, 14, 0.72, 8, false);
  geos.push(pulm);

  // 3.7 Superior Vena Cava (SVC)
  const svc = new THREE.CylinderGeometry(0.62, 0.62, 4.2, 10);
  svc.translate(-1.4, -15.8, -0.6);
  geos.push(svc);

  // 3.8 Coronary Arteries (Left Anterior Descending - LAD & Right Coronary Artery - RCA)
  const lad = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.4, -18.2, 1.2),
    new THREE.Vector3(1.8, -20.2, 1.3),
    new THREE.Vector3(2.3, -22.4, 1.1)
  ]), 12, 0.18, 6, false);
  geos.push(lad);

  const rca = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.3, -18.2, 1.0),
    new THREE.Vector3(-0.7, -19.6, 0.8),
    new THREE.Vector3(-0.4, -21.4, 0.4)
  ]), 12, 0.18, 6, false);
  geos.push(rca);

  return mergeGeos(geos);
}

// ------------------------------ 4. Bilateral Anatomical Lungs Geometry ------------------------------
export function buildRealisticLungsGeometry() {
  const geos = [];

  // 4.1 Right Lung (Subject's RIGHT = -x, 3 Distinct Lobes: Superior, Middle, Inferior)
  const rSuperior = new THREE.SphereGeometry(3.5, 16, 12);
  rSuperior.scale(0.85, 1.25, 0.75); rSuperior.translate(-5.2, -17.2, -0.5); geos.push(rSuperior);

  const rMiddle = new THREE.SphereGeometry(3.2, 16, 12);
  rMiddle.scale(0.85, 0.95, 0.80); rMiddle.translate(-5.4, -20.8, -0.2); geos.push(rMiddle);

  const rInferior = new THREE.SphereGeometry(3.6, 16, 12); // Base resting on diaphragm
  rInferior.scale(0.90, 1.20, 0.85); rInferior.translate(-5.2, -24.4, -0.8); geos.push(rInferior);

  // 4.2 Left Lung (Subject's LEFT = +x, 2 Lobes with deep Cardiac Notch & Lingula)
  const lSuperior = new THREE.SphereGeometry(3.4, 16, 12);
  lSuperior.scale(0.85, 1.30, 0.75); lSuperior.translate(5.2, -17.2, -0.5); geos.push(lSuperior);

  const lInferior = new THREE.SphereGeometry(3.6, 16, 12);
  lInferior.scale(0.82, 1.20, 0.82); lInferior.translate(5.5, -23.8, -1.0); geos.push(lInferior);

  // Lingula of Left Lung (Tongue-like process extending below cardiac notch)
  const lingula = new THREE.SphereGeometry(2.0, 12, 10);
  lingula.scale(0.60, 1.10, 0.60); lingula.translate(4.2, -22.2, 0.4); geos.push(lingula);

  // Main Bronchial Trachea Tree at Carina
  const trachea = new THREE.CylinderGeometry(0.75, 0.75, 4.5, 10);
  trachea.translate(0, -15.5, -3.2); geos.push(trachea);

  return mergeGeos(geos);
}

// ------------------------------ 5. Full Skeleton (Limbs & Pelvis) ------------------------------
export function buildSkeletonParts() {
  const geos = [];  // axial: lumbar spine, sacrum, pelvis
  const parts = {};
  const put = (name, side, g) => { const k = name + (side > 0 ? "L" : "R"); (parts[k] || (parts[k] = [])).push(g); };

  // Lumbar Spine (L1-L5) with massive kidney-shaped bodies and broad spinous processes
  for (let i = 0; i < 5; i++) {
    const y = -30.0 - i * 1.8;
    const z = -4.8 + i * 0.25;
    const r = 1.85 + i * 0.12;
    const lVert = new THREE.CylinderGeometry(r * 0.95, r, 1.35, 16);
    lVert.rotateX(0.06); lVert.translate(0, y, z);
    geos.push(lVert);
    const spin = new THREE.BoxGeometry(0.5, 0.7, 1.8);
    spin.translate(0, y + 0.1, z - 1.3);
    geos.push(spin);
  }

  // Pelvic Girdle & Sacrum
  const sacrum = new THREE.CylinderGeometry(1.9, 0.7, 5.2, 10);
  sacrum.rotateX(0.22); sacrum.translate(0, -42.0, -4.2);
  geos.push(sacrum);

  for (const side of [-1, 1]) {
    const ilium = new THREE.SphereGeometry(4.8, 14, 12);
    ilium.scale(0.35, 1.0, 0.85);
    ilium.rotateZ(side * 0.32); ilium.rotateY(side * 0.25);
    ilium.translate(side * 8.5, -42.5, -1.8);
    geos.push(ilium);

    const pubCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 7.5, -45.0, -1.2),
      new THREE.Vector3(side * 4.5, -48.5, 0.5),
      new THREE.Vector3(side * 1.2, -49.5, 1.8),
      new THREE.Vector3(0, -49.8, 2.0)
    ]);
    const pubTube = new THREE.TubeGeometry(pubCurve, 12, 0.65, 8, false);
    geos.push(pubTube);
  }

  // Upper Limbs (Shoulders, Humerus, Elbows, Forearm)
  for (const side of [-1, 1]) {
    const shBall = new THREE.SphereGeometry(1.4, 12, 10);
    shBall.translate(side * 15.8, -14.6, 0.4);
    put("upperArm", side, shBall);

    const humCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 15.8, -14.6, 0.4),
      new THREE.Vector3(side * 16.8, -21.0, 0.2),
      new THREE.Vector3(side * 17.5, -28.5, -0.6)
    ]);
    const humTube = new THREE.TubeGeometry(humCurve, 14, 0.88, 10, false);
    put("upperArm", side, humTube);

    const elbow = new THREE.SphereGeometry(1.2, 10, 8);
    elbow.translate(side * 17.5, -28.5, -0.6);
    put("forearm", side, elbow);

    const radCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 17.8, -29.2, -0.4),
      new THREE.Vector3(side * 18.6, -35.5, 0.0),
      new THREE.Vector3(side * 19.2, -42.0, 0.5)
    ]);
    const radTube = new THREE.TubeGeometry(radCurve, 12, 0.48, 8, false);
    put("forearm", side, radTube);

    const ulnaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 17.2, -29.2, -0.8),
      new THREE.Vector3(side * 17.8, -35.5, -0.4),
      new THREE.Vector3(side * 18.4, -42.0, 0.1)
    ]);
    const ulnaTube = new THREE.TubeGeometry(ulnaCurve, 12, 0.44, 8, false);
    put("forearm", side, ulnaTube);
  }

  // Lower Limbs (Femur, Patella, Tibia, Fibula, Feet)
  for (const side of [-1, 1]) {
    const femHead = new THREE.SphereGeometry(1.6, 12, 10);
    femHead.translate(side * 8.2, -46.5, -0.4);
    put("thigh", side, femHead);

    const femCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 8.2, -46.5, -0.4),
      new THREE.Vector3(side * 9.8, -50.0, 0.0),
      new THREE.Vector3(side * 8.6, -58.0, 0.3),
      new THREE.Vector3(side * 6.8, -67.0, 0.2)
    ]);
    const femTube = new THREE.TubeGeometry(femCurve, 18, 1.18, 10, false);
    put("thigh", side, femTube);

    const patella = new THREE.CylinderGeometry(0.9, 0.7, 0.5, 10);
    patella.rotateX(Math.PI / 2); patella.translate(side * 6.8, -67.0, 1.8);
    put("shin", side, patella);

    const knee = new THREE.SphereGeometry(1.6, 12, 10);
    knee.scale(1.1, 0.8, 1.0); knee.translate(side * 6.8, -67.5, 0.2);
    put("shin", side, knee);

    const tibCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.8, -68.5, 0.2),
      new THREE.Vector3(side * 6.5, -78.0, 0.0),
      new THREE.Vector3(side * 6.2, -88.0, -0.2)
    ]);
    const tibTube = new THREE.TubeGeometry(tibCurve, 16, 0.98, 10, false);
    put("shin", side, tibTube);

    const fibCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 8.2, -69.5, -0.4),
      new THREE.Vector3(side * 8.0, -78.0, -0.5),
      new THREE.Vector3(side * 7.5, -87.5, -0.3)
    ]);
    const fibTube = new THREE.TubeGeometry(fibCurve, 14, 0.40, 8, false);
    put("shin", side, fibTube);

    const ankle = new THREE.SphereGeometry(1.2, 10, 8);
    ankle.translate(side * 6.2, -88.0, -0.2);
    put("shin", side, ankle);

    const footCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.2, -88.0, -0.2),
      new THREE.Vector3(side * 6.2, -89.8, 1.8),
      new THREE.Vector3(side * 6.0, -90.5, 5.2),
      new THREE.Vector3(side * 5.8, -91.0, 8.5)
    ]);
    const footTube = new THREE.TubeGeometry(footCurve, 12, 0.85, 8, false);
    put("shin", side, footTube);
  }

  const out = { axial: mergeGeos(geos), segments: {} };
  for (const k in parts) out.segments[k] = mergeGeos(parts[k]);
  return out;
}

// Whole skeleton as a single mesh (rest pose) - kept for compatibility
export function buildFullSkeletonGeometry() {
  const { axial, segments } = buildSkeletonParts();
  return mergeGeos([axial, ...Object.values(segments)]);
}

// ------------------------------ 6. Brain Gyri & Sulci (รอยหยักสมอง) ------------------------------
export function applyBrainGyriAndSulci(geo) {
  const pos = geo.attributes.position.array;
  const cx = -0.04, cy = 6.36, cz = -5.60;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.1) continue;
    const nx = dx / dist, ny = dy / dist, nz = dz / dist;

    // Longitudinal fissure cleft along sagittal midline (x = 0)
    const cleft = -0.95 * Math.exp(-Math.pow(x / 0.85, 2));

    // Multi-harmonic gyral convolutions and sulcal grooves
    const s1 = Math.sin(1.85 * x + Math.cos(1.65 * y)) * Math.cos(1.75 * z + Math.sin(1.55 * x));
    const s2 = Math.sin(3.4 * y + Math.sin(2.9 * z)) * Math.cos(3.2 * x);
    const s3 = Math.sin(5.6 * z) * Math.sin(5.4 * y) * 0.5;
    const gyri = (s1 * 0.45 + s2 * 0.22 + s3 * 0.10);

    const disp = cleft + gyri;
    pos[i]     += nx * disp;
    pos[i + 1] += ny * disp;
    pos[i + 2] += nz * disp;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------ 7. Digital Brain & Deep Learning Neural Connectome ------------------------------
export function buildDigitalBrainConnectome() {
  const cx = -0.04, cy = 6.36, cz = -5.60;
  const nodes = [];
  const rng = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  let seed = 1.0;
  for (let i = 0; i < 160; i++) {
    const u = rng(seed++) * Math.PI * 2;
    const v = (rng(seed++) - 0.5) * Math.PI;
    const r = 0.35 + 0.58 * Math.cbrt(rng(seed++));
    let x = cx + r * 6.2 * Math.cos(v) * Math.cos(u);
    const y = cy + r * 6.0 * Math.sin(v) + (v > 0 ? 0.8 : -0.5);
    const z = cz + r * 7.8 * Math.cos(v) * Math.sin(u);
    if (Math.abs(x - cx) < 0.6) x += (x >= cx ? 0.6 : -0.6);
    nodes.push(new THREE.Vector3(x, y, z));
  }

  const linePositions = [];
  const lineColors = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].distanceTo(nodes[j]);
      if (d < 4.2) {
        linePositions.push(nodes[i].x, nodes[i].y, nodes[i].z);
        linePositions.push(nodes[j].x, nodes[j].y, nodes[j].z);
        // Neon cyan, electric violet, amber synapse colors
        const col = (i + j) % 3 === 0 ? [0.0, 0.94, 1.0] : (i + j) % 3 === 1 ? [0.74, 0.0, 1.0] : [1.0, 0.72, 0.0];
        lineColors.push(...col, ...col);
      }
    }
  }

  const nodesGeo = new THREE.BufferGeometry().setFromPoints(nodes);
  const axonsGeo = new THREE.BufferGeometry();
  axonsGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  axonsGeo.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));

  return { nodes, nodesGeo, axonsGeo };
}

// ------------------------------ 8. Ocular Structures & Vasculature (ดวงตาและหลอดเลือดจอตา) ------------------------------
export function buildOcularVasculature() {
  const eyeR = 1.45;
  const eyes = [
    { side: 1, cx: 3.08, cy: 2.37, cz: 2.14 },   // Subject's left eye
    { side: -1, cx: -3.08, cy: 2.37, cz: 2.14 }  // Subject's right eye
  ];

  const arteryLines = [], veinLines = [], structGeos = [];

  for (const { side, cx, cy, cz } of eyes) {
    // 1. Optic disc at posterior-nasal pole
    const discX = cx - side * 0.35;
    const discY = cy + 0.1;
    const discZ = cz - eyeR * 0.88;

    // 2. Optic nerve sheath (CN II) running back toward apex of orbit
    const nerveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(discX, discY, discZ),
      new THREE.Vector3(discX - side * 0.4, discY - 0.2, discZ - 2.8),
      new THREE.Vector3(discX - side * 0.8, discY - 0.3, discZ - 5.5)
    ]);
    structGeos.push(new THREE.TubeGeometry(nerveCurve, 12, 0.38, 8, false));

    // 3. Crystalline lens (biconvex)
    const lens = new THREE.SphereGeometry(0.55, 14, 10);
    lens.scale(1.0, 1.0, 0.45);
    lens.translate(cx, cy, cz + eyeR * 0.65);
    structGeos.push(lens);

    // 4. Retinal Vessel Arbors (Central Retinal Artery & Central Retinal Vein)
    // 4 primary quadrants: Superior Temporal, Inferior Temporal, Superior Nasal, Inferior Nasal
    const quadrants = [
      { dirX: side * 1.0, dirY: 1.0 },
      { dirX: side * 1.0, dirY: -1.0 },
      { dirX: -side * 0.8, dirY: 0.9 },
      { dirX: -side * 0.8, dirY: -0.9 }
    ];

    for (const q of quadrants) {
      for (let branch = 0; branch < 3; branch++) {
        const spread = (branch - 1) * 0.35;
        const ptsA = [], ptsV = [];
        for (let step = 0; step <= 8; step++) {
          const frac = step / 8;
          const theta = frac * 1.4;
          const rx = (q.dirX + spread * (1 - frac)) * Math.sin(theta) * eyeR * 0.88;
          const ry = (q.dirY + spread * frac * 0.5) * Math.sin(theta) * eyeR * 0.88;
          const rz = -Math.cos(theta) * eyeR * 0.88;

          const px = discX + rx, py = discY + ry, pz = cz + rz;
          ptsA.push(new THREE.Vector3(px, py, pz));
          // Vein runs alongside with slight offset
          ptsV.push(new THREE.Vector3(px + 0.04, py - 0.03, pz + 0.02));
        }
        for (let i = 0; i < ptsA.length - 1; i++) {
          arteryLines.push(ptsA[i].x, ptsA[i].y, ptsA[i].z, ptsA[i + 1].x, ptsA[i + 1].y, ptsA[i + 1].z);
          veinLines.push(ptsV[i].x, ptsV[i].y, ptsV[i].z, ptsV[i + 1].x, ptsV[i + 1].y, ptsV[i + 1].z);
        }
      }
    }

    // 5. Major Arterial Circle of Iris (Circulus arteriosus iridis) & Radial Iridial Vessels
    const irisZ = cz + eyeR * 0.82;
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      const rRing = 0.82;
      arteryLines.push(cx + Math.cos(a0) * rRing, cy + Math.sin(a0) * rRing, irisZ,
                       cx + Math.cos(a1) * rRing, cy + Math.sin(a1) * rRing, irisZ);
      arteryLines.push(cx + Math.cos(a0) * rRing, cy + Math.sin(a0) * rRing, irisZ,
                       cx + Math.cos(a0) * 0.32, cy + Math.sin(a0) * 0.32, irisZ);
    }
  }

  const arteryGeo = new THREE.BufferGeometry();
  arteryGeo.setAttribute("position", new THREE.Float32BufferAttribute(arteryLines, 3));
  const veinGeo = new THREE.BufferGeometry();
  veinGeo.setAttribute("position", new THREE.Float32BufferAttribute(veinLines, 3));
  const structuresGeo = mergeGeos(structGeos);

  return { arteryGeo, veinGeo, structuresGeo };
}
