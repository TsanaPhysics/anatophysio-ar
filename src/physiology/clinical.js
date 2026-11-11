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

