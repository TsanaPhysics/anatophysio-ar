// Clinical Screening & Biomechanical Assessment Report Generator
// Generates a structured, printable clinical report window (PDF/Print ready)

export function generateClinicalReport(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const win = window.open("", "_blank", "width=850,height=900");
  if (!win) {
    alert("กรุณาอนุญาตป๊อปอัป (Allow Popups) เพื่อเปิดเอกสารรายงานคลินิก");
    return;
  }

  const ergoColor = data.ergoStatus === "good" ? "#16a34a" : data.ergoStatus === "warn" ? "#d97706" : "#dc2626";
  const cobbColor = data.cobbStatus === "normal" ? "#16a34a" : data.cobbStatus === "mild" ? "#d97706" : "#dc2626";

  win.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>รายงานการตรวจคัดกรองกายวิภาคและชีวกลศาสตร์ - AnatoPhysio AR</title>
<style>
  body { font-family: system-ui, -apple-system, "Sarabun", sans-serif; margin: 28px 36px; color: #1e293b; line-height: 1.5; font-size: 13.5px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; }
  .title { font-size: 20px; font-weight: 800; color: #0369a1; }
  .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  .section-title { font-size: 14.5px; font-weight: 700; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 8px; margin: 20px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; color: #334155; font-size: 12.5px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11.5px; }
  .recom-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-top: 20px; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; text-align: center; }
  .sign-line { border-bottom: 1px dotted #94a3b8; width: 75%; margin: 35px auto 6px; }
  .print-btn { background: #0284c7; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-bottom: 15px; }
  @media print { .print-btn { display: none; } body { margin: 15mm; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ พิมพ์เอกสารฉบับนี้ (Print / Save as PDF)</button>
  
  <div class="header">
    <div>
      <div class="title">AnatoPhysio AR Clinical Screening Report</div>
      <div class="subtitle">รายงานผลการตรวจคัดกรองกายวิภาค สรีรวิทยา และชีวกลศาสตร์ด้วยเทคโนโลยีความเป็นจริงเสริม</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">วันที่ตรวจ: ${dateStr}</div>
      <div style="font-size:12px; color:#64748b">เวลา: ${timeStr} น.</div>
    </div>
  </div>

  <div class="meta-grid">
    <div><b>ผู้รับการตรวจ:</b> บุคคลทั่วไป / นักศึกษา</div>
    <div><b>ระบบประมวลผล:</b> AnatoPhysio AR Platform (Ver 4.0)</div>
    <div><b>เซนเซอร์ AI:</b> MediaPipe Computer Vision (Face, Hand, Pose 33-Keypoints)</div>
    <div><b>การตรวจสัญญาณชีพ:</b> Contactless Green-Chrominance rPPG Engine</div>
  </div>

  <div class="section-title">1. สัญญาณชีพและพลศาสตร์ระบบหัวใจ (Cardiovascular Telemetry)</div>
  <table>
    <tr><th>ตัวชี้วัดสรีรวิทยา (Metrics)</th><th>ค่าที่ตรวจวัดได้ (Measured)</th><th>เกณฑ์มาตรฐาน (Reference)</th><th>การแปลผลทางคลินิก (Interpretation)</th></tr>
    <tr>
      <td><b>อัตราหัวใจเต้น (Heart Rate)</b></td>
      <td><b>${data.bpm} BPM</b> ${data.isRppgLock ? '<span class="badge" style="background:#dcfce7; color:#16a34a">rPPG Real Face Lock</span>' : '<span class="badge" style="background:#f1f5f9; color:#64748b">Calibrated</span>'}</td>
      <td>60 - 100 BPM (ผู้ใหญ่ขณะพัก)</td>
      <td>${data.bpm < 60 ? "Bradycardia (หัวใจเต้นช้า)" : data.bpm > 100 ? "Tachycardia (หัวใจเต้นเร็ว)" : "Normal Sinus Rhythm (ปกติ)"}</td>
    </tr>
    <tr>
      <td><b>อัตราการหายใจ (Respiration Rate)</b></td>
      <td><b>${data.resp} ครั้ง/นาที</b></td>
      <td>12 - 20 ครั้ง/นาที</td>
      <td>Eupnea (อัตราการหายใจปกติขณะพัก)</td>
    </tr>
    <tr>
      <td><b>วงจรหัวใจ Wiggers Cycle Phase</b></td>
      <td><b>${data.wiggersPhase}</b></td>
      <td>7-Phase Cardiac Cycle</td>
      <td>การบีบคลายตัวของหัวใจ 4 ห้องสัมพันธ์กับคลื่น Lead II ECG</td>
    </tr>
    <tr>
      <td><b>ความแปรปรวนอัตราหัวใจ (HRV: RMSSD / SDNN)</b></td>
      <td><b>${data.rmssd || 0} ms / ${data.sdnn || 0} ms</b> (SQI ${data.sqi || 0}%)</td>
      <td>RMSSD ≥ 20 ms (สมดุลประสาทอัตโนมัติ)</td>
      <td>ระดับความเครียด: <b>${data.stressLevel || "Normal"}</b> ${data.irregularFlag ? '<span class="badge" style="background:#fee2e2; color:#dc2626">Irregular Rhythm Flag</span>' : ""}</td>
    </tr>
    <tr>
      <td><b>ความสมมาตรของใบหน้า (Facial Symmetry)</b></td>
      <td><b>${data.facialSymmetry ?? 100}%</b></td>
      <td>≥ 85% (สมมาตรปกติ)</td>
      <td>${(data.facialSymmetry ?? 100) < 82 ? "ควรเฝ้าระวังความไม่สมมาตรของใบหน้า/มุมปาก" : "กล้ามเนื้อใบหน้าและเปลือกตาสมมาตรปกติ"}</td>
    </tr>
  </table>

  <div class="section-title">2. ชีวกลศาสตร์กระดูกคอและแนวกระดูกสันหลัง (Biomechanics & Spine Alignment)</div>
  <table>
    <tr><th>ส่วนที่ตรวจ (Assessment)</th><th>ค่ามุมที่วัดได้ (Angle / Measurement)</th><th>ภาระกดทับจำลอง (Kapandji Load)</th><th>ระดับความเสี่ยง (Risk Tier)</th></tr>
    <tr>
      <td><b>การก้ม-เงยกระดูกคอ (Cervical Pitch)</b></td>
      <td><b>${data.pitch.toFixed(1)}°</b></td>
      <td><b>${data.loadKg.toFixed(1)} kg (${Math.round(data.loadLbs)} lbs)</b></td>
      <td><span class="badge" style="background:${ergoColor}20; color:${ergoColor}">${data.ergoText}</span></td>
    </tr>
    <tr>
      <td><b>การเอียงคอด้านข้าง (Cervical Roll)</b></td>
      <td><b>${data.roll.toFixed(1)}°</b></td>
      <td>-</td>
      <td>${data.roll > 15 ? "เอียงคอมากเกินเกณฑ์ปกติ" : "สมมาตรปกติ"}</td>
    </tr>
    <tr>
      <td><b>แนวกระดูกสันหลัง (Cobb Angle Estimate)</b></td>
      <td><b>${data.cobbAngle.toFixed(1)}°</b></td>
      <td>-</td>
      <td><span class="badge" style="background:${cobbColor}20; color:${cobbColor}">${data.cobbLabel}</span></td>
    </tr>
    <tr>
      <td><b>ระยะการอ้าปากข้อต่อขากรรไกร (TMJ)</b></td>
      <td><b>${data.jawMm} mm</b></td>
      <td>-</td>
      <td>${data.jawMm < 35 ? "เสี่ยงภาวะ Trismus (ระยะอ้าปากจำกัด)" : "ระยะการเคลื่อนไหวข้อต่อขากรรไกรปกติ (Normal)"}</td>
    </tr>
    <tr>
      <td><b>ความสมดุลระนาบข้อไหล่ (Shoulder Tilt)</b></td>
      <td><b>${data.shoulderTilt.toFixed(1)}°</b></td>
      <td>-</td>
      <td>${Math.abs(data.shoulderTilt) > 6 ? "พบภาวะไหล่เอียงไม่สมดุล" : "ระนาบข้อไหล่สมดุลปกติ"}</td>
    </tr>
  </table>

  <div class="recom-box">
    <b>ข้อเสนอแนะด้านการยศาสตร์และสุขภาพ (Ergonomic & Health Recommendations):</b>
    <ul style="margin:6px 0 0; padding-left:20px">
      <li>${data.pitch > 20 ? "ตรวจพบมุมก้มศีรษะสูงกว่าเกณฑ์ปกติ ควรปรับระดับหน้าจอคอมพิวเตอร์และโทรศัพท์มือถือให้อยู่ในระดับสายตา (Eye-level) เพื่อลดภาระกดทับกระดูกคอ C1-C7" : "ท่าทางการจัดแนวกระดูกคออยู่ในเกณฑ์สรีรศาสตร์ดีเยี่ยม (Optimal Ergonomics)"}</li>
      <li>${data.cobbAngle >= 10 ? "พบแนวโน้มความเอียงของแนวกระดูกสันหลังส่วนอก แนะนำให้ฝึกยืดเหยียดกล้ามเนื้อแกนกลางลำตัว (Core stability) และสังเกตพฤติกรรมการนั่งลงน้ำหนักข้างเดียว" : "แนวกระดูกสันหลังในระนาบ Coronal อยู่ในเกณฑ์มาตรฐาน"}</li>
      <li>ควรเปลี่ยนอิริยาบถ ลุกขึ้นยืดเหยียดกล้ามเนื้อทุก 45-60 นาทีของการนั่งทำงาน</li>
    </ul>
  </div>

  <div class="sign-grid">
    <div>
      <div class="sign-line"></div>
      <div>ผู้รับการตรวจ / นักศึกษา</div>
    </div>
    <div>
      <div class="sign-line"></div>
      <div>ผู้ประเมิน / อาจารย์ผู้สอน / นักกายภาพบำบัด</div>
    </div>
  </div>

  <div style="margin-top:35px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:10px">
    เอกสารฉบับนี้สร้างโดยระบบ AnatoPhysio AR เพื่อการเรียนการสอนและการคัดกรองเบื้องต้น ไม่ใช่เอกสารวินิจฉัยโรคขั้นสุดท้ายทางการแพทย์
  </div>
</body>
</html>
  `);
  win.document.close();
}

