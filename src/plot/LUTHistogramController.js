/**
 * LUTHistogramController — owns an internal PlotController configured as a
 * read-only histogram viewer.  Intended as the backing controller for LUTPanel.jsx.
 *
 * Histogram layout:
 *   x-axis: bin counts  (0 → maxCount)
 *   y-axis: data values (globalMin → globalMax)
 *   Bars: horizontal SolidPolygonLayer rectangles, one per bin
 *   Level handles: two 'hline' LineROIs draggable to set level_min / level_max
 *
 * Constructor:
 *   new LUTHistogramController({ lutController, bins = 256 })
 *
 * Public API:
 *   init(webglCanvas, axisCanvas)  — call once canvases are in DOM
 *   destroy()
 *   get plotController()           — the internal PlotController instance
 *
 * Event wiring:
 *   lutController 'dataChanged'  → rebuild bars + update y-domain
 *   lutController 'levelChanged' → move hlines → markDirty
 *   HLine 'roiUpdated'  (drag)   → lutController.setLevels → levelChanged → recolorize
 *   HLine 'roiFinalized' (up)    → same (commit event; use for deferred server-side saves)
 */

import { PlotController } from './PlotController.js';
import { LineROI }        from './ROI/LineROI.js';
import { SolidPolygonLayer } from '@deck.gl/layers';

