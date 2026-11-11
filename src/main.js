const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = "status-bar " + (cls || ""); }
const DEMO = location.hash === "#demo";
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELS = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = MODELS + "face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = MODELS + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
// Anatomy assets (extracted from the monolithic HTML in Phase 1)
const ASSET_BASE = new URL("../assets/models/", import.meta.url);
let META, MESH_BUFFER;
try {
  const [metaRes, binRes] = await Promise.all([
    fetch(new URL("anatomy.meta.json", ASSET_BASE)),
    fetch(new URL("anatomy.mesh.bin", ASSET_BASE))
  ]);
  if (!metaRes.ok || !binRes.ok) throw new Error("HTTP " + metaRes.status + "/" + binRes.status);
  META = await metaRes.json();
  MESH_BUFFER = await binRes.arrayBuffer();
} catch (e) {
  setStatus("Cannot load anatomy assets (" + e.message + "). Open via http://localhost/x-ray/ not file://", "bad");
  throw e;
}

// ------------------------------ Tab Navigation System ------------------------------
const navTabs = document.querySelectorAll(".nav-tab");
const tabPanes = document.querySelectorAll(".tab-pane");
navTabs.forEach(tab => {
  tab.onclick = () => {
    navTabs.forEach(t => t.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const target = $(tab.dataset.tab);
    if (target) target.classList.add("active");
  };
});

// ------------------------------ Bilingual Medical Dictionary ------------------------------
const ANATOMY_DICT = {
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

function getLabel(key) {
  const item = ANATOMY_DICT[key];
  if (!item) return key;
  if (S.lang === "th") return item.th;
  if (S.lang === "en") return item.en;
  return item.th + " (" + item.en + ")";
}

// ------------------------------ UI Translations ------------------------------
const UI_TEXT = {
  th: {
    title: "X-Ray Mirror",
    start_cam: "เปิดกล้อง (Start camera)",
    status_ready: "กดปุ่มเปิดกล้อง แล้วอนุญาตการเข้าถึงเว็บแคม",
    status_tracking: "กำลังตรวจจับและแสดงผลโครงสร้างกายวิภาค",
    status_hands: " + ตรวจพบกระดูกมือ",
    status_demo: "โหมดจำลอง 3D Demo ทั้งร่างกายสมบูรณ์",
    tab_layers: "กายวิภาค",
    tab_cardiac: "หัวใจ/ปอด",
    tab_ergo: "สรีรศาสตร์",
    tab_look: "เอฟเฟกต์",
    tab_fit: "ปรับขนาด",
    layers_head: "ชั้นกายวิภาค (ANATOMICAL LAYERS)",
    ck_skel: "โครงกระดูกทั้งตัว",
    ck_ribs: "ซี่โครง/สันหลัง",
    ck_heart: "หัวใจ 4 ห้อง",
    ck_lungs: "ปอดซ้าย-ขวา",
    ck_cart: "กระดูกอ่อนซี่โครง",
    ck_hands: "กระดูกมือ",
    ck_skull: "กะโหลกศีรษะ",
    ck_brain: "สมอง",
    ck_muscles: "กล้ามเนื้อ",
    ck_eyes: "ดวงตา",
    ck_outline: "โครงร่างใบหน้า",
    ck_labels: "แสดงป้ายชื่อชี้บอก (Labels)",
    ergo_head: "สรีรศาสตร์และภาระกระดูกคอ C1-C7",
    ergo_on: "เปิดตรวจจับท่าทาง (HUD)",
    ergo_sound: "เสียงเตือนเมื่อก้มคอ",
    ergo_load_lbl: "ภาระกดทับกระดูกคอ:",
    ergo_pitch: "ก้ม-เงย (Pitch):",
    ergo_roll: "เอียงคอ (Roll):",
    ergo_yaw: "หันซ้ายขวา (Yaw):",
    ergo_jaw: "อ้าปาก (TMJ):",
    cardiac_head: "ระบบหัวใจและการหายใจ",
    lbl_bpm: "อัตราหัวใจเต้น",
    lbl_resp: "อัตราการหายใจ",
    ck_sound: "เสียงเต้น Lub-Dub",
    ck_twist: "บิดเกลียว Apex Twist",
    mr_head: "ผสานโลกจริง & แสงเรือง (MIXED REALITY)",
    lbl_bright: "ความสว่างเรืองแสง",
    lbl_real: "มองเห็นใบหน้าจริง",
    lbl_feather: "ความนุ่มขอบ",
    lbl_reveal: "โหมดผ่าดู",
    opt_whole: "ทั้งร่างกาย (Whole)",
    opt_left: "ผ่าดูซีกซ้าย (Left)",
    opt_right: "ผ่าดูซีกขวา (Right)",
    opt_top: "ส่วนบนศีรษะ (Top)",
    opt_bottom: "ส่วนอกและลำตัว (Chest)",
    opt_lens: "ไฟฉายตามนิ้ว (Lens)",
    cutlabel: "ตำแหน่งระนาบตัด",
    fit_head: "ปรับสัดส่วนโครงกระดูก (CALIBRATION)",
    lbl_fs: "ขนาดรวม",
    lbl_fw: "ความกว้าง",
    lbl_fh: "ความสูง",
    lbl_fd: "ความลึก",
    lbl_fx: "ซ้าย/ขวา",
    lbl_fy: "ขึ้น/ลง",
    lbl_fz: "หน้า/หลัง",
    fit_reset: "รีเซ็ตขนาดเดิม (Reset Fit)",
    ck_data: "แสดงข้อมูล Real-time Telemetry"
  },
  en: {
    title: "X-Ray Mirror",
    start_cam: "Start camera",
    status_ready: "Click Start camera, then allow the camera.",
    status_tracking: "Tracking and rendering full anatomy.",
    status_hands: " + Hand bones detected.",
    status_demo: "Full-Body 3D Demo Scene (no camera needed).",
    tab_layers: "Anatomy",
    tab_cardiac: "Heart/Lungs",
    tab_ergo: "Ergonomics",
    tab_look: "Effects",
    tab_fit: "Calibration",
    layers_head: "ANATOMICAL LAYERS",
    ck_skel: "Full Skeleton",
    ck_ribs: "Ribs & Spine",
    ck_heart: "4-Chamber Heart",
    ck_lungs: "Lungs (Bilateral)",
    ck_cart: "Costal Cartilage",
    ck_hands: "Hand bones",
    ck_skull: "Skull",
    ck_brain: "Brain",
    ck_muscles: "Muscles",
    ck_eyes: "Eyes",
    ck_outline: "Head outline",
    ck_labels: "Show labels",
    ergo_head: "CERVICAL ERGONOMICS & POSTURE",
    ergo_on: "Posture Assessment (HUD)",
    ergo_sound: "Audio Alert",
    ergo_load_lbl: "C1-C7 Spine Load:",
    ergo_pitch: "Nod / Pitch:",
    ergo_roll: "Tilt / Roll:",
    ergo_yaw: "Turn / Yaw:",
    ergo_jaw: "Jaw Open (TMJ):",
    cardiac_head: "CARDIO-RESPIRATORY PHYSIOLOGY",
    lbl_bpm: "Heart Rate",
    lbl_resp: "Respiration Rate",
    ck_sound: "Heartbeat Audio",
    ck_twist: "Apex Wringing Twist",
    mr_head: "MIXED REALITY & GLOW",
    lbl_bright: "Glow Brightness",
    lbl_real: "Real me showing through",
    lbl_feather: "Edge feather",
    lbl_reveal: "Reveal mode",
    opt_whole: "Whole body",
    opt_left: "Left half only",
    opt_right: "Right half only",
    opt_top: "Top head only",
    opt_bottom: "Chest & torso",
    opt_lens: "Fingertip lens",
    cutlabel: "Cut position",
    fit_head: "SKELETON CALIBRATION",
    lbl_fs: "Overall size",
    lbl_fw: "Width",
    lbl_fh: "Height",
    lbl_fd: "Depth",
    lbl_fx: "Left / right",
    lbl_fy: "Up / down",
    lbl_fz: "Forward / back",
    fit_reset: "Reset fit",
    ck_data: "Show telemetry data"
  },
  both: {
    title: "X-Ray Mirror (กระจกเอกซเรย์)",
    start_cam: "เปิดกล้อง (Start camera)",
    status_ready: "กด Start camera เพื่อเปิดกล้องเว็บแคม / Allow camera access",
    status_tracking: "Tracking anatomy / กำลังติดตามกายวิภาค",
    status_hands: " + Hand bones / กระดูกมือ",
    status_demo: "3D Demo Scene กายวิภาคทั้งตัวสมบูรณ์",
    tab_layers: "กายวิภาค",
    tab_cardiac: "หัวใจ/ปอด",
    tab_ergo: "สรีรศาสตร์",
    tab_look: "เอฟเฟกต์",
    tab_fit: "ปรับขนาด",
    layers_head: "ชั้นกายวิภาค (ANATOMICAL LAYERS)",
    ck_skel: "โครงกระดูกทั้งตัว (Full Skeleton)",
    ck_ribs: "ซี่โครง/สันหลัง (Ribs & Spine)",
    ck_heart: "หัวใจ 4 ห้อง (4-Chamber Heart)",
    ck_lungs: "ปอดซ้าย-ขวา (Lungs)",
    ck_cart: "กระดูกอ่อนซี่โครง (Costal Cartilage)",
    ck_hands: "กระดูกมือ (Hand bones)",
    ck_skull: "กะโหลกศีรษะ (Skull)",
    ck_brain: "สมอง (Brain)",
    ck_muscles: "กล้ามเนื้อใบหน้า (Muscles)",
    ck_eyes: "ลูกตา (Eyes)",
    ck_outline: "โครงหน้า (Outline)",
    ck_labels: "แสดงป้ายชื่อชี้บอก (Labels)",
    ergo_head: "สรีรศาสตร์และท่าทางคอ (ERGONOMICS)",
    ergo_on: "เปิดตรวจจับท่าทาง (HUD)",
    ergo_sound: "เสียงเตือน (Alert sound)",
    ergo_load_lbl: "ภาระกดทับกระดูกคอ C1-C7:",
    ergo_pitch: "ก้ม-เงย (Pitch):",
    ergo_roll: "เอียงคอ (Roll):",
    ergo_yaw: "หันซ้ายขวา (Yaw):",
    ergo_jaw: "อ้าปาก (TMJ):",
    cardiac_head: "ระบบหัวใจและการหายใจ (CARDIO-RESPIRATORY)",
    lbl_bpm: "อัตราหัวใจเต้น (Heart Rate)",
    lbl_resp: "อัตราการหายใจ (Respiration)",
    ck_sound: "เสียงเต้น Lub-Dub",
    ck_twist: "บิดเกลียว Apex Twist",
    mr_head: "ผสานโลกจริง (MIXED REALITY)",
    lbl_bright: "ความสว่าง (Brightness)",
    lbl_real: "มองเห็นใบหน้าจริง (Real Face)",
    lbl_feather: "ความนุ่มขอบ (Feather)",
    lbl_reveal: "โหมดผ่าดู (Reveal)",
    opt_whole: "ทั้งร่างกาย (Whole body)",
    opt_left: "ผ่าดูซีกซ้าย (Left half)",
    opt_right: "ผ่าดูซีกขวา (Right half)",
    opt_top: "เฉพาะส่วนบน (Top head)",
    opt_bottom: "เฉพาะอกและลำตัว (Chest & body)",
    opt_lens: "ไฟฉายเอกซเรย์ตามปลายนิ้ว (Lens)",
    cutlabel: "ตำแหน่งระนาบตัด (Cut position)",
    fit_head: "ปรับขนาดให้พอดี (CALIBRATION)",
    lbl_fs: "ขนาดรวม (Overall)",
    lbl_fw: "ความกว้าง (Width)",
    lbl_fh: "ความสูง (Height)",
    lbl_fd: "ความลึก (Depth)",
    lbl_fx: "ซ้าย / ขวา",
    lbl_fy: "ขึ้น / ลง",
    lbl_fz: "หน้า / หลัง",
    fit_reset: "รีเซ็ตขนาดเดิม (Reset Fit)",
    ck_data: "แสดงข้อมูล Real-time Telemetry"
  }
};

function updateUILanguage() {
  const t = UI_TEXT[S.lang] || UI_TEXT.both;
  const setTxt = (id, str) => { const el = $(id); if (el) el.textContent = str; };
  setTxt("ui_title", t.title);
  setTxt("start", t.start_cam);
  setTxt("tab_lbl_layers", t.tab_layers);
  setTxt("tab_lbl_cardiac", t.tab_cardiac);
  setTxt("tab_lbl_ergo", t.tab_ergo);
  setTxt("tab_lbl_look", t.tab_look);
  setTxt("tab_lbl_fit", t.tab_fit);
  setTxt("ui_lbl_layers_head", t.layers_head);
  setTxt("ui_ck_skel", t.ck_skel);
  setTxt("ui_ck_ribs", t.ck_ribs);
  setTxt("ui_ck_heart", t.ck_heart);
  setTxt("ui_ck_lungs", t.ck_lungs);
  setTxt("ui_ck_cart", t.ck_cart);
  setTxt("ui_ck_hands", t.ck_hands);
  setTxt("ui_ck_skull", t.ck_skull);
  setTxt("ui_ck_brain", t.ck_brain);
  setTxt("ui_ck_muscles", t.ck_muscles);
  setTxt("ui_ck_eyes", t.ck_eyes);
  setTxt("ui_ck_outline", t.ck_outline);
  setTxt("ui_ck_labels", t.ck_labels);
  setTxt("ui_ergo_head", t.ergo_head);
  setTxt("ui_ergo_on", t.ergo_on);
  setTxt("ui_ergo_sound", t.ergo_sound);
  setTxt("ui_ergo_load_lbl", t.ergo_load_lbl);
  setTxt("ui_ergo_pitch", t.ergo_pitch);
  setTxt("ui_ergo_roll", t.ergo_roll);
  setTxt("ui_ergo_yaw", t.ergo_yaw);
  setTxt("ui_ergo_jaw", t.ergo_jaw);
  setTxt("ui_cardiac_head", t.cardiac_head);
  setTxt("ui_lbl_bpm", t.lbl_bpm);
  setTxt("ui_lbl_resp", t.lbl_resp);
  setTxt("ui_ck_sound", t.ck_sound);
  setTxt("ui_ck_twist", t.ck_twist);
  setTxt("ui_mr_head", t.mr_head);
  setTxt("ui_lbl_bright", t.lbl_bright);
  setTxt("ui_lbl_real", t.lbl_real);
  setTxt("ui_lbl_feather", t.lbl_feather);
  setTxt("ui_lbl_reveal", t.lbl_reveal);
  setTxt("ui_opt_whole", t.opt_whole);
  setTxt("ui_opt_left", t.opt_left);
  setTxt("ui_opt_right", t.opt_right);
  setTxt("ui_opt_top", t.opt_top);
  setTxt("ui_opt_bottom", t.opt_bottom);
  setTxt("ui_opt_lens", t.opt_lens);
  setTxt("cutlabel", t.cutlabel);
  setTxt("ui_fit_head", t.fit_head);
  setTxt("ui_lbl_fs", t.lbl_fs);
  setTxt("ui_lbl_fw", t.lbl_fw);
  setTxt("ui_lbl_fh", t.lbl_fh);
  setTxt("ui_lbl_fd", t.lbl_fd);
  setTxt("ui_lbl_fx", t.lbl_fx);
  setTxt("ui_lbl_fy", t.lbl_fy);
  setTxt("ui_lbl_fz", t.lbl_fz);
  setTxt("fitreset", t.fit_reset);
  setTxt("ui_ck_data", t.ck_data);
}

// ------------------------------ settings ------------------------------
const DEFAULTS = {
  skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
  ribs: true, heart: true, lungs: true, cartilage: true, skeleton: true,
  bpm: 75, resp: 15, heartAudio: true, twist: true,
  style: "xray", bright: 1, real: 0.12, feather: 0.2, reveal: "whole", cut: 0.5, showdata: false,
  fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false,
  lang: "both", ergo: true, ergoAudio: true
};
let S = Object.assign({}, DEFAULTS);
try { Object.assign(S, JSON.parse(localStorage.getItem("xr_settings") || "{}")); } catch (e) {}
function save() { try { localStorage.setItem("xr_settings", JSON.stringify(S)); } catch (e) {} }

const LAYERS = ["skull", "brain", "muscles", "eyes", "outline", "hands", "ribs", "heart", "lungs", "cartilage", "skeleton"];
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz", "bpm", "resp"];

function syncUI() {
  for (const k of LAYERS) { const el = $("L_" + k); if (el) el.checked = !!S[k]; }
  for (const b of $("style").children) b.classList.toggle("on", b.dataset.style === S.style);
  for (const b of $("lang_seg").children) b.classList.toggle("on", b.dataset.lang === S.lang);
  $("ergo_enable").checked = S.ergo;
  $("ergo_audio").checked = S.ergoAudio;
  if ($("heart_sound")) $("heart_sound").checked = S.heartAudio;
  if ($("helical_twist")) $("helical_twist").checked = S.twist;
  for (const k of SLIDERS) { const el = $(k); if (el) el.value = S[k]; }
  for (const k of ["fs", "fw", "fh", "fd"]) $(k + "v").textContent = Math.round(S[k] * 100) + "%";
  for (const k of ["fx", "fy", "fz"]) $(k + "v").textContent = (S[k] > 0 ? "+" : "") + S[k].toFixed(1) + " cm";
  if ($("bpmv")) $("bpmv").textContent = Math.round(S.bpm) + " BPM";
  if ($("respv")) $("respv").textContent = Math.round(S.resp) + " /min";
  if ($("ui_bpm_live")) $("ui_bpm_live").textContent = "❤️ " + Math.round(S.bpm) + " BPM";
  $("featherv").textContent = Math.round(S.feather * 100) + "%";
  $("labels").checked = S.labels;
  $("reveal").value = S.reveal; $("showdata").checked = S.showdata; $("data").hidden = !S.showdata;
  $("cutrow").hidden = S.reveal === "whole";
  $("cutlabel").textContent = S.reveal === "lens" ? (S.lang === "th" ? "ขนาดเลนส์ไฟฉาย" : "Lens size") : (S.lang === "th" ? "ตำแหน่งระนาบตัด" : "Cut position");
  updateUILanguage();
}
for (const k of LAYERS) { const el = $("L_" + k); if (el) el.onchange = e => { S[k] = e.target.checked; save(); }; }
for (const b of $("style").children) b.onclick = () => { S.style = b.dataset.style; save(); syncUI(); applyStyle(); };
for (const b of $("lang_seg").children) b.onclick = () => { S.lang = b.dataset.lang; save(); syncUI(); };
$("ergo_enable").onchange = e => { S.ergo = e.target.checked; save(); };
$("ergo_audio").onchange = e => { S.ergoAudio = e.target.checked; save(); };
if ($("heart_sound")) $("heart_sound").onchange = e => { S.heartAudio = e.target.checked; save(); };
if ($("helical_twist")) $("helical_twist").onchange = e => { S.twist = e.target.checked; save(); };
for (const k of SLIDERS) { const el = $(k); if (el) el.oninput = e => { S[k] = parseFloat(e.target.value); save(); syncUI(); }; }
$("labels").onchange = e => { S.labels = e.target.checked; save(); };
$("reveal").onchange = e => { S.reveal = e.target.value; S.cut = 0.5; save(); syncUI(); };
$("showdata").onchange = e => { S.showdata = e.target.checked; save(); };
$("fitreset").onclick = () => { S.fs = S.fw = S.fh = S.fd = 1; S.fx = S.fy = S.fz = 0; save(); syncUI(); };

// Preset Buttons Logic
for (const b of document.querySelectorAll("[data-preset]")) b.onclick = () => {
  document.querySelectorAll("[data-preset]").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  const p = b.dataset.preset;
  if (p === "skeleton") {
    S.skeleton = true; S.ribs = true; S.skull = true; S.eyes = true; S.heart = true; S.cartilage = true; S.lungs = false; S.brain = false; S.muscles = false; S.outline = true;
  } else if (p === "thorax") {
    S.skeleton = false; S.ribs = true; S.skull = false; S.eyes = false; S.heart = true; S.cartilage = true; S.lungs = false; S.brain = false; S.muscles = false; S.outline = true;
  } else if (p === "lungs") {
    S.skeleton = false; S.ribs = true; S.skull = false; S.eyes = false; S.heart = true; S.cartilage = true; S.lungs = true; S.brain = false; S.muscles = false; S.outline = true;
  } else if (p === "skull") {
    S.skeleton = false; S.ribs = false; S.skull = true; S.eyes = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = false; S.muscles = false; S.outline = true;
  } else if (p === "brain") {
    S.skeleton = false; S.ribs = false; S.skull = false; S.eyes = false; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = true; S.muscles = false; S.outline = true;
  } else if (p === "muscles") {
    S.skeleton = false; S.ribs = false; S.skull = false; S.eyes = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = false; S.muscles = true; S.outline = true;
  } else {
    S.skeleton = true; S.ribs = true; S.skull = true; S.eyes = true; S.heart = true; S.cartilage = true; S.lungs = true; S.brain = true; S.muscles = true; S.outline = true;
  }
  save(); syncUI();
};
syncUI();

// ------------------------------ 3D scene ------------------------------
let THREE, renderer, headScene, handScene, cam, ortho, headGroup, jawPivot, baseProj;
let heartGroup = null, lungsGroup = null, ribsGroup = null, skelGroup = null;
let W = 640, H = 480;
const meshes = {};
const handRigs = [];
const BONES = [[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];

const VERT = `
uniform mat4 uToHead; uniform float uOrtho;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  vL = (uToHead * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = uOrtho > 0.5 ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uColor; uniform vec3 uSolidColor;
uniform float uOpacity, uGain, uMode, uClipOn, uFade, uFeather, uCutSoft; uniform vec4 uClip;
varying vec3 vN; varying vec3 vV; varying vec3 vL;
void main() {
  float soft = 1.0;
  if (uClipOn > 0.5) {
    float dcut = dot(uClip.xyz, vL) - uClip.w;
    if (dcut < 0.0) discard;
    if (uCutSoft > 0.001) soft *= smoothstep(0.0, uCutSoft, dcut);
  }
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, normalize(vV)));
  if (uFeather > 0.001) soft *= smoothstep(0.0, uFeather, ndv);
  float fade = uFade > 0.5 ? smoothstep(-12.4, -9.2, vL.y) : 1.0;
  if (uMode > 1.5) {
    gl_FragColor = vec4(uColor, uOpacity * fade * soft);
  } else if (uMode > 0.5) {
    vec3 fn = gl_FrontFacing ? n : -n;
    float d = max(dot(fn, normalize(vec3(0.35, 0.55, 0.76))), 0.0);
    float rim = pow(1.0 - ndv, 2.5);
    gl_FragColor = vec4(uSolidColor * (0.28 + 0.78 * d) * uGain + vec3(0.25) * rim, uOpacity * soft);
  } else {
    float rim = pow(1.0 - ndv, 2.1);
    float a = clamp((0.035 + 0.95 * rim) * uGain * uOpacity * fade, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a * soft);
  }
}`;

function makeMat(xray, solid, mode) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(xray) }, uSolidColor: { value: new THREE.Color(solid) },
                uOpacity: { value: 1 }, uGain: { value: 1 }, uMode: { value: mode || 0 }, uOrtho: { value: 0 }, uFade: { value: 0 }, uFeather: { value: 0 }, uCutSoft: { value: 0 },
                uClipOn: { value: 0 }, uClip: { value: new THREE.Vector4(1, 0, 0, 0) }, uToHead: { value: new THREE.Matrix4() } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
    depthTest: false, depthWrite: false, blending: mode === 2 ? THREE.NormalBlending : THREE.AdditiveBlending
  });
}

