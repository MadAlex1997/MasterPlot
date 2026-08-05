// Throwaway TypeScript smoke-test fixture for REL4 (not shipped, not built).
// Exercises a representative slice of the public API from all three entry
// points to catch declaration drift. Run with: npx tsc --noEmit -p test-types

import * as React from 'react';
import {
  PlotController,
  ViewportController,
  DataStore,
  PlotDataView,
  AxisController,
  buildEpochTickFormatter,
  dataXToEpochSeconds,
  epochSecondsToDataX,
  ROIController,
  ROIBase,
  LinearRegion,
  RectROI,
  LineROI,
  ConstraintEngine,
  BitmapDataLayer,
  BitmapViewGenerator,
  LUTController,
  LUTHistogramController,
  buildScatterLayer,
  buildLineLayer,
  TraceGroup,
  SignalStore,
  AudioController,
  FilterController,
  PlaybackController,
  ExternalDataAdapter,
  ExternalROIAdapter,
  MockDataAdapter,
  MockROIAdapter,
  PopupWindowManager,
  usePopupChannel,
  PlotCanvas,
  type BufferStruct,
  type SerializedROI,
  type Domain,
} from 'masterplot';
import { FilterPanel, LUTPanel, HelpOverlay } from 'masterplot/ui';
import { TableLoaderAdapter, RasterLoaderAdapter } from 'masterplot/loaders';

// ── PlotController ──────────────────────────────────────────────────────
const xAxis = new AxisController({ scaleType: 'log', tickCount: 8, label: 'Frequency (Hz)' });
const ctrl = new PlotController({
  xAxis,
  yScaleType: 'linear',
  xDomain: [1, 10000],
  yDomain: [0, 100],
  disablePanZoom: false,
  mouseButtons: { middle: 'rectZoom' },
  panMode: 'drag',
});

ctrl.on('domainChanged', ({ xDomain, yDomain }) => {
  const x: Domain = xDomain;
  const y: Domain = yDomain;
  void x;
  void y;
});
ctrl.on('dataAppended', ({ count, total }) => {
  const c: number = count;
  const t: number = total;
  void c;
  void t;
});
ctrl.on('roiFinalized', ({ roi, version, domain }) => {
  const v: number = version;
  void roi;
  void v;
  void domain;
});

// ── F40: epoch-offset high-precision time axis ──────────────────────────
const timeOriginMs = Date.now();
const epochCtrl = new PlotController({
  timeOrigin: timeOriginMs,
  timeOriginUnits: 'seconds',
});
const epochSeconds: number = epochCtrl.dataXToEpochSeconds(12.5);
const offsetX: number = epochCtrl.epochSecondsToDataX(epochSeconds);
const asDate: Date = epochCtrl.dataXToDate(12.5);
void offsetX;
void asDate;

const manualFormatter = buildEpochTickFormatter({ timeOriginMs, unitsPerSecond: 1 });
const label: string = manualFormatter(12.5, 0, 1);
void label;
const es: number = dataXToEpochSeconds(12.5, timeOriginMs, 1);
const ox: number = epochSecondsToDataX(es, timeOriginMs, 1);
void ox;

const webglCanvas = document.createElement('canvas');
const axisCanvas = document.createElement('canvas');
ctrl.init(webglCanvas, axisCanvas);

const chunk: BufferStruct = {
  x: new Float32Array([1, 2, 3]),
  y: new Float32Array([4, 5, 6]),
};
ctrl.appendData(chunk);
ctrl.registerDataLayer('scatter', (renderCtx) => buildScatterLayer(renderCtx.gpuAttrs, { xIsLog: true }));

const viewport: ViewportController = ctrl.viewport;
viewport.panByPixels({ dx: 10, dy: -5 });
viewport.zoomAroundX(50, 2);

const store = new DataStore(1024);
store.appendData(chunk);
const view = new PlotDataView(store);
const filtered = view.filterByDomain({ x: [0, 100] });
const hist = filtered.histogram({ field: 'x', bins: 10 });
void hist.counts;

// ── ROI system ───────────────────────────────────────────────────────────
const roiCtrl: ROIController = ctrl.roiController;
const region = new LinearRegion({ x1: 0, x2: 10 });
const rect = new RectROI({ x1: 0, x2: 5, y1: 0, y2: 5, xLocked: true });
const line = new LineROI({ orientation: 'vertical', mode: 'vline-half-top', position: 3, label: 'P-wave' });
roiCtrl.addROI(region);
roiCtrl.addROI(rect);
roiCtrl.addROI(line);
line.bumpVersion();
const serialized: SerializedROI[] = roiCtrl.serializeAll();
void serialized;

