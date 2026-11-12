// Label anchor points (model space) for procedural torso & skeleton.
// Model +x = subject's LEFT (heart, aortic arch and left lung sit at +x).
// seg: limb segment the label rides on (see body-rig.js SEGMENTS); side taken from the sign of x.
export const THORAX_LABELS = [
  { t: "Rib cage", layer: "ribs", jaw: 0, pts: [[9.2, -18.5, 0.0], [-9.2, -18.5, 0.0]] },
  { t: "Sternum", layer: "ribs", jaw: 0, pts: [[0.0, -21.0, 3.2]] },
  { t: "Thoracic spine", layer: "ribs", jaw: 0, pts: [[0.0, -20.0, -5.2]] },
  { t: "Clavicle", layer: "ribs", jaw: 0, pts: [[7.5, -13.8, 2.4], [-7.5, -13.8, 2.4]] },
  { t: "Costal Cartilage", layer: "cartilage", jaw: 0, pts: [[2.2, -22.5, 3.0], [-2.2, -22.5, 3.0]] },
  { t: "Beating Heart", layer: "heart", jaw: 0, pts: [[2.4, -22.2, 1.8]] },
  { t: "Aorta Arch", layer: "heart", jaw: 0, pts: [[1.2, -14.8, 0.8]] },
  { t: "Coronary Arteries", layer: "heart", jaw: 0, pts: [[1.8, -20.0, 1.4]] },
  { t: "Right Lung", layer: "lungs", jaw: 0, pts: [[-6.5, -19.5, 0.4]] },
  { t: "Left Lung", layer: "lungs", jaw: 0, pts: [[6.5, -19.5, 0.4]] },
  { t: "Humerus", layer: "skeleton", seg: "upperArm", jaw: 0, pts: [[16.8, -21.0, 0.2], [-16.8, -21.0, 0.2]] },
  { t: "Radius & Ulna", layer: "skeleton", seg: "forearm", jaw: 0, pts: [[18.2, -35.5, 0.0], [-18.2, -35.5, 0.0]] },
  { t: "Pelvic girdle", layer: "skeleton", jaw: 0, pts: [[8.5, -42.5, -1.8], [-8.5, -42.5, -1.8]] },
  { t: "Lumbar spine", layer: "skeleton", jaw: 0, pts: [[0.0, -34.0, -4.6]] },
  { t: "Femur", layer: "skeleton", seg: "thigh", jaw: 0, pts: [[8.6, -58.0, 0.3], [-8.6, -58.0, 0.3]] },
  { t: "Patella", layer: "skeleton", seg: "shin", jaw: 0, pts: [[6.8, -67.0, 1.8], [-6.8, -67.0, 1.8]] },
  { t: "Tibia & Fibula", layer: "skeleton", seg: "shin", jaw: 0, pts: [[6.5, -78.0, 0.0], [-6.5, -78.0, 0.0]] },
  { t: "Central retinal artery", layer: "eye_vessels", jaw: 0, pts: [[3.2, 2.3, 1.8], [-3.2, 2.3, 1.8]] },
  { t: "Central retinal vein", layer: "eye_vessels", jaw: 0, pts: [[3.0, 2.1, 1.7], [-3.0, 2.1, 1.7]] },
  { t: "Optic disc (CN II)", layer: "eye_vessels", jaw: 0, pts: [[2.7, 2.4, 0.9], [-2.7, 2.4, 0.9]] },
  { t: "Macula & Fovea centralis", layer: "eye_vessels", jaw: 0, pts: [[3.5, 2.3, 1.2], [-3.5, 2.3, 1.2]] },
  { t: "Iris & Pupil", layer: "eyes", jaw: 0, pts: [[3.1, 2.4, 3.3], [-3.1, 2.4, 3.3]] },
  { t: "Crystalline lens", layer: "eyes", jaw: 0, pts: [[3.1, 2.4, 3.0], [-3.1, 2.4, 3.0]] }
];