function decodeMeshes() {
  const u8 = new Uint8Array(MESH_BUFFER);
  const out = {};
  for (const m of META.meshes) {
    const q = new Uint16Array(u8.buffer, m.offV, m.nv * 3), pos = new Float32Array(m.nv * 3);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + q[i] / 65535 * m.size[i % 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(u8.buffer, m.offI, m.ni).slice(), 1));
    geo.computeVertexNormals();
    out[m.name] = geo;
  }
  return out;
}

function mergeGeos(list) {
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
function buildBonyThoraxGeometry() {
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

function buildCostalCartilageGeometry() {
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

function buildRealisticHeartGeometry() {
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

function buildRealisticLungsGeometry() {
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
function buildFullSkeletonGeometry() {
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

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas: $("gl"), alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  headScene = new THREE.Scene(); handScene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(63, W / H, 1, 10000);
  ortho = new THREE.OrthographicCamera(0, W, H, 0, -5000, 5000);
  const geos = decodeMeshes();

  headGroup = new THREE.Group(); headGroup.matrixAutoUpdate = false; headGroup.visible = false;
  headScene.add(headGroup);
  jawPivot = new THREE.Group(); jawPivot.position.fromArray(META.jawPivot); headGroup.add(jawPivot);

  const add = (name, geo, layer, xray, solid, order, parent, mode) => {
    const mesh = new THREE.Mesh(geo, makeMat(xray, solid, mode));
    mesh.renderOrder = order; mesh.frustumCulled = false;
    (parent || headGroup).add(mesh);
    meshes[name] = { mesh, layer, fixedMode: mode };
    return mesh;
  };

  add("veil", geos.skin, "veil", 0x04070d, 0x04070d, -10, null, 2).material.uniforms.uFade.value = 1;
  add("outline", geos.skin, "outline", 0x6fb6ff, 0x6fb6ff, 1, null, 0).material.uniforms.uFade.value = 1;
  add("muscles", geos.muscles, "muscles", 0xff6b5e, 0xb5453c, 2);
  add("cranium", geos.cranium, "skull", 0xbfe3ff, 0xe9e2cf, 3);
  const jaw = add("jaw", geos.jaw, "skull", 0xbfe3ff, 0xe9e2cf, 3, jawPivot);
  jaw.position.fromArray(META.jawPivot).multiplyScalar(-1);
  add("eyes", geos.eyes, "eyes", 0xfff3a8, 0xf4f4ee, 4);
  add("cerebrum", geos.cerebrum, "brain", 0xff9fc0, 0xe2a39d, 5);
  add("hindbrain", geos.hindbrain, "brain", 0xffc37a, 0xd6ad84, 5);

  // 1. Bony Thorax (Ribs 12 pairs + Sternum + Clavicles + Spine)
  const thoraxGeo = buildBonyThoraxGeometry();
  ribsGroup = add("ribs", thoraxGeo, "ribs", 0xbfe3ff, 0xe9e2cf, 3);

  // 2. Costal Cartilage (กระดูกอ่อนซี่โครง)
  const cartGeo = buildCostalCartilageGeometry();
  add("cartilage", cartGeo, "cartilage", 0x88ddff, 0xd2e8f8, 3);

  // 3. Bilateral Lungs (ปอดซ้าย-ขวา)
  const lungsGeo = buildRealisticLungsGeometry();
  lungsGroup = add("lungs", lungsGeo, "lungs", 0x55e0c5, 0xd99595, 2);

  // 4. Realistic 4-Chamber Heart & Great Vessels
  const heartGeo = buildRealisticHeartGeometry();
  heartGroup = add("heart", heartGeo, "heart", 0xff3b5c, 0xb53545, 4);

  // 5. Full Body Skeleton (Lumbar Spine, Pelvis, Humerus, Forearm, Femur, Tibia, Fibula, Feet)
  const fullSkelGeo = buildFullSkeletonGeometry();
  skelGroup = add("skeleton", fullSkelGeo, "skeleton", 0xbfe3ff, 0xe9e2cf, 3);

  for (let h = 0; h < 2; h++) {
    const group = new THREE.Group(); group.visible = false; handScene.add(group);
    const mk = geo => { const m = new THREE.Mesh(geo, makeMat(0xd9f0ff, 0xe9e2cf)); m.material.uniforms.uOrtho.value = 1;
                        m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); return m; };
    handRigs.push({ group, palm: mk(geos.hand_palm), bones: BONES.map(([a, b]) => mk(geos["hand_b_" + a + "_" + b])),
                    pts: null, seen: 0 });
  }
  applyStyle(); resize();
}

function eachMat(fn) {
  for (const k in meshes) fn(meshes[k].mesh.material, meshes[k]);
  for (const r of handRigs) { fn(r.palm.material, { layer: "hands" }); for (const b of r.bones) fn(b.material, { layer: "hands" }); }
}
function applyStyle() {
  if (!renderer) return;
  const solid = S.style === "solid";
  eachMat((m, info) => {
    if (info.fixedMode !== undefined) return;
    m.uniforms.uMode.value = solid ? 1 : 0;
    m.blending = solid ? THREE.NormalBlending : THREE.AdditiveBlending;
    m.depthTest = solid; m.depthWrite = solid; m.needsUpdate = true;
  });
}

function resize() {
  const r = stage.getBoundingClientRect();
  W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height));
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix(); baseProj = cam.projectionMatrix.clone();
    ortho.right = W; ortho.top = H; ortho.updateProjectionMatrix();
  }
  for (const id of ["shade", "hud"]) { const c = $(id); c.width = W; c.height = H; }
}
new ResizeObserver(resize).observe(stage);

// ------------------------------ head tracking ------------------------------
const head = { found: false, pos: null, quat: null, scl: null, fitS: 1, fitX: 0, fitY: 0, jaw: 0, lms: null };
let tmpM, tmpP, tmpQ, tmpS, tmpV, fitM, corr;
function initMath() {
  tmpM = new THREE.Matrix4(); tmpP = new THREE.Vector3(); tmpQ = new THREE.Quaternion(); tmpS = new THREE.Vector3();
  tmpV = new THREE.Vector3(); fitM = new THREE.Matrix4(); corr = new THREE.Matrix4(); jawM = new THREE.Matrix4();
  head.pos = new THREE.Vector3(); head.quat = new THREE.Quaternion(); head.scl = new THREE.Vector3(1, 1, 1);
}
const FIT_IDS = Object.keys(META.fit).map(Number);

function updateHead(matrixData, lms, jawOpen) {
  tmpM.fromArray(matrixData);
  const e = tmpM.elements;
  if (Math.abs(e[12]) + Math.abs(e[13]) + Math.abs(e[14]) < 1e-6 && Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) > 1e-3) tmpM.transpose();
  tmpM.decompose(tmpP, tmpQ, tmpS);
  if (!head.found) { head.pos.copy(tmpP); head.quat.copy(tmpQ); head.scl.copy(tmpS); head.fitS = 1; head.fitX = head.fitY = 0; }
  else { head.pos.lerp(tmpP, 0.6); head.quat.slerp(tmpQ, 0.55); head.scl.lerp(tmpS, 0.5); }
  head.found = true; head.lms = lms;
  head.jaw += (jawOpen - head.jaw) * 0.6;
  tmpM.compose(head.pos, head.quat, head.scl);

  let pmx = 0, pmy = 0, qmx = 0, qmy = 0; const P = [], Q = [];
  for (const id of FIT_IDS) {
    tmpV.fromArray(META.fit[id]).applyMatrix4(tmpM).applyMatrix4(baseProj);
    const q = lms[id]; if (!q) continue;
    P.push([tmpV.x, tmpV.y]); Q.push([q.x * 2 - 1, 1 - q.y * 2]);
  }
  for (let i = 0; i < P.length; i++) { pmx += P[i][0]; pmy += P[i][1]; qmx += Q[i][0]; qmy += Q[i][1]; }
  pmx /= P.length; pmy /= P.length; qmx /= P.length; qmy /= P.length;
  let num = 0, den = 0;
  for (let i = 0; i < P.length; i++) {
    const ax = P[i][0] - pmx, ay = P[i][1] - pmy;
    num += ax * (Q[i][0] - qmx) + ay * (Q[i][1] - qmy); den += ax * ax + ay * ay;
  }
  const s = Math.max(0.6, Math.min(1.6, den > 1e-9 ? num / den : 1));
  head.fitS += (s - head.fitS) * 0.5;
  head.fitX += (qmx - head.fitS * pmx - head.fitX) * 0.7;
  head.fitY += (qmy - head.fitS * pmy - head.fitY) * 0.7;
  corr.set(head.fitS, 0, 0, head.fitX,  0, head.fitS, 0, head.fitY,  0, 0, 1, 0,  0, 0, 0, 1);
  cam.projectionMatrix.copy(baseProj).premultiply(corr);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

  fitM.makeScale(S.fs * S.fw, S.fs * S.fh, S.fs * S.fd).setPosition(-S.fx, S.fy, S.fz);
  headGroup.matrix.copy(tmpM).multiply(fitM);
  headGroup.matrixWorldNeedsUpdate = true;
  headGroup.visible = true;
  jawPivot.rotation.x = Math.min(1, Math.max(0, head.jaw)) * 0.36;
}

