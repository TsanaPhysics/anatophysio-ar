// Clinical Measurement & Diagnostic Assessment Tools
// - Cobb Angle (Spinal Coronal Alignment & Scoliosis Screening)
// - CROM (Cervical Range of Motion vs. Normative Values)
// - TMJ & Trismus Assessment (Inter-incisal clearance in mm)

export function evaluateCobbAngle(poseLandmarks) {
  if (!poseLandmarks) {
    return { angle: 0, status: "normal", label: "Spine Alignment Normal", risk: "low" };
  }

  // 11 = Left Shoulder, 12 = Right Shoulder
  // 23 = Left Hip, 24 = Right Hip
  const lSh = poseLandmarks[11], rSh = poseLandmarks[12];
  const lHip = poseLandmarks[23], rHip = poseLandmarks[24];

  if (!lSh || !rSh || !lHip || !rHip) {
    return { angle: 0, status: "normal", label: "Spine Alignment Normal", risk: "low" };
  }

  // Coronal shoulder center (upper thoracic T1 reference)
  const t1X = (lSh.x + rSh.x) * 0.5;
  const t1Y = (lSh.y + rSh.y) * 0.5;

  // Coronal hip center (lumbar L4/L5 reference)
  const l5X = (lHip.x + rHip.x) * 0.5;
  const l5Y = (lHip.y + rHip.y) * 0.5;

  // Mid-torso estimation (approx T8 apex)
  const midX = (t1X + l5X) * 0.5;

  // Deviation from plumb line in coronal plane
  const dx = (t1X - l5X);
  const dy = Math.max(0.1, Math.abs(t1Y - l5Y));
  const deviationRad = Math.atan2(Math.abs(dx), dy);
  const cobbDeg = Math.min(60, deviationRad * 57.29578 * 1.85); // Scale factor for coronal spinal curvature

  let status = "normal", label = "Normal Spinal Alignment (< 10°)", risk = "low";
  if (cobbDeg >= 25) {
    status = "severe";
    label = "Scoliosis Warning: Significant Curvature (≥ 25°)";
    risk = "high";
  } else if (cobbDeg >= 10) {
    status = "mild";
    label = "Mild Coronal Curvature (10° - 25°)";
    risk = "medium";
  }

  return {
    angle: cobbDeg,
    status,
    label,
    risk
  };
}

export function evaluateCROM(euler) {
  // euler: THREE.Euler (YXZ)
  const pitchDeg = -euler.x * 57.29578; // + = flexion, - = extension
  const rollDeg = Math.abs(euler.z * 57.29578); // lateral flexion
  const yawDeg = Math.abs(euler.y * 57.29578);  // rotation

  const isFlexion = pitchDeg >= 0;
  const sagittalAngle = Math.abs(pitchDeg);

  // Normative clinical cutoffs (Kapandji / Magee Orthopedic Physical Assessment):
  // Flexion: 45° - 50°
  // Extension: 55° - 60°
  // Lateral bending: 40° - 45°
  // Rotation: 70° - 80°
  const sagittalMax = isFlexion ? 50 : 60;
  const sagittalPct = Math.min(100, Math.round((sagittalAngle / sagittalMax) * 100));
  const rollPct = Math.min(100, Math.round((rollDeg / 45) * 100));
  const yawPct = Math.min(100, Math.round((yawDeg / 75) * 100));

  return {
    pitchDeg,
    rollDeg,
    yawDeg,
    isFlexion,
    sagittalPct,
    rollPct,
    yawPct
  };
}

export function evaluateTMJ(jawScore, headScale = 1.0) {
  // Calibrated average maximum inter-incisal distance ~45-50 mm
  const mm = Math.max(0, Math.min(65, Math.round(jawScore * 48 * headScale)));
  let status = "normal", text = "Normal Functional Range";

  if (mm < 35 && jawScore > 0.4) {
    status = "restricted";
    text = "Limited Opening (Trismus / TMJ Restriction)";
  } else if (mm > 55) {
    status = "hypermobile";
    text = "Hypermobility / Subluxation Risk";
  }

  return {
    mm,
    status,
    text
  };
}

// Camera-based Thoracic Respiration Rate Tracker (Pose shoulder/sternum oscillation)
export class RespirationTracker {
  constructor(windowMs = 10000) {
    this.windowMs = windowMs;
    this.samples = [];
    this.rr = 0;
    this.confidence = 0;
    this.lastCalc = 0;
  }

  update(poseLandmarks, now) {
    if (!poseLandmarks) return { rr: this.rr, confidence: 0 };
    const lSh = poseLandmarks[11], rSh = poseLandmarks[12];
    if (!lSh || !rSh) return { rr: this.rr, confidence: 0 };

    const shW = Math.max(0.08, Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y));
    const midY = ((lSh.y + rSh.y) * 0.5) / shW;
    this.samples.push({ t: now, v: midY });

