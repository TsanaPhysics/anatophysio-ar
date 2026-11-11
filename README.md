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
│   │   ├── dictionary.js           # คลังคำศัพท์กายวิภาค 2 ภาษา (TH/EN 52 คำ)
│   │   ├── thorax-labels.js        # พิกัด 3D อวัยวะทรวงอกและโครงกระดูก (Situs Solitus)
│   │   ├── body-rig.js             # Kinematic Body Rig (33 Keypoints Inverse Kinematics)
│   │   └── procedural.js           # โมเดล 3D หัวใจ 4 ห้อง ปอดทวิภาค ซี่โครง และกระดูกระยางค์
│   ├── physiology/ergonomics.js    # ชีวกลศาสตร์กระดูกคอ C1-C7, TMJ, และ ROM ข้อต่อ
│   ├── audio/sounds.js             # Web Audio Cues (เสียงเตือนท่าทาง และเสียงหัวใจ S1/S2 Lub-Dub)
│   ├── shaders/xray.js             # Custom GLSL Shaders (X-Ray fluoroscopy glow & depth-slice)
│   └── ui/i18n.js                  # ระบบสลับภาษา UI (ไทย / อังกฤษ / สองภาษา)
├── assets/models/
│   ├── anatomy.meta.json           # ข้อมูลป้ายกำกับและ mesh offsets
│   └── anatomy.mesh.bin            # ข้อมูล 3D binary geometry
└── master_plan.md                  # แผนแม่บทสถาปัตยกรรมและการยกระดับทางการแพทย์
```
│   ├── audio/sounds.js             # เสียงเตือนท่าทาง + เสียงหัวใจ S1/S2
│   ├── shaders/xray.js             # GLSL vertex/fragment (X-ray / solid / clip)
│   └── ui/i18n.js                  # ข้อความ UI th / en / both
├── assets/models/
│   ├── anatomy.meta.json           # ป้ายกำกับกายวิภาค, ข้อมูล mesh offsets, fit points
│   └── anatomy.mesh.bin            # vertex (uint16 quantized) + index buffer รวม 23 mesh
├── backup/                         # สำเนาไฟล์ monolith ก่อน refactor
└── index.original.html             # ต้นฉบับจาก upload แรก
```

## รูปแบบไฟล์ `anatomy.mesh.bin`
แต่ละ mesh ใน `anatomy.meta.json → meshes[]` ระบุ:
- `offV`, `nv` : ตำแหน่ง byte และจำนวน vertex (Uint16 × 3, quantized)
- `min`, `size`: ใช้ dequantize → `pos = min + q / 65535 * size`
- `offI`, `ni` : ตำแหน่ง byte และจำนวน index (Uint16)

## แผนพัฒนาต่อ
- Phase 1 ✅ แยก CSS / JS / binary assets ออกจาก HTML
- Phase 1b ✅ แยกส่วนที่ไม่ผูก state ออกเป็นโมดูล; ส่วน state/scene/tracking ยังอยู่ใน `main.js`
- Phase 2 ✅ ผสาน MediaPipe PoseLandmarker (33 จุด) + Articulated Skeleton (กระดูกและอวัยวะขยับตามการเคลื่อนไหวจริง) + แก้ไข Anatomical Situs หัวใจ/ปอด + ตัวชี้วัดสรีรศาสตร์แบบเรียลไทม์ (Shoulder tilt, Torso turn, Elbow & Knee flexion)
- Phase 3 ⏳ rPPG สกัดชีพจรจริงจากสีผิวใบหน้า, Wiggers cardiac cycle, เครื่องมือวัด CROM / TMJ / Cobb angle
- Phase 4 ⏳ พจนานุกรม FMA/SNOMED CT และคู่มือวิชาการทางการแพทย์

> ⚠️ เครื่องมือเพื่อการศึกษา ไม่ใช่อุปกรณ์การแพทย์สำหรับวินิจฉัย

# x-ray