const clipState = { on: 0, x: 1, y: 0, w: 0 };
let jawM = null;
const XRAY_GAIN = {
  outline: 0.55, muscles: 0.5, cerebrum: 0.36, hindbrain: 0.6, eyes: 0.9,
  ribs: 0.75, heart: 1.25, lungs: 0.42, cartilage: 0.65, skeleton: 0.75
};

function applyLayers() {
  const reveal = S.reveal;
  let clipOn = 0, cx = 1, cy = 0, cz = 0, cw = 0;
  if (reveal === "left")   { clipOn = 1; cx = 1;  cy = 0; cw = (S.cut - 0.5) * 16; }
  if (reveal === "right")  { clipOn = 1; cx = -1; cy = 0; cw = (S.cut - 0.5) * 16; }
  if (reveal === "top")    { clipOn = 1; cx = 0; cy = 1;  cw = -9 + (1 - S.cut) * 22; }
  if (reveal === "bottom") { clipOn = 1; cx = 0; cy = -1; cw = -(-9 + S.cut * 22); }
  clipState.on = clipOn; clipState.x = cx; clipState.y = cy; clipState.w = cw;
  jawPivot.updateMatrix(); meshes.jaw.mesh.updateMatrix();
  jawM.copy(jawPivot.matrix).multiply(meshes.jaw.mesh.matrix);
  const heavy = (S.skull ? 1 : 0) + (S.brain ? 1 : 0) + (S.muscles ? 1 : 0) + (S.ribs ? 1 : 0) + (S.heart ? 1 : 0) + (S.lungs ? 1 : 0) + (S.skeleton ? 1 : 0);
  const share = 1 / (0.4 + 0.6 * Math.max(1, heavy));
  for (const k in meshes) {
    const { mesh, layer } = meshes[k], u = mesh.material.uniforms;
    mesh.visible = layer === "veil" ? true : !!S[layer];
    u.uGain.value = (S.style === "solid" && k !== "outline") ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * (XRAY_GAIN[k] || 1) * (layer === "outline" ? 1 : share);
    u.uOpacity.value = layer === "veil" ? 1 - S.real : 1;
    u.uClipOn.value = clipOn; u.uClip.value.set(cx, cy, cz, cw);
    u.uFeather.value = S.feather * 0.75; u.uCutSoft.value = S.feather * 5;
    if (k === "jaw") u.uToHead.value.copy(jawPivot.matrix).multiply(mesh.matrix); else u.uToHead.value.identity();
  }
}

