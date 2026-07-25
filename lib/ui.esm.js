import { useRef, useState, useEffect, useCallback } from 'react';
import { FilterController } from '../src/audio/FilterController.js';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { LUTController } from '../src/plot/layers/LUTController.js';

function FilterPanel({
  controller,
  sampleRate = 44100,
  onApply,
  applying = false
}) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({
    ...controller.state
  });

  // Wire controller events
  useEffect(() => {
    const onChange = s => setState({
      ...s
    });
    controller.on('changed', onChange);
    return () => controller.off('changed', onChange);
  }, [controller]);

  // Draw frequency response every time filter state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // 0 dB reference line (dB range: −60 to +6; 0 dB sits at 90.9% from bottom)
    const DB_MIN = -60,
      DB_MAX = 6;
    const dbToY = db => H - (db - DB_MIN) / (DB_MAX - DB_MIN) * H;
    const zeroY = dbToY(0);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(W, zeroY);
    ctx.stroke();
    if (state.type === 'none') {
      // Flat 0 dB line
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(W, zeroY);
      ctx.stroke();
      return;
    }
    const resp = controller.getFrequencyResponse(W, sampleRate);
    if (!resp) return;

    // Response curve
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      const y = Math.max(0, Math.min(H, dbToY(resp.db[i])));
      if (i === 0) ctx.moveTo(i, y);else ctx.lineTo(i, y);
    }
    ctx.stroke();
    const nyquist = sampleRate / 2;

    // Helper: convert Hz to canvas x position (log scale 20 Hz → nyquist)
    const freqToX = hz => Math.log(hz / 20) / Math.log(nyquist / 20) * W;

    // Draw cutoff marker(s) — orange dashed vertical line(s)
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    if (state.type === 'bandpass' || state.type === 'notch') {
      // Two markers: lowFreq and highFreq
      const x1 = freqToX(Math.max(20, state.lowFreq));
      const x2 = freqToX(Math.min(nyquist, state.highFreq));
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, H);
      ctx.stroke();
    } else {
      // Single marker at computed frequency
      const fx = freqToX(state.frequency);
      ctx.beginPath();
      ctx.moveTo(fx, 0);
      ctx.lineTo(fx, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }, [state, sampleRate, controller]);
  const nyquist = sampleRate / 2;
  const sliderStyle = {
    width: '100%',
    marginTop: 2
  };
  const isBandType = state.type === 'bandpass' || state.type === 'notch';
  const isSingleCutoff = state.type === 'lowpass' || state.type === 'highpass';
  return /*#__PURE__*/jsxs("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
      borderTop: '1px solid #2a2a2a',
      fontFamily: 'monospace',
      fontSize: 11,
      color: '#888',
      padding: '6px 8px',
      boxSizing: 'border-box',
      gap: 5,
      flexShrink: 0
    },
    children: [/*#__PURE__*/jsx("div", {
      style: {
        color: '#555',
        fontSize: 10,
        letterSpacing: 1
      },
      children: "FILTER"
    }), /*#__PURE__*/jsx("select", {
      value: state.type,
      onChange: e => controller.setType(e.target.value),
      style: {
        background: '#1a1a1a',
        border: '1px solid #444',
        color: '#aaa',
        padding: '2px',
        fontSize: 11
      },
      children: FilterController.filterTypes.map(t => /*#__PURE__*/jsx("option", {
        value: t,
        children: t
      }, t))
    }), isSingleCutoff && /*#__PURE__*/jsxs(Fragment, {
      children: [/*#__PURE__*/jsxs("label", {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 6px'
        },
        children: [/*#__PURE__*/jsx("span", {
          style: {
            color: '#555'
          },
          children: "Order "
        }), [2, 4, 6, 8].map(n => /*#__PURE__*/jsxs("label", {
          style: {
            marginRight: 4,
            cursor: 'pointer'
          },
          children: [/*#__PURE__*/jsx("input", {
            type: "radio",
            name: "filter-order",
            value: n,
            checked: state.order === n,
            onChange: () => controller.setOrder(n)
          }), n]
        }, n))]
      }), /*#__PURE__*/jsxs("label", {
        children: [/*#__PURE__*/jsx("span", {
          style: {
            color: '#555'
          },
          children: state.type === 'lowpass' ? 'Cutoff (low) ' : 'Cutoff (high) '
        }), /*#__PURE__*/jsx("span", {
          style: {
            color: '#aaa'
          },
          children: state.frequency < 1000 ? `${state.frequency.toFixed(0)} Hz` : `${(state.frequency / 1000).toFixed(2)} kHz`
        }), /*#__PURE__*/jsx("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.001",
          value: Math.log(state.frequency / 20) / Math.log(nyquist / 20),
          onChange: e => {
            const t = parseFloat(e.target.value);
            controller.setFrequency(Math.round(20 * Math.pow(nyquist / 20, t)));
          },
          style: sliderStyle
        })]
      }), /*#__PURE__*/jsxs("label", {
        children: [/*#__PURE__*/jsx("span", {
          style: {
            color: '#555'
          },
          children: "Q "
        }), /*#__PURE__*/jsx("span", {
          style: {
            color: '#aaa'
          },
          children: state.Q.toFixed(2)
        }), /*#__PURE__*/jsx("input", {
          type: "range",
          min: "0.1",
          max: "30",
          step: "0.1",
          value: state.Q,
          onChange: e => controller.setQ(parseFloat(e.target.value)),
          style: sliderStyle
        })]
      })]
    }), isBandType && /*#__PURE__*/jsxs(Fragment, {
      children: [/*#__PURE__*/jsxs("label", {
        children: [/*#__PURE__*/jsx("span", {
          style: {
            color: '#555'
          },
          children: "Low freq "
        }), /*#__PURE__*/jsx("span", {
          style: {
            color: '#aaa'
          },
          children: state.lowFreq < 1000 ? `${state.lowFreq.toFixed(0)} Hz` : `${(state.lowFreq / 1000).toFixed(2)} kHz`
        }), /*#__PURE__*/jsx("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.001",
          value: Math.log(Math.max(20, state.lowFreq) / 20) / Math.log(nyquist / 20),
          onChange: e => {
            const t = parseFloat(e.target.value);
            const lo = Math.round(20 * Math.pow(nyquist / 20, t));
            if (lo < state.highFreq) controller.setLowHighFreq(lo, state.highFreq);
          },
          style: sliderStyle
        })]
      }), /*#__PURE__*/jsxs("label", {
        children: [/*#__PURE__*/jsx("span", {
          style: {
            color: '#555'
          },
          children: "High freq "
        }), /*#__PURE__*/jsx("span", {
          style: {
            color: '#aaa'
          },
          children: state.highFreq < 1000 ? `${state.highFreq.toFixed(0)} Hz` : `${(state.highFreq / 1000).toFixed(2)} kHz`
        }), /*#__PURE__*/jsx("input", {
          type: "range",
          min: "0",
          max: "1",
          step: "0.001",
          value: Math.log(Math.min(nyquist, state.highFreq) / 20) / Math.log(nyquist / 20),
          onChange: e => {
            const t = parseFloat(e.target.value);
            const hi = Math.round(20 * Math.pow(nyquist / 20, t));
            if (hi > state.lowFreq) controller.setLowHighFreq(state.lowFreq, hi);
          },
          style: sliderStyle
        })]
      }), /*#__PURE__*/jsxs("div", {
        style: {
          color: '#666',
          fontSize: 10
        },
        children: ["center ", state.frequency < 1000 ? `${state.frequency.toFixed(0)} Hz` : `${(state.frequency / 1000).toFixed(2)} kHz`, ' · ', "Q ", state.Q.toFixed(2)]
      })]
    }), /*#__PURE__*/jsx("canvas", {
      ref: canvasRef,
      width: 118,
      height: 55,
      style: {
        width: '100%',
        height: 55,
        borderRadius: 2,
        border: '1px solid #1a1a1a'
      }
    }), /*#__PURE__*/jsx("button", {
      onClick: onApply,
      disabled: applying || state.type === 'none',
      style: {
        background: '#1a1a1a',
        border: '1px solid #444',
        color: applying || state.type === 'none' ? '#444' : '#fda',
        padding: '3px',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'monospace'
      },
      children: applying ? 'Applying…' : 'Apply to spectrogram'
    })]
  });
}