const engine = new ConstraintEngine();
const changedSet: Set<ROIBase> = engine.applyConstraints(region, { dx: 1, dy: 0 });
void changedSet;

// ── Layers ───────────────────────────────────────────────────────────────
const lut = new LUTController(256);
lut.setLUT('viridis');
const histCtrl = new LUTHistogramController({ lutController: lut });
void histCtrl.plotController;

new BitmapDataLayer({
  id: 'bmp',
  bitMapping: { bounds: [0, 0, 1, 1] },
  channels: 'gray',
  lutController: lut,
});

new BitmapViewGenerator(ctrl, {
  layerId: 'raster-view',
  generate: (req) => ({ source: new Float32Array(req.widthPx * req.heightPx), width: req.widthPx, height: req.heightPx }),
});

buildLineLayer({ x: new Float32Array([0, 1]), y: new Float32Array([0, 1]) }, { color: [255, 0, 0, 255] });

const traces = new TraceGroup({
  palette: [[255, 0, 0, 255], [0, 255, 0, 255]],
  buildLayer: () => null,
});
traces.appendData({ x: [0, 1], y: [0, 1], tag: ['a', 'b'] });

const signals = new SignalStore();
signals.addSignal('s1', [255, 255, 255, 255]);
signals.appendSignalData('s1', [1, 2, 3], 0);

// ── Audio ────────────────────────────────────────────────────────────────
const audio = new AudioController();
audio.on('tileReady', ({ power, bounds }) => {
  void power;
  void bounds;
});
void audio.play();

const filterCtrl = new FilterController();
filterCtrl.on('changed', (state) => {
  void state.type;
});
filterCtrl.setType('lowpass');

const playback = new PlaybackController();
playback.on('stateChanged', (payload) => {
  if (payload.state === 'loaded') {
    void payload.duration;
  }
});

// ── External integration ────────────────────────────────────────────────
class MyDataAdapter extends ExternalDataAdapter {
  replaceData(bufferStruct: BufferStruct): void {
    void bufferStruct;
  }
  appendData(bufferStruct: BufferStruct): void {
    void bufferStruct;
  }
}
void new MyDataAdapter(store);

class MyROIAdapter extends ExternalROIAdapter {
  async load(): Promise<SerializedROI[]> {
    return [];
  }
  async save(): Promise<void> {}
  subscribe(callback: (roi: SerializedROI) => void): () => void {
    void callback;
    return () => {};
  }
}
void new MyROIAdapter(roiCtrl);

const mockData = new MockDataAdapter(store, { intervalMs: 250, batchSize: 50 });
mockData.start();
mockData.stop();

const mockROI = new MockROIAdapter(roiCtrl, { storageKey: 'demo' });
void mockROI.attach();

// ── Popup ────────────────────────────────────────────────────────────────
const popupMgr = new PopupWindowManager();
popupMgr.on('message', (msg) => void msg.type);
popupMgr.open('/popup.html', 'demo-channel');

function UsePopupDemo() {
  const { open, isOpen, send } = usePopupChannel('/popup.html', 'demo-channel', (msg) => void msg.payload);
  return React.createElement('button', { onClick: open, disabled: isOpen }, isOpen ? 'open' : String(send));
}
void UsePopupDemo;

// ── React components (PlotCanvas, ui/) ────────────────────────────────────
function App() {
  const canvasRef = React.useRef<React.ComponentRef<typeof PlotCanvas>>(null);
  return React.createElement(
    'div',
    null,
    React.createElement(PlotCanvas, {
      ref: canvasRef,
      xDomain: [0, 1],
      yDomain: [0, 1],
      bordered: true,
      onInit: (c) => void c.markDirty(),
    }),
    React.createElement(FilterPanel, { controller: filterCtrl, sampleRate: 44100, onApply: () => {} }),
    React.createElement(LUTPanel, { lutController: lut, lutHistCtrl: histCtrl, width: 200 }),
    React.createElement(HelpOverlay, {
      title: 'Controls',
      controls: [{ key: 'L', description: 'Create LinearRegion' }],
      storageKey: 'help-seen',
    })
  );
}
void App;

// ── Loaders ──────────────────────────────────────────────────────────────
const tableLoader = new TableLoaderAdapter(store, { x: 'lon', y: 'lat', chunkSize: 10000 });
tableLoader.on('loaded', ({ rowCount, columns }) => {
  void rowCount;
  void columns;
});
void tableLoader.loadURL('/data.csv');

const rasterLoader = new RasterLoaderAdapter(ctrl, { layerId: 'raster', lutController: lut });
rasterLoader.on('loaded', ({ variable }) => void variable);
rasterLoader.loadArray(new Float32Array(100), 10, 10, { channels: 'gray' });
