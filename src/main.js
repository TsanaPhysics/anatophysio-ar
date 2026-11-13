import { THREE_URL, MP, MODELS, FACE_MODEL, HAND_MODEL, POSE_MODEL } from "./config.js";
import { createBodyRig, updateBodyRig, segKey } from "./anatomy/body-rig.js";
import { ANATOMY_DICT } from "./anatomy/dictionary.js";
import { THORAX_LABELS } from "./anatomy/thorax-labels.js";
import { setThree, mergeGeos, buildBonyThoraxGeometry, buildCostalCartilageGeometry,
         buildRealisticHeartGeometry, buildRealisticLungsGeometry, buildAirwayAndDiaphragm,
         buildSkeletonParts, buildFullSkeletonGeometry,
         applyBrainGyriAndSulci, buildDigitalBrainConnectome, buildOcularVasculature,
         buildVascularSystemParts, buildLimbMuscleParts } from "./anatomy/procedural.js";
import { UI_TEXT } from "./ui/i18n.js";
import { VERT, FRAG } from "./shaders/xray.js";
import { playSoftChime, playHeartSound, playS1, playS2 } from "./audio/sounds.js";
import { RPPGDetector } from "./physiology/rppg.js";
import { WiggersCycle } from "./physiology/wiggers.js";
import { evaluateCobbAngle, evaluateCROM, evaluateTMJ } from "./physiology/clinical.js";
import { computeErgonomics } from "./physiology/ergonomics.js";
import { initInspector, showAnatomyInspector, hideAnatomyInspector } from "./ui/inspector.js";
import { generateClinicalReport } from "./clinical/report.js";

const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = "status-bar " + (cls || ""); }
const DEMO = location.hash === "#demo";
// Anatomy assets (extracted from the monolithic HTML in Phase 1)
const ASSET_BASE = new URL("../assets/models/", import.meta.url);
let META, MESH_BUFFER;

// ------------------------------ 3D scene & variables ------------------------------
let THREE, renderer, headScene, handScene, cam, ortho, headGroup, jawPivot, baseProj;
let heartGroup = null, lungsGroup = null, ribsGroup = null, skelGroup = null;
let bodyGroup = null, bodyRig = null;
let digitalBrainGroup = null, digitalBrainLines = null, digitalBrainNodes = null;
let eyeVasculatureGroup = null, eyeArteryLines = null, eyeVeinLines = null;
let lastInferMs = 14.5;
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

function getLabel(key) {
  const item = ANATOMY_DICT[key];
  if (!item) return key;
  if (S.lang === "th") return item.th;
  if (S.lang === "en") return item.en;
  return item.th + " (" + item.en + ")";
}

// ------------------------------ UI Translations ------------------------------

function updateUILanguage() {
  const t = UI_TEXT[S.lang] || UI_TEXT.both;
  const setTxt = (id, str) => { const el = $(id); if (el) el.textContent = str; };
  setTxt("ui_title", t.title);
  setTxt("start", t.start_cam);
  setTxt("start_demo", S.lang === "th" ? "🎮 โหมดจำลอง 3D (Demo Mode)" : S.lang === "en" ? "🎮 3D Demo Mode" : "🎮 โหมดจำลอง 3D (Demo Mode)");
  setTxt("intro_h2", "AnatoPhysio AR");
  setTxt("intro_p", S.lang === "th"
    ? "ส่องดูกายวิภาคโครงกระดูกทั้งตัว สมองรอยหยัก หัวใจ 4 ห้องเต้นบิดเกลียว ปอด หลอดเลือดดวงตา และวิเคราะห์สรีรศาสตร์แบบเรียลไทม์"
    : S.lang === "en"
    ? "Explore full-body skeleton, gyri/sulci brain, 4-chamber helical heart, lungs, ocular vasculature & real-time ergonomics mirror"
    : "ส่องดูกายวิภาคโครงกระดูกทั้งตัว สมองรอยหยัก หัวใจ 4 ห้อง ปอด หลอดเลือดดวงตา และสรีรศาสตร์ (Full-body Anatomy & Physiology)");
  setTxt("tab_lbl_layers", t.tab_layers);
  setTxt("tab_lbl_cardiac", t.tab_cardiac);
  setTxt("tab_lbl_ergo", t.tab_ergo);
  setTxt("tab_lbl_look", t.tab_look);
  setTxt("tab_lbl_fit", t.tab_fit);
  setTxt("tab_lbl_xray", t.tab_xray);
  setTxt("tab_lbl_anatomy", t.tab_anatomy);
  setTxt("tab_lbl_physio", t.tab_physio);
  setTxt("ui_lbl_layers_head", t.layers_head);
  setTxt("ui_brain_ai_head", t.brain_ai_head);
  setTxt("ui_ck_digital_brain", t.ck_digital_brain);
  setTxt("ui_ck_deep_learning", t.ck_deep_learning);
  setTxt("ui_ck_skel", t.ck_skel);
  setTxt("ui_ck_ribs", t.ck_ribs);
  setTxt("ui_ck_heart", t.ck_heart);
  setTxt("ui_ck_lungs", t.ck_lungs);
  setTxt("ui_ck_cart", t.ck_cart);
  setTxt("ui_ck_hands", t.ck_hands);
  setTxt("ui_ck_skull", t.ck_skull);
  setTxt("ui_ck_brain", t.ck_brain);
  setTxt("ui_ck_muscles", t.ck_muscles);
  setTxt("ui_ck_vessels", t.ck_vessels);
  setTxt("ui_region_lbl", t.region_lbl);
  setTxt("ui_ck_eyes", t.ck_eyes);
  setTxt("ui_ck_eye_vessels", t.ck_eye_vessels);
  setTxt("ui_ck_fundus", t.ck_fundus);
  setTxt("ui_ck_outline", t.ck_outline);
  setTxt("ui_ck_labels", t.ck_labels);
  setTxt("ui_inspector_lbl", t.inspector_lbl);
  setTxt("ui_ergo_head", t.ergo_head);
  setTxt("ui_ergo_on", t.ergo_on);
  setTxt("ui_ergo_sound", t.ergo_sound);
  setTxt("ui_ergo_load_lbl", t.ergo_load_lbl);
  setTxt("ui_ergo_pitch", t.ergo_pitch);
  setTxt("ui_ergo_roll", t.ergo_roll);
  setTxt("ui_ergo_yaw", t.ergo_yaw);
  setTxt("ui_ergo_jaw", t.ergo_jaw);
  setTxt("ui_ergo_sh_tilt", t.ergo_sh_tilt);
  setTxt("ui_ergo_body_yaw", t.ergo_body_yaw);
  setTxt("ui_ergo_elbow", t.ergo_elbow);
  setTxt("ui_ergo_knee", t.ergo_knee);
  setTxt("ui_btn_report", t.btn_report);
  setTxt("ui_cardiac_head", t.cardiac_head);
  setTxt("ui_lbl_bpm", t.lbl_bpm);
  setTxt("ui_lbl_resp", t.lbl_resp);
  setTxt("ui_ck_sound", t.ck_sound);
  setTxt("ui_ck_twist", t.ck_twist);
  setTxt("ui_ck_rppg", t.ck_rppg);
  setTxt("ui_ck_ecg", t.ck_ecg);
  setTxt("ui_ck_alveolar", t.ck_alveolar);
  setTxt("ui_ck_cardiac_valves", t.ck_cardiac_valves);
  setTxt("ui_btn_flow_video", t.btn_flow_video);
  setTxt("ui_flow_modal_title", t.flow_modal_title);
  setTxt("ui_ergo_cobb_lbl", t.ergo_cobb_lbl);
  setTxt("ui_ergo_crom_lbl", t.ergo_crom_lbl);
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
  skull: true, brain: false, digital_brain: true, deep_learning: true, muscles: false, vessels: true,
  eyes: true, eye_vessels: true, fundusHud: true, outline: true, hands: true,
  ribs: true, heart: true, lungs: true, cartilage: true, skeleton: true, region: "auto",
  bpm: 75, resp: 15, heartAudio: true, twist: true, rppg: true, ecgHud: true, alveolarHud: true, cardiacValvesHud: true,
  style: "xray", bright: 1, real: 0.12, feather: 0.2, reveal: "whole", cut: 0.5, showdata: false,
  fs: 1, fw: 1, fh: 1, fd: 1, fx: 0, fy: 0, fz: 0, labels: false,
  lang: "both", ergo: true, ergoAudio: true
};
let S = Object.assign({}, DEFAULTS);
try { Object.assign(S, JSON.parse(localStorage.getItem("xr_settings") || "{}")); } catch (e) {}
function save() { try { localStorage.setItem("xr_settings", JSON.stringify(S)); } catch (e) {} }

const LAYERS = ["skull", "brain", "digital_brain", "muscles", "vessels", "eyes", "eye_vessels", "outline", "hands", "ribs", "heart", "lungs", "cartilage", "skeleton"];
const SLIDERS = ["bright", "real", "feather", "cut", "fs", "fw", "fh", "fd", "fx", "fy", "fz", "bpm", "resp"];

