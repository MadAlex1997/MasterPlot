// MasterPlot public API
// Import from 'masterplot' to get all library exports.

// ── Controllers ────────────────────────────────────────────────────────────
export { default as PlotController }          from './plot/PlotController.js';
export { default as DataStore }               from './plot/DataStore.js';
export { default as PlotDataView }            from './plot/PlotDataView.js';
export { default as ViewportController }      from './plot/ViewportController.js';
export { default as LUTHistogramController }  from './plot/LUTHistogramController.js';

// ── Axes ───────────────────────────────────────────────────────────────────
export { default as AxisController }  from './plot/axes/AxisController.js';
export { default as AxisRenderer }    from './plot/axes/AxisRenderer.js';

// ── Layers ─────────────────────────────────────────────────────────────────
export { default as BitmapDataLayer }      from './plot/layers/BitmapDataLayer.js';
export { default as BitmapViewGenerator }  from './plot/layers/BitmapViewGenerator.js';
export { default as LUTController }        from './plot/layers/LUTController.js';
export { default as ROILayer }             from './plot/layers/ROILayer.js';
// ScatterLayer and LineLayer export builder functions as default
export { default as buildScatterLayer }    from './plot/layers/ScatterLayer.js';
export { default as buildLineLayer }       from './plot/layers/LineLayer.js';
// Named-only exports
export { PlotLayer }                       from './plot/layers/PlotLayer.js';
export { TraceGroup }                      from './plot/layers/TraceGroup.js';
export { SignalStore, buildSignalLayers }  from './plot/layers/SignalDataLayer.js';

// ── ROI system ─────────────────────────────────────────────────────────────
export { default as ROIController }    from './plot/ROI/ROIController.js';
export { default as ROIBase }          from './plot/ROI/ROIBase.js';
export { default as LinearRegion }     from './plot/ROI/LinearRegion.js';
export { default as RectROI }          from './plot/ROI/RectROI.js';
export { default as LineROI }          from './plot/ROI/LineROI.js';
export { default as ConstraintEngine } from './plot/ROI/ConstraintEngine.js';

// ── Audio ──────────────────────────────────────────────────────────────────
export { AudioController }    from './audio/AudioController.js';
export { FilterController }   from './audio/FilterController.js';
export { PlaybackController } from './audio/PlaybackController.js';

// ── External integration ───────────────────────────────────────────────────
export { default as ExternalDataAdapter } from './integration/ExternalDataAdapter.js';
export { default as ExternalROIAdapter }  from './integration/ExternalROIAdapter.js';
export { default as MockDataAdapter }     from './integration/MockDataAdapter.js';
export { default as MockROIAdapter }      from './integration/MockROIAdapter.js';

// ── Popup utilities ────────────────────────────────────────────────────────
export { default as PopupWindowManager } from './popup/PopupWindowManager.js';
export { default as usePopupChannel }    from './popup/usePopupChannel.js';

// ── React component ────────────────────────────────────────────────────────
// In React-free environments (Node.js, headless workers) omit this or
// import only what you need directly from 'masterplot/src/components/PlotCanvas.jsx'.
export { default as PlotCanvas } from './components/PlotCanvas.jsx';
