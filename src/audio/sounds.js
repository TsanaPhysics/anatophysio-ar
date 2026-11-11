// Web Audio cues: posture alert chime and S1/S2 heart sounds
let audioCtx = null, lastChime = 0;
export function playSoftChime(enabled) {
  if (!enabled) return;
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
export function playHeartSound(now, enabled, bpm) {
  if (!enabled) return;
  if (now - lastHeartBeat < (60000 / bpm) * 0.75) return;
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