function syncUI() {
  for (const k of LAYERS) { const el = $("L_" + k); if (el) el.checked = !!S[k]; }
  if ($("L_deep_learning")) $("L_deep_learning").checked = !!S.deep_learning;
  if ($("fundus_hud")) $("fundus_hud").checked = !!S.fundusHud;
  if ($("region_focus")) $("region_focus").value = S.region || "auto";
  if (digitalBrainGroup) digitalBrainGroup.visible = !!S.digital_brain;
  if (eyeVasculatureGroup) eyeVasculatureGroup.visible = !!S.eye_vessels;
  for (const b of $("style").children) b.classList.toggle("on", b.dataset.style === S.style);
  for (const b of $("lang_seg").children) b.classList.toggle("on", b.dataset.lang === S.lang);
  $("ergo_enable").checked = S.ergo;
  $("ergo_audio").checked = S.ergoAudio;
  if ($("rppg_enable")) $("rppg_enable").checked = S.rppg;
  if ($("ecg_hud")) $("ecg_hud").checked = S.ecgHud;
  if ($("alveolar_hud")) $("alveolar_hud").checked = S.alveolarHud;
  if ($("cardiac_valves_hud")) $("cardiac_valves_hud").checked = S.cardiacValvesHud;
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
  populateAnatomySelect();
}
for (const k of LAYERS) {
  const el = $("L_" + k);
  if (el) el.onchange = e => {
    S[k] = e.target.checked;
    if (k === "digital_brain" && digitalBrainGroup) digitalBrainGroup.visible = S[k];
    if (k === "eye_vessels" && eyeVasculatureGroup) eyeVasculatureGroup.visible = S[k];
    save();
  };
}
if ($("L_deep_learning")) $("L_deep_learning").onchange = e => { S.deep_learning = e.target.checked; save(); };
if ($("fundus_hud")) $("fundus_hud").onchange = e => { S.fundusHud = e.target.checked; save(); };
if ($("region_focus")) $("region_focus").onchange = e => { S.region = e.target.value; save(); };
for (const b of $("style").children) b.onclick = () => { S.style = b.dataset.style; save(); syncUI(); applyStyle(); };
for (const b of $("lang_seg").children) b.onclick = () => { S.lang = b.dataset.lang; save(); syncUI(); };
$("ergo_enable").onchange = e => { S.ergo = e.target.checked; save(); };
$("ergo_audio").onchange = e => { S.ergoAudio = e.target.checked; save(); };
if ($("rppg_enable")) $("rppg_enable").onchange = e => { S.rppg = e.target.checked; save(); };
if ($("ecg_hud")) $("ecg_hud").onchange = e => { S.ecgHud = e.target.checked; save(); };
if ($("alveolar_hud")) $("alveolar_hud").onchange = e => { S.alveolarHud = e.target.checked; save(); };
if ($("cardiac_valves_hud")) $("cardiac_valves_hud").onchange = e => { S.cardiacValvesHud = e.target.checked; save(); };
const FLOW_MEDIA_ITEMS = {
  breathing: {
    src: "assets/media/breathing_animation.mp4",
    th: "<b>การหายใจ & ถุงลม (Human Breathing):</b> แสดงการทำงานประสานกันของหลอดลม (Trachea & Bronchi) การขยายตัวของปอด กะบังลม (Diaphragm Dome) และการแพร่แก๊ส O₂ / CO₂ ในถุงลมปอด",
    en: "<b>Human Breathing Process:</b> Demonstrates trachea/bronchi airflow, bilateral lung expansion, diaphragm dome contraction, and alveolar O₂ / CO₂ gas exchange."
  },
  heart_4chamber: {
    src: "assets/media/heart_4chamber.mp4",
    th: "<b>หัวใจ 4 ห้องและลิ้นหัวใจ (Macroscopic 4-Chamber View):</b> แสดงการทำงานประสานกันของหัวใจทั้ง 4 ห้อง หลอดเลือดใหญ่ (Aorta, Pulmonary Artery/Veins, Vena Cava) และลิ้นหัวใจทั้ง 4 ลิ้น",
    en: "<b>Macroscopic 4-Chamber Heart:</b> Demonstrates coordinated contraction of all four chambers, major great vessels, and opening/closing of all four heart valves."
  },
  heart_ra: {
    src: "assets/media/heart_right_atrium.mp4",
    th: "<b>หัวใจห้องบนขวา (Right Atrium):</b> รับเลือดดำ (Deoxygenated Blood) จาก Superior & Inferior Vena Cava แล้วบีบตัวส่งผ่านลิ้นหัวใจ Tricuspid ลงสู่ห้องล่างขวา",
    en: "<b>Right Atrium (RA):</b> Receives deoxygenated venous blood from the superior & inferior vena cava and contracts to fill the right ventricle."
  },
  heart_rv: {
    src: "assets/media/heart_right_ventricle.mp4",
    th: "<b>หัวใจห้องล่างขวา (Right Ventricle):</b> รับเลือดดำผ่านลิ้น Tricuspid แล้วบีบตัวส่งผ่านลิ้น Pulmonary Valve เข้าสู่ Pulmonary Artery เพื่อไปฟอกที่ปอด",
    en: "<b>Right Ventricle (RV):</b> Fills via the tricuspid valve and pumps deoxygenated blood through the pulmonary valve toward the lungs."
  },
  heart_la: {
    src: "assets/media/heart_left_atrium.mp4",
    th: "<b>หัวใจห้องบนซ้าย (Left Atrium):</b> รับเลือดแดงที่มีออกซิเจนสูงจาก Pulmonary Veins ทั้ง 4 เส้น แล้วส่งผ่านลิ้น Mitral (Bicuspid) ลงสู่ห้องล่างซ้าย",
    en: "<b>Left Atrium (LA):</b> Receives oxygenated blood from the pulmonary veins and delivers it across the mitral valve into the left ventricle."
  },
  heart_lv: {
    src: "assets/media/heart_left_ventricle.mp4",
    th: "<b>หัวใจห้องล่างซ้าย (Left Ventricle):</b> ผนังกล้ามเนื้อหนาที่สุด บีบตัวทรงพลัง (Helical Twist) ส่งเลือดแดงผ่านลิ้น Aortic Valve เข้าสู่ Aorta เลี้ยงทั่วร่างกาย",
    en: "<b>Left Ventricle (LV):</b> Thick muscular chamber contracting powerfully to eject oxygenated blood through the aortic valve into the systemic aorta."
  }
};
if ($("btn_flow_video") && $("flow_media_modal")) {
  const modal = $("flow_media_modal");
  const vid = $("flow_video_player");
  const desc = $("ui_flow_modal_desc");
  const selectFlowMedia = (id) => {
    const item = FLOW_MEDIA_ITEMS[id] || FLOW_MEDIA_ITEMS.breathing;
    if (vid) {
      vid.src = item.src;
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
    if (desc) desc.innerHTML = S.lang === "en" ? item.en : item.th;
    const tabs = $("flow_gallery_tabs");
    if (tabs) {
      for (const b of tabs.querySelectorAll(".flow-tab-btn")) {
        const active = b.dataset.flowId === id;
        b.style.borderColor = active ? "rgba(45,212,191,0.75)" : "rgba(148,163,184,0.25)";
        b.style.background = active ? "rgba(13,148,136,0.35)" : "rgba(30,41,59,0.7)";
        b.style.color = active ? "#5eead4" : "#cbd5e1";
      }
    }
  };
  const tabs = $("flow_gallery_tabs");
  if (tabs) {
    for (const b of tabs.querySelectorAll(".flow-tab-btn")) {
      b.onclick = () => selectFlowMedia(b.dataset.flowId);
    }
  }
  $("btn_flow_video").onclick = () => {
    modal.style.display = "flex";
    selectFlowMedia("breathing");
  };
  const closeModal = () => {
    modal.style.display = "none";
    if (vid) vid.pause();
  };
  if ($("btn_close_flow_modal")) $("btn_close_flow_modal").onclick = closeModal;
  modal.onclick = e => { if (e.target === modal) closeModal(); };
}
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
    S.region = "auto"; S.skeleton = true; S.ribs = true; S.skull = true; S.eyes = true; S.heart = true; S.cartilage = true; S.lungs = false; S.brain = false; S.muscles = false; S.vessels = true; S.outline = true;
  } else if (p === "thorax") {
    S.region = "thorax"; S.skeleton = false; S.ribs = true; S.skull = false; S.eyes = false; S.heart = true; S.cartilage = true; S.lungs = true; S.brain = false; S.muscles = true; S.vessels = true; S.outline = true;
  } else if (p === "arm") {
    S.region = "arm"; S.skeleton = true; S.muscles = true; S.vessels = true; S.hands = true; S.ribs = false; S.skull = false; S.heart = false; S.lungs = false; S.cartilage = false; S.brain = false; S.digital_brain = false; S.eyes = false; S.eye_vessels = false; S.outline = true;
  } else if (p === "leg") {
    S.region = "leg"; S.skeleton = true; S.muscles = true; S.vessels = true; S.hands = false; S.ribs = false; S.skull = false; S.heart = false; S.lungs = false; S.cartilage = false; S.brain = false; S.digital_brain = false; S.eyes = false; S.eye_vessels = false; S.outline = true;
  } else if (p === "lungs") {
    S.region = "thorax"; S.skeleton = false; S.ribs = true; S.skull = false; S.eyes = false; S.heart = true; S.cartilage = true; S.lungs = true; S.brain = false; S.muscles = false; S.vessels = true; S.outline = true;
  } else if (p === "skull") {
    S.region = "head"; S.skeleton = false; S.ribs = false; S.skull = true; S.eyes = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = false; S.muscles = false; S.vessels = true; S.outline = true;
  } else if (p === "eyes") {
    S.region = "head"; S.skeleton = false; S.ribs = false; S.skull = true; S.eyes = true; S.eye_vessels = true; S.fundusHud = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = false; S.digital_brain = false; S.muscles = false; S.outline = true;
  } else if (p === "brain") {
    S.region = "head"; S.skeleton = false; S.ribs = false; S.skull = false; S.eyes = false; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = true; S.digital_brain = false; S.muscles = false; S.outline = true;
  } else if (p === "digital_brain") {
    S.region = "head"; S.skeleton = false; S.ribs = false; S.skull = true; S.eyes = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = true; S.digital_brain = true; S.deep_learning = true; S.muscles = false; S.outline = true;
  } else if (p === "muscles") {
    S.region = "full"; S.skeleton = true; S.ribs = true; S.skull = false; S.eyes = true; S.heart = false; S.cartilage = false; S.lungs = false; S.brain = false; S.muscles = true; S.vessels = true; S.outline = true;
  } else {
    S.region = "full"; S.skeleton = true; S.ribs = true; S.skull = true; S.eyes = true; S.heart = true; S.cartilage = true; S.lungs = true; S.brain = true; S.muscles = true; S.vessels = true; S.outline = true;
  }
  save(); syncUI();
};
syncUI();

