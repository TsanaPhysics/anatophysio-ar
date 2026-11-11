// Cervical spine load vs. forward head flexion, and TMJ opening estimate.
// eu: THREE.Euler (YXZ) of head rotation; jawScore: MediaPipe jawOpen blendshape 0..1
export function computeErgonomics(eu, jawScore, lang) {
  const pitch = -eu.x * 57.2958;
  const roll = Math.abs(eu.z * 57.2958);
  const yaw = eu.y * 57.2958;
  const forwardDeg = Math.max(0, pitch);

  let loadKg = 5.0;
  if (forwardDeg > 0) {
    loadKg = 5.0 + 0.50 * forwardDeg - 0.0022 * forwardDeg * forwardDeg;
    if (forwardDeg > 60) loadKg = 27.2 + (forwardDeg - 60) * 0.2;
  }
  const loadLbs = loadKg * 2.20462;
  const jawMm = Math.max(0, Math.round(jawScore * 42));

  let status = "good", statusText = "";
  if (forwardDeg > 25 || roll > 15) {
    status = "bad";
    statusText = lang === "en" ? "ALERT: Text Neck / High Strain" : "ระวัง! เสี่ยง Text Neck / ก้มคอมากเกินไป";
  } else if (forwardDeg > 12 || roll > 8) {
    status = "warn";
    statusText = lang === "en" ? "Warning: Mild Neck Strain" : "เตือน: เริ่มก้มคอ (ควรปรับระดับสายตา)";
  } else {
    status = "good";
    statusText = lang === "en" ? "Optimal Posture (Neutral)" : "ท่าทางสรีรศาสตร์ดีเยี่ยม (ปกติ)";
  }

  return { pitch, roll, yaw, forwardDeg, loadKg, loadLbs, jawMm, status, statusText };
}
