import { EventEmitter } from 'events';

/**
 * PopupWindowManager — opens a connected secondary browser window and manages
 * bidirectional communication via the BroadcastChannel API.
 *
 * All messages follow the shared envelope convention:
 *   { type: 'TYPE_NAME', payload: { ...data } }
 *
 * Both sides must silently ignore unknown `type` values for forward-compatibility.
 *
 * Usage:
 * ```js
 * const manager = new PopupWindowManager();
 * manager.on('message', (msg) => console.log('from popup:', msg));
 * manager.on('closed',  ()    => console.log('popup closed'));
 *
 * const opened = manager.open('spectrogram-popup.html?panel=filter', 'spectrogram-filter');
 * if (!opened) alert('Popup was blocked — please allow popups for this site.');
 *
 * manager.send({ type: 'FILTER_STATE', payload: { filterType: 'lowpass', cutoff: 1000 } });
 * ```
 *
 * Events emitted:
 *   'message' (msg)  — incoming message from the popup window
 *   'closed'         — popup window was closed (by the user or via manager.close())
 */
export class PopupWindowManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Window|null} */
    this._popup = null;
    /** @type {BroadcastChannel|null} */
    this._channel = null;
    /** @type {ReturnType<typeof setInterval>|null} */
    this._pollTimer = null;
  }

  /**
   * Whether the popup window is currently open.
   * @type {boolean}
   */
  get isOpen() {
    return this._popup !== null && !this._popup.closed;
  }

  /**
   * Open a secondary popup window and establish a BroadcastChannel.
   *
   * @param {string} url           - URL of the popup page (e.g. 'spectrogram-popup.html?panel=filter&channel=spectrogram-filter')
   * @param {string} channelName   - BroadcastChannel name to use for bidirectional messaging
   * @param {string} [windowFeatures] - window.open features string (default: 'width=520,height=640')
   * @returns {boolean} true if the popup was opened; false if blocked by the browser
   */
  open(url, channelName, windowFeatures = 'width=520,height=640') {
    if (this.isOpen) return true;

    const popup = window.open(url, '_blank', windowFeatures);

    if (!popup) {
      console.warn(
        '[PopupWindowManager] Popup was blocked by the browser. ' +
        'Allow popups for this site and try again.'
      );
      return false;
    }

    this._popup = popup;
    this._channel = new BroadcastChannel(channelName);

    // Forward incoming messages to listeners
    this._channel.onmessage = (evt) => {
      const msg = evt.data;
      if (msg && typeof msg.type === 'string') {
        this.emit('message', msg);
      }
    };

    // Poll every 500 ms to detect user-initiated closure
    this._pollTimer = setInterval(() => {
      if (this._popup && this._popup.closed) {
        this._cleanup();
        this.emit('closed');
      }
    }, 500);

    return true;
  }

  /**
   * Send a message to the popup window.
   * No-op if the popup is not currently open.
   *
   * @param {{ type: string, payload: object }} message
   */
  send(message) {
    if (!this._channel) return;
    this._channel.postMessage(message);
  }

  /**
   * Programmatically close the popup window and clean up resources.
   * Emits 'closed'.
   */
  close() {
    if (this._popup && !this._popup.closed) {
      this._popup.close();
    }
    this._cleanup();
    this.emit('closed');
  }

  /**
   * Tear down all resources and listeners.
   * Call this when the managing component unmounts (if not using usePopupChannel).
   */
  destroy() {
    this._cleanup();
    this.removeAllListeners();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _cleanup() {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
    this._popup = null;
  }
}

export default PopupWindowManager;
