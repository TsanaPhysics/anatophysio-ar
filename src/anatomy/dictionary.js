// Bilingual (TH/EN) anatomical nomenclature keyed by mesh label name
export const ANATOMY_DICT = {
  // Skull
  "Frontal bone": { th: "กระดูกหน้าผาก", en: "Frontal bone" },
  "Parietal bone": { th: "กระดูกข้างขม่อม", en: "Parietal bone" },
  "Temporal bone": { th: "กระดูกขมับ", en: "Temporal bone" },
  "Occipital bone": { th: "กระดูกท้ายทอย", en: "Occipital bone" },
  "Nasal bone": { th: "กระดูกสันจมูก", en: "Nasal bone" },
  "Zygomatic bone (cheekbone)": { th: "กระดูกโหนกแก้ม", en: "Zygomatic (cheekbone)" },
  "Maxilla (upper jaw)": { th: "กระดูกขากรรไกรบน", en: "Maxilla (upper jaw)" },
  "Teeth": { th: "ฟัน", en: "Teeth" },
  "Mandible (lower jaw)": { th: "กระดูกขากรรไกรล่าง", en: "Mandible (lower jaw)" },
  "Eyeball": { th: "ลูกตา", en: "Eyeball" },
  // Brain
  "Frontal lobe": { th: "สมองกลีบหน้า (ความคิด/การตัดสินใจ)", en: "Frontal lobe" },
  "Parietal lobe": { th: "สมองกลีบข้าง (ประสาทรับความรู้สึก)", en: "Parietal lobe" },
  "Temporal lobe": { th: "สมองกลีบขมับ (การได้ยิน/ภาษา)", en: "Temporal lobe" },
  "Occipital lobe": { th: "สมองกลีบท้ายทอย (การมองเห็น)", en: "Occipital lobe" },
  "Cerebellum": { th: "สมองน้อย (การทรงตัว/พิกัดกล้ามเนื้อ)", en: "Cerebellum" },
  "Pons (brainstem)": { th: "พอนส์ (ก้านสมอง)", en: "Pons (brainstem)" },
  "Medulla oblongata": { th: "เมดัลลา ออบลองกาตา", en: "Medulla oblongata" },
  // Muscles
  "Frontalis": { th: "กล้ามเนื้อหน้าผาก", en: "Frontalis" },
  "Temporalis": { th: "กล้ามเนื้อขมับ", en: "Temporalis" },
  "Orbicularis oculi": { th: "กล้ามเนื้อรอบเบ้าตา", en: "Orbicularis oculi" },
  "Nasalis": { th: "กล้ามเนื้อปีกจมูก", en: "Nasalis" },
  "Zygomaticus major": { th: "กล้ามเนื้อโหนกแก้มใหญ่ (ยิ้ม)", en: "Zygomaticus major" },
  "Masseter": { th: "กล้ามเนื้อบดเคี้ยว", en: "Masseter" },
  "Orbicularis oris": { th: "กล้ามเนื้อรอบริมฝีปาก", en: "Orbicularis oris" },
  "Depressor anguli oris": { th: "กล้ามเนื้อมุมปากตก", en: "Depressor anguli oris" },
  "Mentalis": { th: "กล้ามเนื้อคาง", en: "Mentalis" },
  // Hands
  "Distal phalanx": { th: "กระดูกข้อนิ้วปลาย", en: "Distal phalanx" },
  "Middle phalanx": { th: "กระดูกข้อนิ้วกลาง", en: "Middle phalanx" },
  "Proximal phalanx": { th: "กระดูกข้อนิ้วโคน", en: "Proximal phalanx" },
  "Metacarpal": { th: "กระดูกฝ่ามือ", en: "Metacarpal" },
  "Carpal bones (wrist)": { th: "กระดูกข้อมือ", en: "Carpal bones (wrist)" },
  // Thorax & Thoracic Cage
  "Rib cage": { th: "กระดูกซี่โครง 12 คู่", en: "Rib cage (12 pairs)" },
  "Sternum": { th: "กระดูกสันอก (Sternum)", en: "Sternum" },
  "Thoracic spine": { th: "กระดูกสันหลังส่วนอก (T1-T12)", en: "Thoracic spine" },
  "Clavicle": { th: "กระดูกไหปลาร้า", en: "Clavicle" },
  "Costal Cartilage": { th: "กระดูกอ่อนซี่โครงไฮยาไลน์", en: "Costal Cartilage" },
  // Heart & Vessels
  "Beating Heart": { th: "หัวใจ 4 ห้อง (เต้นบิดเกลียวเสมือนจริง)", en: "4-Chamber Beating Heart" },
  "Left Ventricle": { th: "หัวใจห้องล่างซ้าย (Apex)", en: "Left Ventricle (Apex)" },
  "Right Ventricle": { th: "หัวใจห้องล่างขวา", en: "Right Ventricle" },
  "Aorta Arch": { th: "ส่วนโค้งหลอดเลือดแดงใหญ่เอออร์ตา (3 แขนง)", en: "Aortic Arch (3 Branches)" },
  "Coronary Arteries": { th: "หลอดเลือดโคโรนารีเลี้ยงหัวใจ (LAD & RCA)", en: "Coronary Arteries" },
  "Pulmonary Trunk": { th: "หลอดเลือดพัลโมนารีไปปอด", en: "Pulmonary Trunk" },
  // Lungs & Respiratory
  "Right Lung": { th: "ปอดขวา (3 พู: บน/กลาง/ล่าง)", en: "Right Lung (3 Lobes)" },
  "Left Lung": { th: "ปอดซ้าย (2 พู พร้อมรอยเว้ารับหัวใจ)", en: "Left Lung (Cardiac Notch)" },
  // Full Body Skeleton (Limbs & Pelvis)
  "Humerus": { th: "กระดูกต้นแขน (Humerus)", en: "Humerus (Upper arm)" },
  "Radius & Ulna": { th: "กระดูกปลายแขนคู่ (Radius & Ulna)", en: "Radius & Ulna (Forearm)" },
  "Lumbar spine": { th: "กระดูกสันหลังส่วนเอว (L1-L5)", en: "Lumbar spine (L1-L5)" },
  "Pelvic girdle": { th: "กระดูกเชิงกรานและกระเบนเหน็บ (Pelvis)", en: "Pelvic Girdle & Sacrum" },
  "Femur": { th: "กระดูกต้นขา (Femur)", en: "Femur (Thigh bone)" },
  "Patella": { th: "กระดูกสะบ้าหัวเข่า (Patella)", en: "Patella (Kneecap)" },
  "Tibia & Fibula": { th: "กระดูกหน้าแข้งและน่อง (Tibia & Fibula)", en: "Tibia & Fibula (Leg)" },
  "Feet & Tarsals": { th: "กระดูกข้อเท้าและเท้า", en: "Foot & Tarsals" }
};
