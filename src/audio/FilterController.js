import EventEmitter from 'events';

export class FilterController extends EventEmitter {
  constructor() {
    super();
    this.state = {
      type:      'none',   // 'none'|'lowpass'|'highpass'|'bandpass'|'notch'|'allpass'
      frequency: 1000,     // Hz — cutoff / centre frequency
      Q:         1.0,      // resonance / bandwidth
    };
  }

  setType(type)      { this.state.type = type;       this.emit('changed', { ...this.state }); }
  setFrequency(freq) { this.state.frequency = freq;  this.emit('changed', { ...this.state }); }
  setQ(q)            { this.state.Q = q;             this.emit('changed', { ...this.state }); }

  /**
   * Process samples through the biquad filter using OfflineAudioContext.
   * Returns a new Float32Array — original is not mutated.
   * If type === 'none', returns the same reference unchanged.
   */
  async applyToSamples(samples, sampleRate) {
    if (this.state.type === 'none') return samples;
    const offlineCtx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf        = offlineCtx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    const filter = offlineCtx.createBiquadFilter();
    filter.type            = this.state.type;
    filter.frequency.value = Math.min(this.state.frequency, sampleRate / 2 - 1);
    filter.Q.value         = this.state.Q;
    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();  // copy — ChannelData view becomes invalid after GC
  }

  /**
   * Compute frequency response for the current filter settings.
   * Returns { freqs: Float32Array, db: Float32Array } for nPoints log-spaced
   * frequencies from 20 Hz to nyquist.  Returns null if type === 'none'.
   *
   * Note: creates and immediately closes a temporary AudioContext; call only
   * when the user interacts with controls (not on every RAF frame).
   */
  getFrequencyResponse(nPoints = 256, sampleRate = 44100) {
    if (this.state.type === 'none') return null;
    const nyquist = sampleRate / 2;
    const freqs   = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      freqs[i] = 20 * Math.pow(nyquist / 20, i / (nPoints - 1));
    }
    const magRes   = new Float32Array(nPoints);
    const phaseRes = new Float32Array(nPoints);
    const tmpCtx   = new AudioContext({ sampleRate });
    const tmpNode  = tmpCtx.createBiquadFilter();
    tmpNode.type            = this.state.type;
    tmpNode.frequency.value = Math.min(this.state.frequency, nyquist - 1);
    tmpNode.Q.value         = this.state.Q;
    tmpNode.getFrequencyResponse(freqs, magRes, phaseRes);
    tmpCtx.close();  // release resources; fire-and-forget async close is fine
    const db = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      db[i] = 20 * Math.log10(Math.max(magRes[i], 1e-10));
    }
    return { freqs, db };
  }

  static get filterTypes() {
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];
  }
}
