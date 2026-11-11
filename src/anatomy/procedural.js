// Procedural thorax, heart, lungs and full-skeleton geometry.
// THREE is loaded dynamically at boot, so it is injected via setThree().
let THREE;
export function setThree(t) { THREE = t; }

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

// ------------------------------ Full Skeleton Geometry Builders ------------------------------
export function buildBonyThoraxGeometry() {
  const geos = [];
  for (let i = 0; i < 18; i++) {
    const y = -7.5 - i * 1.4;
    const z = -4.6 - Math.sin((i / 18) * Math.PI) * 1.1;
    const r = 1.35 + (i > 6 ? 0.35 : 0);
    const vert = new THREE.CylinderGeometry(r * 0.9, r, 1.05, 12);
    vert.rotateX(0.08);
    vert.translate(0, y, z);
    geos.push(vert);
    const spin = new THREE.BoxGeometry(0.45, 0.55, 1.6);
    spin.translate(0, y + 0.1, z - 1.1);
    geos.push(spin);
  }

  for (let i = 0; i < 12; i++) {
    const vertY = -14.2 - i * 1.35;
    const vertZ = -4.9;
    const spanFrac = Math.sin(((i + 1) / 13) * Math.PI);
    const halfWidth = 8.6 * spanFrac + 3.8;
    const dropY = -1.1 - i * 0.18;
    const ribR = 0.32;

    for (const side of [-1, 1]) {
      const p0 = new THREE.Vector3(side * 1.4, vertY, vertZ);
      const p1 = new THREE.Vector3(side * (halfWidth * 0.72), vertY - 0.45, vertZ - 0.3);
      const p2 = new THREE.Vector3(side * halfWidth, vertY + dropY, 0.0);
      const p3 = new THREE.Vector3(side * (halfWidth * 0.72), vertY + dropY - 1.3, 1.8);
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const tube = new THREE.TubeGeometry(curve, 14, ribR, 6, false);
      geos.push(tube);
    }
  }

  const sternMan = new THREE.BoxGeometry(3.6, 3.2, 0.7);
  sternMan.translate(0, -15.2, 3.2);
  geos.push(sternMan);

  const sternBody = new THREE.BoxGeometry(2.3, 9.4, 0.6);
  sternBody.translate(0, -21.4, 2.9);
  geos.push(sternBody);

  const xiphoid = new THREE.ConeGeometry(0.8, 1.8, 8);
  xiphoid.rotateX(Math.PI);
  xiphoid.translate(0, -27.0, 2.8);
  geos.push(xiphoid);

  for (const side of [-1, 1]) {
    const cp0 = new THREE.Vector3(side * 1.6, -14.0, 3.1);
    const cp1 = new THREE.Vector3(side * 7.5, -13.6, 2.3);
    const cp2 = new THREE.Vector3(side * 14.5, -13.2, 0.4);
    const cCurve = new THREE.CatmullRomCurve3([cp0, cp1, cp2]);
    const cTube = new THREE.TubeGeometry(cCurve, 12, 0.52, 6, false);
    geos.push(cTube);
  }
  return mergeGeos(geos);
}

export function buildCostalCartilageGeometry() {
  const geos = [];
  const ribR = 0.30;
  for (let i = 0; i < 10; i++) {
    const vertY = -14.2 - i * 1.35;
    const spanFrac = Math.sin(((i + 1) / 13) * Math.PI);
    const halfWidth = 8.6 * spanFrac + 3.8;
    const dropY = -1.1 - i * 0.18;
    const sternY = -15.5 - Math.min(i, 6) * 1.55;
    const sternZ = 3.2 - (i > 6 ? (i - 6) * 0.55 : 0);

    for (const side of [-1, 1]) {
      const p3 = new THREE.Vector3(side * (halfWidth * 0.72), vertY + dropY - 1.3, 1.8);
      const p4 = i < 7
        ? new THREE.Vector3(side * 1.3, sternY, sternZ)
        : new THREE.Vector3(side * (2.2 + (i - 6) * 0.9), -24.8 - (i - 6) * 0.8, sternZ);

      const curve = new THREE.CatmullRomCurve3([p3, p4]);
      const tube = new THREE.TubeGeometry(curve, 8, ribR, 6, false);
      geos.push(tube);
    }
  }
  return mergeGeos(geos);
}