// ------------------------------ hands ------------------------------
let vA, vB, vC, e1, e2, e3, hm;
function initHandMath() {
  lp = new THREE.Vector3(); ln = new THREE.Vector3(); lc = new THREE.Vector3();
  vA = new THREE.Vector3(); vB = new THREE.Vector3(); vC = new THREE.Vector3();
  e1 = new THREE.Vector3(); e2 = new THREE.Vector3(); e3 = new THREE.Vector3(); hm = new THREE.Matrix4();
}
function updateHand(rig, lms, isRight) {
  if (!rig.pts) rig.pts = lms.map(() => new THREE.Vector3());
  const fresh = !rig.group.visible;
  lms.forEach((p, i) => { tmpV.set(p.x * W, (1 - p.y) * H, -p.z * W); if (fresh) rig.pts[i].copy(tmpV); else rig.pts[i].lerp(tmpV, 0.65); });
  const P = rig.pts, sign = isRight ? 1 : -1;
  e1.subVectors(P[5], P[0]); e2.subVectors(P[17], P[0]);
  e3.crossVectors(e1, e2).normalize().multiplyScalar(sign * Math.sqrt(e1.length() * e2.length()));
  rig.palm.matrix.makeBasis(e1, e2, e3).setPosition(P[0]);
  rig.palm.matrixWorldNeedsUpdate = true;
  vC.subVectors(P[17], P[5]).normalize();
  BONES.forEach(([a, b], i) => {
    vA.subVectors(P[b], P[a]);
    let len = vA.length(); if (len < 1e-6) len = 1e-6;
    vA.divideScalar(len);
    vB.copy(vC).addScaledVector(vA, -vC.dot(vA));
    if (vB.lengthSq() < 1e-6) vB.set(1, 0, 0); vB.normalize();
    e3.crossVectors(vA, vB).multiplyScalar(sign);
    const L = len * (b % 4 === 0 ? 0.8 : 1);
    hm.makeBasis(e1.copy(vA).multiplyScalar(L), e2.copy(vB).multiplyScalar(L), e3.multiplyScalar(L)).setPosition(P[a]);
    rig.bones[i].matrix.copy(hm);
    rig.bones[i].matrixWorldNeedsUpdate = true;
  });
  rig.group.visible = true;
}

