import EventEmitter from 'events';

export class FilterController extends EventEmitter {
  constructor() {
    super();
    this.state = {
      type:      'none',   // 'none'|'lowpass'|'highpass'|'bandpass'|'notch'
      frequency: 1000,     // Hz — cutoff for lowpass/highpass; computed center for bandpass/notch
      Q:         1.0,      // resonance for lowpass/highpass; computed from bandwidth for bandpass/notch
      lowFreq:   500,      // Hz — low edge for bandpass/notch (user-facing)
      highFreq:  2000,     // Hz — high edge for bandpass/notch (user-facing)
    };
  }

  setType(type) {
    this.state.type = type;
    // Reset parameters to sensible defaults when switching between single/dual input modes
    if (type === 'bandpass' || type === 'notch') {
      this.state.lowFreq  = 500;
      this.state.highFreq = 2000;
      this._updateCenterFromLowHigh();
    } else if (type === 'lowpass' || type === 'highpass') {
      this.state.frequency = 1000;
      this.state.Q         = 1.0;
    }
    this.emit('changed', { ...this.state });
  }

  setFrequency(freq) {
    this.state.frequency = freq;
    this.emit('changed', { ...this.state });
  }

  setQ(q) {
    this.state.Q = q;
    this.emit('changed', { ...this.state });
  }

  /**
   * Set bandpass/notch filter via low + high frequency edges.
   * Computes geometric-mean center + bandwidth-derived Q.
   */
  setLowHighFreq(lowFreq, highFreq) {
    this.state.lowFreq  = lowFreq;
    this.state.highFreq = highFreq;
    this._updateCenterFromLowHigh();
    this.emit('changed', { ...this.state });
  }

  _updateCenterFromLowHigh() {
    const { lowFreq, highFreq } = this.state;
    const center = Math.sqrt(lowFreq * highFreq);
    const bw     = highFreq - lowFreq;
    this.state.frequency = center;
    this.state.Q         = bw > 0 ? center / bw : 1.0;
  }

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
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch'];
  }
}