export function buildRealisticHeartGeometry() {
  const geos = [];
  const lv = new THREE.ConeGeometry(2.6, 4.6, 16);
  lv.rotateZ(0.42); lv.rotateX(0.18); lv.translate(-2.4, -22.2, 0.8);
  geos.push(lv);

  const rv = new THREE.SphereGeometry(2.5, 14, 12);
  rv.scale(0.85, 1.15, 0.7); rv.translate(-0.4, -20.6, 1.2);
  geos.push(rv);

  const ra = new THREE.SphereGeometry(2.1, 12, 10); ra.translate(1.2, -18.6, -0.2); geos.push(ra);
  const la = new THREE.SphereGeometry(2.0, 12, 10); la.translate(-2.8, -18.2, -0.6); geos.push(la);

  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.8, -18.5, 0.4), new THREE.Vector3(-0.6, -15.2, 0.6),
    new THREE.Vector3(-1.4, -14.2, 0.0), new THREE.Vector3(-2.6, -14.8, -1.0),
    new THREE.Vector3(-2.9, -19.5, -1.8)
  ]);
  const aorta = new THREE.TubeGeometry(aortaCurve, 18, 0.75, 8, false);
  geos.push(aorta);

  const b1 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, -14.6, 0.4), new THREE.Vector3(-0.5, -12.5, 0.8)]), 6, 0.32, 6, false);
  const b2 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6, -14.3, 0.1), new THREE.Vector3(-1.6, -12.4, 0.3)]), 6, 0.28, 6, false);
  const b3 = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-2.2, -14.4, -0.3), new THREE.Vector3(-2.6, -12.5, -0.2)]), 6, 0.28, 6, false);
  geos.push(b1, b2, b3);

  const pulmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, -18.8, 1.0), new THREE.Vector3(-1.7, -16.6, 0.7), new THREE.Vector3(-2.8, -16.2, -0.2)
  ]);
  const pulm = new THREE.TubeGeometry(pulmCurve, 12, 0.65, 8, false);
  geos.push(pulm);

  const svc = new THREE.CylinderGeometry(0.55, 0.55, 4.2, 8); svc.translate(1.4, -15.8, -0.6); geos.push(svc);

  const lad = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.4, -18.2, 1.2), new THREE.Vector3(-1.8, -20.2, 1.3), new THREE.Vector3(-2.3, -22.4, 1.1)
  ]), 10, 0.16, 6, false);
  geos.push(lad);

  const rca = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, -18.2, 1.0), new THREE.Vector3(0.7, -19.6, 0.8), new THREE.Vector3(0.4, -21.4, 0.4)
  ]), 10, 0.16, 6, false);
  geos.push(rca);

  return mergeGeos(geos);
}

export function buildRealisticLungsGeometry() {
  const geos = [];
  const rSuperior = new THREE.SphereGeometry(3.5, 12, 10); rSuperior.scale(0.85, 1.25, 0.75); rSuperior.translate(5.2, -17.2, -0.6); geos.push(rSuperior);
  const rMiddle = new THREE.SphereGeometry(3.2, 12, 10); rMiddle.scale(0.85, 0.95, 0.8); rMiddle.translate(5.4, -20.8, -0.2); geos.push(rMiddle);
  const rInferior = new THREE.SphereGeometry(3.6, 12, 10); rInferior.scale(0.9, 1.2, 0.85); rInferior.translate(5.2, -24.4, -0.8); geos.push(rInferior);

  const lSuperior = new THREE.SphereGeometry(3.4, 12, 10); lSuperior.scale(0.85, 1.3, 0.75); lSuperior.translate(-5.2, -17.2, -0.6); geos.push(lSuperior);
  const lInferior = new THREE.SphereGeometry(3.6, 12, 10); lInferior.scale(0.82, 1.2, 0.82); lInferior.translate(-5.5, -23.8, -1.0); geos.push(lInferior);
  const lingula = new THREE.SphereGeometry(2.0, 10, 8); lingula.scale(0.6, 1.1, 0.6); lingula.translate(-4.2, -22.2, 0.4); geos.push(lingula);

  return mergeGeos(geos);
}

