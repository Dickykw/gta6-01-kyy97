// Sound, synthesized live with WebAudio — no audio files: engine hum, siren,
// gunshot, pickup chime, mission fanfare, skid noise. All guarded: silence on failure.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.skidSrc = null;
    this.skidGain = null;
    this.ready = false;
    this.trackName = 'Solmara FM · Golden Hour'; // the one synth loop on air
  }

  /** Call from a user gesture (start button). Safe to call repeatedly. */
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine: two detuned saws through a lowpass
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 30;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp); this.engineOsc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); this.engineOsc2.start();
      // siren: square alternating by LFO on frequency
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 800;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 160;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      // skid: looping noise through bandpass
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.skidSrc = this.ctx.createBufferSource();
      this.skidSrc.buffer = buf; this.skidSrc.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
      this.skidGain = this.ctx.createGain(); this.skidGain.gain.value = 0;
      this.skidSrc.connect(bp); bp.connect(this.skidGain); this.skidGain.connect(this.master);
      this.skidSrc.start();
      this.ready = true;
    } catch (e) {
      this.ready = false;
    }
  }

  /** Per-frame: engine pitch follows speed, siren by cop distance, skid while drifting. */
  update(state) {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime;
      const speed = Math.abs(state.speed || 0);
      const driving = state.driving;
      this.engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.min(0.09, speed * 0.002) : 0, t, 0.1);
      const freq = 55 + speed * 4.2;
      this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(freq * 0.5, t, 0.08);
      const siren = state.nearestCop !== undefined && state.nearestCop < 70 && state.wanted > 0;
      this.sirenGain.gain.setTargetAtTime(siren ? 0.045 : 0, t, 0.3);
      this.skidGain.gain.setTargetAtTime(state.drifting ? 0.08 : 0, t, 0.05);
    } catch (e) { /* stay silent */ }
  }

  _blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  gunshot() {
    if (!this.ready) return;
    try {
      const len = this.ctx.sampleRate * 0.12;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g = this.ctx.createGain(); g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
    } catch (e) { /* ignore */ }
  }

  pickup() { this._blip(880, 0.12, 'sine', 0.25); this._blip(1318, 0.18, 'sine', 0.22, 0.09); }
  missionComplete() {
    [523, 659, 784, 1046].forEach((f, i) => this._blip(f, 0.22, 'triangle', 0.22, i * 0.11));
  }
  missionFailed() { this._blip(330, 0.3, 'sawtooth', 0.15); this._blip(220, 0.4, 'sawtooth', 0.15, 0.16); }
  click() { this._blip(1200, 0.05, 'square', 0.12); }
}
