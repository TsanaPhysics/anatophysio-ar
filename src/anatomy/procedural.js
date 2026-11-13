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

/**
 * Custom anatomical bone lofting builder along a 3D CatmullRomCurve3.
 * Uses parallel transport frames to prevent twisting and supports non-uniform
 * cross-sections (epiphyseal flares, condyles, bone crests, and flat blades).
 */
export function buildLoftedBone(points, profileFn, segsL = 22, segsR = 14, closedEnds = true) {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions = [];
  const indices = [];

  let tan = curve.getTangentAt(0).normalize();
  const ref = Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const norm = new THREE.Vector3().crossVectors(tan, ref).normalize();
  const binorm = new THREE.Vector3().crossVectors(tan, norm).normalize();

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL;
    const pos = curve.getPointAt(t);
    const nextTan = curve.getTangentAt(t).normalize();

    const dot = Math.max(-1, Math.min(1, tan.dot(nextTan)));
    if (dot < 0.9999) {
      const axis = new THREE.Vector3().crossVectors(tan, nextTan);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        norm.applyAxisAngle(axis, Math.acos(dot)).normalize();
      }
    }
    tan = nextTan;
    binorm.crossVectors(tan, norm).normalize();

    for (let j = 0; j < segsR; j++) {
      const theta = (j / segsR) * Math.PI * 2;
      const prof = profileFn(t, theta);
      const rx = typeof prof === "number" ? prof : prof.rx;
      const ry = typeof prof === "number" ? prof : prof.ry;

      const c = Math.cos(theta) * rx;
      const s = Math.sin(theta) * ry;
      positions.push(
        pos.x + norm.x * c + binorm.x * s,
        pos.y + norm.y * c + binorm.y * s,
        pos.z + norm.z * c + binorm.z * s
      );
    }
  }

  for (let i = 0; i < segsL; i++) {
    const row1 = i * segsR;
    const row2 = (i + 1) * segsR;
    for (let j = 0; j < segsR; j++) {
      const nextJ = (j + 1) % segsR;
      const a = row1 + j, b = row1 + nextJ, c = row2 + nextJ, d = row2 + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (closedEnds) {
    const pStart = curve.getPointAt(0);
    const startIdx = positions.length / 3;
    positions.push(pStart.x, pStart.y, pStart.z);
    for (let j = 0; j < segsR; j++) indices.push(startIdx, (j + 1) % segsR, j);

    const pEnd = curve.getPointAt(1);
    const endIdx = positions.length / 3;
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    const lastRow = segsL * segsR;
    for (let j = 0; j < segsR; j++) indices.push(endIdx, lastRow + j, lastRow + ((j + 1) % segsR));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to construct a high-fidelity anatomical vertebra with kidney-shaped
 * concave-waisted body, intervertebral disc, neural arch, transverse & spinous processes.
 */
function addVertebra(geos, y, z, r, h, spinLen, spinTilt, tpWidth) {
  // Concave-waisted kidney-shaped vertebral body
  const body = buildLoftedBone(
    [new THREE.Vector3(0, y + h * 0.48, z), new THREE.Vector3(0, y, z), new THREE.Vector3(0, y - h * 0.48, z)],
    (t, th) => {
      const waist = 1.0 - 0.14 * Math.sin(t * Math.PI);
      const kidney = 1.0 - 0.15 * Math.exp(-Math.pow(Math.sin(th) + 1.0, 2)); // posterior spinal canal notch
      return { rx: r * 1.15 * waist * kidney, ry: r * 0.88 * waist * kidney };
    },
    6, 14, true
  );
  geos.push(body);

  // Spinous process (tapered, angled posteriorly and inferiorly)
  const spinPts = [
    new THREE.Vector3(0, y + 0.1, z - r * 0.8),
    new THREE.Vector3(0, y - spinTilt * 0.5, z - r * 0.8 - spinLen * 0.5),
    new THREE.Vector3(0, y - spinTilt, z - r * 0.8 - spinLen)
  ];
  const spin = buildLoftedBone(spinPts, (t) => ({
    rx: 0.22 * (1 - 0.45 * t),
    ry: 0.36 * (1 - 0.3 * t)
  }), 5, 8, true);
  geos.push(spin);

  // Bilateral pedicles & transverse processes
  for (const side of [-1, 1]) {
    const tpPts = [
      new THREE.Vector3(side * r * 0.65, y + 0.1, z - r * 0.4),
      new THREE.Vector3(side * (r * 0.65 + tpWidth * 0.55), y + 0.15, z - r * 0.75),
      new THREE.Vector3(side * (r * 0.65 + tpWidth), y + 0.1, z - r * 0.95)
    ];
    const tp = buildLoftedBone(tpPts, (t) => ({
      rx: 0.28 * (1 + 0.2 * Math.sin(t * Math.PI)),
      ry: 0.22 * (1 - 0.25 * t)
    }), 5, 8, true);
    geos.push(tp);
  }
}

// ------------------------------ 1. Anatomical Bony Thorax Geometry ------------------------------
export function buildBonyThoraxGeometry() {
  const geos = [];

  // 1.0 Cervical Vertebrae C1-C7 (with physiological cervical lordosis connecting skull to T1)
  for (let i = 0; i < 7; i++) {
    const y = -5.6 - i * 1.15;
    const lordosis = Math.sin((i / 6) * Math.PI) * 0.65;
    const z = -4.9 + lordosis;
    const r = 1.02 + i * 0.04;
    addVertebra(geos, y, z, r, 0.85, 1.0 + i * 0.14, 0.35, 0.95);
  }

  // 1.1 Thoracic Vertebrae T1 to T12 with kidney-shaped body, neural arch, transverse & spinous processes
  for (let i = 0; i < 12; i++) {
    const y = -14.2 - i * 1.35;
    const kyphosis = -Math.sin((i / 11) * Math.PI) * 0.95;
    const z = -4.9 + kyphosis;
    const r = 1.32 + (i > 6 ? 0.35 : i * 0.04);
    addVertebra(geos, y, z, r, 1.05, 1.75 + i * 0.08, 0.85 + i * 0.04, 1.25);
  }

  // 1.2 Flat Ribbon Ribs (12 Pairs with true local elliptical cross-section, neck, costal angle & drop)
  for (let i = 0; i < 12; i++) {
    const vertY = -14.2 - i * 1.35;
    const kyphosis = -Math.sin((i / 11) * Math.PI) * 0.95;
    const vertZ = -4.9 + kyphosis;
    const spanFrac = Math.sin(((i + 1) / 13) * Math.PI);
    const halfWidth = 8.6 * spanFrac + 3.8;
    const dropY = -1.1 - i * 0.18;

    const ribH = i === 0 ? 0.58 : 0.44;
    const ribT = 0.17;

    for (const side of [-1, 1]) {
      const p0 = new THREE.Vector3(side * 1.35, vertY, vertZ);                              // Head at vertebra
      const p1 = new THREE.Vector3(side * 3.1, vertY + 0.1, vertZ - 0.55);                  // Neck & Tubercle
      const p2 = new THREE.Vector3(side * (halfWidth * 0.72), vertY - 0.45, vertZ - 0.65);  // Costal Angle
      const p3 = new THREE.Vector3(side * halfWidth, vertY + dropY, 0.0);                   // Lateral shaft
      const p4 = new THREE.Vector3(side * (halfWidth * 0.72), vertY + dropY - 1.3, 1.9);    // Costochondral junction

      const pts = i >= 10 ? [p0, p1, p2, p3] : [p0, p1, p2, p3, p4];
      const rib = buildLoftedBone(pts, (t) => {
        const neck = 1.0 - 0.18 * Math.exp(-Math.pow((t - 0.12) * 8, 2));
        return { rx: ribT * neck, ry: ribH * neck };
      }, 20, 10, true);
      geos.push(rib);
    }
  }

  // 1.3 Anatomical Sternum (Lofted Manubrium with jugular notch, Corpus sterni, Xiphoid)
  const sternPts = [
    new THREE.Vector3(0, -13.6, 3.3),  // Top of manubrium
    new THREE.Vector3(0, -15.3, 3.1),  // Manubrium center
    new THREE.Vector3(0, -17.0, 3.0),  // Sternal angle (Angle of Louis)
    new THREE.Vector3(0, -21.5, 2.9),  // Corpus sterni
    new THREE.Vector3(0, -26.2, 2.8),  // Xiphisternal junction
    new THREE.Vector3(0, -28.0, 2.75)  // Xiphoid tip
  ];
  const sternum = buildLoftedBone(sternPts, (t) => {
    let w = 1.15;
    if (t < 0.25) w = 1.95 - 2.2 * Math.pow(t - 0.1, 2);   // Broad manubrium
    else if (t < 0.8) w = 1.15 + 0.15 * Math.sin(((t - 0.25) / 0.55) * Math.PI); // Corpus
    else w = 1.15 * Math.max(0.18, 1.0 - (t - 0.8) / 0.22); // Tapered xiphoid
    return { rx: w, ry: 0.38 * (1 - 0.35 * t) };
  }, 18, 10, true);
  geos.push(sternum);

  // 1.4 Clavicles (True S-shaped Collarbones with sternal & acromial epiphyseal flares)
  for (const side of [-1, 1]) {
    const cPts = [
      new THREE.Vector3(side * 1.4, -13.9, 3.15),   // Sternal end
      new THREE.Vector3(side * 5.2, -13.5, 3.55),   // Anterior convex medial curve
      new THREE.Vector3(side * 10.2, -13.3, 1.85),  // Posterior concave lateral curve
      new THREE.Vector3(side * 15.2, -13.1, 0.35)   // Acromial end
    ];
    const clav = buildLoftedBone(cPts, (t) => {
      const flare = 1.0 + 0.55 * Math.exp(-Math.pow(t * 5, 2)) + 0.45 * Math.exp(-Math.pow((1 - t) * 5, 2));
      return { rx: 0.48 * flare, ry: 0.36 * flare };
    }, 16, 10, true);
    geos.push(clav);
  }

  // 1.5 Scapulae (Bilateral Shoulder Blades: triangular body, scapular spine, acromion, glenoid)
  for (const side of [-1, 1]) {
    // Scapular flat blade (curved along posterior ribcage)
    const bladePts = [
      new THREE.Vector3(side * 9.5, -14.8, -5.3),   // Superior-medial angle
      new THREE.Vector3(side * 11.0, -18.5, -5.0),  // Mid-blade
      new THREE.Vector3(side * 9.8, -23.4, -4.4)    // Inferior angle
    ];
    const blade = buildLoftedBone(bladePts, (t) => {
      const w = 2.6 * Math.sin(t * Math.PI * 0.78 + 0.32);
      return { rx: Math.max(0.4, w), ry: 0.22 };
    }, 10, 10, true);
    geos.push(blade);

    // Spine of Scapula & Acromion process arching over shoulder joint
    const spinePts = [
      new THREE.Vector3(side * 8.4, -16.4, -5.6),
      new THREE.Vector3(side * 12.8, -15.2, -4.2),
      new THREE.Vector3(side * 15.6, -13.4, -1.2),
      new THREE.Vector3(side * 15.8, -13.1, 0.3)    // Meets acromial end of clavicle
    ];
    const scSpine = buildLoftedBone(spinePts, (t) => ({
      rx: 0.38 + 0.25 * t,
      ry: 0.55 * (1 - 0.3 * t)
    }), 12, 8, true);
    geos.push(scSpine);
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

// ------------------------------ 5. Full Skeleton (Limbs & Pelvis - High-Fidelity Anatomical Bones) ------------------------------
export function buildSkeletonParts() {
  const geos = [];  // axial: lumbar spine, sacrum, coccyx, pelvic girdle
  const parts = {};
  const put = (name, side, g) => { const k = name + (side > 0 ? "L" : "R"); (parts[k] || (parts[k] = [])).push(g); };

  // 5.1 Lumbar Spine (L1-L5) with physiological lumbar lordosis, massive kidney-shaped bodies & hatchet spinous processes
  for (let i = 0; i < 5; i++) {
    const y = -30.2 - i * 1.85;
    const lordosis = Math.sin((i / 4) * Math.PI) * 1.1;
    const z = -4.6 + lordosis;
    const r = 1.75 + i * 0.14;
    addVertebra(geos, y, z, r, 1.38, 2.05, 0.25, 1.55);
  }

  // 5.2 Sacrum (triangular fused sacral segments S1-S5) & Coccyx
  const sacrumPts = [
    new THREE.Vector3(0, -39.2, -4.1),  // Sacral promontory
    new THREE.Vector3(0, -41.5, -5.0),  // Posterior sacral curve
    new THREE.Vector3(0, -44.2, -4.8),
    new THREE.Vector3(0, -46.2, -3.7)   // Apex / Coccyx tip
  ];
  const sacrum = buildLoftedBone(sacrumPts, (t) => {
    const w = 3.2 * (1 - 0.82 * t);
    const d = 1.05 * (1 - 0.72 * t);
    const segBump = 1.0 + 0.08 * Math.sin(t * Math.PI * 10);
    return { rx: Math.max(0.25, w * segBump), ry: Math.max(0.2, d * segBump) };
  }, 16, 12, true);
  geos.push(sacrum);

  // 5.3 Pelvic Girdle (Os Coxae: Iliac Wing/Crest, Acetabulum, Ischial Tuberosity & Pubic Symphysis)
  for (const side of [-1, 1]) {
    // Iliac Wing (Curved fan-shaped plate swept from sacroiliac joint to ASIS)
    const iliumPts = [
      new THREE.Vector3(side * 2.8, -40.5, -4.4),  // Posterior Superior Iliac Spine (PSIS)
      new THREE.Vector3(side * 7.2, -38.8, -2.5),  // Iliac Crest arch
      new THREE.Vector3(side * 10.2, -41.0, 0.2),  // Lateral Iliac Crest
      new THREE.Vector3(side * 8.6, -45.5, -0.3)   // Acetabular roof
    ];
    const ilium = buildLoftedBone(iliumPts, (t) => {
      const flare = 1.6 + 1.45 * Math.sin(t * Math.PI);
      return { rx: 0.48, ry: flare };
    }, 14, 12, true);
    geos.push(ilium);

    // Acetabulum (Hip socket cup rim)
    const acetabulum = new THREE.TorusGeometry(1.75, 0.48, 8, 16);
    acetabulum.rotateY(side * 1.15);
    acetabulum.translate(side * 8.2, -46.5, -0.4);
    geos.push(acetabulum);

    // Superior Pubic Ramus -> Pubic Symphysis
    const pubSup = buildLoftedBone([
      new THREE.Vector3(side * 8.0, -46.6, -0.2),
      new THREE.Vector3(side * 4.5, -48.6, 1.4),
      new THREE.Vector3(side * 0.4, -49.5, 2.2)
    ], (t) => ({ rx: 0.55 - 0.1 * t, ry: 0.72 }), 10, 8, true);
    geos.push(pubSup);

    // Ischial Tuberosity & Inferior Pubic Ramus (forming Obturator Foramen loop)
    const ischium = buildLoftedBone([
      new THREE.Vector3(side * 8.0, -47.2, -0.8),
      new THREE.Vector3(side * 6.8, -50.8, -1.6),  // Ischial tuberosity
      new THREE.Vector3(side * 3.2, -51.2, 0.6),
      new THREE.Vector3(side * 0.4, -49.8, 2.1)    // Meets pubic symphysis
    ], (t) => {
      const tub = 1.0 + 0.55 * Math.exp(-Math.pow((t - 0.35) * 5, 2));
      return { rx: 0.58 * tub, ry: 0.65 * tub };
    }, 12, 8, true);
    geos.push(ischium);
  }

  // 5.4 Upper Limbs (Humerus, Radius, Ulna with true epiphyseal flares, condyles & olecranon)
  for (const side of [-1, 1]) {
    // Humeral Head (Hemispherical articular surface angled medially into glenoid)
    const humHead = new THREE.SphereGeometry(1.55, 14, 12);
    humHead.scale(1.05, 1.0, 0.95);
    humHead.translate(side * 15.3, -14.5, 0.4);
    put("upperArm", side, humHead);

    // Greater Tubercle
    const gTub = new THREE.SphereGeometry(0.95, 10, 8);
    gTub.translate(side * 16.5, -14.7, 0.5);
    put("upperArm", side, gTub);

    // Humerus Shaft & Distal Epicondyles / Trochlea
    const humPts = [
      new THREE.Vector3(side * 15.8, -14.6, 0.4),
      new THREE.Vector3(side * 16.5, -19.0, 0.35),
      new THREE.Vector3(side * 17.0, -24.0, -0.1),
      new THREE.Vector3(side * 17.5, -28.5, -0.6)
    ];
    const humerus = buildLoftedBone(humPts, (t, th) => {
      const proxFlare = 1.0 + 0.65 * Math.exp(-Math.pow(t * 6.5, 2));
      const deltoidTub = 1.0 + 0.22 * Math.exp(-Math.pow((t - 0.38) * 7, 2));
      const distFlare = 1.0 + 1.05 * Math.exp(-Math.pow((1 - t) * 7.5, 2));
      const bilobed = 1.0 + 0.22 * Math.exp(-Math.pow((1 - t) * 8, 2)) * Math.cos(2 * th);
      const baseR = 0.78 * proxFlare * deltoidTub;
      return {
        rx: baseR * distFlare * bilobed,
        ry: baseR * (1.0 - 0.28 * Math.exp(-Math.pow((1 - t) * 6, 2)))
      };
    }, 20, 14, true);
    put("upperArm", side, humerus);

    // Ulna (Proximal Olecranon hook -> triangular shaft -> narrow Distal Styloid)
    const ulnaPts = [
      new THREE.Vector3(side * 17.1, -27.8, -1.1),  // Olecranon process
      new THREE.Vector3(side * 17.2, -29.2, -0.7),
      new THREE.Vector3(side * 17.8, -35.5, -0.4),
      new THREE.Vector3(side * 18.4, -42.0, 0.1)    // Distal ulnar head
    ];
    const ulna = buildLoftedBone(ulnaPts, (t, th) => {
      const olecranon = 1.0 + 1.15 * Math.exp(-Math.pow(t * 7, 2));
      const taper = 1.0 - 0.38 * t;
      const triShaft = 1.0 + 0.12 * Math.cos(3 * th);
      return { rx: 0.45 * olecranon * taper * triShaft, ry: 0.48 * olecranon * taper };
    }, 16, 10, true);
    put("forearm", side, ulna);

    // Radius (Disc Radial Head -> bowed shaft -> broad Distal Radius)
    const radPts = [
      new THREE.Vector3(side * 17.9, -29.0, -0.35), // Radial head
      new THREE.Vector3(side * 18.7, -33.5, 0.05),
      new THREE.Vector3(side * 18.9, -38.0, 0.25),
      new THREE.Vector3(side * 19.3, -42.0, 0.5)    // Distal wrist flare
    ];
    const radius = buildLoftedBone(radPts, (t) => {
      const head = 1.0 + 0.55 * Math.exp(-Math.pow(t * 8, 2));
      const wrist = 1.0 + 0.95 * Math.exp(-Math.pow((1 - t) * 6.5, 2));
      return { rx: 0.44 * head * wrist, ry: 0.42 * head * (1 + 0.3 * wrist) };
    }, 16, 10, true);
    put("forearm", side, radius);
  }

  // 5.5 Lower Limbs (Femur with Head/Neck/Trochanters/Condyles, Patella, Tibia with Shin Crest, Fibula, 5-Toed Foot)
  for (const side of [-1, 1]) {
    // Femoral Head (inside Acetabulum)
    const femHead = new THREE.SphereGeometry(1.65, 14, 12);
    femHead.translate(side * 8.2, -46.5, -0.4);
    put("thigh", side, femHead);

    // Femoral Neck (angled ~126° from shaft to head)
    const neckPts = [
      new THREE.Vector3(side * 8.2, -46.5, -0.4),
      new THREE.Vector3(side * 9.5, -47.6, -0.25),
      new THREE.Vector3(side * 10.7, -48.6, -0.1)
    ];
    const femNeck = buildLoftedBone(neckPts, (t) => 0.92 - 0.1 * Math.sin(t * Math.PI), 8, 10, true);
    put("thigh", side, femNeck);

    // Greater Trochanter
    const gTroch = new THREE.SphereGeometry(1.35, 10, 8);
    gTroch.scale(0.85, 1.25, 0.95);
    gTroch.translate(side * 11.2, -48.4, -0.2);
    put("thigh", side, gTroch);

    // Lesser Trochanter
    const lTroch = new THREE.SphereGeometry(0.7, 8, 8);
    lTroch.translate(side * 9.6, -50.2, -0.8);
    put("thigh", side, lTroch);

    // Femur Shaft & Distal Medial/Lateral Condyles
    const femPts = [
      new THREE.Vector3(side * 10.7, -48.6, -0.1),
      new THREE.Vector3(side * 9.6, -53.5, 0.45),   // Anterior bowing
      new THREE.Vector3(side * 8.2, -60.5, 0.45),
      new THREE.Vector3(side * 6.8, -67.0, 0.2)     // Knee joint condyles
    ];
    const femur = buildLoftedBone(femPts, (t, th) => {
      const prox = 1.0 + 0.45 * Math.exp(-Math.pow(t * 6, 2));
      const dist = 1.0 + 1.05 * Math.exp(-Math.pow((1 - t) * 7, 2));
      const condyles = 1.0 + 0.24 * Math.exp(-Math.pow((1 - t) * 8, 2)) * Math.cos(2 * th);
      const linea = 1.0 + 0.1 * Math.sin(3 * th);
      return {
        rx: 1.02 * prox * dist * condyles * linea,
        ry: 0.98 * prox * (1 + 0.55 * Math.exp(-Math.pow((1 - t) * 7, 2)))
      };
    }, 22, 14, true);
    put("thigh", side, femur);

    // Patella (Sesamoid kneecap)
    const patella = new THREE.SphereGeometry(1.15, 12, 10);
    patella.scale(0.95, 1.05, 0.48);
    patella.translate(side * 6.8, -67.1, 1.75);
    put("shin", side, patella);

    // Tibia (Broad Tibial Plateau -> Sharp Triangular Shin Crest -> Medial Malleolus)
    const tibPts = [
      new THREE.Vector3(side * 6.8, -68.0, 0.2),
      new THREE.Vector3(side * 6.65, -74.0, 0.15),
      new THREE.Vector3(side * 6.45, -81.0, 0.0),
      new THREE.Vector3(side * 6.2, -88.0, -0.2)
    ];
    const tibia = buildLoftedBone(tibPts, (t, th) => {
      const plateau = 1.0 + 1.05 * Math.exp(-Math.pow(t * 7.5, 2));
      const mall = 1.0 + 0.65 * Math.exp(-Math.pow((1 - t) * 7.5, 2));
      const crest = 1.0 + 0.18 * Math.cos(3 * th); // Triangular tibial crest
      return {
        rx: 0.85 * plateau * mall * crest,
        ry: 0.82 * (1 + 0.6 * Math.exp(-Math.pow(t * 7, 2))) * mall
      };
    }, 20, 12, true);
    put("shin", side, tibia);

    // Fibula (Bulbous Head -> Slender Shaft -> Prominent Lateral Malleolus)
    const fibPts = [
      new THREE.Vector3(side * 8.3, -69.2, -0.45),
      new THREE.Vector3(side * 8.1, -77.5, -0.55),
      new THREE.Vector3(side * 7.6, -88.2, -0.35)
    ];
    const fibula = buildLoftedBone(fibPts, (t) => {
      const head = 1.0 + 0.75 * Math.exp(-Math.pow(t * 8, 2));
      const latMall = 1.0 + 0.85 * Math.exp(-Math.pow((1 - t) * 8, 2));
      return { rx: 0.34 * head * latMall, ry: 0.38 * head * latMall };
    }, 16, 8, true);
    put("shin", side, fibula);

    // Foot Skeleton: Calcaneus (Heel), Talus, Tarsal Arch & 5 Metatarsals/Toes
    const calcaneus = buildLoftedBone([
      new THREE.Vector3(side * 6.2, -90.2, -1.8),   // Posterior heel tuberosity
      new THREE.Vector3(side * 6.2, -89.4, 0.2),    // Talocalcaneal body
      new THREE.Vector3(side * 6.1, -90.2, 2.2)     // Midfoot tarsals
    ], (t) => ({ rx: 1.05 - 0.15 * t, ry: 1.15 - 0.2 * t }), 10, 10, true);
    put("shin", side, calcaneus);

    // 5 Metatarsals & Phalanges (fanning from medial hallux to lateral 5th toe)
    for (let toe = 0; toe < 5; toe++) {
      const medOffset = (toe - 2) * 0.55 * side;
      const toeLen = toe === 0 ? 6.2 : 6.4 - toe * 0.45;
      const toePts = [
        new THREE.Vector3(side * 6.1 + medOffset * 0.45, -90.1, 2.0),
        new THREE.Vector3(side * 6.0 + medOffset * 0.85, -90.8, 2.0 + toeLen * 0.55),
        new THREE.Vector3(side * 5.9 + medOffset, -91.1, 2.0 + toeLen)
      ];
      const rRay = toe === 0 ? 0.38 : 0.24;
      const ray = buildLoftedBone(toePts, (t) => {
        const joint = 1.0 + 0.3 * Math.sin(t * Math.PI * 2);
        return rRay * joint * (1 - 0.25 * t);
      }, 8, 6, true);
      put("shin", side, ray);
    }
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

// ------------------------------ 9. Systemic Blood Vessels (Arteries & Veins: Axial + Articulated Limbs) ------------------------------
export function buildVascularSystemParts() {
  const artAxial = [], veinAxial = [];
  const artParts = {}, veinParts = {};
  const putA = (name, side, g) => { const k = name + (side > 0 ? "L" : "R"); (artParts[k] || (artParts[k] = [])).push(g); };
  const putV = (name, side, g) => { const k = name + (side > 0 ? "L" : "R"); (veinParts[k] || (veinParts[k] = [])).push(g); };

  // 9.1 Thoracic & Abdominal Aorta + Iliac Bifurcation
  const aorta = buildLoftedBone([
    new THREE.Vector3(0.4, -18.5, -0.8),   // Aortic Arch
    new THREE.Vector3(-0.3, -22.5, -2.6),  // Descending Thoracic Aorta
    new THREE.Vector3(-0.2, -32.0, -2.8),  // Abdominal Aorta
    new THREE.Vector3(0.0, -40.5, -2.4)    // Aortic Bifurcation (L4)
  ], (t) => 0.58 - 0.16 * t, 18, 10, true);
  artAxial.push(aorta);

  // Inferior & Superior Vena Cava
  const ivc = buildLoftedBone([
    new THREE.Vector3(-1.3, -15.0, -1.0),  // SVC
    new THREE.Vector3(-1.2, -21.0, -1.8),  // Right Atrium entry
    new THREE.Vector3(-1.1, -32.0, -2.5),  // IVC
    new THREE.Vector3(-0.9, -41.0, -2.3)   // Iliac confluence
  ], () => 0.62, 18, 10, true);
  veinAxial.push(ivc);

  for (const side of [-1, 1]) {
    // Carotid Artery & Internal Jugular Vein (Neck to Skull base)
    artAxial.push(buildLoftedBone([
      new THREE.Vector3(side * 1.1, -17.5, 0.2),
      new THREE.Vector3(side * 2.2, -12.0, -1.2),
      new THREE.Vector3(side * 2.4, -6.5, -2.4)
    ], () => 0.26, 10, 8, true));

    veinAxial.push(buildLoftedBone([
      new THREE.Vector3(side * 1.5, -16.5, 0.4),
      new THREE.Vector3(side * 2.7, -12.0, -1.0),
      new THREE.Vector3(side * 2.9, -6.5, -2.2)
    ], () => 0.30, 10, 8, true));

    // Subclavian & Axillary Vessels (Chest -> Shoulder)
    artAxial.push(buildLoftedBone([
      new THREE.Vector3(side * 1.0, -16.8, -0.5),
      new THREE.Vector3(side * 7.5, -14.5, 0.2),
      new THREE.Vector3(side * 15.2, -14.8, 0.4)
    ], () => 0.30, 10, 8, true));

    veinAxial.push(buildLoftedBone([
      new THREE.Vector3(side * 1.4, -16.4, -0.2),
      new THREE.Vector3(side * 7.8, -14.1, 0.6),
      new THREE.Vector3(side * 15.5, -14.4, 0.7)
    ], () => 0.34, 10, 8, true));

    // Common & External Iliac Vessels (Pelvis -> Hip)
    artAxial.push(buildLoftedBone([
      new THREE.Vector3(0.0, -40.5, -2.4),
      new THREE.Vector3(side * 4.5, -43.5, -1.2),
      new THREE.Vector3(side * 8.2, -46.5, 0.2)
    ], () => 0.36, 10, 8, true));

    veinAxial.push(buildLoftedBone([
      new THREE.Vector3(-0.9, -41.0, -2.3),
      new THREE.Vector3(side * 4.0, -44.0, -0.9),
      new THREE.Vector3(side * 7.8, -46.8, 0.4)
    ], () => 0.40, 10, 8, true));

    // Upper Arm: Brachial Artery + Cephalic/Basilic Veins
    putA("upperArm", side, buildLoftedBone([
      new THREE.Vector3(side * 15.2, -14.8, 0.4),
      new THREE.Vector3(side * 16.2, -21.5, 0.6),
      new THREE.Vector3(side * 17.3, -28.5, 0.0)
    ], () => 0.25, 12, 8, true));

    putV("upperArm", side, buildLoftedBone([
      new THREE.Vector3(side * 15.8, -14.4, 0.9),
      new THREE.Vector3(side * 17.4, -21.0, 0.8),
      new THREE.Vector3(side * 18.2, -28.2, 0.2)  // Cephalic vein (lateral)
    ], () => 0.24, 12, 8, true));

    putV("upperArm", side, buildLoftedBone([
      new THREE.Vector3(side * 15.0, -15.2, 0.1),
      new THREE.Vector3(side * 15.8, -21.8, -0.2),
      new THREE.Vector3(side * 16.8, -28.5, -0.4) // Basilic vein (medial)
    ], () => 0.24, 12, 8, true));

    // Forearm: Radial Artery + Ulnar Artery + Veins
    putA("forearm", side, buildLoftedBone([
      new THREE.Vector3(side * 17.4, -29.0, 0.0),
      new THREE.Vector3(side * 18.8, -35.5, 0.4),
      new THREE.Vector3(side * 19.5, -42.2, 0.7)  // Radial pulse at wrist
    ], () => 0.18, 12, 6, true));

    putA("forearm", side, buildLoftedBone([
      new THREE.Vector3(side * 17.2, -29.0, -0.1),
      new THREE.Vector3(side * 17.6, -35.5, -0.2),
      new THREE.Vector3(side * 18.2, -42.0, 0.2)  // Ulnar artery
    ], () => 0.17, 12, 6, true));

    putV("forearm", side, buildLoftedBone([
      new THREE.Vector3(side * 18.2, -28.5, 0.3),
      new THREE.Vector3(side * 19.3, -35.5, 0.6),
      new THREE.Vector3(side * 19.7, -42.0, 0.8)
    ], () => 0.20, 12, 6, true));

    // Thigh: Femoral Artery & Great Saphenous/Femoral Veins
    putA("thigh", side, buildLoftedBone([
      new THREE.Vector3(side * 8.2, -46.5, 0.3),
      new THREE.Vector3(side * 8.8, -54.0, 0.9),
      new THREE.Vector3(side * 7.2, -62.5, 0.2),
      new THREE.Vector3(side * 6.8, -67.2, -0.6)  // Popliteal continuation
    ], () => 0.34, 16, 8, true));

    putV("thigh", side, buildLoftedBone([
      new THREE.Vector3(side * 7.7, -46.8, 0.5),
      new THREE.Vector3(side * 7.8, -55.0, 1.1),
      new THREE.Vector3(side * 6.4, -63.0, 0.6),
      new THREE.Vector3(side * 6.2, -67.5, 0.2)   // Great Saphenous / Femoral Vein
    ], () => 0.36, 16, 8, true));

    // Shin: Anterior & Posterior Tibial Arteries + Dorsalis Pedis + Saphenous Vein
    putA("shin", side, buildLoftedBone([
      new THREE.Vector3(side * 6.8, -67.8, -0.6),
      new THREE.Vector3(side * 7.0, -76.0, 0.8),
      new THREE.Vector3(side * 6.4, -87.5, 0.9),
      new THREE.Vector3(side * 6.0, -89.8, 4.8)   // Dorsalis Pedis
    ], () => 0.22, 16, 6, true));

    putV("shin", side, buildLoftedBone([
      new THREE.Vector3(side * 6.2, -68.0, 0.2),
      new THREE.Vector3(side * 6.0, -77.5, 0.7),
      new THREE.Vector3(side * 5.8, -88.0, 0.6),
      new THREE.Vector3(side * 5.6, -90.0, 4.5)
    ], () => 0.24, 16, 6, true));
  }

  const out = {
    arteries: { axial: mergeGeos(artAxial), segments: {} },
    veins: { axial: mergeGeos(veinAxial), segments: {} }
  };
  for (const k in artParts) out.arteries.segments[k] = mergeGeos(artParts[k]);
  for (const k in veinParts) out.veins.segments[k] = mergeGeos(veinParts[k]);
  return out;
}

// ------------------------------ 10. Limb & Torso Skeletal Muscles (กล้ามเนื้อลำตัวและระยางค์) ------------------------------
export function buildLimbMuscleParts() {
  const axial = [];
  const parts = {};
  const put = (name, side, g) => { const k = name + (side > 0 ? "L" : "R"); (parts[k] || (parts[k] = [])).push(g); };

  // Pectoralis Major & Rectus Abdominis (Axial torso)
  for (const side of [-1, 1]) {
    const pec = new THREE.SphereGeometry(4.2, 14, 12);
    pec.scale(1.15, 0.72, 0.38);
    pec.rotateY(side * 0.22);
    pec.translate(side * 5.2, -17.5, 3.3);
    axial.push(pec);

    for (let ab = 0; ab < 3; ab++) {
      const rect = new THREE.SphereGeometry(1.75, 10, 8);
      rect.scale(0.85, 1.1, 0.45);
      rect.translate(side * 1.9, -27.5 - ab * 4.2, 3.0 - ab * 0.2);
      axial.push(rect);
    }

    // Deltoid (Shoulder Cap) & Biceps/Triceps (Upper Arm)
    const deltoid = new THREE.SphereGeometry(2.3, 12, 10);
    deltoid.scale(0.95, 1.35, 0.95);
    deltoid.rotateZ(side * -0.18);
    deltoid.translate(side * 16.0, -15.8, 0.4);
    put("upperArm", side, deltoid);

    const biceps = buildLoftedBone([
      new THREE.Vector3(side * 15.8, -16.5, 1.1),
      new THREE.Vector3(side * 16.7, -21.8, 1.35),
      new THREE.Vector3(side * 17.4, -27.5, 0.1)
    ], (t) => ({ rx: 1.35 * Math.sin(t * Math.PI * 0.85 + 0.2), ry: 1.15 * Math.sin(t * Math.PI * 0.85 + 0.2) }), 12, 10, true);
    put("upperArm", side, biceps);

    const triceps = buildLoftedBone([
      new THREE.Vector3(side * 15.8, -16.8, -0.5),
      new THREE.Vector3(side * 16.9, -21.8, -1.1),
      new THREE.Vector3(side * 17.5, -27.8, -0.9)
    ], (t) => ({ rx: 1.45 * Math.sin(t * Math.PI * 0.85 + 0.2), ry: 1.2 * Math.sin(t * Math.PI * 0.85 + 0.2) }), 12, 10, true);
    put("upperArm", side, triceps);

    // Forearm Flexors & Brachioradialis (tapering smoothly toward wrist)
    const forearmMuscle = buildLoftedBone([
      new THREE.Vector3(side * 17.6, -29.0, 0.2),
      new THREE.Vector3(side * 18.4, -34.0, 0.4),
      new THREE.Vector3(side * 18.9, -41.2, 0.4)
    ], (t) => {
      const belly = Math.sin(Math.pow(t, 0.6) * Math.PI) * 1.45 + 0.35 * (1 - t);
      return { rx: Math.max(0.45, belly), ry: Math.max(0.45, belly * 0.9) };
    }, 14, 10, true);
    put("forearm", side, forearmMuscle);

    // Thigh: Quadriceps Femoris (anterior) & Hamstrings (posterior)
    const quad = buildLoftedBone([
      new THREE.Vector3(side * 9.8, -48.0, 1.2),
      new THREE.Vector3(side * 9.4, -55.5, 1.8),
      new THREE.Vector3(side * 7.2, -65.5, 1.0)
    ], (t) => {
      const belly = 0.7 + 2.15 * Math.sin(t * Math.PI * 0.88 + 0.15);
      return { rx: belly, ry: belly * 0.85 };
    }, 16, 12, true);
    put("thigh", side, quad);

    const ham = buildLoftedBone([
      new THREE.Vector3(side * 7.5, -50.0, -1.4),
      new THREE.Vector3(side * 8.4, -57.0, -1.5),
      new THREE.Vector3(side * 6.9, -65.5, -0.8)
    ], (t) => {
      const belly = 0.6 + 1.85 * Math.sin(t * Math.PI * 0.88 + 0.15);
      return { rx: belly, ry: belly * 0.85 };
    }, 14, 10, true);
    put("thigh", side, ham);

    // Shin: Gastrocnemius / Calf (posterior) & Tibialis Anterior
    const calf = buildLoftedBone([
      new THREE.Vector3(side * 7.0, -68.5, -0.9),
      new THREE.Vector3(side * 7.1, -74.5, -1.65),
      new THREE.Vector3(side * 6.5, -85.0, -0.85)
    ], (t) => {
      const belly = 0.4 + 1.65 * Math.sin(Math.pow(t, 0.65) * Math.PI);
      return { rx: Math.max(0.35, belly), ry: Math.max(0.35, belly * 0.9) };
    }, 14, 10, true);
    put("shin", side, calf);
  }

  const out = { axial: mergeGeos(axial), segments: {} };
  for (const k in parts) out.segments[k] = mergeGeos(parts[k]);
  return out;
}