    const cutoff = now - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) this.samples.shift();

    if (now - this.lastCalc >= 1000 && this.samples.length >= 60) {
      this.lastCalc = now;
      this._estimate();
    }
    return { rr: this.rr, confidence: this.confidence };
  }

  _estimate() {
    const N = this.samples.length;
    const dt = (this.samples[N - 1].t - this.samples[0].t) / (N - 1) / 1000;
    if (dt <= 0 || dt > 0.2) return;
    const fs = 1 / dt;

    let mean = 0;
    for (let i = 0; i < N; i++) mean += this.samples[i].v;
    mean /= N;

    const sig = new Float32Array(N);
    let rms = 0;
    for (let i = 0; i < N; i++) {
      sig[i] = this.samples[i].v - mean;
      rms += sig[i] * sig[i];
    }
    rms = Math.sqrt(rms / N);
    // Reject large body movement (> 0.08 normalized shift) or flat signal
    if (rms > 0.08 || rms < 0.0005) {
      this.confidence = Math.max(0, this.confidence - 0.15);
      return;
    }

    const minLag = Math.floor(fs * (60 / 32)); // max 32 breaths/min
    const maxLag = Math.min(Math.floor(fs * (60 / 8)), Math.floor(N * 0.72));
    if (maxLag <= minLag + 2) return;

    let bestLag = -1, maxCorr = -1e9;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      const len = N - lag;
      for (let i = 0; i < len; i++) c += sig[i] * sig[i + lag];
      c /= len;
      if (c > maxCorr) { maxCorr = c; bestLag = lag; }
    }
    if (bestLag > 0) {
      const est = (fs / bestLag) * 60;
      if (est >= 8 && est <= 32) {
        this.rr = this.rr ? Math.round(this.rr * 0.7 + est * 0.3) : Math.round(est);
        this.confidence = Math.min(1, this.confidence + 0.2);
      }
    }
  }
}

// Facial & Ocular Symmetry Screening (468-pt FaceMesh: Mouth corners + Eyelid opening)
export function evaluateFacialSymmetry(faceLandmarks) {
  if (!faceLandmarks || faceLandmarks.length < 390) {
    return { symmetryScore: 100, mouthDiffPct: 0, eyeDiffPct: 0, status: "normal" };
  }
  const lEyeOut = faceLandmarks[33], rEyeOut = faceLandmarks[263];
  const lMouth = faceLandmarks[61], rMouth = faceLandmarks[291];
  const lUp = faceLandmarks[159], lLo = faceLandmarks[145];
  const rUp = faceLandmarks[386], rLo = faceLandmarks[374];
  if (!lEyeOut || !rEyeOut || !lMouth || !rMouth || !lUp || !lLo || !rUp || !rLo) {
    return { symmetryScore: 100, mouthDiffPct: 0, eyeDiffPct: 0, status: "normal" };
  }

  const eyeSpan = Math.max(0.05, Math.hypot(rEyeOut.x - lEyeOut.x, rEyeOut.y - lEyeOut.y));
  const eyeSlope = (rEyeOut.y - lEyeOut.y) / Math.max(0.02, rEyeOut.x - lEyeOut.x);
  const expectedMouthDy = (rMouth.x - lMouth.x) * eyeSlope;
  const actualMouthDy = (rMouth.y - lMouth.y);
  const mouthDiffPct = Math.min(100, Math.round((Math.abs(actualMouthDy - expectedMouthDy) / eyeSpan) * 100));

  const lOpen = Math.hypot(lUp.x - lLo.x, lUp.y - lLo.y);
  const rOpen = Math.hypot(rUp.x - rLo.x, rUp.y - rLo.y);
  const maxOpen = Math.max(0.005, lOpen, rOpen);
  const eyeDiffPct = Math.min(100, Math.round((Math.abs(lOpen - rOpen) / maxOpen) * 100));

  const penalty = mouthDiffPct * 1.4 + eyeDiffPct * 0.45;
  const symmetryScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const status = symmetryScore < 82 ? "monitor" : "normal";

  return { symmetryScore, mouthDiffPct, eyeDiffPct, status };
}