// ------------------------------ 3D scene ------------------------------
const limbMeshes = {};
const rppgDetector = new RPPGDetector(6);
const wiggersCycle = new WiggersCycle();
const ecgHistory = [];
const meshes = {};
const handRigs = [];
const BONES = [[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];
let lastEcgPush = 0;
let W = 640, H = 480;


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
    if (m.name === "cerebrum") {
      applyBrainGyriAndSulci(geo);
    } else {
      geo.computeVertexNormals();
    }
    out[m.name] = geo;
  }
  return out;
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

  // Digital Brain Neural Connectome (Synapses & Axon neural pathways)
  const dBrain = buildDigitalBrainConnectome();
  const dAxonMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending
  });
  digitalBrainLines = new THREE.LineSegments(dBrain.axonsGeo, dAxonMat);
  digitalBrainLines.matrixAutoUpdate = false; digitalBrainLines.frustumCulled = false;

  const dNodeMat = new THREE.PointsMaterial({
    color: 0x00f0ff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
  });
  digitalBrainNodes = new THREE.Points(dBrain.nodesGeo, dNodeMat);
  digitalBrainNodes.matrixAutoUpdate = false; digitalBrainNodes.frustumCulled = false;

  digitalBrainGroup = new THREE.Group();
  digitalBrainGroup.add(digitalBrainLines);
  digitalBrainGroup.add(digitalBrainNodes);
  digitalBrainGroup.visible = !!S.digital_brain;
  headGroup.add(digitalBrainGroup);

  // Ocular Structures & Vasculature (Central Retinal Artery/Vein, Optic Nerve & Lens)
  const eyeVas = buildOcularVasculature();
  const eyeArtMat = new THREE.LineBasicMaterial({
    color: 0xff2a4b, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending
  });
  eyeArteryLines = new THREE.LineSegments(eyeVas.arteryGeo, eyeArtMat);
  eyeArteryLines.matrixAutoUpdate = false; eyeArteryLines.frustumCulled = false;

  const eyeVeinMat = new THREE.LineBasicMaterial({
    color: 0xb81b4c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
  });
  eyeVeinLines = new THREE.LineSegments(eyeVas.veinGeo, eyeVeinMat);
  eyeVeinLines.matrixAutoUpdate = false; eyeVeinLines.frustumCulled = false;

  const eyeStructMesh = new THREE.Mesh(eyeVas.structuresGeo, makeMat(0x88ddff, 0xe2f1f8));
  eyeStructMesh.matrixAutoUpdate = false; eyeStructMesh.frustumCulled = false;

  eyeVasculatureGroup = new THREE.Group();
  eyeVasculatureGroup.add(eyeArteryLines);
  eyeVasculatureGroup.add(eyeVeinLines);
  eyeVasculatureGroup.add(eyeStructMesh);
  eyeVasculatureGroup.visible = !!S.eye_vessels;
  headGroup.add(eyeVasculatureGroup);

  // Body group & Rig (Thorax, Viscera, Spine, Pelvis & Limbs)
  bodyGroup = new THREE.Group(); bodyGroup.matrixAutoUpdate = false;
  headScene.add(bodyGroup);
  bodyRig = createBodyRig(THREE);

  // 1. Bony Thorax (Ribs 12 pairs + Sternum + Clavicles + Thoracic Spine)
  const thoraxGeo = buildBonyThoraxGeometry();
  ribsGroup = add("ribs", thoraxGeo, "ribs", 0xbfe3ff, 0xe9e2cf, 3, bodyGroup);

  // 2. Costal Cartilage (กระดูกอ่อนซี่โครง)
  const cartGeo = buildCostalCartilageGeometry();
  add("cartilage", cartGeo, "cartilage", 0x88ddff, 0xd2e8f8, 3, bodyGroup);

  // 3. Bilateral Lungs (ปอดซ้าย-ขวา - correct anatomical situs)
  const lungsGeo = buildRealisticLungsGeometry();
  lungsGroup = add("lungs", lungsGeo, "lungs", 0x55e0c5, 0xd99595, 2, bodyGroup);

  // 3b. Airway Tree (Trachea + Bronchi) & Muscular Diaphragm Dome (Google Flow Concept)
  const { airwayGeo, diaphragmGeo } = buildAirwayAndDiaphragm();
  add("airway", airwayGeo, "lungs", 0x7dd3fc, 0xe2e8f0, 3, bodyGroup);
  add("diaphragm", diaphragmGeo, "lungs", 0xfb7185, 0xc94c5b, 3, bodyGroup);

  // 4. Realistic 4-Chamber Heart & Great Vessels (Apex & Aorta at subject's left)
  const heartGeo = buildRealisticHeartGeometry();
  heartGroup = add("heart", heartGeo, "heart", 0xff3b5c, 0xb53545, 4, bodyGroup);

  // 5. Full Body Skeleton: Axial (Lumbar spine & pelvis) + Articulated Limbs
  const skelParts = buildSkeletonParts();
  skelGroup = add("skeleton", skelParts.axial, "skeleton", 0xbfe3ff, 0xe9e2cf, 3, bodyGroup);
  meshes["skeleton"].region = "pelvis";
  meshes["ribs"].region = "thorax";
  meshes["cartilage"].region = "thorax";
  meshes["lungs"].region = "thorax";
  meshes["heart"].region = "thorax";
  for (const k in skelParts.segments) {
    const m = add("skeleton_" + k, skelParts.segments[k], "skeleton", 0xbfe3ff, 0xe9e2cf, 3, bodyGroup);
    m.matrixAutoUpdate = false;
    meshes["skeleton_" + k].region = (k.startsWith("upperArm") || k.startsWith("forearm")) ? "arm" : "leg";
    (limbMeshes[k] || (limbMeshes[k] = [])).push(m);
  }

  // 6. Systemic Blood Vessels (Arteries & Veins: Aorta, Vena Cava, Carotid, Brachial/Radial, Femoral/Tibial)
  const vascParts = buildVascularSystemParts();
  add("vessels_art_axial", vascParts.arteries.axial, "vessels", 0xff2e4c, 0xc81e3a, 5, bodyGroup);
  meshes["vessels_art_axial"].region = "thorax";
  add("vessels_vein_axial", vascParts.veins.axial, "vessels", 0x387dff, 0x1d4ed8, 5, bodyGroup);
  meshes["vessels_vein_axial"].region = "thorax";
  for (const k in vascParts.arteries.segments) {
    const reg = (k.startsWith("upperArm") || k.startsWith("forearm")) ? "arm" : "leg";
    const ma = add("artery_" + k, vascParts.arteries.segments[k], "vessels", 0xff2e4c, 0xc81e3a, 5, bodyGroup);
    ma.matrixAutoUpdate = false;
    meshes["artery_" + k].region = reg;
    (limbMeshes[k] || (limbMeshes[k] = [])).push(ma);
  }
  for (const k in vascParts.veins.segments) {
    const reg = (k.startsWith("upperArm") || k.startsWith("forearm")) ? "arm" : "leg";
    const mv = add("vein_" + k, vascParts.veins.segments[k], "vessels", 0x387dff, 0x1d4ed8, 5, bodyGroup);
    mv.matrixAutoUpdate = false;
    meshes["vein_" + k].region = reg;
    (limbMeshes[k] || (limbMeshes[k] = [])).push(mv);
  }

  // 7. Torso & Limb Skeletal Muscles (Pectorals, Abs, Deltoid, Biceps/Triceps, Forearm, Quads/Hams, Calf)
  const muscParts = buildLimbMuscleParts();
  add("muscles_torso_axial", muscParts.axial, "muscles", 0xff6b5e, 0xb5453c, 2, bodyGroup);
  meshes["muscles_torso_axial"].region = "thorax";
  for (const k in muscParts.segments) {
    const reg = (k.startsWith("upperArm") || k.startsWith("forearm")) ? "arm" : "leg";
    const mm = add("muscle_" + k, muscParts.segments[k], "muscles", 0xff6b5e, 0xb5453c, 2, bodyGroup);
    mm.matrixAutoUpdate = false;
    meshes["muscle_" + k].region = reg;
    (limbMeshes[k] || (limbMeshes[k] = [])).push(mm);
  }

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
  outline: 0.55, muscles: 0.52, vessels: 1.15, cerebrum: 0.36, hindbrain: 0.6, eyes: 0.9,
  ribs: 0.75, heart: 1.25, lungs: 0.42, cartilage: 0.65, skeleton: 0.75
};

function applyLayers(focusRegion = null) {
  const reveal = S.reveal;
  let clipOn = 0, cx = 1, cy = 0, cz = 0, cw = 0;
  if (reveal === "left")   { clipOn = 1; cx = 1;  cy = 0; cw = (S.cut - 0.5) * 16; }
  if (reveal === "right")  { clipOn = 1; cx = -1; cy = 0; cw = (S.cut - 0.5) * 16; }
  if (reveal === "top")    { clipOn = 1; cx = 0; cy = 1;  cw = -9 + (1 - S.cut) * 22; }
  if (reveal === "bottom") { clipOn = 1; cx = 0; cy = -1; cw = -(-9 + S.cut * 22); }
  clipState.on = clipOn; clipState.x = cx; clipState.y = cy; clipState.w = cw;
  jawPivot.updateMatrix(); meshes.jaw.mesh.updateMatrix();
  jawM.copy(jawPivot.matrix).multiply(meshes.jaw.mesh.matrix);
  const heavy = (S.skull ? 1 : 0) + (S.brain ? 1 : 0) + (S.muscles ? 1 : 0) + (S.vessels ? 1 : 0) + (S.ribs ? 1 : 0) + (S.heart ? 1 : 0) + (S.lungs ? 1 : 0) + (S.skeleton ? 1 : 0);
  const share = 1 / (0.4 + 0.6 * Math.max(1, heavy));
  const explicitReg = S.region && S.region !== "auto" && S.region !== "full";
  for (const k in meshes) {
    const item = meshes[k];
    const { mesh, layer, region } = item, u = mesh.material.uniforms;
    let vis = layer === "veil" ? true : !!S[layer];
    if (explicitReg && region && region !== S.region && layer !== "veil" && layer !== "outline") {
      vis = false;
    }
    mesh.visible = vis;
    let gain = (S.style === "solid" && k !== "outline") ? Math.min(1.25, 0.6 + 0.4 * S.bright) : S.bright * (XRAY_GAIN[k] || XRAY_GAIN[layer] || 1) * (layer === "outline" ? 1 : share);
    if (focusRegion && focusRegion !== "full" && region && layer !== "veil" && layer !== "outline") {
      gain *= (region === focusRegion ? 1.45 : 0.40);
    }
    u.uGain.value = gain;
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
  skull: "#d9f0ff", brain: "#ffc2d6", muscles: "#ffb3aa", eyes: "#fff3a8", eye_vessels: "#ff4d68", hands: "#d9f0ff",
  ribs: "#bfe3ff", heart: "#ff5d73", lungs: "#55e0c5", cartilage: "#88ddff", skeleton: "#bfe3ff"
};
const HEAD_C = [0, 3.2, -4.8];
const labelState = {};
let activeLabelHitBoxes = [];
let lp, ln, lc;
function toScreen(v) {
  lc.copy(v).applyMatrix4(cam.projectionMatrix);
  return { x: W - (lc.x + 1) / 2 * W, y: (1 - lc.y) / 2 * H };
}

// Comprehensive Full-Body Labels

function collectHeadLabels(lens) {
  const out = [], solid = S.style === "solid", M = headGroup.matrix;
  const allLabels = [...META.labels, ...THORAX_LABELS];
  for (const L of allLabels) {
    if (!S[L.layer]) continue;
    if (solid && S.muscles && (L.layer === "skull" || L.layer === "brain")) continue;
    if (solid && S.skull && L.layer === "brain") continue;
    let best = null;
    for (const p of L.pts) {
      lp.fromArray(p);
      const isThorax = L.layer === "ribs" || L.layer === "cartilage" || L.layer === "heart" || L.layer === "lungs" || L.layer === "skeleton";
      let useM = M;
      if (isThorax && bodyRig) {
        if (L.seg) {
          const side = p[0] >= 0 ? 1 : -1;
          const k = segKey(L.seg, side);
          if (bodyRig.seg[k]) lp.applyMatrix4(bodyRig.seg[k].matrix);
        }
        useM = bodyRig.matrix;
      } else if (L.jaw) {
        lp.applyMatrix4(jawM);
      }
      if (clipState.on && clipState.x * lp.x + clipState.y * lp.y < clipState.w) continue;
      ln.set(lp.x - HEAD_C[0], lp.y - HEAD_C[1], lp.z - HEAD_C[2]).transformDirection(useM);
      lp.applyMatrix4(useM);
      const facing = -(ln.x * lp.x + ln.y * lp.y + ln.z * lp.z) / (lp.length() || 1);
      if (solid && facing < 0.12) continue;
      const s = toScreen(lp);
      if (lens && Math.hypot(s.x - lens.x, s.y - lens.y) > lens.r) continue;
      if (!best || facing > best.facing) best = { text: getLabel(L.t), rawKey: L.t, color: LABEL_COLOR[L.layer] || "#eef1f8", ax: s.x, ay: s.y, facing };
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

      const tw = g.measureText(it.text).width;
      const lx = side === "left" ? tx - tw - 4 : tx - 4;
      const rx = side === "left" ? tx + 4 : tx + tw + 4;
      activeLabelHitBoxes.push({
        rawKey: it.rawKey || it.text,
        text: it.text,
        minX: lx, maxX: rx,
        minY: y - 10, maxY: y + 10
      });
    }
  }
}

let frameNo = 0, headSplit = 0;
function drawLabels(g, lens) {
  frameNo++;
  activeLabelHitBoxes = [];
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
      .map(([text, a, b, k]) => Object.assign({ text: getLabel(text), rawKey: text, color: LABEL_COLOR.hands }, at(a, b, k)))
      .filter(it => !lens || Math.hypot(it.ax - lens.x, it.ay - lens.y) <= lens.r);
    let lo = 1e9, hi = -1e9; for (const p of P) { lo = Math.min(lo, W - p.x); hi = Math.max(hi, W - p.x); }
    const mid = (lo + hi) / 2, outerRight = mid > hx, far = outerRight ? lo - 1e4 : hi + 1e4;
    layoutLabels(g, items, far, outerRight ? hi - far : far - lo, "hand" + i + ":");
  });
}