// ------------------------------ Full Skeleton (Limbs & Pelvis) ------------------------------
export function buildFullSkeletonGeometry() {
  const geos = [];

  // Lumbar Spine (L1-L5)
  for (let i = 0; i < 5; i++) {
    const y = -30.0 - i * 1.8;
    const z = -4.8 + i * 0.25;
    const r = 1.85 + i * 0.12;
    const lVert = new THREE.CylinderGeometry(r * 0.95, r, 1.35, 12);
    lVert.rotateX(0.06); lVert.translate(0, y, z);
    geos.push(lVert);
    const spin = new THREE.BoxGeometry(0.5, 0.7, 1.8);
    spin.translate(0, y + 0.1, z - 1.3);
    geos.push(spin);
  }

  // Pelvic Girdle & Sacrum
  const sacrum = new THREE.CylinderGeometry(1.9, 0.7, 5.2, 8);
  sacrum.rotateX(0.22); sacrum.translate(0, -42.0, -4.2);
  geos.push(sacrum);

  for (const side of [-1, 1]) {
    const ilium = new THREE.SphereGeometry(4.8, 12, 10);
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
    const pubTube = new THREE.TubeGeometry(pubCurve, 10, 0.65, 6, false);
    geos.push(pubTube);
  }

  // Upper Limbs (Shoulders, Humerus, Elbows, Forearm)
  for (const side of [-1, 1]) {
    const shBall = new THREE.SphereGeometry(1.4, 10, 8);
    shBall.translate(side * 15.8, -14.6, 0.4);
    geos.push(shBall);

    const humCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 15.8, -14.6, 0.4),
      new THREE.Vector3(side * 16.8, -21.0, 0.2),
      new THREE.Vector3(side * 17.5, -28.5, -0.6)
    ]);
    const humTube = new THREE.TubeGeometry(humCurve, 12, 0.85, 8, false);
    geos.push(humTube);

    const elbow = new THREE.SphereGeometry(1.2, 8, 8);
    elbow.translate(side * 17.5, -28.5, -0.6);
    geos.push(elbow);

    const radCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 17.8, -29.2, -0.4),
      new THREE.Vector3(side * 18.6, -35.5, 0.0),
      new THREE.Vector3(side * 19.2, -42.0, 0.5)
    ]);
    const radTube = new THREE.TubeGeometry(radCurve, 10, 0.48, 6, false);
    geos.push(radTube);

    const ulnaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 17.2, -29.2, -0.8),
      new THREE.Vector3(side * 17.8, -35.5, -0.4),
      new THREE.Vector3(side * 18.4, -42.0, 0.1)
    ]);
    const ulnaTube = new THREE.TubeGeometry(ulnaCurve, 10, 0.44, 6, false);
    geos.push(ulnaTube);
  }

  // Lower Limbs (Femur, Patella, Tibia, Fibula, Feet)
  for (const side of [-1, 1]) {
    const femHead = new THREE.SphereGeometry(1.6, 10, 8);
    femHead.translate(side * 8.2, -46.5, -0.4);
    geos.push(femHead);

    const femCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 8.2, -46.5, -0.4),
      new THREE.Vector3(side * 9.8, -50.0, 0.0),
      new THREE.Vector3(side * 8.6, -58.0, 0.3),
      new THREE.Vector3(side * 6.8, -67.0, 0.2)
    ]);
    const femTube = new THREE.TubeGeometry(femCurve, 16, 1.15, 8, false);
    geos.push(femTube);

    const patella = new THREE.CylinderGeometry(0.9, 0.7, 0.5, 8);
    patella.rotateX(Math.PI / 2); patella.translate(side * 6.8, -67.0, 1.8);
    geos.push(patella);

    const knee = new THREE.SphereGeometry(1.6, 10, 8);
    knee.scale(1.1, 0.8, 1.0); knee.translate(side * 6.8, -67.5, 0.2);
    geos.push(knee);

    const tibCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.8, -68.5, 0.2),
      new THREE.Vector3(side * 6.5, -78.0, 0.0),
      new THREE.Vector3(side * 6.2, -88.0, -0.2)
    ]);
    const tibTube = new THREE.TubeGeometry(tibCurve, 14, 0.95, 8, false);
    geos.push(tibTube);

    const fibCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 8.2, -69.5, -0.4),
      new THREE.Vector3(side * 8.0, -78.0, -0.5),
      new THREE.Vector3(side * 7.5, -87.5, -0.3)
    ]);
    const fibTube = new THREE.TubeGeometry(fibCurve, 12, 0.38, 6, false);
    geos.push(fibTube);

    const ankle = new THREE.SphereGeometry(1.2, 8, 8);
    ankle.translate(side * 6.2, -88.0, -0.2);
    geos.push(ankle);

    const footCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.2, -88.0, -0.2),
      new THREE.Vector3(side * 6.2, -89.8, 1.8),
      new THREE.Vector3(side * 6.0, -90.5, 5.2),
      new THREE.Vector3(side * 5.8, -91.0, 8.5)
    ]);
    const footTube = new THREE.TubeGeometry(footCurve, 10, 0.82, 6, false);
    geos.push(footTube);
  }

  return mergeGeos(geos);
}
