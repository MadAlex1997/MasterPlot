import React, { useEffect, useRef, useState } from 'react';
import FilterPanel from '../src/components/FilterPanel.jsx';
import { FilterController } from '../src/audio/FilterController.js';

/**
 * SpectrogramPopup — host shell for spectrogram-related popup panels.
 *
 * Reads URL search params to determine which panel to render:
 *   ?panel=filter   → FilterPanel (added by F24)
 *   ?panel=labels   → ROI label panel (added by EX11)
 *   ?channel=<name> → BroadcastChannel name to connect to
 *
 * Popup detection:
 *   window.opener !== null  OR  ?panel= param present
 * When detected, main-page chrome (nav, hub link) is suppressed.
 *
 * Message protocol (shared envelope, both directions):
 *   { type: 'TYPE_NAME', payload: { ...data } }
 * Unknown type values are silently ignored for forward-compatibility.
 */
export default function SpectrogramPopup() {
  const params = new URLSearchParams(window.location.search);
  const panel = params.get('panel') || '';
  const channelName = params.get('channel') || '';

  // Detect popup mode — suppress main chrome
  const isPopup = window.opener !== null || panel !== '';

  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  // Connect to BroadcastChannel if a channel name was provided
  useEffect(() => {
    if (!channelName) return;

    const ch = new BroadcastChannel(channelName);
    channelRef.current = ch;
    setConnected(true);

    ch.onmessage = (evt) => {
      const msg = evt.data;
      if (msg && typeof msg.type === 'string') {
        setLastMessage(msg);
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
      setConnected(false);
    };
  }, [channelName]);

  const send = (message) => {
    if (channelRef.current) channelRef.current.postMessage(message);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {!isPopup && (
        <div style={styles.standaloneNotice}>
          <p style={styles.noticeText}>
            This page is a popup panel host. Open it from the{' '}
            <a href="spectrogram.html" style={styles.link}>Spectrogram</a>{' '}
            example using the panel buttons.
          </p>
        </div>
      )}

      <div style={styles.header}>
        <span style={styles.title}>
          {panel ? `Panel: ${panel}` : 'Spectrogram Popup Host'}
        </span>
        {channelName && (
          <span style={connected ? styles.connectedBadge : styles.disconnectedBadge}>
            {connected ? `channel: ${channelName}` : 'disconnected'}
          </span>
        )}
      </div>

      <div style={styles.body}>
        {renderPanel(panel, send, lastMessage)}
      </div>
    </div>
  );
}

/**
 * FilterPanelPopup — popup-side filter panel (F24).
 *
 * Maintains a local FilterController mirror driven by BroadcastChannel messages
 * from the main window.  User interactions (slider/dropdown changes) send
 * FILTER_STATE to the main window.  Apply/Clear buttons send FILTER_APPLY /
 * FILTER_CLEAR; the main window executes the DSP and echoes FILTER_STATE back.
 *
 * Message protocol (channel: 'spectrogram-filter'):
 *   Main → Popup  FILTER_STATE  { filterType, cutoff, q, lowFreq, highFreq, applied, sampleRate }
 *   Popup → Main  FILTER_STATE  same shape (on control change)
 *   Popup → Main  FILTER_APPLY  {}
 *   Popup → Main  FILTER_CLEAR  {}
 */
function FilterPanelPopup({ send, lastMessage }) {
  const fcRef = useRef(null);
  if (!fcRef.current) fcRef.current = new FilterController();

  const suppressRef  = useRef(false);
  const [sampleRate, setSampleRate] = useState(44100);
  const [applying,   setApplying]   = useState(false);
  const [hasData,    setHasData]    = useState(false);  // true once main sent at least one FILTER_STATE

  // Forward local FC state changes to main window
  useEffect(() => {
    const fc = fcRef.current;
    const onChange = (s) => {
      if (suppressRef.current) return;
      send({
        type: 'FILTER_STATE',
        payload: {
          filterType: s.type,
          cutoff:     s.frequency,
          q:          s.Q,
          lowFreq:    s.lowFreq,
          highFreq:   s.highFreq,
        },
      });
    };
    fc.on('changed', onChange);
    return () => fc.off('changed', onChange);
  }, [send]);

  // Apply incoming messages from main window
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;
    if (type === 'FILTER_STATE') {
      const fc = fcRef.current;
      suppressRef.current = true;
      fc.state.type      = payload.filterType;
      fc.state.frequency = payload.cutoff;
      fc.state.Q         = payload.q;
      fc.state.lowFreq   = payload.lowFreq;
      fc.state.highFreq  = payload.highFreq;
      fc.emit('changed', { ...fc.state });
      suppressRef.current = false;
      if (payload.sampleRate) setSampleRate(payload.sampleRate);
      setApplying(false);  // main echoes FILTER_STATE after DSP completes
      setHasData(true);
    }
  }, [lastMessage]);

  const handleApply = () => {
    setApplying(true);
    send({ type: 'FILTER_APPLY', payload: {} });
  };

  const handleClear = () => {
    send({ type: 'FILTER_CLEAR', payload: {} });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!hasData && (
        <p style={{ ...styles.hint, fontSize: 11 }}>
          Waiting for main window connection…
        </p>
      )}
      <FilterPanel
        controller={fcRef.current}
        sampleRate={sampleRate}
        onApply={handleApply}
        applying={applying}
      />
      <button
        onClick={handleClear}
        style={{
          background: '#222', border: '1px solid #555', borderRadius: 3,
          color: '#fa8', padding: '4px 8px', fontSize: 11,
          cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        Clear DSP Filter
      </button>
    </div>
  );
}

/**
 * Route to the correct panel component by name.
 * F24 adds 'filter'; EX11 will add 'labels'.
 */
function renderPanel(panel, send, lastMessage) {
  switch (panel) {
    case 'filter':
      return <FilterPanelPopup send={send} lastMessage={lastMessage} />;
    case '':
      return (
        <p style={styles.hint}>
          No panel specified. Pass <code>?panel=filter</code> or <code>?panel=labels</code> in the URL.
        </p>
      );
    default:
      return (
        <p style={styles.hint}>
          Panel <strong>"{panel}"</strong> is not yet implemented.
          It will be added in a future feature (EX11).
        </p>
      );
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#0d0d0d',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid #222',
    background: '#111',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ccc',
    flex: 1,
  },
  connectedBadge: {
    fontSize: 11,
    background: '#1a3a1a',
    color: '#4caf50',
    border: '1px solid #2e5c2e',
    borderRadius: 4,
    padding: '2px 8px',
  },
  disconnectedBadge: {
    fontSize: 11,
    background: '#2a1a1a',
    color: '#f44',
    border: '1px solid #5c2e2e',
    borderRadius: 4,
    padding: '2px 8px',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  hint: {
    color: '#666',
    lineHeight: 1.6,
  },
  standaloneNotice: {
    background: '#1a1a2a',
    borderBottom: '1px solid #2a2a4a',
    padding: '10px 16px',
  },
  noticeText: {
    color: '#888',
    margin: 0,
  },
  link: {
    color: '#7ab',
  },
};