/**
 * LUTPanel — React component providing a LUT histogram panel.
 *
 * Layout:
 *   ┌──────────────────────────┬──┐
 *   │  histogram plot          │  │
 *   │  (bars + hline handles)  │LU│
 *   │                          │T │
 *   │                          │gd│
 *   ├──────────────────────────┤  │
 *   │  [Colormap ▼]  [Auto]    │  │
 *   └──────────────────────────┴──┘
 *
 * - Left area: two raw canvases wired to lutHistCtrl's internal PlotController
 * - Right strip (12 px): LUT gradient canvas, redrawn on lutController 'lutChanged'
 * - Bottom controls: colormap <select> + Auto Level <button>
 * - Level adjustment is via hline LineROIs inside the plot — no React drag handlers needed
 *
 * Props:
 *   lutController  {LUTController}           — manages colormap + levels
 *   lutHistCtrl    {LUTHistogramController}  — owns the internal PlotController
 *   width          {number}                  — total panel width in px (default 160)
 *   height         {string|number}           — panel height CSS value (default '100%')
 */

const GRAD_W = 12; // LUT gradient strip width in px

function LUTPanel({
  lutController,
  lutHistCtrl,
  width = 160,
  height = '100%'
}) {
  const webglCanvasRef = useRef(null);
  const axisCanvasRef = useRef(null);
  const gradCanvasRef = useRef(null);
  const [preset, setPreset] = useState(() => lutController.state.lutName);

  // ── Initialize LUTHistogramController once canvases are in DOM ──────────────
  useEffect(() => {
    const wc = webglCanvasRef.current;
    const ac = axisCanvasRef.current;
    if (!wc || !ac) return;
    const raf = requestAnimationFrame(() => {
      const w = wc.offsetWidth || 120;
      const h = wc.offsetHeight || 300;
      wc.width = w;
      wc.height = h;
      ac.width = w;
      ac.height = h;
      lutHistCtrl.init(wc, ac);
    });
    return () => {
      cancelAnimationFrame(raf);
      lutHistCtrl.destroy();
    };
  }, []); // mount once — lutHistCtrl identity must not change

  // ── LUT gradient strip: resize + redraw on lutChanged ──────────────────────
  useEffect(() => {
    const canvas = gradCanvasRef.current;
    if (!canvas) return;
    const drawGradient = () => {
      const H = canvas.height;
      if (!H) return;
      const ctx = canvas.getContext('2d');
      const lut = lutController.getLUTArray();
      // top = high value, bottom = low value (matches histogram y orientation)
      for (let py = 0; py < H; py++) {
        const t = 1 - py / H;
        const li = Math.min(255, Math.floor(t * 255)) * 4;
        ctx.fillStyle = `rgb(${lut[li]},${lut[li + 1]},${lut[li + 2]})`;
        ctx.fillRect(0, py, GRAD_W, 1);
      }
    };
    const syncAndDraw = () => {
      canvas.width = GRAD_W;
      canvas.height = canvas.offsetHeight || 300;
      drawGradient();
    };

    // Initial size + draw after layout
    const initRaf = requestAnimationFrame(syncAndDraw);

    // Resize
    const ro = new ResizeObserver(() => requestAnimationFrame(syncAndDraw));
    ro.observe(canvas);

    // Redraw whenever colormap changes
    const onLutChanged = presetName => {
      setPreset(presetName);
      drawGradient();
    };
    lutController.on('lutChanged', onLutChanged);
    return () => {
      cancelAnimationFrame(initRaf);
      ro.disconnect();
      lutController.off('lutChanged', onLutChanged);
    };
  }, [lutController]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return /*#__PURE__*/jsxs("div", {
    style: {
      width,
      height,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
      borderLeft: '1px solid #333',
      fontFamily: 'monospace',
      fontSize: 11,
      color: '#888',
      flexShrink: 0,
      boxSizing: 'border-box'
    },
    children: [/*#__PURE__*/jsxs("div", {
      style: {
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      },
      children: [/*#__PURE__*/jsxs("div", {
        style: {
          flex: 1,
          position: 'relative'
        },
        children: [/*#__PURE__*/jsx("canvas", {
          ref: webglCanvasRef,
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%'
          }
        }), /*#__PURE__*/jsx("canvas", {
          ref: axisCanvasRef,
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }
        })]
      }), /*#__PURE__*/jsx("canvas", {
        ref: gradCanvasRef,
        style: {
          width: GRAD_W,
          display: 'block',
          flexShrink: 0
        }
      })]
    }), /*#__PURE__*/jsxs("div", {
      style: {
        padding: '4px 6px',
        borderTop: '1px solid #222',
        flexShrink: 0
      },
      children: [/*#__PURE__*/jsx("select", {
        value: preset,
        onChange: e => {
          lutController.setLUT(e.target.value);
          setPreset(e.target.value);
        },
        style: {
          width: '100%',
          background: '#1a1a1a',
          border: '1px solid #444',
          color: '#aaa',
          padding: '2px 4px',
          fontSize: 11
        },
        children: LUTController.presetNames.map(n => /*#__PURE__*/jsx("option", {
          value: n,
          children: n
        }, n))
      }), /*#__PURE__*/jsx("button", {
        onClick: () => lutController.autoLevel(),
        style: {
          marginTop: 4,
          width: '100%',
          background: '#1a1a1a',
          border: '1px solid #444',
          color: '#adf',
          padding: '3px',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'monospace'
        },
        children: "Auto Level"
      })]
    })]
  });
}

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

