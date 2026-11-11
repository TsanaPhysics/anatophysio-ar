# X-Ray Mirror (Full Body & MedTech AR)

แอป AR กายวิภาคศาสตร์แบบเรียลไทม์ ใช้กล้องเว็บแคม + MediaPipe (Face/Hand) + Three.js

## การเปิดใช้งาน
ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (XAMPP) เพราะโหลดไฟล์ asset ด้วย `fetch` และกล้องต้องใช้ secure context:

- ใช้งานจริง: http://localhost/x-ray/
- โหมดสาธิต (ไม่ใช้กล้อง): http://localhost/x-ray/#demo

> เปิดแบบ `file://` จะโหลดโมเดลไม่ได้ (แถบสถานะจะแจ้งเตือน)

## โครงสร้างโปรเจกต์ (Phase 1)
```
x-ray/
├── index.html                      # HTML markup (~13 KB)
├── css/app.css                     # สไตล์ทั้งหมด
├── src/
│   ├── main.js                     # state, scene, tracking loop, HUD, boot (843 บรรทัด)
│   ├── config.js                   # URL ของ Three.js / MediaPipe / models
│   ├── anatomy/
│   │   ├── dictionary.js           # ศัพท์กายวิภาค TH/EN (52 คำ)
│   │   ├── thorax-labels.js        # จุดยึดป้ายชื่อทรวงอก/โครงกระดูก
│   │   └── procedural.js           # สร้าง geometry ซี่โครง หัวใจ ปอด โครงกระดูก (setThree ก่อนใช้)
│   ├── physiology/ergonomics.js    # โมเดลภาระกระดูกคอ C1–C7 และระยะอ้าปาก TMJ
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
- Phase 1b ✅ (ขั้นแรก) แยกส่วนที่ไม่ผูก state ออกเป็นโมดูล; ส่วน state/scene/tracking ยังอยู่ใน `main.js`
- Phase 2 Full-body PoseLandmarker + skeletal IK
- Phase 3 rPPG วัดชีพจรจริง, Wiggers cardiac cycle, เครื่องมือวัด CROM / TMJ
- Phase 4 พจนานุกรม FMA/SNOMED CT และคู่มือวิชาการ

> ⚠️ เครื่องมือเพื่อการศึกษา ไม่ใช่อุปกรณ์การแพทย์สำหรับวินิจฉัย

