import React, { useEffect, useRef, useState } from 'react';

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
 * Route to the correct panel component by name.
 * F24 will add 'filter', EX11 will add 'labels'.
 */
function renderPanel(panel, send, lastMessage) {
  switch (panel) {
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
          It will be added in a future feature (F24 / EX11).
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
