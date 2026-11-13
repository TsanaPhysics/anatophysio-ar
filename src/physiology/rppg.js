// Remote Photoplethysmography (rPPG) Engine
// Non-contact pulse and heart rate extraction from facial video feed.
// Uses Green-channel chrominance analysis on the forehead and cheek ROIs.

export class RPPGDetector {
  constructor(bufferSeconds = 6) {
    this.bufferSeconds = bufferSeconds;
    this.samples = []; // { time, value }
    this.bpm = 72;
    this.confidence = 0;
    this.pulseWave = 0;
    this.lastBpmUpdate = 0;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 64;
    this.canvas.height = 32;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.minBpm = 45;
    this.maxBpm = 180;
    this.rmssd = 0;
    this.sdnn = 0;
    this.sqi = 0;
    this.stressLevel = "Normal";
    this.irregularFlag = false;
  }

  // Extract average green intensity from forehead ROI
  // video: HTMLVideoElement, faceLandmarks: array of 468/478 normalized points
  processFrame(video, faceLandmarks, now) {
    if (!faceLandmarks || !video || video.readyState < 2) {
      this.confidence = Math.max(0, this.confidence - 0.05);
      this.sqi = Math.round(this.confidence * 100);
      return {
        bpm: this.bpm, pulse: 0, confidence: this.confidence,
        sqi: this.sqi, rmssd: this.rmssd, sdnn: this.sdnn,
        stressLevel: this.stressLevel, irregularFlag: this.irregularFlag
      };
    }

    // Forehead ROI landmarks (indices around points 10, 151, 67, 297, 109, 338)
    // We use forehead center [10, 151, 9] and cheek regions [118, 347]
    const p10 = faceLandmarks[10];   // top center forehead
    const p151 = faceLandmarks[151]; // mid forehead
    const p67 = faceLandmarks[67];   // left forehead
    const p297 = faceLandmarks[297]; // right forehead

    if (!p10 || !p151 || !p67 || !p297) return { bpm: this.bpm, pulse: this.pulseWave, confidence: this.confidence };

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    // Bounding box of forehead ROI in video coordinates
    const minX = Math.max(0, Math.min(p67.x, p297.x, p10.x) * vw);
    const maxX = Math.min(vw, Math.max(p67.x, p297.x, p10.x) * vw);
    const minY = Math.max(0, Math.min(p10.y, p67.y) * vh);
    const maxY = Math.min(vh, p151.y * vh);

    const w = maxX - minX;
    const h = maxY - minY;

    if (w < 16 || h < 10) return { bpm: this.bpm, pulse: this.pulseWave, confidence: this.confidence };

    // Downsample forehead patch onto off-screen canvas
    this.ctx.drawImage(video, minX, minY, w, h, 0, 0, this.canvas.width, this.canvas.height);
    const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;

    let sumG = 0, sumR = 0, sumB = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Basic skin tone check to avoid dark hair/shadow pixels
      if (r > 40 && g > 25 && b > 15 && r > b) {
        sumR += r; sumG += g; sumB += b;
        count++;
      }
    }

    if (count < 32) return { bpm: this.bpm, pulse: this.pulseWave, confidence: this.confidence };

    const meanG = sumG / count;
    const meanR = sumR / count;
    // Normalized green channel with red normalization (Green/Red chrominance signal)
    const rawVal = meanR > 0 ? (meanG / meanR) : meanG;

    this.samples.push({ t: now, v: rawVal });

