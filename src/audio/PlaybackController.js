import EventEmitter from 'events';

export class PlaybackController extends EventEmitter {
  constructor() {
    super();
    this._audioContext     = null;
    this._audioBuffer      = null;
    this._source           = null;
    this._isPlaying        = false;
    this._pauseOffset      = 0;   // seconds into buffer where we paused/stopped
    this._startContextTime = 0;   // audioContext.currentTime at last play() call
    this._startOffset      = 0;   // buffer offset at last play() call
  }

  get isPlaying() { return this._isPlaying; }
  get duration()  { return this._audioBuffer?.duration ?? 0; }

  /** Returns the current playback position in seconds. */
  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  /**
   * Decode samples into an AudioBuffer. Called after file load.
   * Creates or reuses the AudioContext; resumes it (autoplay policy).
   */
  async loadBuffer(samples, sampleRate) {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({ sampleRate });
    }
    await this._audioContext.resume();
    const buf = this._audioContext.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    this._audioBuffer = buf;
    this.emit('stateChanged', { state: 'loaded', duration: buf.duration });
  }

  /** Start or resume playback. Optional offset (seconds) overrides saved position. */
  async play(offset = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume();   // browser autoplay guard
    this._stopSource();
    const startAt = (offset !== null) ? Math.max(0, offset) : this._pauseOffset;
    if (startAt >= this.duration) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false;  // distinguish natural end from manual stop
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying   = false;
        this._pauseOffset = 0;
        this.emit('stateChanged', { state: 'stopped' });
      }
    };
    source.start(0, startAt);
    this._source           = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset      = startAt;
    this._isPlaying        = true;
    this.emit('stateChanged', { state: 'playing' });
  }

  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this.emit('stateChanged', { state: 'paused' });
  }

  stop() {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    this.emit('stateChanged', { state: 'stopped' });
  }

  /** Jump to a time; resumes playback if it was playing. */
  seek(time) {
    const clipped    = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) { this._stopSource(); this._isPlaying = false; }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);
    else this.emit('stateChanged', { state: 'paused' });
  }

  destroy() {
    this._stopSource();
    this._audioContext?.close();
    this._audioContext = null;
  }

  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try { this._source.stop(); } catch (_) {}
      this._source.disconnect();
      this._source = null;
    }
  }
}