function drawHandVeil(g, lms, alpha) {
  const px = i => lms[i].x * W, py = i => lms[i].y * H;
  const d = Math.hypot(px(5) - px(17), py(5) - py(17)) || 1;
  g.fillStyle = g.strokeStyle = "rgba(4,7,13," + alpha.toFixed(3) + ")";
  g.lineJoin = g.lineCap = "round";
  const path = new Path2D();
  [0, 1, 2, 5, 9, 13, 17].forEach((i, k) => k ? path.lineTo(px(i), py(i)) : path.moveTo(px(i), py(i)));
  path.closePath();
  const fingers = new Path2D();
  for (const c of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]])
    c.forEach((i, k) => k ? fingers.lineTo(px(i), py(i)) : fingers.moveTo(px(i), py(i)));
  const sc = drawHandVeil.sc || (drawHandVeil.sc = document.createElement("canvas"));
  if (sc.width !== W || sc.height !== H) { sc.width = W; sc.height = H; }
  const s = sc.getContext("2d");
  s.clearRect(0, 0, W, H); s.fillStyle = s.strokeStyle = "#04070d"; s.lineJoin = s.lineCap = "round";
  s.lineWidth = d * 0.34; s.fill(path); s.stroke(path); s.lineWidth = d * 0.36; s.stroke(fingers);
  const blur = S.feather * d * 0.22;
  g.filter = blur > 0.5 ? "blur(" + blur.toFixed(1) + "px)" : "none";
  g.globalAlpha = alpha; g.drawImage(sc, 0, 0); g.globalAlpha = 1; g.filter = "none";
}

// ------------------------------ labels ------------------------------
const LABEL_COLOR = {
  skull: "#d9f0ff", brain: "#ffc2d6", muscles: "#ffb3aa", eyes: "#fff3a8", hands: "#d9f0ff",
  ribs: "#bfe3ff", heart: "#ff5d73", lungs: "#55e0c5", cartilage: "#88ddff", skeleton: "#bfe3ff"
};
const HEAD_C = [0, 3.2, -4.8];
const labelState = {};
let lp, ln, lc;
function toScreen(v) {
  lc.copy(v).applyMatrix4(cam.projectionMatrix);
  return { x: W - (lc.x + 1) / 2 * W, y: (1 - lc.y) / 2 * H };
}