// ------------------------------ Audio & Biomechanics Engine ------------------------------
let riskStart = 0;
let lastErgo = null, lastCobb = null;

function updateErgoUI(ergo) {
  lastErgo = ergo;
  const badge = $("ergo_badge");
  badge.className = "ergo-badge " + ergo.status;
  const icon = ergo.status === "good" ? "🟢" : ergo.status === "warn" ? "🟡" : "🔴";
  badge.textContent = icon + " " + ergo.statusText;

  $("ergo_load").textContent = ergo.loadKg.toFixed(1) + " kg (" + Math.round(ergo.loadLbs) + " lbs)";
  $("ergo_pitch").textContent = (ergo.pitch >= 0 ? "+" : "") + ergo.pitch.toFixed(1) + "°";
  $("ergo_roll").textContent = ergo.roll.toFixed(1) + "°";
  $("ergo_yaw").textContent = (ergo.yaw >= 0 ? "+" : "") + ergo.yaw.toFixed(1) + "°";
  $("ergo_jaw").textContent = ergo.jawMm + " mm";
  if (bodyRig && bodyRig.info) {
    const inf = bodyRig.info;
    $("ergo_sh_tilt").textContent = (inf.shoulderTilt >= 0 ? "+" : "") + inf.shoulderTilt.toFixed(1) + "°";
    $("ergo_body_yaw").textContent = (inf.torsoYaw >= 0 ? "+" : "") + inf.torsoYaw.toFixed(1) + "°";
    $("ergo_elbow").textContent = (inf.elbowL !== null ? inf.elbowL.toFixed(0) + "°" : "-") + " / " +
                                  (inf.elbowR !== null ? inf.elbowR.toFixed(0) + "°" : "-");
    $("ergo_knee").textContent  = (inf.kneeL !== null ? inf.kneeL.toFixed(0) + "°" : "-") + " / " +
                                  (inf.kneeR !== null ? inf.kneeR.toFixed(0) + "°" : "-");
  }

  // Clinical Cobb Angle & CROM
  if (head && head.quat) {
    const eu = new THREE.Euler().setFromQuaternion(head.quat, "YXZ");
    const crom = evaluateCROM(eu);
    if ($("ergo_crom")) {
      const dir = crom.isFlexion ? "ก้ม" : "เงย";
      $("ergo_crom").textContent = dir + " " + Math.round(Math.abs(crom.pitchDeg)) + "° (" + crom.sagittalPct + "% ROM)";
    }
  }
  if (lastPoseData && lastPoseData.image) {
    const cobb = evaluateCobbAngle(lastPoseData.image);
    lastCobb = cobb;
    if ($("ergo_cobb")) {
      $("ergo_cobb").textContent = cobb.angle.toFixed(1) + "° (" + (cobb.status === "normal" ? "ปกติ" : "เอน") + ")";
      $("ergo_cobb").style.color = cobb.status === "normal" ? "var(--ok)" : cobb.status === "mild" ? "var(--warn)" : "var(--bad)";
    }
  }

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

function drawDeepLearningHUD(g, now, inferMs) {
  const boxW = Math.min(230, W * 0.44), boxH = 68;
  const bx = W - boxW - 14, by = 62;
  g.save();
  g.fillStyle = "rgba(8, 14, 26, 0.88)";
  g.strokeStyle = "rgba(0, 240, 255, 0.45)";
  g.lineWidth = 1;
  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  g.font = "700 11px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#38bdf8";
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillText("🧠 DEEP LEARNING AI INFERENCE", bx + 10, by + 8);

  g.font = "500 10px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#94a3b8";
  g.fillText("Backbone: BlazePose & Face CNN", bx + 10, by + 23);
  g.fillText("Inference: " + inferMs.toFixed(1) + " ms | Synapses: 1,791", bx + 10, by + 36);

  // Animated synaptic pulse bar
  const pulseW = (((now / 15) % 100) / 100) * (boxW - 20);
  g.fillStyle = "rgba(0, 240, 255, 0.18)";
  g.fillRect(bx + 10, by + 51, boxW - 20, 5);
  g.fillStyle = "#00f0ff";
  g.fillRect(bx + 10, by + 51, pulseW, 5);
  g.restore();
}

function drawFundusHUD(g, now) {
  const boxW = Math.min(270, W * 0.44), boxH = 92;
  const bx = 14, by = 126;
  g.save();

  // Glassmorphic background
  g.fillStyle = "rgba(10, 14, 24, 0.90)";
  g.strokeStyle = "rgba(255, 77, 104, 0.45)";
  g.lineWidth = 1;
  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  // 1. Ophthalmoscopic Circular Retina Viewport
  const eyeCx = bx + 42, eyeCy = by + 46, eyeR = 32;
  g.save();
  g.beginPath();
  g.arc(eyeCx, eyeCy, eyeR, 0, Math.PI * 2);
  g.clip();

  // Warm retinal reflex background
  const grad = g.createRadialGradient(eyeCx, eyeCy, 4, eyeCx, eyeCy, eyeR);
  grad.addColorStop(0, "#e67e22");
  grad.addColorStop(0.65, "#c0392b");
  grad.addColorStop(1, "#641e16");
  g.fillStyle = grad;
  g.fillRect(eyeCx - eyeR, eyeCy - eyeR, eyeR * 2, eyeR * 2);

  // Optic disc (nasal side, slightly right)
  const discX = eyeCx + 10, discY = eyeCy - 2;
  g.fillStyle = "#f9ca24";
  g.beginPath(); g.arc(discX, discY, 6.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f6e58d";
  g.beginPath(); g.arc(discX + 1, discY, 3.0, 0, Math.PI * 2); g.fill(); // Cup

  // Central Retinal Arterioles (bright red, pulsating)
  const pulse = 0.5 + 0.5 * Math.sin(now / 150);
  g.strokeStyle = "#ff4757";
  g.lineWidth = 1.2 + pulse * 0.4;
  g.beginPath(); g.moveTo(discX, discY); g.quadraticCurveTo(discX - 9, discY - 16, discX - 20, discY - 12); g.stroke();
  g.beginPath(); g.moveTo(discX, discY); g.quadraticCurveTo(discX - 9, discY + 16, discX - 20, discY + 12); g.stroke();
  g.beginPath(); g.moveTo(discX, discY); g.lineTo(discX + 7, discY - 10); g.stroke();
  g.beginPath(); g.moveTo(discX, discY); g.lineTo(discX + 7, discY + 10); g.stroke();

  // Central Retinal Venules (darker crimson, thicker)
  g.strokeStyle = "#a81d45";
  g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(discX + 1, discY); g.quadraticCurveTo(discX - 7, discY - 18, discX - 22, discY - 16); g.stroke();
  g.beginPath(); g.moveTo(discX + 1, discY); g.quadraticCurveTo(discX - 7, discY + 18, discX - 22, discY + 16); g.stroke();

  // Macula lutea & fovea centralis (temporal side)
  const maculaX = eyeCx - 8, maculaY = eyeCy;
  g.fillStyle = "rgba(74, 20, 20, 0.45)";
  g.beginPath(); g.arc(maculaX, maculaY, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff5a5";
  g.beginPath(); g.arc(maculaX, maculaY, 1.2, 0, Math.PI * 2); g.fill(); // Foveal reflex

  g.restore(); // end clip

  // Border ring around fundus viewport
  g.strokeStyle = "rgba(255, 77, 104, 0.75)";
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(eyeCx, eyeCy, eyeR, 0, Math.PI * 2); g.stroke();

  // 2. Clinical Telemetry Text
  const tx = bx + 84;
  g.font = "700 10.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#ff6b81";
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillText("👁️ " + (S.lang === "en" ? "RETINAL FUNDUSCOPY" : "ตรวจจอตาและหลอดเลือด"), tx, by + 10);

  g.font = "500 10px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#eef2fa";
  g.fillText("A:V Ratio: 2:3 (Normal)", tx, by + 26);
  g.fillText("Cup/Disc: 0.3 (No Glaucoma)", tx, by + 40);
  g.fillText("CRA / CRV: Clear Arcade", tx, by + 54);

  g.font = "600 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#2ed573";
  g.fillText("● Macula & Fovea: Intact", tx, by + 70);

  g.restore();
}

function drawAlveolarHUD(g, now, breath, respRate) {
  const boxW = Math.min(276, W * 0.45), boxH = 96;
  const bx = 14, by = H - boxH - 16;
  const t = now / 1000;
  const insp = Math.cos((t * (respRate / 60)) * Math.PI * 2) >= 0;

  g.save();
  g.fillStyle = "rgba(10, 14, 24, 0.90)";
  g.strokeStyle = "rgba(45, 212, 191, 0.48)";
  g.lineWidth = 1;
  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  // Alveolar Sac Viewport (left side)
  const cx = bx + 44, cy = by + 38;
  const alvR = 19 + breath * 4.5;
  const alvGrad = g.createRadialGradient(cx, cy, 3, cx, cy, alvR);
  alvGrad.addColorStop(0, "rgba(186, 230, 253, 0.32)");
  alvGrad.addColorStop(1, "rgba(45, 212, 191, 0.16)");
  g.fillStyle = alvGrad;
  g.strokeStyle = "rgba(94, 234, 212, 0.85)";
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(cx, cy, alvR, 0, Math.PI * 2); g.fill(); g.stroke();

  // Bronchiole neck
  g.strokeStyle = "rgba(125, 211, 252, 0.75)";
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(cx, by + 10); g.lineTo(cx, cy - alvR + 2); g.stroke();

  // Pulmonary Capillary Arc underneath alveolus
  const capY = by + 74;
  g.lineCap = "round";
  const capGrad = g.createLinearGradient(bx + 12, capY, bx + 76, capY);
  capGrad.addColorStop(0, "rgba(99, 102, 241, 0.65)");
  capGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.65)");
  capGrad.addColorStop(1, "rgba(255, 59, 92, 0.75)");
  g.strokeStyle = capGrad;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(bx + 12, capY);
  g.quadraticCurveTo(cx, capY - 12, bx + 76, capY);
  g.stroke();

  // Moving Red Blood Cells (RBCs) shifting from deoxygenated -> oxygenated
  for (let i = 0; i < 4; i++) {
    const p = ((t * 0.45 + i * 0.25) % 1);
    const rx = (bx + 14) + p * 60;
    const ry = capY - Math.sin(p * Math.PI) * 6;
    const red = Math.round(99 + p * (255 - 99));
    const green = Math.round(102 - p * 43);
    const blue = Math.round(241 - p * 149);
    g.fillStyle = `rgb(${red},${green},${blue})`;
    g.beginPath(); g.arc(rx, ry, 2.7, 0, Math.PI * 2); g.fill();
  }

  // O2 (cyan) diffusing down & CO2 (amber) diffusing up across alveolar-capillary membrane
  const diffP = (t * 0.9) % 1;
  g.fillStyle = "#38bdf8";
  g.beginPath(); g.arc(cx - 7, cy + 10 + diffP * 14, 2.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fbbf24";
  g.beginPath(); g.arc(cx + 7, (capY - 8) - diffP * 14, 2.2, 0, Math.PI * 2); g.fill();

  // Telemetry text (right side)
  const tx = bx + 88;
  g.font = "700 10.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#5eead4";
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillText("🫁 " + (S.lang === "en" ? "ALVEOLAR GAS EXCHANGE" : "การแลกเปลี่ยนแก๊สถุงลม"), tx, by + 10);

  const pao2 = Math.round(98 + breath * 8);
  const paco2 = Math.round(42 - breath * 4);
  g.font = "500 10px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#eef2fa";
  g.fillText(`PAO₂: ${pao2} mmHg  |  SpO₂: 98%`, tx, by + 27);
  g.fillText(`PACO₂: ${paco2} mmHg  |  RR: ${Math.round(respRate)} /min`, tx, by + 42);
  g.fillText(`O₂ → Capillary  |  CO₂ → Alveolus`, tx, by + 57);

  g.font = "600 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = insp ? "#38bdf8" : "#fbbf24";
  g.fillText(insp
    ? (S.lang === "en" ? "● INSPIRATION (Diaphragm ↓)" : "● หายใจเข้า (กะบังลมเลื่อนลง ↓)")
    : (S.lang === "en" ? "● EXPIRATION (Diaphragm ↑)" : "● หายใจออก (กะบังลมยกตัวขึ้น ↑)"), tx, by + 73);

  g.restore();
}

function drawCardiacValvesHUD(g, now, wState) {
  const boxW = Math.min(270, W * 0.44), boxH = 104;
  const bx = W - boxW - 14, by = H - 76 - 16 - boxH - 10;
  const phase = wState.phase || 0;
  const avOpen = phase < 0.21 || phase >= 0.56;
  const slOpen = phase >= 0.25 && phase < 0.50;
  const t = now / 1000;

  g.save();
  g.fillStyle = "rgba(10, 14, 24, 0.90)";
  g.strokeStyle = "rgba(255, 77, 104, 0.45)";
  g.lineWidth = 1;
  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  // 4-Chamber Mini Schematic (left side of box, anatomical orientation)
  const cx = bx + 44, cy = by + 54;
  const chW = 24, chH = 26;
  const beatScale = 0.88 + 0.12 * (wState.ventricleVolume || 1.0);

  // Right Atrium (screen-left top) & Right Ventricle (screen-left bottom) - Deoxygenated
  g.fillStyle = "rgba(56, 189, 248, 0.25)";
  g.strokeStyle = "#38bdf8";
  g.lineWidth = 1.4;
  g.fillRect(cx - chW - 2, cy - chH - 2, chW, chH * 0.72);
  g.strokeRect(cx - chW - 2, cy - chH - 2, chW, chH * 0.72);
  g.fillRect(cx - chW * beatScale - 2, cy - 4, chW * beatScale, chH * beatScale);
  g.strokeRect(cx - chW * beatScale - 2, cy - 4, chW * beatScale, chH * beatScale);

  // Left Atrium (screen-right top) & Left Ventricle (screen-right bottom) - Oxygenated
  g.fillStyle = "rgba(255, 59, 92, 0.28)";
  g.strokeStyle = "#ff4d68";
  g.fillRect(cx + 2, cy - chH - 2, chW, chH * 0.72);
  g.strokeRect(cx + 2, cy - chH - 2, chW, chH * 0.72);
  g.fillRect(cx + 2, cy - 4, chW * beatScale, chH * beatScale);
  g.strokeRect(cx + 2, cy - 4, chW * beatScale, chH * beatScale);

  // Chamber Labels
  g.font = "700 8.5px system-ui,-apple-system,sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#bae6fd";
  g.fillText("RA", cx - chW * 0.5 - 2, cy - chH * 0.64);
  g.fillText("RV", cx - chW * 0.5 - 2, cy + chH * 0.42);
  g.fillStyle = "#fecdd3";
  g.fillText("LA", cx + chW * 0.5 + 2, cy - chH * 0.64);
  g.fillText("LV", cx + chW * 0.5 + 2, cy + chH * 0.42);

  // AV Valves (Tricuspid & Mitral) Leaflet Indicators
  g.strokeStyle = avOpen ? "#4ade80" : "#facc15";
  g.lineWidth = 2.2;
  const avDrop = avOpen ? 5 : 0;
  g.beginPath();
  g.moveTo(cx - chW + 2, cy - 5); g.lineTo(cx - chW * 0.5 - 2, cy - 5 + avDrop);
  g.moveTo(cx - 4, cy - 5); g.lineTo(cx - chW * 0.5 - 2, cy - 5 + avDrop);
  g.moveTo(cx + 4, cy - 5); g.lineTo(cx + chW * 0.5 + 2, cy - 5 + avDrop);
  g.moveTo(cx + chW - 2, cy - 5); g.lineTo(cx + chW * 0.5 + 2, cy - 5 + avDrop);
  g.stroke();

  // Animated Blood Flow Particles
  const p = (t * ((S.bpm || 75) / 60)) % 1;
  g.fillStyle = "#38bdf8";
  g.beginPath();
  g.arc(cx - chW * 0.5 - 2, (avOpen ? (cy - 18 + p * 26) : (cy + 8 - p * 18)), 2.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ff4d68";
  g.beginPath();
  g.arc(cx + chW * 0.5 + 2, (avOpen ? (cy - 18 + p * 26) : (cy + 8 - p * 18)), 2.3, 0, Math.PI * 2);
  g.fill();

  // Telemetry & Valve Status (right side)
  const tx = bx + 84;
  g.font = "700 10.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#ff6b81";
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillText("🫀 " + (S.lang === "en" ? "4-CHAMBER & VALVES" : "ลิ้นหัวใจและการไหลเวียน"), tx, by + 10);

  g.font = "600 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = avOpen ? "#4ade80" : "#facc15";
  g.fillText(`AV (Tricuspid/Mitral): ${avOpen ? "OPEN (Fill)" : "CLOSED (S1)"}`, tx, by + 28);

  g.fillStyle = slOpen ? "#4ade80" : "#94a3b8";
  g.fillText(`SL (Pulm./Aortic): ${slOpen ? "OPEN (Eject)" : "CLOSED (S2)"}`, tx, by + 44);

  g.font = "500 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#eef2fa";
  const sv = Math.round(70 * (1.15 - (wState.ventricleVolume || 0.7) * 0.3));
  g.fillText(`EF: ~62%  |  SV: ${sv} mL  |  CO: ${((sv * (S.bpm || 75)) / 1000).toFixed(1)} L/m`, tx, by + 61);

  g.font = "600 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = slOpen ? "#ff4d68" : "#38bdf8";
  g.fillText(slOpen
    ? (S.lang === "en" ? "● SYSTOLE: Ventricular Ejection ↑" : "● บีบตัว: ส่งเลือดออก Aorta/Pulm ↑")
    : (S.lang === "en" ? "● DIASTOLE: Chamber Filling ↓" : "● คลายตัว: เลือดไหลเข้า 4 ห้อง ↓"), tx, by + 79);

  g.restore();
}

function drawECGHUD(g, wState, rppgRes) {
  if (!S.ecgHud) return;
  const boxW = Math.min(270, W * 0.44), boxH = 76;
  const bx = W - boxW - 14, by = H - boxH - 16;

  g.save();
  // Glassmorphic monitor background
  g.fillStyle = "rgba(7, 11, 20, 0.85)";
  g.strokeStyle = "rgba(71, 217, 132, 0.4)";
  g.lineWidth = 1.2;
  const r = 8;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  // Grid lines
  g.strokeStyle = "rgba(71, 217, 132, 0.12)";
  g.lineWidth = 0.8;
  for (let y = by + 12; y < by + boxH; y += 14) {
    g.beginPath(); g.moveTo(bx + 6, y); g.lineTo(bx + boxW - 6, y); g.stroke();
  }
  for (let x = bx + 12; x < bx + boxW; x += 22) {
    g.beginPath(); g.moveTo(x, by + 18); g.lineTo(x, by + boxH - 6); g.stroke();
  }

  // Header
  g.font = "700 10.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#47d984";
  g.textAlign = "left"; g.textBaseline = "top";
  g.fillText("LEAD II ECG  |  " + Math.round(S.bpm) + " BPM", bx + 10, by + 6);

  // Pulse Lock Indicator
  const isLock = rppgRes && rppgRes.confidence > 0.45;
  g.textAlign = "right";
  g.fillStyle = isLock ? "#47d984" : S.rppg ? "#ffb703" : "#8a96b5";
  g.fillText(isLock ? "● rPPG LOCK" : S.rppg ? "▲ SCANNING" : "○ MANUAL", bx + boxW - 8, by + 6);

  // ECG Trace
  if (ecgHistory.length > 2) {
    g.strokeStyle = "#47d984";
    g.lineWidth = 1.8;
    g.shadowColor = "rgba(71, 217, 132, 0.75)";
    g.shadowBlur = 4;
    g.beginPath();
    const baselineY = by + 46;
    const stepX = (boxW - 20) / 190;
    const startIdx = Math.max(0, ecgHistory.length - 190);

    for (let i = startIdx; i < ecgHistory.length; i++) {
      const x = bx + 10 + (i - startIdx) * stepX;
      const y = baselineY - (ecgHistory[i] * 22);
      if (i === startIdx) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  // Phase Footer
  g.font = "500 9.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "rgba(238, 242, 250, 0.65)";
  g.textAlign = "left";
  g.fillText(wState.phaseName, bx + 10, by + boxH - 14);

  g.restore();
}

// ------------------------------ per-frame update ------------------------------
let pointer = null, frames = 0, fps = 0, fpsAt = 0, dataAt = 0;
stage.addEventListener("pointermove", e => { const r = stage.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
stage.addEventListener("pointerleave", () => { pointer = null; });

const REGION_INFO = {
  head: {
    th: "🧠 ศีรษะและสมอง (Head & Brain)",
    en: "🧠 Head, Brain & Cranial Vessels",
    bones: "Cranium, Mandible, C1-C7 Spine",
    muscles: "Temporalis, Masseter, Orbicularis",
    vessels: "Carotid Artery, Jugular Vein, Retinal CRA/CRV"
  },
  thorax: {
    th: "🫁 ทรวงอกและหัวใจ (Thorax & Viscera)",
    en: "🫁 Thorax, Heart, Lungs & Great Vessels",
    bones: "Ribs 1-12, Sternum, T1-T12, Clavicles, Scapulae",
    muscles: "Pectoralis Major, Intercostals, Diaphragm",
    vessels: "Thoracic Aorta, Vena Cava, Pulmonary/Subclavian"
  },
  arm: {
    th: "💪 แขนและมือ (Upper Limb & Vessels)",
    en: "💪 Upper Limb (Bones, Muscles & Vessels)",
    bones: "Humerus, Radius, Ulna, Carpals, Phalanges",
    muscles: "Deltoid, Biceps, Triceps, Brachioradialis",
    vessels: "Brachial, Radial & Ulnar Arteries; Cephalic/Basilic Veins"
  },
  pelvis: {
    th: "🦴 เชิงกรานและสันหลังเอว (Pelvis & Lumbar)",
    en: "🦴 Pelvis, Sacrum & Lumbar Spine",
    bones: "L1-L5 Spine, Iliac Wings, Sacrum, Coccyx, Pubis",
    muscles: "Rectus Abdominis, Iliopsoas, Gluteals",
    vessels: "Abdominal Aorta, IVC, Common & External Iliac"
  },
  leg: {
    th: "🦵 ขาและเท้า (Lower Limb & Vessels)",
    en: "🦵 Lower Limb (Bones, Muscles & Vessels)",
    bones: "Femur, Patella, Tibia, Fibula, Calcaneus, 5 Toes",
    muscles: "Quadriceps, Hamstrings, Gastrocnemius (Calf)",
    vessels: "Femoral, Popliteal, Tibial & Dorsalis Pedis"
  }
};

const REGION_ANCHORS = [
  { key: "head",   pos: [0, 2, -4],     useHead: true },
  { key: "thorax", pos: [0, -21, 0],    useHead: false },
  { key: "arm",    pos: [17, -26, 0],   useHead: false },
  { key: "arm",    pos: [-17, -26, 0],  useHead: false },
  { key: "pelvis", pos: [0, -44, -1],   useHead: false },
  { key: "leg",    pos: [7, -65, 0],    useHead: false },
  { key: "leg",    pos: [-7, -65, 0],   useHead: false }
];

function detectPointedRegion(hands) {
  let px = null, py = null, src = "";
  if (hands && hands[0] && hands[0][8]) {
    px = (1 - hands[0][8].x) * W;
    py = hands[0][8].y * H;
    src = S.lang === "en" ? "👆 Hand Pointer" : "👆 ชี้ด้วยนิ้วมือ";
  } else if (pointer) {
    px = pointer.x;
    py = pointer.y;
    src = S.lang === "en" ? "🖱️ Cursor Focus" : "🖱️ ชี้ด้วยเมาส์";
  }
  if (px === null || !bodyGroup) return { key: null, src: "" };

  let bestKey = null, bestDist = 95;
  for (const a of REGION_ANCHORS) {
    if (a.useHead && !headGroup.visible) continue;
    if (!a.useHead && !bodyGroup.visible) continue;
    tmpV.fromArray(a.pos).applyMatrix4(a.useHead ? headGroup.matrix : bodyGroup.matrix).project(cam);
    const sx = (1 - (tmpV.x + 1) * 0.5) * W;
    const sy = (1 - tmpV.y) * 0.5 * H;
    const d = Math.hypot(px - sx, py - sy);
    if (d < bestDist) { bestDist = d; bestKey = a.key; }
  }
  return { key: bestKey, src };
}

function drawRegionHUD(g, regionKey, sourceStr) {
  const info = REGION_INFO[regionKey];
  if (!info) return;
  const boxW = Math.min(310, W * 0.5), boxH = 82;
  const bx = 14, by = H - boxH - 16;
  g.save();
  g.fillStyle = "rgba(10, 15, 28, 0.90)";
  g.strokeStyle = "rgba(88, 197, 255, 0.55)";
  g.lineWidth = 1.2;
  const r = 9;
  g.beginPath();
  g.moveTo(bx + r, by); g.lineTo(bx + boxW - r, by); g.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
  g.lineTo(bx + boxW, by + boxH - r); g.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
  g.lineTo(bx + r, by + boxH); g.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
  g.lineTo(bx, by + r); g.quadraticCurveTo(bx, by, bx + r, by);
  g.closePath();
  g.fill(); g.stroke();

  g.font = "700 11.5px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#58c5ff";
  g.textAlign = "left"; g.textBaseline = "top";
  const title = S.lang === "en" ? info.en : info.th;
  g.fillText(title, bx + 10, by + 8);

  if (sourceStr) {
    g.font = "600 9.5px system-ui,-apple-system,sans-serif";
    g.fillStyle = "#47d984";
    g.textAlign = "right";
    g.fillText(sourceStr, bx + boxW - 10, by + 9);
  }

  g.textAlign = "left";
  g.font = "500 10px system-ui,-apple-system,sans-serif";
  g.fillStyle = "#e2e8f0";
  g.fillText("🦴 " + info.bones, bx + 10, by + 27);
  g.fillStyle = "#fda4af";
  g.fillText("💪 " + info.muscles, bx + 10, by + 43);
  g.fillStyle = "#ff6b81";
  g.fillText("🩸 " + info.vessels, bx + 10, by + 59);
  g.restore();
}

let lastPoseData = null;
function renderFrame(now, faceLms, hands, sides, poseData, rppgLatest) {
  if (poseData) lastPoseData = poseData;
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

  headGroup.visible = !!head.found;
  if (bodyGroup) {
    const hasPose = Boolean(poseData && poseData.world);
    if (head.found || hasPose || bodyRig.active) {
      const headScale = head.found ? (S.fs * S.fw) : 1.0;
      updateBodyRig(bodyRig, poseData, headGroup.matrix, headScale, cam, now, head.found);
      bodyGroup.visible = Boolean(head.found || bodyRig.active);
      bodyGroup.matrix.copy(bodyRig.matrix);
      bodyGroup.matrixWorldNeedsUpdate = true;
      for (const k in limbMeshes) {
        if (bodyRig.seg[k]) {
          for (const m of limbMeshes[k]) {
            m.matrix.copy(bodyRig.seg[k].matrix);
            m.matrixWorldNeedsUpdate = true;
          }
        }
      }
    } else {
      bodyGroup.visible = false;
    }
  }

  // Regional Detection: Explicit dropdown, Pointed Cursor/Hand, or Partial Camera Framing
  let activeRegion = (S.region && S.region !== "auto" && S.region !== "full") ? S.region : null;
  let regionSource = activeRegion ? (S.lang === "en" ? "🎯 Focused" : "🎯 โฟกัสเฉพาะส่วน") : "";
  if (!activeRegion && S.region === "auto") {
    const pointed = detectPointedRegion(hands);
    if (pointed.key) {
      activeRegion = pointed.key;
      regionSource = pointed.src;
    } else if (bodyRig && bodyRig.active && !head.found) {
      const r = bodyRig.regions;
      if (!r.thorax && (r.armL || r.armR)) { activeRegion = "arm"; regionSource = "📷 Auto Arm"; }
      else if (!r.thorax && (r.legL || r.legR)) { activeRegion = "leg"; regionSource = "📷 Auto Leg"; }
      else if (r.thorax && !r.pelvis) { activeRegion = "thorax"; regionSource = "📷 Auto Thorax"; }
    }
  }

  applyLayers(activeRegion);

  // 1. Physiological Wiggers Cardiac Cycle & Helical Apex Twist
  const wState = wiggersCycle.evaluate(now, S.bpm || 75);
  if ($("wiggers_phase_lbl")) {
    $("wiggers_phase_lbl").textContent = "Wiggers Phase: " + wState.phaseName;
  }

  // Push to ECG history buffer @ ~60 fps
  if (now - lastEcgPush > 16) {
    lastEcgPush = now;
    ecgHistory.push(wState.ecg);
    if (ecgHistory.length > 200) ecgHistory.shift();
  }

  if (meshes.heart && S.heart) {
    const vol = wState.ventricleVolume; // 1.0 (EDV) down to 0.4 (ESV)
    const twistAngle = S.twist ? wState.twist : 0;

    // Ventricles contract and apex twists counterclockwise
    const sX = 0.75 + 0.25 * vol;
    const sY = 0.70 + 0.30 * vol;
    const sZ = 0.75 + 0.25 * vol;
    meshes.heart.mesh.scale.set(sX, sY, sZ);
    meshes.heart.mesh.rotation.z = twistAngle;
    meshes.heart.mesh.rotation.y = twistAngle * 0.55;

    const u = meshes.heart.mesh.material.uniforms;
    const ejectionGlow = (1.0 - (vol - 0.4) / 0.6) * 0.5;
    u.uGain.value = (S.style === "solid" ? 1.0 : S.bright * 1.25) * (1.0 + ejectionGlow);

    // Acoustically accurate S1 ("Lub" - AV valves snap shut) & S2 ("Dub" - Semilunar valves close)
    if (wState.triggerS1) playS1(S.heartAudio);
    if (wState.triggerS2) playS2(S.heartAudio);
  }
  if (S.vessels && meshes.vessels_art_axial && meshes.vessels_art_axial.mesh.material.uniforms && meshes.vessels_art_axial.mesh.material.uniforms.uGain) {
    meshes.vessels_art_axial.mesh.material.uniforms.uGain.value = (S.style === "solid" ? 1.0 : S.bright) * (0.95 + 0.45 * (wState.aortaPulse || 0));
  }

  // 2. Respiratory Cycle (Lungs, Airway Tree, Diaphragm Dome & Thoracic expansion)
  const respRate = S.resp || 15;
  const respPhase = (now / 1000) * (respRate / 60) * Math.PI * 2;
  const breath = 0.5 + 0.5 * Math.sin(respPhase);
  if (S.lungs || S.ribs) {
    if (meshes.lungs) {
      meshes.lungs.mesh.scale.set(1 + breath * 0.08, 1 + breath * 0.06, 1 + breath * 0.09);
    }
    if (meshes.diaphragm) {
      meshes.diaphragm.mesh.position.y = -breath * 1.4;
      meshes.diaphragm.mesh.scale.set(1 + breath * 0.04, 1 - 0.12 * breath, 1 + breath * 0.05);
    }
    if (meshes.airway && meshes.airway.mesh.material.uniforms && meshes.airway.mesh.material.uniforms.uGain) {
      meshes.airway.mesh.material.uniforms.uGain.value = (S.style === "solid" ? 1.0 : S.bright) * (0.9 + 0.35 * breath);
    }
    if (meshes.ribs && S.ribs) {
      meshes.ribs.mesh.scale.set(1 + breath * 0.03, 1 + breath * 0.02, 1 + breath * 0.035);
    }
  }

  // 3. Digital Brain Synaptic Wave Animation
  if (digitalBrainGroup && digitalBrainGroup.visible) {
    const t = now / 1000;
    if (digitalBrainLines) digitalBrainLines.material.opacity = 0.45 + 0.35 * Math.sin(t * 8.0);
    if (digitalBrainNodes) digitalBrainNodes.material.size = 4.0 + 2.0 * Math.sin(t * 12.0);
  }

  // 4. Ocular & Retinal Blood Vessels Arterial Pulse
  if (eyeVasculatureGroup && eyeVasculatureGroup.visible) {
    if (eyeArteryLines) {
      const artPulse = 0.8 + 0.25 * Math.sin(now / 150);
      eyeArteryLines.material.opacity = artPulse;
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
  drawECGHUD(g, wState, rppgLatest);
  if (S.cardiacValvesHud && S.heart) drawCardiacValvesHUD(g, now, wState);
  if (S.deep_learning) drawDeepLearningHUD(g, now, lastInferMs);
  if (S.fundusHud && (S.eye_vessels || S.eyes)) drawFundusHUD(g, now);
  if (S.alveolarHud && S.lungs) drawAlveolarHUD(g, now, breath, respRate);
  if (activeRegion) drawRegionHUD(g, activeRegion, regionSource);

  // Ergonomics computation & HUD overlay
  if (head.found && headGroup.visible) {
    const eu = new THREE.Euler().setFromQuaternion(head.quat, "YXZ");
    const ergo = computeErgonomics(eu, head.jaw, S.lang);
    updateErgoUI(ergo);

    if (S.ergo) {
      drawErgoHUD(g, ergo);
      if (ergo.status === "bad") {
        if (!riskStart) riskStart = now;
        if (now - riskStart > 2500) playSoftChime(S.ergoAudio);
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
let faceTracker = null, handTracker = null, poseTracker = null;
async function loadTrackers() {
  const vision = await import(MP + "/vision_bundle.mjs");
  const files = await vision.FilesetResolver.forVisionTasks(MP + "/wasm");
  const mkFace = d => vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d },
    runningMode: "VIDEO", numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true });
  const mkHand = d => vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate: d },
    runningMode: "VIDEO", numHands: 2 });
  const mkPose = d => vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: d },
    runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: false });
  try { faceTracker = await mkFace("GPU"); } catch (e) { faceTracker = await mkFace("CPU"); }
  try { try { handTracker = await mkHand("GPU"); } catch (e) { handTracker = await mkHand("CPU"); } }
  catch (e) { handTracker = null; }
  try { try { poseTracker = await mkPose("GPU"); } catch (e) { poseTracker = await mkPose("CPU"); } }
  catch (e) { poseTracker = null; console.warn("Pose tracker unavailable:", e); }
}

function liveLoop() {
  let lastTime = -1, lostAt = 0, said = "";
  const say = (t, c) => { if (said !== t) { said = t; setStatus(t, c); } };
  function tick() {
    requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const now = performance.now();
    let faceLms = null, hands = [], sides = [], poseData = null, rppgLatest = null;
    const inferStart = performance.now();
    try {
      const fr = faceTracker.detectForVideo(video, now);
      faceLms = fr.faceLandmarks && fr.faceLandmarks[0];
      const mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
      if (faceLms && mat) {
        let jaw = 0;
        const bs = fr.faceBlendshapes && fr.faceBlendshapes[0];
        if (bs) for (const c of bs.categories) if (c.categoryName === "jawOpen") jaw = c.score;
        updateHead(mat.data, faceLms, jaw); lostAt = 0;

        // Remote Photoplethysmography (rPPG) from forehead skin color micro-pulsations
        if (S.rppg) {
          rppgLatest = rppgDetector.processFrame(video, faceLms, now);
          if (rppgLatest.confidence > 0.45) {
            S.bpm = Math.round(rppgLatest.bpm);
            if ($("bpm")) $("bpm").value = S.bpm;
            if ($("bpmv")) $("bpmv").textContent = S.bpm + " BPM";
            if ($("ui_bpm_live")) $("ui_bpm_live").textContent = "❤️ " + S.bpm + " BPM";
            if ($("rppg_status_badge")) {
              $("rppg_status_badge").textContent = "🟢 rPPG ชีพจรล็อกแล้ว (Face Pulse Lock: " + S.bpm + " BPM)";
              $("rppg_status_badge").style.color = "var(--ok)";
            }
          } else {
            if ($("rppg_status_badge")) {
              $("rppg_status_badge").textContent = "🟡 rPPG กำลังสแกนสีผิวหน้าผาก (Calibrating...)";
              $("rppg_status_badge").style.color = "var(--warn)";
            }
          }
        } else {
          if ($("rppg_status_badge")) {
            $("rppg_status_badge").textContent = "⚪ ใช้ค่าจำลองจากแถบเลื่อน (Manual Slider)";
            $("rppg_status_badge").style.color = "var(--dim)";
          }
        }
      } else { faceLms = null; if (!lostAt) lostAt = now; if (now - lostAt > 250) head.found = false; }
      if (handTracker && (S.hands || S.reveal === "lens" || S.showdata)) {
        const hr = handTracker.detectForVideo(video, now);
        hands = hr.landmarks || [];
        const hd = hr.handedness || hr.handednesses || [];
        sides = hands.map((h, i) => !!(hd[i] && hd[i][0] && hd[i][0].categoryName === "Left"));
      }
      if (poseTracker && (S.skeleton || S.ribs || S.heart || S.lungs || S.muscles || S.vessels || S.ergo)) {
        const pr = poseTracker.detectForVideo(video, now);
        if (pr && pr.landmarks && pr.landmarks[0]) {
          poseData = { image: pr.landmarks[0], world: pr.worldLandmarks && pr.worldLandmarks[0] };
        }
      }
    } catch (e) { say("The tracker hit an error: " + e.message, "bad"); return; }
    const t = UI_TEXT[S.lang] || UI_TEXT.both;
    const bodyStr = poseData ? " + Body" : "";
    const inferEnd = performance.now();
    lastInferMs = lastInferMs * 0.85 + (inferEnd - inferStart) * 0.15;
    if ($("ui_dl_latency")) $("ui_dl_latency").textContent = "~" + lastInferMs.toFixed(1) + " ms (" + Math.round(1000 / Math.max(16, lastInferMs)) + " FPS)";
    say(head.found ? t.status_tracking + (hands.length ? t.status_hands : "") + bodyStr
                   : poseData ? "กำลังตรวจจับโครงสร้างร่างกายเฉพาะส่วน (Body/Limb Tracking Active)"
                   : hands.length ? "Hand found. Point at any body part or face camera."
                   : "No body detected. Point camera at head, chest, arm, or leg.", (head.found || poseData || hands.length) ? "ok" : "bad");
    renderFrame(now, faceLms, hands, sides, poseData, rppgLatest);
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
    lastInferMs = 13.8 + 2.2 * Math.sin(time * 2.5);
    if ($("ui_dl_latency")) $("ui_dl_latency").textContent = "~" + lastInferMs.toFixed(1) + " ms (60 FPS)";
    const k = 0.0021 * H / W * (4 / 3), hand = base.map(p => ({ x: 0.2 - (p[0] - cx) * k, y: 0.56 + (p[2] - cz) * k * W / H, z: (p[1] - cy) * k }));
    renderFrame(now, FIT_IDS.map(id => lms[id]), [hand], [true], null);
  }
  tick();
}


function populateAnatomySelect() {
  const sel = $("anatomy_select");
  if (!sel) return;
  const curVal = sel.value;
  sel.innerHTML = '<option value="">-- ' + (S.lang === "th" ? "เลือกอวัยวะเพื่อดูข้อมูล FMA / Clinical" : "Select organ for FMA / Clinical Data") + ' --</option>';
  for (const k in ANATOMY_DICT) {
    const item = ANATOMY_DICT[k];
    const opt = document.createElement("option");
    opt.value = k;
    const txt = S.lang === "th" ? item.th : S.lang === "en" ? item.en : (item.th + " (" + item.en + ")");
    opt.textContent = "[" + (item.fma || "FMA") + "] " + txt;
    if (k === curVal) opt.selected = true;
    sel.appendChild(opt);
  }
}

let booted = false;
async function boot() {
  if (booted) return;
  booted = true;
  THREE = await import(DEMO && new URLSearchParams(location.search).get("three") || THREE_URL);
  setThree(THREE);
  initMath(); initHandMath(); buildScene();
  initInspector(stage);
  populateAnatomySelect();
  if ($("anatomy_select")) {
    $("anatomy_select").onchange = (e) => {
      if (e.target.value) showAnatomyInspector(e.target.value, S.lang);
      else hideAnatomyInspector();
    };
  }

  // Interactive Label & 3D Raycasting Hit-Test
  stage.addEventListener("pointermove", (e) => {
    const rect = stage.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const hit = activeLabelHitBoxes.find(b => px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY);
    stage.style.cursor = hit ? "pointer" : "default";
  });

  stage.addEventListener("pointerdown", (e) => {
    const rect = stage.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const hit = activeLabelHitBoxes.find(b => px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY);
    if (hit && hit.rawKey) {
      showAnatomyInspector(hit.rawKey, S.lang);
      if ($("anatomy_select")) $("anatomy_select").value = hit.rawKey;
    }
  });

  // Clinical Assessment Report Generator
  if ($("btn_export_report")) {
    $("btn_export_report").onclick = () => {
      const data = {
        bpm: Math.round(rppgLatest && rppgLatest.isLocked ? rppgLatest.bpm : S.bpm),
        isRppgLock: Boolean(rppgLatest && rppgLatest.isLocked),
        resp: S.resp,
        wiggersPhase: wState ? wState.phaseName : "Diastasis (Ventricular Filling)",
        pitch: lastErgo ? lastErgo.pitch : 0,
        loadKg: lastErgo ? lastErgo.loadKg : 5.0,
        loadLbs: lastErgo ? lastErgo.loadLbs : 11.0,
        ergoStatus: lastErgo ? lastErgo.status : "good",
        ergoText: lastErgo ? lastErgo.statusText : (S.lang === "th" ? "ท่าทางปกติ" : "Good Posture"),
        roll: lastErgo ? lastErgo.roll : 0,
        cobbAngle: lastCobb ? lastCobb.angle : 0,
        cobbStatus: lastCobb ? lastCobb.status : "normal",
        cobbLabel: lastCobb ? (lastCobb.status === "normal" ? "ปกติ (Scoliosis < 10°)" : "Mild Scoliosis Trend") : "ปกติ (Normal)",
        jawMm: lastErgo ? lastErgo.jawMm : 40,
        shoulderTilt: bodyRig && bodyRig.info ? bodyRig.info.shoulderTilt : 0,
      };
      generateClinicalReport(data);
    };
  }
}

// ------------------------------ Camera Acquisition & Diagnostics ------------------------------

async function requestCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      const err = new Error("Insecure context: WebRTC requires localhost or HTTPS.");
      err.name = "InsecureContextError";
      throw err;
    }
    const err = new Error("This browser does not support getUserMedia WebRTC.");
    err.name = "NotSupportedError";
    throw err;
  }

  // Tier 1: Ideal HD front user-facing camera
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (err1) {
    console.warn("Camera Tier 1 (facingMode:user, 720p) failed:", err1);
    if (err1.name === "NotAllowedError" || err1.name === "SecurityError") throw err1;
  }

  // Tier 2: HD without facingMode (many USB / external / virtual webcams reject facingMode)
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (err2) {
    console.warn("Camera Tier 2 (720p without facingMode) failed:", err2);
    if (err2.name === "NotAllowedError" || err2.name === "SecurityError") throw err2;
  }

  // Tier 3: Standard VGA 640x480
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
  } catch (err3) {
    console.warn("Camera Tier 3 (VGA 640x480) failed:", err3);
    if (err3.name === "NotAllowedError" || err3.name === "SecurityError") throw err3;
  }

  // Tier 4: Minimal constraint fallback
  return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
}

function showCameraTroubleshooting(err) {
  const panel = $("cam_troubleshoot");
  if (!panel) return;
  panel.style.display = "block";
  const title = $("cam_err_title");
  const desc = $("cam_err_desc");
  const steps = $("cam_err_steps");

  const errName = err ? err.name : "UnknownError";
  const isThai = S.lang !== "en";

  if (errName === "NotAllowedError" || errName === "PermissionDeniedError" || errName === "SecurityError") {
    if (title) title.textContent = isThai ? "⚠️ ถูกบล็อกสิทธิ์การเข้าถึงกล้อง (Camera Permission Blocked)" : "⚠️ Camera Permission Blocked";
    if (desc) desc.innerHTML = isThai
      ? "เบราว์เซอร์หรือระบบปฏิบัติการไม่อนุญาตให้หน้านี้เข้าถึงกล้อง กรุณาเปิดสิทธิ์ตามขั้นตอนด้านล่าง:"
      : "Camera access was denied by your browser or operating system settings. Follow these steps:";
    if (steps) steps.innerHTML = isThai
      ? `<ol style="margin:0;padding-left:18px;">
           <li style="margin-bottom:6px;"><b>แถบ URL ของเบราว์เซอร์:</b> คลิกไอคอน <b>แม่กุญแจ 🔒</b> หรือ <b>กล้อง 📷</b> ที่ด้านซ้ายสุดของช่องพิมพ์ URL ➔ ปรับตัวเลือก <i>"กล้อง (Camera)"</i> ให้เป็น <b>"อนุญาต (Allow)"</b></li>
           <li style="margin-bottom:6px;"><b>สำหรับ macOS:</b> เปิด <b>System Settings (การตั้งค่าระบบ)</b> ➔ <b>Privacy & Security (ความเป็นส่วนตัวและความปลอดภัย)</b> ➔ <b>Camera (กล้อง)</b> ➔ ตรวจสอบว่าเปิดสวิตช์อนุญาตให้กับ Google Chrome / Safari หรือไม่</li>
           <li>คลิกปุ่ม <b>"🔄 ลองเปิดกล้องอีกครั้ง"</b> หรือรีเฟรชหน้าเว็บ</li>
         </ol>`
      : `<ol style="margin:0;padding-left:18px;">
           <li style="margin-bottom:6px;"><b>Browser URL bar:</b> Click the <b>Lock 🔒</b> or <b>Camera 📷</b> icon on the left ➔ Set <i>"Camera"</i> to <b>"Allow"</b>.</li>
           <li style="margin-bottom:6px;"><b>macOS System Settings:</b> Go to <b>System Settings</b> ➔ <b>Privacy & Security</b> ➔ <b>Camera</b> ➔ Ensure Google Chrome / Safari is enabled.</li>
           <li>Click <b>"🔄 Retry Camera"</b> or refresh the page.</li>
         </ol>`;
  } else if (errName === "NotReadableError" || errName === "TrackStartError") {
    if (title) title.textContent = isThai ? "⚠️ กล้องกำลังถูกใช้งานโดยแอปอื่น (Camera Busy / In Use)" : "⚠️ Camera is Busy / In Use by Another App";
    if (desc) desc.innerHTML = isThai
      ? "ฮาร์ดแวร์เว็บแคมกำลังถูกเชื่อมต่อหรือล็อกโดยโปรแกรมอื่นในเครื่อง:"
      : "The camera device is locked or in use by another program:";
    if (steps) steps.innerHTML = isThai
      ? `<ol style="margin:0;padding-left:18px;">
           <li style="margin-bottom:6px;">ปิดโปรแกรมที่อาจกำลังเปิดกล้องอยู่ เช่น <b>FaceTime, Zoom, Microsoft Teams, Photo Booth, OBS Studio, Discord</b> หรือแท็บเบราว์เซอร์อื่น</li>
           <li style="margin-bottom:6px;">หากใช้เว็บแคม USB หรือ Continuity Camera (iPhone) ให้ลองเชื่อมต่อใหม่</li>
           <li>คลิก <b>"🔄 ลองเปิดกล้องอีกครั้ง"</b> หรือเลือก <b>"🚀 เข้าสู่โหมดจำลอง 3D ทันที"</b></li>
         </ol>`
      : `<ol style="margin:0;padding-left:18px;">
           <li style="margin-bottom:6px;">Close other video applications (e.g. <b>FaceTime, Zoom, Teams, Photo Booth, OBS, Discord</b>).</li>
           <li style="margin-bottom:6px;">If using external USB or Continuity Camera, re-connect it.</li>
           <li>Click <b>"🔄 Retry Camera"</b> or <b>"🚀 Launch 3D Demo Mode"</b>.</li>
         </ol>`;
  } else if (errName === "InsecureContextError") {
    if (title) title.textContent = isThai ? "⚠️ เบราว์เซอร์ต้องการ Secure Context (localhost หรือ HTTPS)" : "⚠️ Secure Context (localhost / HTTPS) Required";
    if (desc) desc.innerHTML = isThai
      ? "เทคโนโลยี WebRTC ของเบราว์เซอร์ไม่อนุญาตให้เปิดกล้องผ่าน HTTP บน IP เครือข่าย (เช่น 192.168.x.x)"
      : "WebRTC camera access requires a secure context (localhost or HTTPS).";
    if (steps) steps.innerHTML = isThai
      ? `กรุณาเข้าใช้งานผ่านลิงก์ <b><a href="http://localhost/anatophysio-ar/" style="color:#58c5ff;text-decoration:underline;">http://localhost/anatophysio-ar/</a></b> หรือ <b><a href="http://localhost/x-ray/" style="color:#58c5ff;text-decoration:underline;">http://localhost/x-ray/</a></b> หรือเปิดใช้งาน HTTPS`
      : `Please access via <b><a href="http://localhost/anatophysio-ar/" style="color:#58c5ff;text-decoration:underline;">http://localhost/anatophysio-ar/</a></b> or use HTTPS.`;
  } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
    if (title) title.textContent = isThai ? "⚠️ ไม่พบอุปกรณ์เว็บแคม (No Camera Found)" : "⚠️ No Camera Device Detected";
    if (desc) desc.innerHTML = isThai
      ? "ระบบไม่พบเว็บแคมที่เชื่อมต่ออยู่กับคอมพิวเตอร์ของคุณ:"
      : "No video input devices were found on this computer:";
    if (steps) steps.innerHTML = isThai
      ? `กรุณาเชื่อมต่อเว็บแคม หรือคลิกปุ่ม <b>"🚀 เข้าสู่โหมดจำลอง 3D ทันที"</b> เพื่อใช้งานกายวิภาคและสรีรวิทยาได้ครบทุกฟังก์ชันโดยไม่ต้องใช้กล้อง`
      : `Please connect a webcam, or click <b>"🚀 Launch 3D Demo Mode"</b> below to experience all anatomy & physiology features.`;
  } else {
    if (title) title.textContent = isThai ? "⚠️ เกิดข้อผิดพลาดในการเปิดกล้อง (" + errName + ")" : "⚠️ Camera Initialization Error (" + errName + ")";
    if (desc) desc.textContent = (err && err.message) ? err.message : String(err);
    if (steps) steps.innerHTML = isThai
      ? `คุณสามารถกดปุ่ม <b>"🚀 เข้าสู่โหมดจำลอง 3D ทันที"</b> ด้านล่าง เพื่อเข้าใช้งานระบบได้ทันที`
      : `You can click <b>"🚀 Launch 3D Demo Mode"</b> below to experience the system immediately.`;
  }
}

