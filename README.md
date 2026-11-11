# AnatoPhysio AR (Human Anatomy, Physiology & Biomechanics Mirror)

แอปพลิเคชันกระจกส่องตรวจเสมือนจริงทางกายวิภาคศาสตร์ สรีรวิทยา และชีวกลศาสตร์ (Full-Body Clinical AR) 
ประมวลผลแบบเรียลไทม์ผ่านกล้องเว็บแคมด้วย Three.js และ MediaPipe Tasks AI Vision (Face, Hand, และ 33-point Pose)

## การเปิดใช้งาน
เปิดผ่านเว็บเซิร์ฟเวอร์ (XAMPP):

- ใช้งานจริง (URL ใหม่): http://localhost/anatophysio-ar/
- โหมดสาธิต (3D Simulation ไม่ต้องใช้กล้อง): http://localhost/anatophysio-ar/#demo
- (URL เดิมยังคงเข้าได้ผ่าน symlink): http://localhost/x-ray/

> เปิดแบบ `file://` จะโหลดโมเดลไม่ได้เนื่องจากข้อจำกัด CORS ของเบราว์เซอร์

## โครงสร้างโปรเจกต์ (Clean Modular Architecture)
```
anatophysio-ar/
├── index.html                      # หน้าต่างหลัก HTML markup (~13 KB)
├── css/app.css                     # สไตล์ Glassmorphism, Theme & HUD Overlay
├── src/
│   ├── main.js                     # Application controller, Render Loop & Boot
│   ├── config.js                   # URL และ Model weights ของ Three.js / MediaPipe
│   ├── anatomy/
│   │   ├── dictionary.js           # คลังคำศัพท์กายวิภาค 3 ภาษา (TH/EN/Latin) พร้อม FMA & SNOMED CT
│   │   ├── thorax-labels.js        # พิกัด 3D อวัยวะทรวงอกและโครงกระดูก (Situs Solitus)
│   │   ├── body-rig.js             # Kinematic Body Rig (33 Keypoints Inverse Kinematics)
│   │   └── procedural.js           # โมเดล 3D หัวใจ 4 ห้อง ปอดทวิภาค ซี่โครง และกระดูกระยางค์
│   ├── physiology/
│   │   ├── ergonomics.js           # ชีวกลศาสตร์กระดูกคอ C1-C7 (Kapandji load formula)
│   │   ├── rppg.js                 # Contactless rPPG Pulse Detector สกัดชีพจรจริงจากสีผิวหน้า
│   │   ├── wiggers.js              # Wiggers Cardiac Cycle & คลื่น Lead II ECG Waveform
│   │   └── clinical.js             # การวัด Cobb Angle, CROM, และ TMJ Trismus
│   ├── ui/
│   │   ├── i18n.js                 # ระบบสลับภาษา UI (ไทย / อังกฤษ / สองภาษา)
│   │   └── inspector.js            # Clinical Anatomy Inspector & Ontology Modal
│   ├── audio/sounds.js             # Web Audio Cues (เสียงเตือนท่าทาง และเสียงหัวใจ S1/S2 Lub-Dub)
│   └── shaders/xray.js             # Custom GLSL Shaders (X-Ray fluoroscopy glow & depth-slice)
├── assets/models/
│   ├── anatomy.meta.json           # ข้อมูลป้ายกำกับและ mesh offsets
│   └── anatomy.mesh.bin            # ข้อมูล 3D binary geometry
├── docs/
│   └── CLINICAL_WHITEPAPER.md      # เอกสารคู่มือวิชาการทางการแพทย์ฉบับสมบูรณ์
├── backup/                         # สำเนาไฟล์ monolith ก่อน refactor
└── index.original.html             # ต้นฉบับจาก upload แรก
```

## รูปแบบไฟล์ `anatomy.mesh.bin`
แต่ละ mesh ใน `anatomy.meta.json → meshes[]` ระบุ:
- `offV`, `nv` : ตำแหน่ง byte และจำนวน vertex (Uint16 × 3, quantized)
- `min`, `size`: ใช้ dequantize → `pos = min + q / 65535 * size`
- `offI`, `ni` : ตำแหน่ง byte และจำนวน index (Uint16)

## สถานะความสำเร็จของแผนพัฒนา (Phased Roadmap)
- Phase 1 ✅ แยก CSS / JS / binary assets ออกจาก HTML (2.8 MB → 13 KB)
- Phase 1b ✅ แยกโมดูลอิสระ Clean Architecture (shaders, audio, ergonomics, i18n, procedural)
- Phase 2 ✅ ผสาน MediaPipe PoseLandmarker (33 จุด) + Articulated Skeleton (กระดูกและอวัยวะขยับตามการเคลื่อนไหวจริง) + แก้ไข Anatomical Situs หัวใจ/ปอด + ตัวชี้วัดสรีรศาสตร์แบบเรียลไทม์ (Shoulder tilt, Torso turn, Elbow & Knee flexion)
- Phase 3 ✅ ระบบวัดสัญญาณชีพไร้สัมผัส rPPG (Remote Photoplethysmography สกัดชีพจรจริงจากสีผิวหน้าผาก), วงจรหัวใจตามสรีรวิทยา Wiggers Cardiac Cycle พร้อมคลื่นไฟฟ้าหัวใจ Lead II ECG บนหน้าจอ HUD, เสียงลิ้นหัวใจ S1/S2 ตรงจังหวะมิลลิวินาที, เครื่องมือวัดทางคลินิก (Cobb Angle ประเมินกระดูกสันหลังคด, CROM ช่วงการเคลื่อนไหวคอ, TMJ ระยะอ้าปาก)
- Phase 4 ✅ คลังคำศัพท์กายวิภาคศาสตร์มาตรฐานสากล FMA / SNOMED CT / Nomina Anatomica (Latin) ครบ 3 ภาษา (TH/EN/Latin), ระบบส่องตรวจอวัยวะเชิงลึก (Clinical Anatomy Inspector Modal), และเอกสารคู่มือวิชาการทางการแพทย์ฉบับสมบูรณ์ [`docs/CLINICAL_WHITEPAPER.md`](docs/CLINICAL_WHITEPAPER.md)

---
> ⚠️ **คำเตือนและการใช้งาน:** ระบบ AnatoPhysio AR ถูกออกแบบและพัฒนาขึ้นเพื่อการศึกษาทางกายวิภาคศาสตร์ สรีรวิทยา ชีวกลศาสตร์การแพทย์ และเป็นระบบคัดกรองเบื้องต้น ไม่ใช่เครื่องมือทางการแพทย์สำหรับการวินิจฉัยโรคขั้นสุดท้ายในโรงพยาบาล