// Comprehensive Full-Body Labels
const THORAX_LABELS = [
  { t: "Rib cage", layer: "ribs", jaw: 0, pts: [[9.2, -18.5, 0.0], [-9.2, -18.5, 0.0]] },
  { t: "Sternum", layer: "ribs", jaw: 0, pts: [[0.0, -21.0, 3.2]] },
  { t: "Thoracic spine", layer: "ribs", jaw: 0, pts: [[0.0, -20.0, -5.2]] },
  { t: "Clavicle", layer: "ribs", jaw: 0, pts: [[7.5, -13.8, 2.4], [-7.5, -13.8, 2.4]] },
  { t: "Costal Cartilage", layer: "cartilage", jaw: 0, pts: [[2.2, -22.5, 3.0], [-2.2, -22.5, 3.0]] },
  { t: "Beating Heart", layer: "heart", jaw: 0, pts: [[-2.4, -22.2, 1.8]] },
  { t: "Aorta Arch", layer: "heart", jaw: 0, pts: [[-1.2, -14.8, 0.8]] },
  { t: "Coronary Arteries", layer: "heart", jaw: 0, pts: [[-1.8, -20.0, 1.4]] },
  { t: "Right Lung", layer: "lungs", jaw: 0, pts: [[6.5, -19.5, 0.4]] },
  { t: "Left Lung", layer: "lungs", jaw: 0, pts: [[-6.5, -19.5, 0.4]] },
  { t: "Humerus", layer: "skeleton", jaw: 0, pts: [[16.8, -21.0, 0.2], [-16.8, -21.0, 0.2]] },
  { t: "Radius & Ulna", layer: "skeleton", jaw: 0, pts: [[18.2, -35.5, 0.0], [-18.2, -35.5, 0.0]] },
  { t: "Pelvic girdle", layer: "skeleton", jaw: 0, pts: [[8.5, -42.5, -1.8], [-8.5, -42.5, -1.8]] },
  { t: "Lumbar spine", layer: "skeleton", jaw: 0, pts: [[0.0, -34.0, -4.6]] },
  { t: "Femur", layer: "skeleton", jaw: 0, pts: [[8.6, -58.0, 0.3], [-8.6, -58.0, 0.3]] },
  { t: "Patella", layer: "skeleton", jaw: 0, pts: [[6.8, -67.0, 1.8], [-6.8, -67.0, 1.8]] },
  { t: "Tibia & Fibula", layer: "skeleton", jaw: 0, pts: [[6.5, -78.0, 0.0], [-6.5, -78.0, 0.0]] }
];

function collectHeadLabels(lens) {
  const out = [], solid = S.style === "solid", M = headGroup.matrix;
  const allLabels = [...META.labels, ...THORAX_LABELS];
  for (const L of allLabels) {
    if (!S[L.layer]) continue;
    if (solid && S.muscles && (L.layer === "skull" || L.layer === "brain")) continue;
    if (solid && S.skull && L.layer === "brain") continue;
    let best = null;
    for (const p of L.pts) {
      lp.fromArray(p); if (L.jaw) lp.applyMatrix4(jawM);
      if (clipState.on && clipState.x * lp.x + clipState.y * lp.y < clipState.w) continue;
      ln.set(lp.x - HEAD_C[0], lp.y - HEAD_C[1], lp.z - HEAD_C[2]).transformDirection(M);
      lp.applyMatrix4(M);
      const facing = -(ln.x * lp.x + ln.y * lp.y + ln.z * lp.z) / (lp.length() || 1);
      if (solid && facing < 0.12) continue;
      const s = toScreen(lp);
      if (lens && Math.hypot(s.x - lens.x, s.y - lens.y) > lens.r) continue;
      if (!best || facing > best.facing) best = { text: getLabel(L.t), color: LABEL_COLOR[L.layer] || "#eef1f8", ax: s.x, ay: s.y, facing };
    }
    if (best) out.push(best);
  }
  return out;
}

function layoutLabels(g, items, cx, halfWidth, key, splitX) {
  if (splitX === undefined) splitX = cx;
  const cols = { left: [], right: [] };
  for (const it of items) {
    const st = labelState[key + it.text] || (labelState[key + it.text] = { side: it.ax < splitX ? "left" : "right", y: null, seen: 0 });
    if (st.side === "left" && it.ax > splitX + halfWidth * 0.15) st.side = "right";
    else if (st.side === "right" && it.ax < splitX - halfWidth * 0.15) st.side = "left";
    it.st = st; cols[st.side].push(it);
  }
  g.font = "600 12px system-ui,-apple-system,'Sarabun','Thonburi','Segoe UI',sans-serif";
  g.textBaseline = "middle"; g.lineJoin = "round";
  for (const side of ["left", "right"]) {
    const list = cols[side], gap = 18;
    for (const it of list) {
      const st = it.st;
      if (st.wy === undefined || frameNo - st.seen > 3) { st.wy = it.ay; st.rank = undefined; } else st.wy += (it.ay - st.wy) * 0.5;
      st.seen = frameNo;
    }
    list.sort((p, q) => (p.st.rank === undefined || q.st.rank === undefined || p.st.side !== p.st.rankSide || q.st.side !== p.st.rankSide)
                        ? p.st.wy - q.st.wy : p.st.rank - q.st.rank);
    for (let swapped = true, guard = 0; swapped && guard < 40; guard++) {
      swapped = false;
      for (let i = 0; i + 1 < list.length; i++)
        if (list[i].st.wy > list[i + 1].st.wy + 7) { const tmp = list[i]; list[i] = list[i + 1]; list[i + 1] = tmp; swapped = true; }
    }
    list.forEach((it, i) => { it.st.rank = i; it.st.rankSide = side; });
    let prev = -1e9;
    for (const it of list) { it.ty = Math.max(it.st.wy, prev + gap); prev = it.ty; }
    const over = prev - (H - 12); if (over > 0) for (const it of list) it.ty -= over;
    const tx = side === "left" ? Math.max(8, cx - halfWidth - 22) : Math.min(W - 8, cx + halfWidth + 22);
    for (const it of list) {
      const y = it.ty;
      g.strokeStyle = it.color; g.globalAlpha = 0.75; g.lineWidth = 1;
      g.beginPath(); g.moveTo(it.ax, it.ay); g.lineTo(tx + (side === "left" ? 5 : -5), y); g.stroke();
      g.globalAlpha = 1; g.fillStyle = it.color; g.beginPath(); g.arc(it.ax, it.ay, 2.6, 0, 6.3); g.fill();
      g.textAlign = side === "left" ? "right" : "left";
      g.strokeStyle = "rgba(4,7,13,.92)"; g.lineWidth = 3.5; g.strokeText(it.text, tx, y);
      g.fillText(it.text, tx, y);
    }
  }
}

let frameNo = 0, headSplit = 0;
function drawLabels(g, lens) {
  frameNo++;
  let hx = W / 2, halfW = W * 0.16;
  if (head.found && headGroup.visible) {
    lp.fromArray(HEAD_C).applyMatrix4(headGroup.matrix);
    const c = toScreen(lp); lp.x += 10.5 * S.fs * S.fw; const e = toScreen(lp);
    hx = c.x; halfW = Math.abs(e.x - c.x);
    const items = collectHeadLabels(lens);
    const xs = items.map(it => it.ax).sort((a, b) => a - b), med = xs.length ? xs[xs.length >> 1] : hx;
    headSplit += ((hx + med) / 2 - headSplit) * 0.2;
    layoutLabels(g, items, hx, halfW, "h:", headSplit);
  }
  if (S.hands) handRigs.forEach((rig, i) => {
    if (!rig.group.visible || !rig.pts) return;
    const P = rig.pts, at = (a, b, k) => ({ ax: W - (P[a].x + (P[b].x - P[a].x) * k), ay: H - (P[a].y + (P[b].y - P[a].y) * k) });
    const items = [["Distal phalanx", 11, 12, 0.5], ["Middle phalanx", 10, 11, 0.5], ["Proximal phalanx", 9, 10, 0.5],
                   ["Metacarpal", 0, 9, 0.62], ["Carpal bones (wrist)", 0, 9, 0.1]]
      .map(([text, a, b, k]) => Object.assign({ text: getLabel(text), color: LABEL_COLOR.hands }, at(a, b, k)))
      .filter(it => !lens || Math.hypot(it.ax - lens.x, it.ay - lens.y) <= lens.r);
    let lo = 1e9, hi = -1e9; for (const p of P) { lo = Math.min(lo, W - p.x); hi = Math.max(hi, W - p.x); }
    const mid = (lo + hi) / 2, outerRight = mid > hx, far = outerRight ? lo - 1e4 : hi + 1e4;
    layoutLabels(g, items, far, outerRight ? hi - far : far - lo, "hand" + i + ":");
  });
}

// ------------------------------ Audio & Biomechanics Engine ------------------------------
let audioCtx = null, lastChime = 0, riskStart = 0;
function playSoftChime() {
  if (!S.ergoAudio) return;
  const now = performance.now();
  if (now - lastChime < 4000) return;
  lastChime = now;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) {}
}