export class LUTHistogramController {
  /**
   * @param {object}        opts
   * @param {LUTController} opts.lutController  — the shared LUT controller
   * @param {number}        [opts.bins=256]     — number of histogram bins
   */
  constructor({ lutController, bins = 256 } = {}) {
    if (!lutController) throw new Error('LUTHistogramController: lutController is required');

    this._lutController = lutController;
    this._bins          = bins;
    this._barData       = [];    // array of polygon objects for SolidPolygonLayer
    this._maxCount      = 1;     // current histogram peak (y-axis upper bound)

    // Internal PlotController — read-only histogram viewer
    const { level_min, level_max, globalMin, globalMax } = lutController.state;
    this._plotController = new PlotController({
      disableDefaultDataLayer: true,
      disablePanZoom:          true,
      hideXAxis:               true,
      xDomain: [0, 1],                   // updated after first data
      yDomain: [globalMin, globalMax],
      yLabel:  'value',
      autoExpand: false,
    });

    // Register histogram bar layer
    this._plotController.registerDataLayer('histogram-bars', (ctx) => {
      if (this._barData.length === 0) return null;
      return new SolidPolygonLayer({
        id:           'histogram-bars',
        data:         this._barData,
        getPolygon:   d => d.polygon,
        getFillColor: [80, 140, 220, 200],
        extruded:     false,
        updateTriggers: { getPolygon: ctx.dataTrigger },
      });
    });

    // Create the two hline level-handle LineROIs
    this._hlineMin = new LineROI({
      orientation: 'horizontal',
      mode:        'hline',
      position:    level_min,
      flags:       { deletable: false },
    });
    this._hlineMin.bumpVersion();

    this._hlineMax = new LineROI({
      orientation: 'horizontal',
      mode:        'hline',
      position:    level_max,
      flags:       { deletable: false },
    });
    this._hlineMax.bumpVersion();

    // Bind handlers for cleanup
    this._onDataChanged  = this._onDataChanged.bind(this);
    this._onLevelChanged = this._onLevelChanged.bind(this);
    this._onROIUpdated   = this._onROIUpdated.bind(this);

    // Wire LUTController events
    this._lutController.on('dataChanged',  this._onDataChanged);
    this._lutController.on('levelChanged', this._onLevelChanged);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get plotController() { return this._plotController; }

  /**
   * Initialize the internal PlotController.
   * Call once after both canvases are mounted in the DOM.
   *
   * @param {HTMLCanvasElement} webglCanvas
   * @param {HTMLCanvasElement} axisCanvas
   */
  init(webglCanvas, axisCanvas) {
    this._plotController.init(webglCanvas, axisCanvas);

    // Add hline ROIs after init (ROIController is set up by init)
    const roiCtrl = this._plotController.roiController;
    roiCtrl.addROI(this._hlineMin);
    this._hlineMin.onCreate();
    roiCtrl.addROI(this._hlineMax);
    this._hlineMax.onCreate();
    roiCtrl.emit('roisChanged', { rois: roiCtrl.getAllROIs() });

    // Wire ROI events → LUT level updates
    roiCtrl.on('roiUpdated',   this._onROIUpdated);
    roiCtrl.on('roiFinalized', this._onROIUpdated);

    // If LUT already has data, build initial bars
    const { histogramBins, histogramEdges, globalMin, globalMax } = this._lutController.state;
    if (histogramBins) {
      this._rebuildBars(histogramBins, histogramEdges, globalMin, globalMax);
    }
  }

  destroy() {
    this._lutController.off('dataChanged',  this._onDataChanged);
    this._lutController.off('levelChanged', this._onLevelChanged);

    const roiCtrl = this._plotController.roiController;
    roiCtrl.off('roiUpdated',   this._onROIUpdated);
    roiCtrl.off('roiFinalized', this._onROIUpdated);

    this._plotController.destroy();
  }

  // ─── Internal event handlers ───────────────────────────────────────────────

  /** LUTController emitted 'dataChanged' — rebuild bars and update axes. */
  _onDataChanged({ bins, edges, globalMin, globalMax }) {
    this._rebuildBars(bins, edges, globalMin, globalMax);

    // Update y-domain to match new data range
    this._plotController.viewport.setYDomain([globalMin, globalMax]);

    // Clamp hlines into new y-domain
    this._clampHlinePositions(globalMin, globalMax);

    this._plotController.markDirty();
  }

  /** LUTController emitted 'levelChanged' — move hlines to match. */
  _onLevelChanged({ level_min, level_max }) {
    // Only update hlines if they differ (avoid infinite loop with _onROIUpdated)
    if (this._hlineMin.position !== level_min) {
      this._hlineMin.position = level_min;
      this._hlineMin._syncBoundsFromPosition();
    }
    if (this._hlineMax.position !== level_max) {
      this._hlineMax.position = level_max;
      this._hlineMax._syncBoundsFromPosition();
    }
    this._plotController.markDirty();
  }

  /**
   * A hline was dragged or committed — push new levels to LUTController.
   * Triggered by both 'roiUpdated' (drag) and 'roiFinalized' (mouseUp).
   */
  _onROIUpdated({ roi }) {
    if (roi !== this._hlineMin && roi !== this._hlineMax) return;

    // Read both current positions (either may have changed)
    const level_min = Math.min(this._hlineMin.position, this._hlineMax.position);
    const level_max = Math.max(this._hlineMin.position, this._hlineMax.position);

    // setLevels emits 'levelChanged' → _onLevelChanged → we move hlines.
    // Guard: only call if the values actually changed to avoid circular ping.
    const state = this._lutController.state;
    if (state.level_min !== level_min || state.level_max !== level_max) {
      this._lutController.setLevels(level_min, level_max);
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Rebuild horizontal bar polygon data from histogram bins/edges.
   * Each bar is a horizontal rectangle:
   *   x: 0 → count,  y: edgeLow → edgeHigh
   */
  _rebuildBars(bins, edges, globalMin, globalMax) {
    let maxCount = 1;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] > maxCount) maxCount = bins[i];
    }
    this._maxCount = maxCount;

    const bars = [];
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] === 0) continue;
      const yLo = edges[i];
      const yHi = edges[i + 1];
      bars.push({
        polygon: [
          [0,         yLo],
          [bins[i],   yLo],
          [bins[i],   yHi],
          [0,         yHi],
        ],
      });
    }
    this._barData = bars;

    // Update x-domain to count range
    this._plotController.viewport.setXDomain([0, maxCount]);
  }

  /** Ensure hline positions stay within the current y-domain. */
  _clampHlinePositions(globalMin, globalMax) {
    const clampFn = v => Math.max(globalMin, Math.min(v, globalMax));
    this._hlineMin.position = clampFn(this._hlineMin.position);
    this._hlineMax.position = clampFn(this._hlineMax.position);
    this._hlineMin._syncBoundsFromPosition();
    this._hlineMax._syncBoundsFromPosition();
  }
}

export default LUTHistogramController;