function HelpOverlay({
  title,
  controls,
  storageKey
}) {
  // Lazy initializer: compute first-visit state during the initial render
  // (not in a post-mount effect) so there's no closed-then-reopens flash.
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return false; // localStorage blocked
    }
  });
  const handleClose = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {/* localStorage blocked */}
  }, [storageKey]);
  const handleOpen = useCallback(() => setOpen(true), []);
  const mono = {
    fontFamily: 'monospace',
    fontSize: 12
  };
  return /*#__PURE__*/jsxs(Fragment, {
    children: [/*#__PURE__*/jsx("button", {
      onClick: handleOpen,
      title: "Show controls",
      style: {
        width: 22,
        height: 22,
        borderRadius: '50%',
        flexShrink: 0,
        background: '#1a1a1a',
        border: '1px solid #555',
        color: '#8af',
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...mono,
        fontSize: 13,
        fontWeight: 700
      },
      children: "?"
    }), open && /*#__PURE__*/jsx("div", {
      onClick: handleClose,
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      children: /*#__PURE__*/jsxs("div", {
        onClick: e => e.stopPropagation(),
        style: {
          background: '#151515',
          border: '1px solid #333',
          borderRadius: 6,
          padding: '20px 24px',
          minWidth: 320,
          maxWidth: 520,
          maxHeight: '80vh',
          overflowY: 'auto',
          ...mono
        },
        children: [/*#__PURE__*/jsxs("div", {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14
          },
          children: [/*#__PURE__*/jsx("span", {
            style: {
              color: '#7df',
              fontWeight: 700,
              fontSize: 14
            },
            children: title
          }), /*#__PURE__*/jsx("button", {
            onClick: handleClose,
            style: {
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0
            },
            children: "\u2715"
          })]
        }), /*#__PURE__*/jsx("table", {
          style: {
            width: '100%',
            borderCollapse: 'collapse'
          },
          children: /*#__PURE__*/jsx("tbody", {
            children: controls.map(({
              key,
              description
            }) => /*#__PURE__*/jsxs("tr", {
              style: {
                borderBottom: '1px solid #222'
              },
              children: [/*#__PURE__*/jsx("td", {
                style: {
                  padding: '5px 12px 5px 0',
                  whiteSpace: 'nowrap',
                  color: '#fd8',
                  verticalAlign: 'top',
                  width: 1
                },
                children: key
              }), /*#__PURE__*/jsx("td", {
                style: {
                  padding: '5px 0',
                  color: '#aaa'
                },
                children: description
              })]
            }, key))
          })
        }), /*#__PURE__*/jsx("div", {
          style: {
            marginTop: 14,
            color: '#555',
            fontSize: 11,
            textAlign: 'right'
          },
          children: "Click outside or \u2715 to close"
        })]
      })
    })]
  });
}

export { FilterPanel, HelpOverlay, LUTPanel };
//# sourceMappingURL=ui.esm.js.map