let lastHeartBeat = 0;
function playHeartSound(now) {
  if (!S.heartAudio) return;
  if (now - lastHeartBeat < (60000 / S.bpm) * 0.75) return;
  lastHeartBeat = now;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o1 = audioCtx.createOscillator(), g1 = audioCtx.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(68, audioCtx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.11);
    g1.gain.setValueAtTime(0.14, audioCtx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.13);
    o1.connect(g1); g1.connect(audioCtx.destination);
    o1.start(); o1.stop(audioCtx.currentTime + 0.14);

    setTimeout(() => {
      try {
        const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(54, audioCtx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(36, audioCtx.currentTime + 0.12);
        g2.gain.setValueAtTime(0.12, audioCtx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
        o2.connect(g2); g2.connect(audioCtx.destination);
        o2.start(); o2.stop(audioCtx.currentTime + 0.15);
      } catch(e) {}
    }, 135);
  } catch(e) {}
}

function computeErgonomics(eu, jawScore) {
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
    statusText = S.lang === "en" ? "ALERT: Text Neck / High Strain" : "ระวัง! เสี่ยง Text Neck / ก้มคอมากเกินไป";
  } else if (forwardDeg > 12 || roll > 8) {
    status = "warn";
    statusText = S.lang === "en" ? "Warning: Mild Neck Strain" : "เตือน: เริ่มก้มคอ (ควรปรับระดับสายตา)";
  } else {
    status = "good";
    statusText = S.lang === "en" ? "Optimal Posture (Neutral)" : "ท่าทางสรีรศาสตร์ดีเยี่ยม (ปกติ)";
  }

  return { pitch, roll, yaw, forwardDeg, loadKg, loadLbs, jawMm, status, statusText };
}

function updateErgoUI(ergo) {
  const badge = $("ergo_badge");
  badge.className = "ergo-badge " + ergo.status;
  const icon = ergo.status === "good" ? "🟢" : ergo.status === "warn" ? "🟡" : "🔴";
  badge.textContent = icon + " " + ergo.statusText;

  $("ergo_load").textContent = ergo.loadKg.toFixed(1) + " kg (" + Math.round(ergo.loadLbs) + " lbs)";
  $("ergo_pitch").textContent = (ergo.pitch >= 0 ? "+" : "") + ergo.pitch.toFixed(1) + "°";
  $("ergo_roll").textContent = ergo.roll.toFixed(1) + "°";
  $("ergo_yaw").textContent = (ergo.yaw >= 0 ? "+" : "") + ergo.yaw.toFixed(1) + "°";
  $("ergo_jaw").textContent = ergo.jawMm + " mm";

  const pct = Math.min(100, Math.max(10, (ergo.loadKg / 28) * 100));
  const bar = $("ergo_bar");
  bar.style.width = pct + "%";
  bar.style.background = ergo.status === "good" ? "var(--ok)" : ergo.status === "warn" ? "var(--warn)" : "var(--bad)";
}

function drawErgoHUD(g, ergo) {
  const boxW = Math.min(260, W * 0.42), boxH = 56, bx = 14, by = 62; // Below floating bar
  g.save();
  g.fillStyle = "rgba(11, 16, 26, 0.82)";
  g.strokeStyle = ergo.status === "good" ? "rgba(71,217,132,0.5)" : ergo.status === "warn" ? "rgba(255,183,3,0.55)" : "rgba(255,77,104,0.75)";
  g.lineWidth = 1.5;

  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  g.font = "700 11px system-ui,-apple-system,sans-serif";
  g.fillStyle = ergo.status === "good" ? "#47d984" : ergo.status === "warn" ? "#ffb703" : "#ff4d68";
  g.textAlign = "left"; g.textBaseline = "top";
  const icon = ergo.status === "good" ? "● " : ergo.status === "warn" ? "▲ " : "■ ";
  g.fillText(icon + (S.lang === "en" ? "CERVICAL ERGONOMICS" : "สรีรศาสตร์กระดูกคอ C1-C7"), bx + 10, by + 8);

  g.font = "600 12.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#eef2fa";
  g.fillText(ergo.loadKg.toFixed(1) + " kg (" + Math.round(ergo.loadLbs) + " lbs)", bx + 10, by + 24);

  g.font = "500 10.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "rgba(238,242,250,0.7)";
  g.fillText("Pitch: " + ergo.pitch.toFixed(0) + "° | Roll: " + ergo.roll.toFixed(0) + "°", bx + 10, by + 40);

  const barX = bx + boxW - 70, barY = by + 25, barW = 60, barH = 6;
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.fillRect(barX, barY, barW, barH);
  g.fillStyle = ergo.status === "good" ? "#47d984" : ergo.status === "warn" ? "#ffb703" : "#ff4d68";
  const fillW = Math.min(barW, Math.max(4, (ergo.loadKg / 28) * barW));
  g.fillRect(barX, barY, fillW, barH);

  g.restore();
}

// ------------------------------ per-frame update ------------------------------
let pointer = null, frames = 0, fps = 0, fpsAt = 0, dataAt = 0;
stage.addEventListener("pointermove", e => { const r = stage.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
stage.addEventListener("pointerleave", () => { pointer = null; });

function renderFrame(now, faceLms, hands, sides) {
  const sg = $("shade").getContext("2d"); sg.clearRect(0, 0, W, H);
  handRigs.forEach((rig, i) => {
    const lms = hands[i];
    if (lms && S.hands) {
      updateHand(rig, lms, sides[i]);
      drawHandVeil(sg, lms, (1 - S.real) * 0.92);
      for (const m of [rig.palm, ...rig.bones]) { m.material.uniforms.uGain.value = S.style === "solid" ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * 1.15;
                                                 m.material.uniforms.uFeather.value = S.feather * 0.75; }
    } else rig.group.visible = false;
  });
  if (!head.found) headGroup.visible = false;
  applyLayers();

  // 1. Helical Cardiac Contraction & Apex Twist Animation
  if (meshes.heart && S.heart) {
    const bpm = S.bpm || 75;
    const freq = (bpm / 60) * Math.PI * 2;
    const phase = (now / 1000) * freq;
    const lub = Math.sin(phase);
    const dub = Math.sin(phase + 0.65);
    const beat = Math.pow(Math.max(0, lub), 6) * 0.16 + Math.pow(Math.max(0, dub), 8) * 0.10;

    const twistAngle = S.twist ? (beat * 0.22) : 0;
    meshes.heart.mesh.rotation.z = twistAngle;
    meshes.heart.mesh.rotation.y = twistAngle * 0.6;
    meshes.heart.mesh.scale.set(1 + beat * 0.8, 1 + beat * 1.15, 1 + beat * 0.8);

    const u = meshes.heart.mesh.material.uniforms;
    u.uGain.value = (S.style === "solid" ? 1.0 : S.bright * 1.25) * (1.0 + beat * 0.85);

    if (beat > 0.18) playHeartSound(now);
  }

  // 2. Respiratory Cycle (Lungs & Thoracic expansion)
  if (S.lungs || S.ribs) {
    const respRate = S.resp || 15;
    const respPhase = (now / 1000) * (respRate / 60) * Math.PI * 2;
    const breath = 0.5 + 0.5 * Math.sin(respPhase);
    if (meshes.lungs) {
      meshes.lungs.mesh.scale.set(1 + breath * 0.08, 1 + breath * 0.06, 1 + breath * 0.09);
    }
    if (meshes.ribs && S.ribs) {
      meshes.ribs.mesh.scale.set(1 + breath * 0.03, 1 + breath * 0.02, 1 + breath * 0.035);
    }
  }

  let mask = "none", lens = null;
  if (S.reveal === "lens") {
    const rad = (0.07 + 0.38 * S.cut) * W;
    let cx, cy;
    if (hands[0]) { cx = hands[0][8].x * W; cy = hands[0][8].y * H; }
    else if (pointer) { cx = W - pointer.x; cy = pointer.y; }
    else if (faceLms) { cx = faceLms[1].x * W; cy = faceLms[1].y * H; }
    else { cx = W / 2; cy = H / 2; }
    mask = "radial-gradient(circle " + rad.toFixed(1) + "px at " + cx.toFixed(1) + "px " + cy.toFixed(1) + "px, #000 " + (98 - 78 * S.feather).toFixed(0) + "%, transparent 100%)";
    lens = { x: W - cx, y: cy, r: rad };
  }
  for (const id of ["gl", "shade"]) { const st = $(id).style; st.maskImage = mask; st.webkitMaskImage = mask; }

  renderer.clear();
  renderer.render(headScene, cam);
  renderer.clearDepth();
  renderer.render(handScene, ortho);

  const g = $("hud").getContext("2d"); g.clearRect(0, 0, W, H);
  if (lens) { g.strokeStyle = "rgba(127,209,255,.8)"; g.lineWidth = 2; g.beginPath(); g.arc(lens.x, lens.y, lens.r, 0, 6.3); g.stroke(); }
  if (S.labels) drawLabels(g, lens);

  // Ergonomics computation & HUD overlay
  if (head.found && headGroup.visible) {
    const eu = new THREE.Euler().setFromQuaternion(head.quat, "YXZ");
    const ergo = computeErgonomics(eu, head.jaw);
    updateErgoUI(ergo);

    if (S.ergo) {
      drawErgoHUD(g, ergo);
      if (ergo.status === "bad") {
        if (!riskStart) riskStart = now;
        if (now - riskStart > 2500) playSoftChime();
      } else {
        riskStart = 0;
      }
    }
  }

  if (S.showdata) {
    if (faceLms) { g.fillStyle = "rgba(127,255,170,.85)"; for (const p of faceLms) g.fillRect((1 - p.x) * W - 1, p.y * H - 1, 2, 2); }
    g.strokeStyle = "rgba(255,183,3,.9)"; g.fillStyle = "#ffb703"; g.lineWidth = 1.5;
    for (const lms of hands) {
      for (const c of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]) {
        g.beginPath(); c.forEach((i, k) => { const x = (1 - lms[i].x) * W, y = lms[i].y * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      }
      for (const p of lms) { g.beginPath(); g.arc((1 - p.x) * W, p.y * H, 3, 0, 6.3); g.fill(); }
    }
    if (now - dataAt > 120) {
      dataAt = now;
      const pad = k => (k + "                  ").slice(0, 18), rows = [];
      if (head.found) {
        const eu = new THREE.Euler().setFromQuaternion(head.quat, "YXZ"), deg = r => (r * 57.2958).toFixed(0) + "°";
        rows.push(["face", "tracked, " + (faceLms ? faceLms.length : 0) + " points"],
                  ["distance", (-head.pos.z).toFixed(0) + " cm (estimate)"],
                  ["turn / nod / tilt", deg(eu.y) + " / " + deg(eu.x) + " / " + deg(eu.z)],
                  ["jaw open", head.jaw.toFixed(2)],
                  ["screen fit", "scale " + head.fitS.toFixed(3) + ", shift " + head.fitX.toFixed(3) + ", " + head.fitY.toFixed(3)]);
      } else rows.push(["face", "not found"]);
      rows.push(["hands", hands.length ? hands.map((h, i) => sides[i] ? "right" : "left").join(" + ") : "none"]);
      if (hands[0]) rows.push(["index fingertip", (1 - hands[0][8].x).toFixed(2) + ", " + hands[0][8].y.toFixed(2)]);
      rows.push(["heart rate", Math.round(S.bpm) + " BPM (" + (S.twist ? "helical twist" : "uniform") + ")"],
                ["respiration", Math.round(S.resp) + " /min"],
                ["layers", LAYERS.filter(k => S[k]).join(", ") || "none"], ["speed", fps + " frames/s"]);
      $("data").textContent = rows.map(r => pad(r[0]) + r[1]).join("\n");
    }
  }
  frames++;
  if (now - fpsAt >= 1000) { fps = Math.round(frames * 1000 / (now - fpsAt)); frames = 0; fpsAt = now; }
}

// ------------------------------ start-up ------------------------------
let faceTracker = null, handTracker = null;
async function loadTrackers() {
  const vision = await import(MP + "/vision_bundle.mjs");
  const files = await vision.FilesetResolver.forVisionTasks(MP + "/wasm");
  const mkFace = d => vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d },
    runningMode: "VIDEO", numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true });
  const mkHand = d => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
    runningMode: "VIDEO", numHands: 2 });
  try { faceTracker = await mkFace("GPU"); } catch (e) { faceTracker = await mkFace("CPU"); }
  try { try { handTracker = await mkHand("GPU"); } catch (e) { handTracker = await mkHand("CPU"); } }
  catch (e) { handTracker = null; }
}

