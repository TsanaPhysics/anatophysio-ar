// Physiological Wiggers Cardiac Cycle & ECG Lead II Synthesizer
// Accurately models electrical conduction, ventricular pressure/volume changes,
// aortic pressure pulse with dicrotic notch, and valve closure acoustics.

export class WiggersCycle {
  constructor() {
    this.lastS1Time = 0;
    this.lastS2Time = 0;
  }

  /**
   * Evaluate the cardiac state at the given time.
   * @param {number} now - timestamp in milliseconds (performance.now)
   * @param {number} bpm - current heart rate (beats per minute)
   * @returns {Object} Cardiac state variables
   */
  evaluate(now, bpm = 75) {
    const cycleMs = Math.max(300, Math.min(1500, 60000 / bpm));
    const phase = ((now % cycleMs) / cycleMs); // 0.0 to 1.0

    // 1. ECG Lead II Waveform Synthesis
    let ecg = 0;
    // P wave (0.06 - 0.16)
    if (phase >= 0.06 && phase < 0.16) {
      const p = (phase - 0.06) / 0.10;
      ecg = 0.18 * Math.sin(p * Math.PI);
    }
    // Q wave (0.20 - 0.22)
    else if (phase >= 0.20 && phase < 0.22) {
      const q = (phase - 0.20) / 0.02;
      ecg = -0.15 * Math.sin(q * Math.PI);
    }
    // R wave (0.22 - 0.26)
    else if (phase >= 0.22 && phase < 0.26) {
      const r = (phase - 0.22) / 0.04;
      ecg = 1.05 * Math.sin(r * Math.PI);
    }
    // S wave (0.26 - 0.29)
    else if (phase >= 0.26 && phase < 0.29) {
      const s = (phase - 0.26) / 0.03;
      ecg = -0.32 * Math.sin(s * Math.PI);
    }
    // T wave (0.38 - 0.54)
    else if (phase >= 0.38 && phase < 0.54) {
      const t = (phase - 0.38) / 0.16;
      ecg = 0.32 * Math.sin(t * Math.PI);
    }

    // 2. Ventricular Volume & Helical Apex Twist
    // Systole occurs from phase 0.22 (isovolumetric contraction) to 0.50 (end-systole)
    let ventricleVolume = 1.0; // 1.0 = End-Diastolic Volume (EDV), ~0.4 = End-Systolic Volume (ESV)
    let twist = 0; // Helical torsion in radians
    let phaseName = "Diastasis (Passive Filling)";

    if (phase < 0.22) {
      // Late diastole / Atrial systole
      ventricleVolume = 0.92 + 0.08 * (phase / 0.22);
      twist = 0;
      phaseName = phase < 0.16 ? "Atrial Systole (P wave)" : "Isovolumetric Contraction";
    } else if (phase >= 0.22 && phase < 0.38) {
      // Rapid Ventricular Ejection
      const k = (phase - 0.22) / 0.16;
      ventricleVolume = 1.0 - 0.45 * Math.sin(k * Math.PI * 0.5);
      twist = 0.26 * Math.sin(k * Math.PI * 0.5); // Counterclockwise apex twist
      phaseName = "Rapid Ventricular Ejection";
    } else if (phase >= 0.38 && phase < 0.50) {
      // Reduced Ejection
      const k = (phase - 0.38) / 0.12;
      ventricleVolume = 0.55 - 0.15 * Math.sin(k * Math.PI * 0.5);
      twist = 0.26 - 0.04 * k;
      phaseName = "Reduced Ventricular Ejection (T wave)";
    } else if (phase >= 0.50 && phase < 0.58) {
      // Isovolumetric Relaxation
      const k = (phase - 0.50) / 0.08;
      ventricleVolume = 0.40;
      twist = 0.22 * (1.0 - k); // Rapid untwisting creates ventricular suction
      phaseName = "Isovolumetric Relaxation (Aortic valve close)";
    } else {
      // Rapid Inflow & Diastasis
      const k = (phase - 0.58) / 0.42;
      ventricleVolume = 0.40 + 0.52 * Math.sin(k * Math.PI * 0.5);
      twist = 0;
      phaseName = phase < 0.75 ? "Rapid Ventricular Inflow" : "Diastasis (Resting)";
    }

    // 3. Aortic Pressure & Vessel Expansion Pulse (with Dicrotic Notch)
    let aortaPulse = 1.0;
    if (phase >= 0.24 && phase < 0.50) {
      // Pulse pressure expansion
      const k = (phase - 0.24) / 0.26;
      aortaPulse = 1.0 + 0.18 * Math.sin(k * Math.PI);
    } else if (phase >= 0.50 && phase < 0.58) {
      // Dicrotic notch caused by aortic valve rebound
      const k = (phase - 0.50) / 0.08;
      aortaPulse = 1.0 + 0.05 * Math.sin(k * Math.PI);
    }

    // 4. Acoustic Valve Triggers (S1 at 0.22, S2 at 0.50)
    let triggerS1 = false;
    let triggerS2 = false;

    if (phase >= 0.21 && phase < 0.25 && now - this.lastS1Time > cycleMs * 0.7) {
      triggerS1 = true;
      this.lastS1Time = now;
    }
    if (phase >= 0.49 && phase < 0.53 && now - this.lastS2Time > cycleMs * 0.7) {
      triggerS2 = true;
      this.lastS2Time = now;
    }

    return {
      phase,
      ecg,
      ventricleVolume,
      twist,
      aortaPulse,
      triggerS1,
      triggerS2,
      phaseName
    };
  }
}

