// Clinical Anatomy Inspector Modal & Ontology Card Controller
import { ANATOMY_DICT } from "../anatomy/dictionary.js";

let container = null;
let currentKey = null;

export function initInspector(stageElement) {
  if (container) return;
  container = document.createElement("div");
  container.className = "inspector-card";
  container.hidden = true;
  stageElement.appendChild(container);
}

export function showAnatomyInspector(key, lang = "both") {
  if (!container) return;
  const item = ANATOMY_DICT[key];
  if (!item) return;

  currentKey = key;
  const title = lang === "th" ? item.th : lang === "en" ? item.en : (item.th + " (" + item.en + ")");

  container.innerHTML = `
    <div class="inspector-header">
      <div>
        <div class="inspector-title">${title}</div>
        <div class="inspector-latin">${item.la || item.en}</div>
      </div>
      <button class="inspector-close" title="Close">✕</button>
    </div>
    <div class="inspector-meta">
      <span class="inspector-tag">${item.system || "Anatomy"}</span>
      <span class="inspector-tag fma">${item.fma || "FMA"}</span>
      <span class="inspector-tag snomed">SNOMED: ${item.snomed || "-"}</span>
    </div>
    <div class="inspector-desc">${item.desc || ""}</div>
    <div class="inspector-clinical">
      <b>ความสำคัญทางคลินิก (Clinical):</b> ${item.clinical || "ไม่มีรายงานพยาธิสภาพเฉพาะ"}
    </div>
  `;

  container.querySelector(".inspector-close").onclick = (e) => {
    e.stopPropagation();
    hideAnatomyInspector();
  };

  container.hidden = false;
}

export function hideAnatomyInspector() {
  if (container) {
    container.hidden = true;
    currentKey = null;
  }
}

export function getCurrentInspectedKey() {
  return currentKey;
}