function liveLoop() {
  let lastTime = -1, lostAt = 0, said = "";
  const say = (t, c) => { if (said !== t) { said = t; setStatus(t, c); } };
  function tick() {
    requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const now = performance.now();
    let faceLms = null, hands = [], sides = [];
    try {
      const fr = faceTracker.detectForVideo(video, now);
      faceLms = fr.faceLandmarks && fr.faceLandmarks[0];
      const mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
      if (faceLms && mat) {
        let jaw = 0;
        const bs = fr.faceBlendshapes && fr.faceBlendshapes[0];
        if (bs) for (const c of bs.categories) if (c.categoryName === "jawOpen") jaw = c.score;
        updateHead(mat.data, faceLms, jaw); lostAt = 0;
      } else { faceLms = null; if (!lostAt) lostAt = now; if (now - lostAt > 250) head.found = false; }
      if (handTracker && (S.hands || S.reveal === "lens" || S.showdata)) {
        const hr = handTracker.detectForVideo(video, now);
        hands = hr.landmarks || [];
        const hd = hr.handedness || hr.handednesses || [];
        sides = hands.map((h, i) => !!(hd[i] && hd[i][0] && hd[i][0].categoryName === "Left"));
      }
    } catch (e) { say("The tracker hit an error: " + e.message, "bad"); return; }
    const t = UI_TEXT[S.lang] || UI_TEXT.both;
    say(head.found ? t.status_tracking + (hands.length ? t.status_hands : "")
                   : hands.length ? "Hand found. Face the camera to see inside your head."
                   : "No face found. Face the camera, with light on your face.", head.found || hands.length ? "ok" : "bad");
    renderFrame(now, faceLms, hands, sides);
  }
  tick();
}

function demoLoop() {
  $("intro").hidden = true;
  const t = UI_TEXT[S.lang] || UI_TEXT.both;
  setStatus(t.status_demo, "ok");
  const params = new URLSearchParams(location.search), still = params.has("still");
  const base = META.demoHand, cx = base[9][0], cy = base[9][1], cz = base[9][2];
  function tick() {
    if (!still) requestAnimationFrame(tick);
    const now = performance.now(), time = still ? 1.2 : now / 1000;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.06 + 0.05 * Math.sin(time * 0.7), 0.42 * Math.sin(time * 0.5 + 0.9), 0.04, "YXZ"));
    m.setPosition(-5 + 2 * Math.sin(time * 0.4), 1.5, -46);
    const lms = [];
    for (const id of FIT_IDS) { const v = new THREE.Vector3().fromArray(META.fit[id]).applyMatrix4(m).applyMatrix4(baseProj); lms[id] = { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: 0 }; }
    updateHead(m.elements, lms, 0.5 + 0.5 * Math.sin(time * 1.3));
    const k = 0.0021 * H / W * (4 / 3), hand = base.map(p => ({ x: 0.2 - (p[0] - cx) * k, y: 0.56 + (p[2] - cz) * k * W / H, z: (p[1] - cy) * k }));
    renderFrame(now, FIT_IDS.map(id => lms[id]), [hand], [true]);
  }
  tick();
}

async function boot() {
  THREE = await import(DEMO && new URLSearchParams(location.search).get("three") || THREE_URL);
  initMath(); initHandMath(); buildScene();
}

$("start").onclick = async () => {
  $("start").disabled = true;
  let stageName = "camera";
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error("this browser will not give this page a camera. Try Chrome or Edge.");
    setStatus("Asking for the camera… / กำลังขอสิทธิ์เปิดกล้อง…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    if (video.videoWidth && video.videoHeight) stage.style.setProperty("--ar", (video.videoWidth / video.videoHeight).toFixed(4));
    $("intro").hidden = true;
    stageName = "3D engine";
    setStatus("Loading the 3D anatomy… / กำลังโหลดโมเดล 3D กายวิภาค…");
    await boot();
    stageName = "trackers";
    setStatus("Loading face & hand AI trackers… / กำลังโหลด AI ตรวจจับใบหน้าและมือ…");
    await loadTrackers();
    if (!handTracker) $("L_hands").disabled = true;
    resize();
    liveLoop();
  } catch (err) {
    $("start").disabled = false; $("intro").hidden = false;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const msg = err && err.message ? err.message : String(err);
    setStatus(denied ? "Camera blocked. Allow camera access for this page and click Start again."
            : "Could not load the " + stageName + ": " + msg, "bad");
  }
};

if (DEMO) boot().then(demoLoop).catch(e => setStatus("Demo failed: " + e.message, "bad"));
