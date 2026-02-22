import React, { useRef, useEffect, useState } from 'react';
import { FilterController } from '../audio/FilterController.js';

export default function FilterPanel({ controller, sampleRate = 44100, onApply, applying = false }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ ...controller.state });

  // Wire controller events
  useEffect(() => {
    const onChange = s => setState({ ...s });
    controller.on('changed', onChange);
    return () => controller.off('changed', onChange);
  }, [controller]);

  // Draw frequency response every time filter state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // 0 dB reference line (dB range: −60 to +6; 0 dB sits at 90.9% from bottom)
    const DB_MIN = -60, DB_MAX = 6;
    const dbToY = db => H - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * H;
    const zeroY = dbToY(0);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();

    if (state.type === 'none') {
      // Flat 0 dB line
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();
      return;
    }

    const resp = controller.getFrequencyResponse(W, sampleRate);
    if (!resp) return;

    // Response curve
    ctx.strokeStyle = '#4af'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      const y = Math.max(0, Math.min(H, dbToY(resp.db[i])));
      if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Cutoff frequency marker (orange vertical dashed line)
    const nyquist = sampleRate / 2;
    const fx = Math.log(state.frequency / 20) / Math.log(nyquist / 20) * W;
    ctx.strokeStyle = '#f80'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
    ctx.setLineDash([]);
  }, [state, sampleRate, controller]);

  const nyquist = sampleRate / 2;
  const sliderStyle = { width: '100%', marginTop: 2 };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderTop: '1px solid #2a2a2a',
      fontFamily: 'monospace', fontSize: 11, color: '#888',
      padding: '6px 8px', boxSizing: 'border-box', gap: 5, flexShrink: 0,
    }}>
      <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>FILTER</div>

      <select
        value={state.type}
        onChange={e => controller.setType(e.target.value)}
        style={{ background: '#1a1a1a', border: '1px solid #444', color: '#aaa', padding: '2px', fontSize: 11 }}
      >
        {FilterController.filterTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {state.type !== 'none' && (
        <>
          <label>
            <span style={{ color: '#555' }}>Cutoff </span>
            <span style={{ color: '#aaa' }}>
              {state.frequency < 1000
                ? `${state.frequency.toFixed(0)} Hz`
                : `${(state.frequency / 1000).toFixed(2)} kHz`}
            </span>
            {/* Log-scale slider: range [0,1] mapped to [20 Hz, Nyquist] via exponential */}
            <input type="range" min="0" max="1" step="0.001"
              value={Math.log(state.frequency / 20) / Math.log(nyquist / 20)}
              onChange={e => {
                const t = parseFloat(e.target.value);
                controller.setFrequency(Math.round(20 * Math.pow(nyquist / 20, t)));
              }}
              style={sliderStyle}
            />
          </label>
          <label>
            <span style={{ color: '#555' }}>Q </span>
            <span style={{ color: '#aaa' }}>{state.Q.toFixed(2)}</span>
            <input type="range" min="0.1" max="30" step="0.1"
              value={state.Q}
              onChange={e => controller.setQ(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </label>
        </>
      )}

      {/* Frequency response canvas: x = 20 Hz→Nyquist (log), y = −60→+6 dB */}
      <canvas ref={canvasRef} width={118} height={55}
        style={{ width: '100%', height: 55, borderRadius: 2, border: '1px solid #1a1a1a' }}
      />

      <button
        onClick={onApply}
        disabled={applying || state.type === 'none'}
        style={{
          background: '#1a1a1a', border: '1px solid #444',
          color: (applying || state.type === 'none') ? '#444' : '#fda',
          padding: '3px', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {applying ? 'Applying…' : 'Apply to spectrogram'}
      </button>
    </div>
  );
}
