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
      order:     2,        // 2|4|6|8 — only used for lowpass/highpass (cascaded Butterworth sections)
    };
  }

  setOrder(n) {
    this.state.order = [2, 4, 6, 8].includes(n) ? n : 2;
    this.emit('changed', { ...this.state });
  }

  /**
   * Compute Butterworth Q values for each biquad section.
   * Formula: Q_k = 1 / (2 * cos((2k − 1) * π / (2 * order))), k = 1…order/2
   * Spot-checks:
   *   order=2: [0.7071]
   *   order=4: [0.5412, 1.3066]
   *   order=6: [0.5176, 0.7071, 1.9319]
   *   order=8: [0.5098, 0.6013, 0.9000, 2.5629]
   */
  _butterworthQValues(order) {
    const sections = order / 2;
    const qs = new Float32Array(sections);
    for (let k = 1; k <= sections; k++) {
      qs[k - 1] = 1 / (2 * Math.cos((2 * k - 1) * Math.PI / (2 * order)));
    }
    return qs;
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
    const clampedFreq = Math.min(this.state.frequency, sampleRate / 2 - 1);

    if (this.state.type === 'lowpass' || this.state.type === 'highpass') {
      // Cascade order/2 biquad sections with Butterworth Q values
      const qs = this._butterworthQValues(this.state.order);
      const filters = Array.from(qs).map(q => {
        const f = offlineCtx.createBiquadFilter();
        f.type            = this.state.type;
        f.frequency.value = clampedFreq;
        f.Q.value         = q;
        return f;
      });
      // Chain: source → filters[0] → filters[1] → … → destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(offlineCtx.destination);
    } else {
      // bandpass/notch: single biquad as before
      const filter = offlineCtx.createBiquadFilter();
      filter.type            = this.state.type;
      filter.frequency.value = clampedFreq;
      filter.Q.value         = this.state.Q;
      source.connect(filter);
      filter.connect(offlineCtx.destination);
    }

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
    const nyquist     = sampleRate / 2;
    const clampedFreq = Math.min(this.state.frequency, nyquist - 1);
    const freqs       = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      freqs[i] = 20 * Math.pow(nyquist / 20, i / (nPoints - 1));
    }
    const magBuf   = new Float32Array(nPoints);
    const phaseBuf = new Float32Array(nPoints);
    const tmpCtx   = new AudioContext({ sampleRate });
    let db;

    if (this.state.type === 'lowpass' || this.state.type === 'highpass') {
      // Multiply linear magnitudes of each cascaded section
      const qs          = this._butterworthQValues(this.state.order);
      const combinedMag = new Float32Array(nPoints).fill(1.0);
      for (const q of qs) {
        const node = tmpCtx.createBiquadFilter();
        node.type            = this.state.type;
        node.frequency.value = clampedFreq;
        node.Q.value         = q;
        node.getFrequencyResponse(freqs, magBuf, phaseBuf);
        for (let i = 0; i < nPoints; i++) combinedMag[i] *= magBuf[i];
      }
      db = new Float32Array(nPoints);
      for (let i = 0; i < nPoints; i++) {
        db[i] = 20 * Math.log10(Math.max(combinedMag[i], 1e-10));
      }
    } else {
      // bandpass/notch: single section
      const node = tmpCtx.createBiquadFilter();
      node.type            = this.state.type;
      node.frequency.value = clampedFreq;
      node.Q.value         = this.state.Q;
      node.getFrequencyResponse(freqs, magBuf, phaseBuf);
      db = new Float32Array(nPoints);
      for (let i = 0; i < nPoints; i++) {
        db[i] = 20 * Math.log10(Math.max(magBuf[i], 1e-10));
      }
    }

    tmpCtx.close();  // release resources; fire-and-forget async close is fine
    return { freqs, db };
  }

  static get filterTypes() {
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch'];
  }
}