async function startDemoMode() {
  if ($("start")) $("start").disabled = true;
  if ($("start_demo")) $("start_demo").disabled = true;
  if ($("cam_troubleshoot")) $("cam_troubleshoot").style.display = "none";
  setStatus(S.lang === "th" ? "กำลังเริ่มระบบกายวิภาคจำลอง 3D…" : "Initializing 3D Anatomy Simulation…");
  try {
    await boot();
    $("intro").hidden = true;
    resize();
    demoLoop();
  } catch (e) {
    setStatus("Demo failed: " + e.message, "bad");
    if ($("start")) $("start").disabled = false;
    if ($("start_demo")) $("start_demo").disabled = false;
  }
}

async function startCameraMode() {
  $("start").disabled = true;
  if ($("start_demo")) $("start_demo").disabled = true;
  if ($("cam_troubleshoot")) $("cam_troubleshoot").style.display = "none";
  let stageName = "camera";
  try {
    setStatus("Asking for the camera… / กำลังขอสิทธิ์เปิดกล้อง (กรุณากด Allow บนเบราว์เซอร์)…");
    const stream = await requestCameraStream();
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
    $("start").disabled = false;
    if ($("start_demo")) $("start_demo").disabled = false;
    $("intro").hidden = false;
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const msg = err && err.message ? err.message : String(err);
    setStatus(denied ? "Camera blocked. Allow camera access for this page and click Start again."
            : "Could not load the " + stageName + ": " + msg, "bad");
    showCameraTroubleshooting(err);
  }
}

$("start").onclick = startCameraMode;
if ($("start_demo")) $("start_demo").onclick = startDemoMode;
if ($("btn_retry_cam")) $("btn_retry_cam").onclick = () => { if ($("cam_troubleshoot")) $("cam_troubleshoot").style.display = "none"; startCameraMode(); };
if ($("btn_use_demo")) $("btn_use_demo").onclick = startDemoMode;

if (DEMO) boot().then(demoLoop).catch(e => setStatus("Demo failed: " + e.message, "bad"));
