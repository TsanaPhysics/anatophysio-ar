import { THREE_URL, MP, MODELS, FACE_MODEL, HAND_MODEL, POSE_MODEL } from "./config.js";
import { createBodyRig, updateBodyRig, segKey } from "./anatomy/body-rig.js";
import { ANATOMY_DICT } from "./anatomy/dictionary.js";
import { THORAX_LABELS } from "./anatomy/thorax-labels.js";
import { setThree, mergeGeos, buildBonyThoraxGeometry, buildCostalCartilageGeometry,
         buildRealisticHeartGeometry, buildRealisticLungsGeometry, buildSkeletonParts, buildFullSkeletonGeometry } from "./anatomy/procedural.js";
import { UI_TEXT } from "./ui/i18n.js";
import { VERT, FRAG } from "./shaders/xray.js";
import { playSoftChime, playHeartSound, playS1, playS2 } from "./audio/sounds.js";
import { RPPGDetector } from "./physiology/rppg.js";
import { WiggersCycle } from "./physiology/wiggers.js";
import { evaluateCobbAngle, evaluateCROM, evaluateTMJ } from "./physiology/clinical.js";
import { computeErgonomics } from "./physiology/ergonomics.js";

const $ = id => document.getElementById(id);
const statusEl = $("status"), video = $("video"), stage = $("stage");
function setStatus(text, cls) { statusEl.textContent = text; statusEl.className = "status-bar " + (cls || ""); }
const DEMO = location.hash === "#demo";
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
  setTxt("ui_ergo_sh_tilt", t.ergo_sh_tilt);
  setTxt("ui_ergo_body_yaw", t.ergo_body_yaw);
  setTxt("ui_ergo_elbow", t.ergo_elbow);
  setTxt("ui_ergo_knee", t.ergo_knee);
  setTxt("ui_cardiac_head", t.cardiac_head);
  setTxt("ui_lbl_bpm", t.lbl_bpm);
  setTxt("ui_lbl_resp", t.lbl_resp);
  setTxt("ui_ck_sound", t.ck_sound);
  setTxt("ui_ck_twist", t.ck_twist);
  setTxt("ui_ck_rppg", t.ck_rppg);
  setTxt("ui_ck_ecg", t.ck_ecg);
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
  skull: true, brain: false, muscles: false, eyes: true, outline: true, hands: true,
  ribs: true, heart: true, lungs: true, cartilage: true, skeleton: true,
  bpm: 75, resp: 15, heartAudio: true, twist: true, rppg: true, ecgHud: true,
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
  if ($("rppg_enable")) $("rppg_enable").checked = S.rppg;
  if ($("ecg_hud")) $("ecg_hud").checked = S.ecgHud;
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
if ($("rppg_enable")) $("rppg_enable").onchange = e => { S.rppg = e.target.checked; save(); };
if ($("ecg_hud")) $("ecg_hud").onchange = e => { S.ecgHud = e.target.checked; save(); };
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
let bodyGroup = null, bodyRig = null;
const limbMeshes = {};
const rppgDetector = new RPPGDetector(6);
const wiggersCycle = new WiggersCycle();
const ecgHistory = [];
let lastEcgPush = 0;
let W = 640, H = 480;
const meshes = {};
const handRigs = [];
const BONES = [[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];


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

  // 4. Realistic 4-Chamber Heart & Great Vessels (Apex & Aorta at subject's left)
  const heartGeo = buildRealisticHeartGeometry();
  heartGroup = add("heart", heartGeo, "heart", 0xff3b5c, 0xb53545, 4, bodyGroup);

  // 5. Full Body Skeleton: Axial (Lumbar spine & pelvis) + Articulated Limbs
  const skelParts = buildSkeletonParts();
  skelGroup = add("skeleton", skelParts.axial, "skeleton", 0xbfe3ff, 0xe9e2cf, 3, bodyGroup);
  for (const k in skelParts.segments) {
    const m = add("skeleton_" + k, skelParts.segments[k], "skeleton", 0xbfe3ff, 0xe9e2cf, 3, bodyGroup);
    m.matrixAutoUpdate = false;
    limbMeshes[k] = m;
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
let riskStart = 0;


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
  if (!head.found) {
    headGroup.visible = false;
    if (bodyGroup) bodyGroup.visible = false;
  } else {
    if (bodyGroup) {
      bodyGroup.visible = true;
      const headScale = S.fs * S.fw;
      updateBodyRig(bodyRig, poseData, headGroup.matrix, headScale, cam, now);
      bodyGroup.matrix.copy(bodyRig.matrix);
      bodyGroup.matrixWorldNeedsUpdate = true;
      for (const k in limbMeshes) {
        if (bodyRig.seg[k]) {
          limbMeshes[k].matrix.copy(bodyRig.seg[k].matrix);
          limbMeshes[k].matrixWorldNeedsUpdate = true;
        }
      }
    }
  }
  applyLayers();

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
  drawECGHUD(g, wState, rppgLatest);

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
      if (poseTracker && (S.skeleton || S.ribs || S.heart || S.lungs || S.ergo)) {
        const pr = poseTracker.detectForVideo(video, now);
        if (pr && pr.landmarks && pr.landmarks[0]) {
          poseData = { image: pr.landmarks[0], world: pr.worldLandmarks && pr.worldLandmarks[0] };
        }
      }
    } catch (e) { say("The tracker hit an error: " + e.message, "bad"); return; }
    const t = UI_TEXT[S.lang] || UI_TEXT.both;
    const bodyStr = poseData ? " + Body" : "";
    say(head.found ? t.status_tracking + (hands.length ? t.status_hands : "") + bodyStr
                   : hands.length ? "Hand found. Face the camera to see inside your body."
                   : "No face found. Face the camera, with light on your face.", head.found || hands.length ? "ok" : "bad");
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
    const k = 0.0021 * H / W * (4 / 3), hand = base.map(p => ({ x: 0.2 - (p[0] - cx) * k, y: 0.56 + (p[2] - cz) * k * W / H, z: (p[1] - cy) * k }));
    renderFrame(now, FIT_IDS.map(id => lms[id]), [hand], [true], null);
  }
  tick();
}

async function boot() {
  THREE = await import(DEMO && new URLSearchParams(location.search).get("three") || THREE_URL);
  setThree(THREE);
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
