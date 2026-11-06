export const SOUND_OPTIONS = [
  { key: 'rain', label: 'Rain' },
  { key: 'cafe', label: 'Coffee shop' },
  { key: 'noise', label: 'White noise' },
  { key: 'forest', label: 'Nature' },
  { key: 'lofi', label: 'Lo-fi pad' },
];

function brownNoiseBuffer(ctx, seconds = 3) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function whiteNoiseBuffer(ctx, seconds = 3) {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AmbienceEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.nodes = [];
    this.volume = 0.5;
    this.key = null;
  }

  ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  stop() {
    this.nodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    });
    this.nodes = [];
    this.key = null;
  }

  play(key) {
    const ctx = this.ensure();
    this.stop();
    this.key = key;
    const out = this.master;

    const addNoise = (buffer, filters = [], gainValue = 0.5) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      let node = src;
      filters.forEach((f) => {
        node.connect(f);
        node = f;
      });
      node.connect(gain);
      gain.connect(out);
      src.start();
      this.nodes.push(src, gain, ...filters);
      return gain;
    };

    if (key === 'noise') {
      addNoise(whiteNoiseBuffer(ctx), [this.filter('lowpass', 9000)], 0.28);
    } else if (key === 'rain') {
      const lp = this.filter('lowpass', 5200);
      const hp = this.filter('highpass', 500);
      addNoise(whiteNoiseBuffer(ctx), [hp, lp], 0.32);
      const rumble = this.filter('lowpass', 220);
      addNoise(brownNoiseBuffer(ctx), [rumble], 0.35);
    } else if (key === 'cafe') {
      addNoise(brownNoiseBuffer(ctx), [this.filter('lowpass', 700)], 0.5);
      addNoise(whiteNoiseBuffer(ctx), [this.filter('bandpass', 1400, 1.2)], 0.06);
    } else if (key === 'forest') {
      const bp = this.filter('bandpass', 900, 0.8);
      const gain = addNoise(brownNoiseBuffer(ctx), [bp], 0.34);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      this.nodes.push(lfo, lfoGain);
      addNoise(whiteNoiseBuffer(ctx), [this.filter('highpass', 6000)], 0.05);
    } else if (key === 'lofi') {
      // Procedural lo-fi chord pad: no sampled or copyrighted audio.
      const chord = [220, 277.18, 329.63, 415.3];
      const pad = ctx.createGain();
      pad.gain.value = 0.12;
      const lp = this.filter('lowpass', 1200);
      pad.connect(lp);
      lp.connect(out);
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = i * 4 - 6;
        osc.connect(pad);
        osc.start();
        this.nodes.push(osc);
      });
      const trem = ctx.createOscillator();
      const tremGain = ctx.createGain();
      trem.frequency.value = 0.18;
      tremGain.gain.value = 0.05;
      trem.connect(tremGain);
      tremGain.connect(pad.gain);
      trem.start();
      this.nodes.push(trem, tremGain, pad, lp);
      addNoise(brownNoiseBuffer(ctx), [this.filter('lowpass', 320)], 0.16);
    }
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
}

export function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.8);
    });
    setTimeout(() => ctx.close(), 1800);
  } catch {
    /* audio unavailable */
  }
}