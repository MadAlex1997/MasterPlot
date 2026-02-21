/**
 * PlotCanvas — thin React wrapper around PlotController.
 *
 * This component's only job is to:
 *   1. Create the canvas DOM elements
 *   2. Instantiate PlotController and call init() once mounted
 *   3. Call destroy() on unmount
 *   4. Expose plotController via ref for the parent to call appendData() etc.
 *
 * React state is NOT used for:
 *   - Point data
 *   - Zoom / pan state
 *   - ROI geometry
 *
 * React state IS used for:
 *   - UI overlay text (mode indicator, point count badge)
 */

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { PlotController } from '../plot/PlotController.js';

const PlotCanvas = forwardRef(function PlotCanvas(props, ref) {
  const {
    width       = '100%',
    height      = '100%',
    xScaleType  = 'linear',
    yScaleType  = 'linear',
    xDomain     = [0, 1],
    yDomain     = [0, 100],
    xLabel,
    yLabel,
    onEvent,    // optional: (eventName, data) => void
  } = props;

  const containerRef  = useRef(null);
  const webglCanvasRef = useRef(null);
  const axisCanvasRef  = useRef(null);
  const controllerRef  = useRef(null);

  const [modeText,  setModeText]  = useState('');
  const [pointCount, setPointCount] = useState(0);

  // Expose controller via ref
  useImperativeHandle(ref, () => ({
    getController: () => controllerRef.current,
    appendData:    (chunk, autoExpand) => controllerRef.current?.appendData(chunk, autoExpand),
  }));

  useEffect(() => {
    if (!webglCanvasRef.current || !axisCanvasRef.current) return;

    const controller = new PlotController({
      xScaleType, yScaleType, xDomain, yDomain, xLabel, yLabel,
    });

    controllerRef.current = controller;

    // Initialise after next paint so canvas dimensions are settled
    const raf = requestAnimationFrame(() => {
      const wc = webglCanvasRef.current;
      const ac = axisCanvasRef.current;
      if (!wc || !ac) return;

      const w = wc.offsetWidth  || 800;
      const h = wc.offsetHeight || 600;
      wc.width = w;
      ac.width = w;
      wc.height = h;
      ac.height = h;

      controller.init(wc, ac);

      // Wire events to UI state (cheap: only a few events/sec)
      controller.on('dataAppended', ({ total }) => setPointCount(total));

      controller.on('modeChanged', ({ mode }) => {
        const labels = {
          idle:         '',
          createLinear: 'Mode: Draw LinearRegion — click x1, then x2',
          createRect:   'Mode: Draw RectROI — click top-left, then bottom-right',
        };
        setModeText(labels[mode] || mode);
      });

      // Bubble all events to parent if requested
      if (onEvent) {
        const names = ['roiCreated','roiUpdated','roiDeleted','dataAppended','domainChanged','zoomChanged','panChanged'];
        names.forEach(n => controller.on(n, d => onEvent(n, d)));
      }

      // Also listen to ROI controller's mode changes
      controller.roiController.on('modeChanged', ({ mode }) => {
        const labels = {
          idle:         '',
          createLinear: 'Mode: Draw LinearRegion — click x1, then x2',
          createRect:   'Mode: Draw RectROI — click top-left, then bottom-right',
        };
        setModeText(labels[mode] || mode);
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      controller.destroy();
      controllerRef.current = null;
    };
  }, []); // mount once

  const overlayStyle = {
    position:      'absolute',
    bottom:        4,
    right:         8,
    color:         '#aaa',
    fontSize:      11,
    fontFamily:    'monospace',
    pointerEvents: 'none',
    userSelect:    'none',
  };

  const modeStyle = {
    position:      'absolute',
    top:           4,
    left:          '50%',
    transform:     'translateX(-50%)',
    color:         '#ffd700',
    fontSize:      12,
    fontFamily:    'monospace',
    pointerEvents: 'none',
    background:    'rgba(0,0,0,0.6)',
    padding:       '2px 8px',
    borderRadius:  3,
    display:       modeText ? 'block' : 'none',
  };

  const canvasStyle = {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width, height, background: '#0d0d0d', overflow: 'hidden' }}>
      {/* WebGL canvas (deck.gl renders here) */}
      <canvas ref={webglCanvasRef} style={canvasStyle} />

      {/* Axis overlay canvas (2D, pointer-events: none) */}
      <canvas ref={axisCanvasRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />

      {/* Mode indicator */}
      <div style={modeStyle}>{modeText}</div>

      {/* Point count */}
      <div style={overlayStyle}>{pointCount.toLocaleString()} pts</div>
    </div>
  );
});

export default PlotCanvas;
