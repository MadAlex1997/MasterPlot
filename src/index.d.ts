// MasterPlot — TypeScript declarations for the public API (mirrors src/index.js).
// Hand-written (REL4) — not generated from JSDoc. Keep in sync with src/index.js exports.

import { EventEmitter } from 'events';
import type { Layer, CompositeLayer } from '@deck.gl/core';
import type { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import type * as React from 'react';

// ════════════════════════════════════════════════════════════════════════
// Shared primitive types
// ════════════════════════════════════════════════════════════════════════

/** A [min, max] domain range. */
export type Domain = [number, number];

export type ScaleType = 'linear' | 'log' | 'time';

/** RGBA color, 0-255 per channel. */
export type RGBAColor = [number, number, number, number];

export interface PlotArea {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

/** GPU-ready buffer views returned by DataStore/PlotDataView. */
export interface GPUAttributes {
  x: Float32Array;
  y: Float32Array;
  size: Float32Array;
  color: Uint8Array;
}

/** Input chunk accepted by DataStore.appendData()/PlotController.appendData(). */
export interface DataChunk {
  x: Float32Array | number[];
  y: Float32Array | number[];
  size?: Float32Array | number[];
  color?: Uint8Array | number[];
  metadata?: object[];
}

// ════════════════════════════════════════════════════════════════════════
// AxisController (src/plot/axes/AxisController.js)
// ════════════════════════════════════════════════════════════════════════

export interface AxisTick {
  value: number;
  screen: number;
  label: string;
}

export interface AxisControllerOptions {
  /** @default 'linear' */
  scaleType?: ScaleType;
  /** (value, index) => string. Overrides the built-in numeric/time formatter. */
  tickFormat?: ((value: number | Date, index: number) => string) | null;
  /** @default 5 */
  tickCount?: number;
  /** @default null */
  label?: string | null;

  /** F35 positioning. @default 'border' */
  mode?: 'border' | 'relative';
  /** Edges to render at: x-axis 'top'|'bottom', y-axis 'left'|'right'. Multiple = mirrored. @default null (renderer default) */
  edges?: string[] | null;
  /** Data coordinate the axis line is anchored to in 'relative' mode. @default 0 */
  crossingValue?: number;
  /** Pixels from edge at which the axis snaps to border rendering. 0 = never snap. @default 0 */
  snapTolerancePx?: number;
  /** @default 'border' */
  offscreen?: 'border' | 'hide';
  /** @default 'auto' */
  labelSide?: 'auto' | 'positive' | 'negative';
}

/** d3-scale instance (scaleLinear/scaleLog/scaleTime), domain+range already applied. */
export type D3Scale = ((value: any) => number) & {
  domain(): any[];
  domain(domain: any[]): D3Scale;
  range(): number[];
  range(range: number[]): D3Scale;
  invert(value: number): any;
  ticks(count?: number): any[];
};

export class AxisController {
  constructor(opts?: AxisControllerOptions);

  scaleType: ScaleType;
  tickCount: number;
  label: string | null;
  tickFormat: ((value: number | Date, index: number) => string) | null;

  mode: 'border' | 'relative';
  edges: string[] | null;
  crossingValue: number;
  snapTolerancePx: number;
  offscreen: 'border' | 'hide';
  labelSide: 'auto' | 'positive' | 'negative';

  getScale(domain: any[], range: number[]): D3Scale;
  getTicks(scale: D3Scale): AxisTick[];
  formatTick(value: number | Date, index?: number): string;
  getTickSize(): number;
}

// ════════════════════════════════════════════════════════════════════════
// AxisRenderer (src/plot/axes/AxisRenderer.js)
// ════════════════════════════════════════════════════════════════════════

export interface AxisRendererStyle {
  background?: string;
  axisColor?: string;
  tickColor?: string;
  labelColor?: string;
  gridColor?: string;
  fontSize?: number;
  fontFamily?: string;
  tickLength?: number;
  labelPadding?: number;
  hideXAxis?: boolean;
}

export class AxisRenderer {
  constructor(
    canvas: HTMLCanvasElement,
    xAxis: AxisController,
    yAxis: AxisController,
    viewport: ViewportController
  );

  setVisible(visible: boolean): void;
  exportMode(hide?: boolean): void;
  setStyle(partial: AxisRendererStyle): void;
  /** F34: fill the 4 margin gutters with the container's CSS background before drawing ticks. */
  setBordered(on: boolean): void;
  render(rois?: ReadonlyArray<ROIBase>): void;
  /** F21: hit-test a canvas pixel position against the x/y axis gutters. */
  getAxisHit(px: number, py: number): 'x' | 'y' | null;
}

// ════════════════════════════════════════════════════════════════════════
// ViewportController (src/plot/ViewportController.js)
// ════════════════════════════════════════════════════════════════════════

export interface ViewportControllerOptions {
  /** @default 60 */
  marginLeft?: number;
  /** @default 20 */
  marginRight?: number;
  /** @default 20 */
  marginTop?: number;
  /** @default 50 */
  marginBottom?: number;
}

export interface DomainChangedPayload {
  xDomain: Domain;
  yDomain: Domain;
}

export interface ResizePayload {
  width: number;
  height: number;
  plotArea: PlotArea;
}

export interface DeckViewState {
  target: [number, number, number];
  zoom: number;
}

export class ViewportController extends EventEmitter {
  constructor(opts?: ViewportControllerOptions);

  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  canvasWidth: number;
  canvasHeight: number;
  plotArea: PlotArea;

  setAxisConfig(xAxis: AxisController, yAxis: AxisController): void;

  setXDomain(domain: Domain): void;
  setYDomain(domain: Domain): void;
  setDomains(xDomain: Domain | null, yDomain: Domain | null): void;
  getXDomain(): Domain;
  getYDomain(): Domain;

  setXRange(range: [number, number]): void;
  setYRange(range: [number, number]): void;

  zoomAroundX(dataCenter: number, factor: number): void;
  zoomAroundY(dataCenter: number, factor: number): void;
  zoomAround(focalDataX: number, focalDataY: number, factor: number): void;
  panByPixels(deltas: { dx?: number; dy?: number }): void;
  scaleDomainFromMidpointX(factor: number): void;
  scaleDomainFromMidpointY(factor: number): void;

  getXScale(): D3Scale | null;
  getYScale(): D3Scale | null;

  setCanvasSize(width: number, height: number): void;

  dataXToScreen(dataX: number): number;
  dataYToScreen(dataY: number): number;
  screenXToData(screenX: number): number;
  screenYToData(screenY: number): number;
  getCanvasPosition(event: MouseEvent, canvas: HTMLElement): { x: number; y: number };
  eventToData(
    event: MouseEvent,
    canvas: HTMLElement
  ): { dataX: number; dataY: number; screenX: number; screenY: number };
  isInPlotArea(screenX: number, screenY: number): boolean;
  getDeckViewState(xDomain: Domain, yDomain: Domain): DeckViewState;

  on(event: 'domainChanged', listener: (payload: DomainChangedPayload) => void): this;
  on(event: 'resize', listener: (payload: ResizePayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: 'domainChanged', listener: (payload: DomainChangedPayload) => void): this;
  once(event: 'resize', listener: (payload: ResizePayload) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'domainChanged', payload: DomainChangedPayload): boolean;
  emit(event: 'resize', payload: ResizePayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// DataStore (src/plot/DataStore.js)
// ════════════════════════════════════════════════════════════════════════

export interface EnableRollingOptions {
  /** Evict oldest points once count exceeds this. @default Infinity */
  maxPoints?: number;
  /** Evict points older than this many ms. @default Infinity */
  maxAgeMs?: number;
}

export interface DataExpiredPayload {
  expired: number;
  remaining: number;
}

export class DataStore extends EventEmitter {
  /** @default 65536 */
  constructor(initialCapacity?: number);

  enableRolling(opts: EnableRollingOptions): void;
  expireIfNeeded(): void;
  getLogicalData(): GPUAttributes;

  appendData(chunk: DataChunk): void;
  getGPUAttributes(): GPUAttributes;
  getPointCount(): number;
  getMetadata(index: number): object | undefined;
  clear(): void;

  on(event: 'dirty', listener: () => void): this;
  on(event: 'dataExpired', listener: (payload: DataExpiredPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: 'dirty', listener: () => void): this;
  once(event: 'dataExpired', listener: (payload: DataExpiredPayload) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'dirty'): boolean;
  emit(event: 'dataExpired', payload: DataExpiredPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// PlotDataView (src/plot/PlotDataView.js)
// ════════════════════════════════════════════════════════════════════════

export interface PlotDataViewOptions {
  roiController?: ROIController | null;
}

export interface HistogramOptions {
  /** 'x' | 'y' | 'size' */
  field: 'x' | 'y' | 'size';
  bins: number;
}

export interface HistogramResult {
  counts: Float32Array;
  edges: Float32Array;
}

export interface RecomputedPayload {
  count: number;
}

export class PlotDataView extends EventEmitter {
  constructor(
    source: DataStore | PlotDataView,
    transformFn?: ((data: GPUAttributes) => GPUAttributes) | null,
    opts?: PlotDataViewOptions
  );

  getData(): GPUAttributes;
  markDirty(): void;

  filterByDomain(domain: { x?: Domain; y?: Domain }): PlotDataView;
  filterByROI(roiId: string): PlotDataView;

  histogram(opts: HistogramOptions): HistogramResult;
  snapshot(): GPUAttributes;
  destroy(): void;

  on(event: 'dirty', listener: () => void): this;
  on(event: 'recomputed', listener: (payload: RecomputedPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: 'dirty', listener: () => void): this;
  once(event: 'recomputed', listener: (payload: RecomputedPayload) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'dirty'): boolean;
  emit(event: 'recomputed', payload: RecomputedPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// ROI system (src/plot/ROI/*)
// ════════════════════════════════════════════════════════════════════════

export interface ROIFlags {
  movable?: boolean;
  resizable?: boolean;
  visible?: boolean;
  pickable?: boolean;
  deletable?: boolean;
  [key: string]: boolean | undefined;
}

export interface ROIBounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface ROIDomain {
  x?: Domain;
  y?: Domain;
}

export interface SerializedROI {
  id: string;
  type: string;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  flags?: ROIFlags;
  metadata?: object;
  color?: string | null;
  version: number;
  updatedAt: number;
  domain: ROIDomain;
  parentId?: string | null;
  // LineROI-specific (present only when type === 'lineROI')
  orientation?: 'vertical' | 'horizontal';
  mode?: string;
  position?: number;
  label?: string | null;
}

export interface ROIBaseOptions {
  id?: string;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  flags?: ROIFlags;
  metadata?: object;
  color?: string | null;
  version?: number;
  updatedAt?: number;
  domain?: ROIDomain;
}

export interface ROIUpdatePayload {
  roi: ROIBase;
  bounds: ROIBounds;
}

export class ROIBase extends EventEmitter {
  constructor(opts?: ROIBaseOptions);

  id: string;
  type: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  parent: ROIBase | null;
  children: ROIBase[];
  flags: ROIFlags;
  metadata: object;
  color: string | null;
  version: number;
  updatedAt: number;
  domain: ROIDomain;
  selected: boolean;
  hovered: boolean;

  readonly width: number;
  readonly height: number;

  bumpVersion(): void;
  syncDomain(): void;

  getBounds(): ROIBounds;
  setBounds(bounds: ROIBounds, silent?: boolean): void;

  setParent(parent: ROIBase | null): void;
  addChild(child: ROIBase): void;
  removeChild(child: ROIBase): void;
  walkChildren(fn: (child: ROIBase) => void): void;

  serialize(): SerializedROI;

  onCreate(): void;
  onDelete(): void;

  on(event: 'onCreate' | 'onDelete', listener: (payload: { roi: ROIBase }) => void): this;
  on(event: 'onUpdate', listener: (payload: ROIUpdatePayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: 'onCreate' | 'onDelete', listener: (payload: { roi: ROIBase }) => void): this;
  once(event: 'onUpdate', listener: (payload: ROIUpdatePayload) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'onCreate' | 'onDelete', payload: { roi: ROIBase }): boolean;
  emit(event: 'onUpdate', payload: ROIUpdatePayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface LinearRegionOptions extends ROIBaseOptions {
  /** @default -Infinity (spans full plot height) */
  y1?: number;
  /** @default Infinity */
  y2?: number;
}

export class LinearRegion extends ROIBase {
  constructor(opts?: LinearRegionOptions);
  type: 'linearRegion';

  hitTest(sx: number, sy: number, viewport: ViewportController): 'none' | 'move' | 'left' | 'right';
  applyDelta(handle: 'none' | 'move' | 'left' | 'right', dx: number): void;
}

export interface RectROIOptions extends ROIBaseOptions {
  /** When true, x1/x2 are owned by a parent LinearRegion; left/right handles are hidden. @default false */
  xLocked?: boolean;
}

export type RectROIHandle =
  | 'none'
  | 'move'
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | 'tm'
  | 'bm'
  | 'ml'
  | 'mr';

export class RectROI extends ROIBase {
  constructor(opts?: RectROIOptions);
  type: 'rect';
  xLocked: boolean;

  hitTestHandles(sx: number, sy: number, viewport: ViewportController): RectROIHandle;
  applyDelta(handle: RectROIHandle, dx: number, dy: number): void;
}

export type LineROIMode =
  | 'vline'
  | 'hline'
  | 'vline-half-top'
  | 'vline-half-bottom'
  | 'hline-half-left'
  | 'hline-half-right';

export interface LineROIOptions extends ROIBaseOptions {
  /** @default 'vertical' */
  orientation?: 'vertical' | 'horizontal';
  /** One of the 6 LineROIMode strings (not runtime-validated). @default 'vline' | 'hline' (matches orientation) */
  mode?: LineROIMode | string;
  /** Data coordinate on the primary axis. @default 0 */
  position?: number;
  /** Truncated to 25 chars; only rendered for half-variant modes. @default null */
  label?: string | null;
}

export interface SerializedLineROI extends SerializedROI {
  type: 'lineROI';
  orientation: 'vertical' | 'horizontal';
  mode: string;
  position: number;
  label: string | null;
}

export class LineROI extends ROIBase {
  constructor(opts?: LineROIOptions);
  type: 'lineROI';
  orientation: 'vertical' | 'horizontal';
  mode: string;
  position: number;
  label: string | null;

  hitTest(sx: number, sy: number, viewport: ViewportController): 'none' | 'move';
  applyDelta(handle: 'none' | 'move', dx: number, dy: number): void;
  serialize(): SerializedLineROI;
}

export class ConstraintEngine {
  constructor();
  /**
   * Apply parent-child bound constraints to all descendants of `parent`.
   * @param delta the {dx,dy} the parent itself moved by; pass {dx:0,dy:0} for resize-only ops.
   * @returns the set of descendant ROIs whose bounds actually changed.
   */
  applyConstraints(parent: ROIBase, delta?: { dx: number; dy: number }): Set<ROIBase>;
}

export interface RoisChangedPayload {
  rois: ROIBase[];
}
export interface ROICreatedPayload {
  roi: ROIBase;
  type: 'linearRegion' | 'rect' | 'lineROI';
}
export interface ROIFinalizedPayload {
  roi: ROIBase;
  bounds: ROIBounds;
  version: number;
  updatedAt: number;
  domain: ROIDomain;
}
export interface ROIExternalUpdatePayload {
  roi: ROIBase;
  version: number;
}
export interface ROISelectedPayload {
  roi: ROIBase;
}
export interface ModeChangedPayload {
  mode: 'idle' | 'createLinear' | 'createRect' | 'createVLine' | 'createHLine';
}

export class ROIController extends EventEmitter {
  constructor(viewport: ViewportController);

  init(canvas: HTMLElement): void;
  destroy(): void;

  getAllROIs(): ROIBase[];
  getROI(id: string): ROIBase | undefined;
  addROI(roi: ROIBase): void;
  deleteROI(id: string): void;
  setFlags(id: string, flagsPatch: Partial<ROIFlags>): void;

  serializeAll(): SerializedROI[];
  deserializeAll(array: SerializedROI[]): void;
  updateFromExternal(serializedROI: SerializedROI): boolean;

  enterCreateMode(type: 'linear' | 'rect' | 'vline' | 'hline'): void;
  cancelCreateMode(): void;

  on(event: 'roiCreated', listener: (payload: ROICreatedPayload) => void): this;
  on(event: 'roiUpdated', listener: (payload: ROIUpdatePayload) => void): this;
  on(event: 'roiDeleted', listener: (payload: { id: string }) => void): this;
  on(event: 'roiFinalized', listener: (payload: ROIFinalizedPayload) => void): this;
  on(event: 'roiExternalUpdate', listener: (payload: ROIExternalUpdatePayload) => void): this;
  on(event: 'roisChanged', listener: (payload: RoisChangedPayload) => void): this;
  on(event: 'roiSelected', listener: (payload: ROISelectedPayload) => void): this;
  on(event: 'roiDeselected', listener: (payload: {}) => void): this;
  on(event: 'modeChanged', listener: (payload: ModeChangedPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'roiCreated', payload: ROICreatedPayload): boolean;
  emit(event: 'roiUpdated', payload: ROIUpdatePayload): boolean;
  emit(event: 'roiDeleted', payload: { id: string }): boolean;
  emit(event: 'roiFinalized', payload: ROIFinalizedPayload): boolean;
  emit(event: 'roiExternalUpdate', payload: ROIExternalUpdatePayload): boolean;
  emit(event: 'roisChanged', payload: RoisChangedPayload): boolean;
  emit(event: 'roiSelected', payload: ROISelectedPayload): boolean;
  emit(event: 'roiDeselected', payload: {}): boolean;
  emit(event: 'modeChanged', payload: ModeChangedPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// Layers (src/plot/layers/*, src/plot/LUTHistogramController.js)
// ════════════════════════════════════════════════════════════════════════

export type BitMapping =
  | { bounds: [number, number, number, number]; origin?: never; scale?: never }
  | { origin: [number, number]; scale: [number, number]; bounds?: never };

export type BitmapChannels = 'gray' | 'rgb' | 'rgba' | 'gray+alpha';
export type BitmapDtype = 'float32' | 'float64' | 'uint8' | 'uint16' | 'int16' | 'int32';

/** Duck-typed LUT source — LUTController satisfies this. */
export interface LUTSource {
  getLUTArray(): Uint8Array;
  state: { level_min: number; level_max: number };
}

export interface BitmapDataLayerProps {
  id: string;
  source?: string | ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement | ArrayBufferView | null;
  /** Data-space placement; `bounds` and `origin`+`scale` are mutually exclusive and one is required. */
  bitMapping: BitMapping;
  /** Required for TypedArray sources or bitMapping.origin+scale. */
  width?: number;
  height?: number;
  /** @default 'rgba' */
  channels?: BitmapChannels;
  /** @default 'uint8' */
  dtype?: BitmapDtype;
  lutController?: LUTSource | null;
  /** Increment to force full re-upload + re-colorize. @default 0 */
  dataTrigger?: number;
  /** Increment to force recolorization only. @default 0 */
  colorTrigger?: number;
  /** Pixel-count cap for TypedArray sources. @default 16777216 (4096x4096) */
  maxArrayPixels?: number;
  [key: string]: unknown;
}

export class BitmapDataLayer extends CompositeLayer<BitmapDataLayerProps> {
  static layerName: 'BitmapDataLayer';
  constructor(props: BitmapDataLayerProps);
  renderLayers(): Layer[];
}

export interface BitmapRequest {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  widthPx: number;
  heightPx: number;
  pixelsPerUnitX: number;
  pixelsPerUnitY: number;
}

export interface BitmapGenerateResult {
  source: BitmapDataLayerProps['source'];
  width: number;
  height: number;
  bitMapping?: BitMapping;
}

export interface BitmapViewGeneratorOptions {
  /** Required. Passed to plotController.registerDataLayer(). */
  layerId: string;
  /** Exactly one of generate/fetch is required. */
  generate?: (request: BitmapRequest) => BitmapGenerateResult | Promise<BitmapGenerateResult>;
  /** Exactly one of generate/fetch is required. */
  fetch?: (request: BitmapRequest, signal: AbortSignal) => Promise<BitmapGenerateResult>;
  /** @default 150 */
  debounceMs?: number;
  /** @default 'gray' */
  channels?: BitmapChannels;
  /** @default 'float32' */
  dtype?: BitmapDtype;
  lutController?: LUTSource | null;
  /** Seed bitMapping so the first frame isn't empty. @default null */
  initialBitMapping?: BitMapping | null;
}

export interface BitmapRequestPayload {
  request: BitmapRequest;
}
export interface BitmapRequestCompletePayload {
  request: BitmapRequest;
  durationMs: number;
}
export interface BitmapRequestErrorPayload {
  request: BitmapRequest;
  error: Error;
}

export class BitmapViewGenerator extends EventEmitter {
  constructor(plotController: PlotController, opts: BitmapViewGeneratorOptions);

  setLutController(lutController: LUTSource | null): void;
  bumpColorTrigger(): void;
  refresh(): void;
  destroy(): void;

  on(event: 'requestStart', listener: (payload: BitmapRequestPayload) => void): this;
  on(event: 'requestComplete', listener: (payload: BitmapRequestCompletePayload) => void): this;
  on(event: 'requestError', listener: (payload: BitmapRequestErrorPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'requestStart', payload: BitmapRequestPayload): boolean;
  emit(event: 'requestComplete', payload: BitmapRequestCompletePayload): boolean;
  emit(event: 'requestError', payload: BitmapRequestErrorPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface LUTControllerState {
  level_min: number;
  level_max: number;
  lut: Uint8Array;
  lutName: string;
  histogramBins: Float32Array | null;
  histogramEdges: Float32Array | null;
  globalMin: number;
  globalMax: number;
}

export interface LUTDataChangedPayload {
  bins: Float32Array;
  edges: Float32Array;
  globalMin: number;
  globalMax: number;
}
export interface LUTLevelChangedPayload {
  level_min: number;
  level_max: number;
}

export class LUTController extends EventEmitter {
  /** @default 256 */
  constructor(binCount?: number);

  state: LUTControllerState;
  readonly version: number;
  static readonly presetNames: string[];

  setData(flatArray: ArrayLike<number>, globalMin: number, globalMax: number): void;
  setSpectrogramData(power: ArrayLike<number>, globalMin: number, globalMax: number): void;
  setLevels(min: number, max: number): void;
  setLUT(presetName: string): void;
  /** @default loPct=2, hiPct=98 */
  autoLevel(loPct?: number, hiPct?: number): void;
  getLUTArray(): Uint8Array;
  reset(): void;

  on(event: 'levelChanged', listener: (payload: LUTLevelChangedPayload) => void): this;
  on(event: 'lutChanged', listener: (presetName: string) => void): this;
  on(event: 'dataChanged', listener: (payload: LUTDataChangedPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'levelChanged', payload: LUTLevelChangedPayload): boolean;
  emit(event: 'lutChanged', presetName: string): boolean;
  emit(event: 'dataChanged', payload: LUTDataChangedPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

/** Duck-typed ROI shape consumed by ROILayer (RectROI/LinearRegion/LineROI all satisfy this). */
export interface ROILayerROI {
  id: string;
  type: string;
  selected?: boolean;
  hovered?: boolean;
  color?: [number, number, number] | null;
  flags: ROIFlags;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  orientation?: 'vertical' | 'horizontal';
  mode?: string;
  position?: number;
  xLocked?: boolean;
}

export interface ROILayerProps {
  id: string;
  /** @default [] */
  rois?: ROILayerROI[];
  /** @default 0 */
  plotXMin?: number;
  /** @default 1 */
  plotXMax?: number;
  /** @default 0 */
  plotYMin?: number;
  /** @default 100 */
  plotYMax?: number;
  /** @default false */
  xIsLog?: boolean;
  /** @default false */
  yIsLog?: boolean;
  onROIClick?: ((roi: ROILayerROI) => void) | null;
  [key: string]: unknown;
}

export class ROILayer extends CompositeLayer<ROILayerProps> {
  static layerName: 'ROILayer';
  constructor(props: ROILayerProps);
  renderLayers(): Layer[];
}

export interface ScatterLayerOptions {
  /** @default 'masterplot-scatter' */
  id?: string;
  /** @default false */
  xIsLog?: boolean;
  /** @default false */
  yIsLog?: boolean;
  /** @default 0 */
  dataTrigger?: number;
  /** Arbitrary passthrough/override props merged into the constructed ScatterplotLayer. */
  layerProps?: Record<string, unknown>;
}

export function buildScatterLayer(
  gpuAttrs: GPUAttributes,
  opts?: ScatterLayerOptions
): ScatterplotLayer;

export interface LineLayerOptions {
  /** @default 'masterplot-line' */
  id?: string;
  /** @default [100, 200, 255, 200] */
  color?: RGBAColor;
  /** @default 1 */
  width?: number;
  layerProps?: Record<string, unknown>;
}

export function buildLineLayer(
  gpuAttrs: { x: Float32Array; y: Float32Array },
  opts?: LineLayerOptions
): PathLayer;

export interface PlotLayerProps {
  id: string;
  /** @default [] */
  dataLayers?: Layer[];
  /** Single ROILayer instance, always rendered last when present. @default null */
  roiLayer?: Layer | null;
  [key: string]: unknown;
}

export class PlotLayer extends CompositeLayer<PlotLayerProps> {
  static layerName: 'PlotLayer';
  constructor(props: PlotLayerProps);
  renderLayers(): Layer[];
}

/** {id, build} pair suitable for PlotController.registerDataLayer(id, def.build). */
export interface DataLayerDef {
  id: string;
  build: (ctx: RenderContext) => Layer | Layer[] | null;
}

export interface ResolvedTraceAttrs {
  color: RGBAColor;
  opacity: number;
  size: number;
  [key: string]: unknown;
}

export interface TraceEntry {
  x: Float32Array;
  y: Float32Array;
  size: Float32Array | null;
  count: number;
  capacity: number;
  version: number;
  visible: boolean;
  insertionIndex: number;
}

export interface TraceGroupOptions {
  /** Non-empty array of [R,G,B,A] colors cycled by trace insertion order. Required. */
  palette: RGBAColor[];
  /** Required. Builds a deck.gl layer for one trace. */
  buildLayer: (
    traceId: string,
    traceData: TraceEntry,
    attrs: ResolvedTraceAttrs,
    ctx: unknown
  ) => Layer | null;
  /** Per-tag attribute overrides (highest priority). @default {} */
  traceAttrs?: Record<string, Partial<ResolvedTraceAttrs>>;
  /** Library-wide default overrides (below palette, above built-in defaults). @default {} */
  defaultAttrs?: Partial<ResolvedTraceAttrs>;
}

export interface TraceAppendChunk {
  x: Float32Array | number[];
  y: Float32Array | number[];
  /** Tag per point — assigns each point to a trace. */
  tag: string[] | Uint8Array;
  size?: Float32Array | number[] | null;
}

export class TraceGroup {
  constructor(opts: TraceGroupOptions);

  appendData(chunk: TraceAppendChunk): void;
  setTraceVisible(tag: string, visible: boolean): void;
  getTraceVisible(tag: string): boolean;
  setTraceAttr(tag: string, attrs: Partial<ResolvedTraceAttrs>): void;
  setPalette(palette: RGBAColor[]): void;
  getAllTags(): string[];
  getTrace(tag: string): TraceEntry | undefined;
  resolveAttrs(tag: string): ResolvedTraceAttrs;
  toLayerDef(): DataLayerDef;
}

export interface SignalEntry {
  path: number[][];
  color: RGBAColor;
  layerData: object[] | null;
  version: number;
}

export class SignalStore {
  constructor();

  addSignal(id: string, color: RGBAColor): void;
  getSignal(id: string): SignalEntry | undefined;
  appendSignalData(id: string, yValues: number[] | Float32Array, xBase: number): void;
  advanceXCounter(n: number): void;
  readonly xCounter: number;
  /** Rolling time-window trim — drops leading points with x < xMin, for every signal. */
  trimBefore(xMin: number): void;
  expandDomains(): { xDomain: Domain; yDomain: Domain };
  getPointCount(): number;
  reset(): void;
  toLayerDef(): DataLayerDef;
}

export function buildSignalLayers(signalsMap: Map<string, SignalEntry>): PathLayer[];

export interface LUTHistogramControllerOptions {
  /** Required. The shared LUTController this histogram view mirrors. */
  lutController: LUTController;
  /** @default 256 */
  bins?: number;
}

export class LUTHistogramController {
  constructor(opts: LUTHistogramControllerOptions);

  readonly plotController: PlotController;

  init(webglCanvas: HTMLCanvasElement, axisCanvas: HTMLCanvasElement): void;
  destroy(): void;
}

// ════════════════════════════════════════════════════════════════════════
// PlotController (src/plot/PlotController.js)
// ════════════════════════════════════════════════════════════════════════

export type MouseAction = 'pan' | 'zoomDrag' | 'rectZoom' | 'none';

export interface MouseButtonsConfig {
  left?: MouseAction;
  middle?: MouseAction;
  right?: MouseAction;
}

/** Context object passed to registerDataLayer's build function on every render. */
export interface RenderContext {
  gpuAttrs: GPUAttributes;
  /** Monotonically increasing counter, bump-on-change for deck.gl updateTriggers. */
  dataTrigger: number;
  xIsLog: boolean;
  yIsLog: boolean;
  xDomain: Domain;
  yDomain: Domain;
  /** The static props passed to registerDataLayer()/updateDataLayerProps(). */
  props: Record<string, unknown>;
}

export interface PlotControllerOptions {
  /** Shared AxisController config instance. If omitted, one is built from xScaleType/xLabel. */
  xAxis?: AxisController;
  yAxis?: AxisController;
  /** Only used when xAxis is not supplied. @default 'linear' */
  xScaleType?: ScaleType;
  /** Only used when yAxis is not supplied. @default 'linear' */
  yScaleType?: ScaleType;
  /** Only applied if the shared/created xAxis has no label yet. */
  xLabel?: string;
  yLabel?: string;

  /** @default [0, 1] */
  xDomain?: Domain;
  /** @default [0, 100] */
  yDomain?: Domain;

  /** F17: inject an external DataStore; if omitted, an owned one is created. */
  dataStore?: DataStore;
  /** F17: inject an external DataView. */
  dataView?: PlotDataView | null;

  /** @default false */
  disableDefaultDataLayer?: boolean;
  /** Disables wheel zoom, right-drag zoom, pan, axis-drag zoom, and the autoscale key. ROI interaction still works. @default false */
  disablePanZoom?: boolean;

  /** F38: partial override, merged over { left: 'pan', middle: 'none', right: 'zoomDrag' }. */
  mouseButtons?: MouseButtonsConfig;

  /** @default true */
  autoExpand?: boolean;
  /** @default false */
  hideXAxis?: boolean;
  /** F34. @default true */
  bordered?: boolean;
  /** Non-'drag' values normalize to 'follow'. @default 'drag' */
  panMode?: 'drag' | 'follow';
  /** Key that triggers autoScale(). null/'' disables the listener. @default ' ' */
  autoScaleKey?: string | null;
  /** ARCH-B: wraps all data layers + ROI layer into a single PlotLayer composite. @default false */
  usePlotLayer?: boolean;
}

export interface DataAppendedPayload {
  count: number;
  total: number;
}
export interface AutoScaledPayload {
  xDomain: Domain;
  yDomain: Domain;
}
export type ZoomChangedPayload =
  | { factor: number; focalDataX: number; focalDataY: number }
  | { factor: number; axis: 'x' | 'y' }
  | { mode: 'rect'; xDomain: Domain; yDomain: Domain };
export interface PanChangedPayload {
  dx: number;
  dy: number;
}

export class PlotController extends EventEmitter {
  constructor(opts?: PlotControllerOptions);

  readonly dataStore: DataStore;
  readonly xAxis: AxisController;
  readonly yAxis: AxisController;
  readonly viewport: ViewportController;
  readonly roiController: ROIController;

  init(webglCanvas: HTMLCanvasElement, axisCanvas: HTMLCanvasElement): void;
  destroy(): void;

  appendData(chunk: DataChunk): void;
  setAutoExpand(enabled: boolean): void;
  setPanMode(mode: 'follow' | 'drag'): void;
  setFollowPanSpeed(speed: number): void;
  setMouseButtons(cfg?: MouseButtonsConfig): void;

  autoScale(): void;
  setHomeDomain(xDomain: Domain | null, yDomain: Domain | null): void;
  setZoom(factor: number, focalScreenX: number, focalScreenY: number): void;

  setDataView(dataView: PlotDataView | null, owns?: boolean): void;
  registerDataLayer(
    id: string,
    buildFn: (ctx: RenderContext) => Layer | Layer[] | null,
    props?: Record<string, unknown>
  ): void;
  unregisterDataLayer(id: string): void;
  updateDataLayerProps(id: string, props: Record<string, unknown>): void;

  markDirty(): void;
  /** v2 placeholder — not yet implemented. */
  exportPNG(options?: { hideAxes?: boolean }): void;

  on(event: 'dataAppended', listener: (payload: DataAppendedPayload) => void): this;
  on(event: 'autoScaled', listener: (payload: AutoScaledPayload) => void): this;
  on(event: 'zoomChanged', listener: (payload: ZoomChangedPayload) => void): this;
  on(event: 'panChanged', listener: (payload: PanChangedPayload) => void): this;
  on(event: 'domainChanged', listener: (payload: DomainChangedPayload) => void): this;
  on(event: 'dataExpired', listener: (payload: DataExpiredPayload) => void): this;
  on(event: 'roiCreated', listener: (payload: ROICreatedPayload) => void): this;
  on(event: 'roiUpdated', listener: (payload: ROIUpdatePayload) => void): this;
  on(event: 'roiDeleted', listener: (payload: { id: string }) => void): this;
  on(event: 'roiFinalized', listener: (payload: ROIFinalizedPayload) => void): this;
  on(event: 'roiExternalUpdate', listener: (payload: ROIExternalUpdatePayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'dataAppended', payload: DataAppendedPayload): boolean;
  emit(event: 'autoScaled', payload: AutoScaledPayload): boolean;
  emit(event: 'zoomChanged', payload: ZoomChangedPayload): boolean;
  emit(event: 'panChanged', payload: PanChangedPayload): boolean;
  emit(event: 'domainChanged', payload: DomainChangedPayload): boolean;
  emit(event: 'dataExpired', payload: DataExpiredPayload): boolean;
  emit(event: 'roiCreated', payload: ROICreatedPayload): boolean;
  emit(event: 'roiUpdated', payload: ROIUpdatePayload): boolean;
  emit(event: 'roiDeleted', payload: { id: string }): boolean;
  emit(event: 'roiFinalized', payload: ROIFinalizedPayload): boolean;
  emit(event: 'roiExternalUpdate', payload: ROIExternalUpdatePayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// Audio (src/audio/*)
// ════════════════════════════════════════════════════════════════════════

export interface AudioLoadedPayload {
  duration: number;
  sampleRate: number;
  samples: Float32Array;
}
export type AudioStateChangedPayload = { state: 'playing' | 'paused' | 'stopped' };
export interface AudioTimeUpdatePayload {
  currentTime: number;
}
export interface AudioTileReadyPayload {
  tileIndex: number;
  power: Float32Array;
  width: number;
  height: number;
  globalMin: number;
  globalMax: number;
  bounds: [number, number, number, number];
}

export type WindowFnName = 'hann' | 'hamming' | 'blackman' | 'rectangular' | string;

export interface ComputeSTFTOptions {
  /** @default 1024 */
  windowSize?: number;
  /** @default windowSize / 2 */
  hopSize?: number;
  /** @default 'hann' */
  windowFn?: WindowFnName;
  /** @default 30 */
  tileWidthSec?: number;
}

export class AudioController extends EventEmitter {
  constructor();

  readonly isPlaying: boolean;
  readonly sampleRate: number;
  readonly duration: number;
  readonly currentTime: number;

  loadFile(arrayBuffer: ArrayBuffer): Promise<void>;
  loadBuffer(samples: Float32Array | ArrayLike<number>, sampleRate: number): Promise<void>;
  appendSamples(newSamples: Float32Array): void;
  setFilterFn(
    fn: ((samples: Float32Array, sampleRate: number) => Float32Array | Promise<Float32Array>) | null | undefined
  ): void;
  getFilteredSamples(): Promise<Float32Array | null>;
  rebuildFilteredBuffer(): Promise<void>;

  play(offsetSec?: number | null): Promise<void>;
  pause(): void;
  stop(): void;
  seek(timeSec: number): void;

  computeSTFT(opts?: ComputeSTFTOptions): Promise<void>;
  setStreamingInterval(ms: number): void;

  destroy(): void;

  on(event: 'loaded', listener: (payload: AudioLoadedPayload) => void): this;
  on(event: 'stateChanged', listener: (payload: AudioStateChangedPayload) => void): this;
  on(event: 'timeUpdate', listener: (payload: AudioTimeUpdatePayload) => void): this;
  on(event: 'tileReady', listener: (payload: AudioTileReadyPayload) => void): this;
  on(event: 'stftComplete', listener: () => void): this;
  on(event: 'streamingTick', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'loaded', payload: AudioLoadedPayload): boolean;
  emit(event: 'stateChanged', payload: AudioStateChangedPayload): boolean;
  emit(event: 'timeUpdate', payload: AudioTimeUpdatePayload): boolean;
  emit(event: 'tileReady', payload: AudioTileReadyPayload): boolean;
  emit(event: 'stftComplete'): boolean;
  emit(event: 'streamingTick'): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export type FilterType = 'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type FilterOrder = 2 | 4 | 6 | 8;

export interface FilterState {
  type: FilterType;
  frequency: number;
  Q: number;
  lowFreq: number;
  highFreq: number;
  order: FilterOrder;
}

export interface FrequencyResponse {
  freqs: Float32Array;
  db: Float32Array;
}

export class FilterController extends EventEmitter {
  constructor();

  state: FilterState;
  static readonly filterTypes: string[];

  setOrder(n: FilterOrder | number): void;
  setType(type: FilterType | string): void;
  setFrequency(freq: number): void;
  setQ(q: number): void;
  setLowHighFreq(lowFreq: number, highFreq: number): void;
  applyToSamples(samples: Float32Array, sampleRate: number): Promise<Float32Array>;
  /** @default nPoints=256, sampleRate=44100 */
  getFrequencyResponse(nPoints?: number, sampleRate?: number): FrequencyResponse | null;

  on(event: 'changed', listener: (payload: FilterState) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'changed', payload: FilterState): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export type PlaybackStateChangedPayload =
  | { state: 'loaded'; duration: number }
  | { state: 'playing' | 'paused' | 'stopped' };

export class PlaybackController extends EventEmitter {
  constructor();

  readonly isPlaying: boolean;
  readonly duration: number;
  readonly currentTime: number;

  loadBuffer(samples: Float32Array, sampleRate: number): Promise<void>;
  play(offset?: number | null): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  destroy(): void;

  on(event: 'stateChanged', listener: (payload: PlaybackStateChangedPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'stateChanged', payload: PlaybackStateChangedPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

// ════════════════════════════════════════════════════════════════════════
// External integration (src/integration/*)
// ════════════════════════════════════════════════════════════════════════

/** Buffer shape accepted by ExternalDataAdapter.replaceData()/appendData(). */
export interface BufferStruct {
  x: Float32Array;
  y: Float32Array;
  /** @default 4.0 px per point */
  size?: Float32Array;
  /** RGBA per point, 4 bytes each. @default opaque white */
  color?: Uint8Array;
}

/**
 * Base contract for external data sources. Subclass and override replaceData()/
 * appendData() — the base implementations throw.
 */
export class ExternalDataAdapter {
  constructor(dataStore: DataStore);
  replaceData(bufferStruct: BufferStruct): void;
  appendData(bufferStruct: BufferStruct): void;
}

/**
 * Base contract for external ROI persistence/sync. Subclass and override
 * load()/save()/subscribe() — the base implementations throw. attach()/detach()
 * are concrete and wire the overridden methods to a ROIController.
 */
export class ExternalROIAdapter {
  constructor(roiController: ROIController);
  load(): Promise<SerializedROI[]>;
  save(serializedROI: SerializedROI): Promise<void>;
  /** Must return an unsubscribe function. */
  subscribe(callback: (roi: SerializedROI) => void): () => void;
  /** Concrete: load() -> deserializeAll(); subscribe() -> updateFromExternal(); wires roiFinalized -> save(). */
  attach(): Promise<void>;
  detach(): void;
}

export interface MockDataAdapterOptions {
  /** @default 500 */
  intervalMs?: number;
  /** @default 100 */
  batchSize?: number;
  /** @default 0 */
  xMin?: number;
  /** @default 100 */
  xMax?: number;
  /** @default 0 */
  yMin?: number;
  /** @default 100 */
  yMax?: number;
}

/** Generates random data on an interval — for demos/testing. */
export class MockDataAdapter extends ExternalDataAdapter {
  constructor(dataStore: DataStore, opts?: MockDataAdapterOptions);
  /** Idempotent — no-op if already running. */
  start(): void;
  stop(): void;
}

export interface MockROIAdapterOptions {
  /** localStorage key. @default 'masterplot_rois' */
  storageKey?: string;
}

/** Persists ROIs to localStorage — for demos/testing. */
export class MockROIAdapter extends ExternalROIAdapter {
  constructor(roiController: ROIController, opts?: MockROIAdapterOptions);
}

// ════════════════════════════════════════════════════════════════════════
// Popup utilities (src/popup/*)
// ════════════════════════════════════════════════════════════════════════

export interface PopupMessage {
  type: string;
  payload: object;
}

export class PopupWindowManager extends EventEmitter {
  constructor();

  readonly isOpen: boolean;

  /** @default windowFeatures='width=520,height=640'. Returns false if blocked by the popup blocker. */
  open(url: string, channelName: string, windowFeatures?: string): boolean;
  send(message: PopupMessage): void;
  close(): void;
  destroy(): void;

  on(event: 'message', listener: (msg: PopupMessage) => void): this;
  on(event: 'closed', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'message', msg: PopupMessage): boolean;
  emit(event: 'closed'): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface UsePopupChannelResult {
  send: (message: object) => void;
  isOpen: boolean;
  /** Opens the popup window (not called automatically on mount). Returns false if blocked. */
  open: () => boolean;
  close: () => void;
}

/** React hook wrapping PopupWindowManager. Creates one manager instance per mount; open() is opt-in. */
export function usePopupChannel(
  url: string,
  channelName: string,
  onMessage: (msg: PopupMessage) => void
): UsePopupChannelResult;

// ════════════════════════════════════════════════════════════════════════
// PlotCanvas (src/components/PlotCanvas.jsx)
// ════════════════════════════════════════════════════════════════════════

export interface PlotCanvasProps {
  /** CSS width. @default '100%' */
  width?: string | number;
  /** CSS height. @default '100%' */
  height?: string | number;
  /** @default 'linear' */
  xScaleType?: ScaleType;
  /** @default 'linear' */
  yScaleType?: ScaleType;
  /** @default [0, 1] */
  xDomain?: Domain;
  /** @default [0, 100] */
  yDomain?: Domain;
  xLabel?: string;
  yLabel?: string;
  /** ARCH-G: shared AxisController config instance. */
  xAxis?: AxisController;
  yAxis?: AxisController;
  /**
   * F34. NOTE: only forwarded to PlotController when truthy — passing
   * `bordered={false}` has no effect (PlotController's own default of
   * `true` applies instead). Set via PlotController opts directly if you
   * need to force it off.
   */
  bordered?: boolean;
  /** F17: optional shared DataStore instance. */
  dataStore?: DataStore;
  onEvent?: (eventName: string, data: object) => void;
  /** Fires once, after controller.init(), before internal event wiring. */
  onInit?: (controller: PlotController) => void;
}

export interface PlotCanvasHandle {
  getController: () => PlotController | null;
  appendData: (chunk: DataChunk) => void;
}

/** React wrapper around PlotController. React owns no plot state — only the two canvas refs. */
export const PlotCanvas: React.ForwardRefExoticComponent<
  PlotCanvasProps & React.RefAttributes<PlotCanvasHandle>
>;