// Preliminary Clinical Screening & Triage Rule Engine
export function evaluateHealthScreeningSummary({ bpm, resp, rppg, ergo, cobb, facial, tmj, lang = "both" }) {
  const th = lang !== "en";
  const alerts = [];
  const recommendations = [];
  let levelRank = 0; // 0 = normal, 1 = monitor, 2 = consult

  // 1. Cardiovascular & HRV Rules
  if (bpm < 50 || bpm > 105) {
    levelRank = Math.max(levelRank, 2);
    alerts.push(th ? `อัตราหัวใจเต้นขณะพักผิดเกณฑ์ (${Math.round(bpm)} BPM)` : `Resting HR outside normal range (${Math.round(bpm)} BPM)`);
    recommendations.push(th ? "นั่งพัก 5 นาทีแล้ววัดซ้ำ หากยัง <50 หรือ >105 BPM ร่วมกับใจสั่น/หน้ามืด ควรพบแพทย์" : "Rest 5 min and re-measure; consult a physician if persistent with symptoms.");
  }
  if (rppg && rppg.sqi >= 40) {
    if (rppg.irregularFlag) {
      levelRank = Math.max(levelRank, 2);
      alerts.push(th ? "พบสัญญาณชีพจรเต้นไม่สม่ำเสมอ (Irregular IBI)" : "Irregular pulse rhythm variability detected");
      recommendations.push(th ? "แนะนำตรวจคลื่นไฟฟ้าหัวใจ (ECG 12-Lead) เพื่อยืนยันผล" : "Recommend 12-lead ECG confirmation.");
    } else if (rppg.rmssd > 0 && rppg.rmssd < 20) {
      levelRank = Math.max(levelRank, 1);
      alerts.push(th ? `HRV ต่ำ (${rppg.rmssd} ms) บ่งชี้ความเครียด/ความล้าสูง` : `Low HRV (${rppg.rmssd} ms) indicating elevated autonomic stress`);
      recommendations.push(th ? "ฝึกหายใจลึกช้า (4-7-8 Breathing) และพักผ่อนให้เพียงพอ" : "Practice slow paced breathing and adequate rest.");
    }
  }

  // 2. Respiratory Rule
  if (resp < 10 || resp > 24) {
    levelRank = Math.max(levelRank, 1);
    alerts.push(th ? `อัตราการหายใจสูง/ต่ำกว่าเกณฑ์ (${Math.round(resp)} /min)` : `Respiratory rate outside normal range (${Math.round(resp)} /min)`);
  }

  // 3. Musculoskeletal & Posture Rules
  if (ergo && ergo.status === "bad") {
    levelRank = Math.max(levelRank, 1);
    alerts.push(th ? `ภาระกระดูกคอ C1-C7 สูง (${ergo.loadKg.toFixed(1)} kg)` : `High C1-C7 cervical load (${ergo.loadKg.toFixed(1)} kg)`);
    recommendations.push(th ? "ยกหน้าจอให้อยู่ระดับสายตา และยืดกล้ามเนื้อคอทุก 30 นาที" : "Raise screen to eye level and stretch neck every 30 min.");
  }
  if (cobb && cobb.angle >= 10) {
    levelRank = Math.max(levelRank, cobb.angle >= 25 ? 2 : 1);
    alerts.push(th ? `แนวกระดูกสันหลังเอียง (${cobb.angle.toFixed(1)}°)` : `Coronal spinal asymmetry (${cobb.angle.toFixed(1)}°)`);
    if (cobb.angle >= 25) {
      recommendations.push(th ? "แนะนำพบนักกายภาพบำบัดหรือแพทย์ออร์โธปิดิกส์เพื่อตรวจกระดูกสันหลัง" : "Recommend orthopedic / physiotherapy spine evaluation.");
    }
  }
  if (tmj && tmj.status !== "normal") {
    levelRank = Math.max(levelRank, 1);
    alerts.push(th ? `ข้อต่อขากรรไกร TMJ: ${tmj.text}` : `TMJ Screening: ${tmj.text}`);
  }

  // 4. Facial Symmetry Rule
  if (facial && facial.status === "monitor") {
    levelRank = Math.max(levelRank, 1);
    alerts.push(th ? `ความสมมาตรใบหน้าลดลง (${facial.symmetryScore}%)` : `Reduced facial symmetry (${facial.symmetryScore}%)`);
    recommendations.push(th ? "หากมีอาการมุมปากตก/พูดไม่ชัด/แขนขาอ่อนแรงเฉียบพลัน ให้รีบพบแพทย์ทันที (FAST)" : "Seek urgent care if sudden facial droop, slurred speech, or limb weakness occurs.");
  }

  if (alerts.length === 0) {
    recommendations.push(th ? "ค่าคัดกรองเบื้องต้นอยู่ในเกณฑ์ปกติ รักษาท่าทางและออกกำลังกายสม่ำเสมอ" : "Preliminary screening metrics are within normal limits. Maintain good posture and regular exercise.");
  }

  const overallLevel = levelRank === 2 ? "consult" : levelRank === 1 ? "monitor" : "normal";
  const score = Math.max(35, 100 - alerts.length * 14 - (levelRank === 2 ? 15 : 0));

  return { overallLevel, score, alerts, recommendations };
}

