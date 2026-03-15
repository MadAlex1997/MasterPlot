/**
 * HelpOverlay — EX15: First-Load Help Icon (Controls Overlay).
 *
 * Props:
 *   title      {string}   Overlay heading (e.g. 'Scatter / ROI Controls')
 *   controls   {Array<{ key: string, description: string }>}
 *   storageKey {string}   localStorage key — overlay auto-shows when key is absent
 *
 * Behaviour:
 *   - On first page visit (localStorage key absent) the overlay opens automatically.
 *   - Closing the overlay sets the localStorage key so it won't re-open on refresh.
 *   - The ? button (top-right, position:fixed inside the plot container) always
 *     re-opens the overlay regardless of localStorage state.
 */

import React, { useState, useEffect, useCallback } from 'react';

export default function HelpOverlay({ title, controls, storageKey }) {
  const [open, setOpen] = useState(false);

  // Auto-show on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch (_) { /* localStorage blocked */ }
  }, [storageKey]);

  const handleClose = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(storageKey, '1'); } catch (_) {}
  }, [storageKey]);

  const handleOpen = useCallback(() => setOpen(true), []);

  const mono = { fontFamily: 'monospace', fontSize: 12 };

  return (
    <>
      {/* Always-visible ? button — renders inline; place inside a header bar */}
      <button
        onClick={handleOpen}
        title="Show controls"
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: '#1a1a1a', border: '1px solid #555',
          color: '#8af', cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          ...mono, fontSize: 13, fontWeight: 700,
        }}
      >?</button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#151515', border: '1px solid #333',
              borderRadius: 6, padding: '20px 24px',
              minWidth: 320, maxWidth: 520,
              maxHeight: '80vh', overflowY: 'auto',
              ...mono,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ color: '#7df', fontWeight: 700, fontSize: 14 }}>{title}</span>
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: 'none', color: '#888',
                  cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
                }}
              >✕</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {controls.map(({ key, description }) => (
                  <tr key={key} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '5px 12px 5px 0', whiteSpace: 'nowrap', color: '#fd8', verticalAlign: 'top', width: 1 }}>
                      {key}
                    </td>
                    <td style={{ padding: '5px 0', color: '#aaa' }}>
                      {description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 14, color: '#555', fontSize: 11, textAlign: 'right' }}>
              Click outside or ✕ to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