    // Evict old samples outside sliding window
    const cutoff = now - (this.bufferSeconds * 1000);
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }

    // Process pulse signal when buffer has sufficient frames (> 2.5 seconds)
    if (this.samples.length > 75) {
      this._analyzeSignal(now);
    }

    return {
      bpm: this.bpm,
      pulse: this.pulseWave,
      confidence: this.confidence,
      sqi: this.sqi,
      rmssd: this.rmssd,
      sdnn: this.sdnn,
      stressLevel: this.stressLevel,
      irregularFlag: this.irregularFlag
    };
  }

  _analyzeSignal(now) {
    const N = this.samples.length;
    const values = new Float32Array(N);
    let mean = 0;
    for (let i = 0; i < N; i++) {
      values[i] = this.samples[i].v;
      mean += values[i];
    }
    mean /= N;

    // Detrend (zero-mean)
    for (let i = 0; i < N; i++) values[i] -= mean;

    // Moving average bandpass filter (approx 0.75 Hz to 3.0 Hz @ ~30-60 fps)
    const dt = (this.samples[N - 1].t - this.samples[0].t) / (N - 1) / 1000; // average frame duration in sec
    if (dt <= 0 || dt > 0.1) return;
    const fs = 1.0 / dt; // sampling frequency

    // Current normalized pulse wave for waveform rendering
    const smoothWindow = Math.max(2, Math.round(fs * 0.1));
    let curVal = 0, curCount = 0;
    for (let i = Math.max(0, N - smoothWindow); i < N; i++) {
      curVal += values[i];
      curCount++;
    }
    this.pulseWave = curCount > 0 ? (curVal / curCount) : 0;

    // Recompute BPM every 750 ms
    if (now - this.lastBpmUpdate < 750) return;
    this.lastBpmUpdate = now;

    // Autocorrelation to identify dominant cardiac period
    const minLag = Math.floor(fs * (60.0 / this.maxBpm)); // min lag for 180 bpm
    const maxLag = Math.floor(fs * (60.0 / this.minBpm)); // max lag for 45 bpm

    if (maxLag >= N / 2) return;

    let bestLag = -1, maxCorr = -1e9;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < N - lag; i++) {
        corr += values[i] * values[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag > 0) {
      const detectedBpm = (fs / bestLag) * 60;
      if (detectedBpm >= this.minBpm && detectedBpm <= this.maxBpm) {
        // Smooth adaptive update
        this.bpm = this.bpm * 0.8 + detectedBpm * 0.2;
        this.confidence = Math.min(1.0, this.confidence + 0.12);
        this._computeHRV(values, fs);
        this.sqi = Math.round(this.confidence * 100);
        return;
      }
    }
    this.confidence = Math.max(0.1, this.confidence - 0.05);
    this.sqi = Math.round(this.confidence * 100);
  }

  // Extract systolic peaks and compute HRV (RMSSD, SDNN), Stress Level & Rhythm Regularity
  _computeHRV(values, fs) {
    const N = values.length;
    const minPeakDist = Math.max(4, Math.round(fs * 0.34)); // >= 340 ms refractory
    const peaks = [];
    for (let i = 2; i < N - 2; i++) {
      if (values[i] > 0 && values[i] > values[i - 1] && values[i] >= values[i + 1] && values[i] > values[i - 2]) {
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDist) {
          peaks.push(i);
        }
      }
    }
    if (peaks.length < 4) return;

    const ibis = [];
    for (let i = 1; i < peaks.length; i++) {
      const ibiMs = ((peaks[i] - peaks[i - 1]) / fs) * 1000;
      if (ibiMs >= 333 && ibiMs <= 1333) ibis.push(ibiMs);
    }
    if (ibis.length < 3) return;

    let meanIbi = 0;
    for (let i = 0; i < ibis.length; i++) meanIbi += ibis[i];
    meanIbi /= ibis.length;

    let varSum = 0, diffSqSum = 0, largeDiffCount = 0;
    for (let i = 0; i < ibis.length; i++) {
      varSum += (ibis[i] - meanIbi) * (ibis[i] - meanIbi);
      if (i > 0) {
        const d = ibis[i] - ibis[i - 1];
        diffSqSum += d * d;
        if (Math.abs(d) / meanIbi > 0.20) largeDiffCount++;
      }
    }

    const sdnn = Math.sqrt(varSum / ibis.length);
    const rmssd = Math.sqrt(diffSqSum / (ibis.length - 1));
    this.sdnn = Math.round(this.sdnn ? (this.sdnn * 0.7 + sdnn * 0.3) : sdnn);
    this.rmssd = Math.round(this.rmssd ? (this.rmssd * 0.7 + rmssd * 0.3) : rmssd);
    this.irregularFlag = largeDiffCount >= Math.max(2, Math.floor(ibis.length * 0.4));
    this.stressLevel = this.rmssd < 20 ? "High" : this.rmssd < 45 ? "Moderate" : "Low";
  }
}

