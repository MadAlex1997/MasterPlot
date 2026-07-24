import React from 'react';
import CodeBlock from './shared/CodeBlock';

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionStyle = { marginBottom: 72 };
const classSectionStyle = { marginBottom: 56 };

const h2Style = {
  fontSize: 22,
  fontWeight: 700,
  color: '#fff',
  marginBottom: 20,
  paddingBottom: 10,
  borderBottom: '1px solid #222',
};

const h3Style = {
  fontSize: 17,
  fontWeight: 700,
  color: '#fff',
  margin: '40px 0 6px',
  paddingBottom: 8,
  borderBottom: '1px solid #1e1e1e',
};

const h4Style = {
  fontSize: 14,
  fontWeight: 700,
  color: '#7df',
  margin: '20px 0 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const pStyle = {
  fontSize: 14,
  lineHeight: 1.8,
  color: '#bbb',
  marginBottom: 12,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  marginBottom: 16,
};

const thStyle = {
  background: '#111',
  color: '#7df',
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #2a2a2a',
  fontWeight: 600,
};

const tdStyle = {
  padding: '7px 12px',
  borderBottom: '1px solid #1a1a1a',
  color: '#ccc',
  verticalAlign: 'top',
};

const tdMonoStyle = {
  ...tdStyle,
  fontFamily: 'monospace',
  color: '#fd9',
  fontSize: 12,
};

const tdTypeStyle = {
  ...tdStyle,
  fontFamily: 'monospace',
  color: '#adf',
  fontSize: 12,
};

const calloutStyle = {
  background: '#0e1e14',
  border: '1px solid #1e4a2a',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 13,
  color: '#8ec',
  marginBottom: 16,
  lineHeight: 1.7,
};

const warnCalloutStyle = {
  background: '#1a1400',
  border: '1px solid #4a3a00',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 13,
  color: '#fdb',
  marginBottom: 16,
  lineHeight: 1.7,
};

const inlineCode = { color: '#fd9', fontFamily: 'monospace', fontSize: '0.93em' };

// ── Reusable table components ─────────────────────────────────────────────────

function Th({ children }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ mono, type, children }) {
  const s = mono ? tdMonoStyle : type ? tdTypeStyle : tdStyle;
  return <td style={s}>{children}</td>;
}

// ── Code snippets ─────────────────────────────────────────────────────────────

const BUTTERWORTH_Q_CODE = `// Q_k = 1 / (2 × cos((2k − 1) × π / (2 × N))),  k = 1 … N/2
//
// N=2:  sections=1  →  Q ≈ [0.7071]
// N=4:  sections=2  →  Q ≈ [0.5412, 1.3066]
// N=6:  sections=3  →  Q ≈ [0.5176, 0.7071, 1.9319]
// N=8:  sections=4  →  Q ≈ [0.5098, 0.6013, 0.9000, 2.5629]`;

const TRACE_GROUP_PRIORITY_CODE = `// Attribute resolution priority (highest → lowest):
//   1. traceAttrs[tag]  — per-tag overrides set at construction or via setTraceAttr()
//   2. palette[tag.insertionIndex % palette.length]  — auto-assigned color
//   3. defaultAttrs     — instance-wide defaults below palette
//   4. LIB_DEFAULTS     — { opacity: 1.0, size: 4.0, color: [255,255,255,255] }`;

const SIGNAL_LAYERS_CODE = `// buildSignalLayers is also exported for standalone use:
import { buildSignalLayers } from '../src/plot/layers/SignalDataLayer.js';

// Builds one PathLayer per signal that has ≥2 path points.
// Each PathLayer uses 'pixels' width units and disables picking.`;

// ── PlotController ────────────────────────────────────────────────────────────

function PlotControllerSection() {
  return (
    <section id="plot-controller" style={classSectionStyle}>
      <h3 style={h3Style}>PlotController</h3>
      <p style={pStyle}>
        The central coordinator. Owns all subsystems (DataStore, AxisControllers, ViewportController,
        ROIController, AxisRenderer, deck.gl Deck) and drives the RAF render loop. Extends{' '}
        <code style={inlineCode}>EventEmitter</code>; re-emits all sub-controller events at the
        top level.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { PlotController } from \'../src/plot/PlotController.js\''}</code>
      </p>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>xScaleType</Td><Td type>'linear'|'log'|'time'</Td><Td mono>'linear'</Td><Td>d3 scale type for the X axis</Td></tr>
          <tr><Td mono>yScaleType</Td><Td type>'linear'|'log'|'time'</Td><Td mono>'linear'</Td><Td>d3 scale type for the Y axis</Td></tr>
          <tr><Td mono>xDomain</Td><Td type>number[]</Td><Td mono>[0, 1]</Td><Td>Initial X domain [min, max]</Td></tr>
          <tr><Td mono>yDomain</Td><Td type>number[]</Td><Td mono>[0, 100]</Td><Td>Initial Y domain [min, max]</Td></tr>
          <tr><Td mono>xLabel</Td><Td type>string</Td><Td mono>''</Td><Td>Label text painted beside the X axis</Td></tr>
          <tr><Td mono>yLabel</Td><Td type>string</Td><Td mono>''</Td><Td>Label text painted beside the Y axis</Td></tr>
          <tr><Td mono>panMode</Td><Td type>'follow'|'drag'</Td><Td mono>'drag'</Td><Td>Initial pan mode</Td></tr>
          <tr><Td mono>mouseButtons</Td><Td type>object</Td><Td mono>{'{ left: \'pan\', middle: \'none\', right: \'zoomDrag\' }'}</Td><Td>Button→action map (F38). Values: 'pan', 'zoomDrag' (F6), 'rectZoom' (F37, opt-in), 'none'</Td></tr>
          <tr><Td mono>bordered</Td><Td type>boolean</Td><Td mono>true</Td><Td>Fill axis gutter areas with the container element's CSS backgroundColor before rendering ticks (F34). Disable for transparent/overlay layouts.</Td></tr>
          <tr><Td mono>autoExpand</Td><Td type>boolean</Td><Td mono>true</Td><Td>Expand domain automatically when new data exceeds current bounds</Td></tr>
          <tr><Td mono>autoScaleKey</Td><Td type>string|null</Td><Td mono>' '</Td><Td>Keyboard key that triggers autoScale(); <code style={inlineCode}>null</code> to disable the spacebar binding</Td></tr>
          <tr><Td mono>disableDefaultDataLayer</Td><Td type>boolean</Td><Td mono>false</Td><Td>Omit the built-in scatter layer; register custom layers via registerDataLayer() instead</Td></tr>
          <tr><Td mono>disablePanZoom</Td><Td type>boolean</Td><Td mono>false</Td><Td>Disable wheel zoom and mouse-drag pan/zoom. ROI hit-testing still works. Used by LUTHistogramController to create a read-only histogram viewer.</Td></tr>
          <tr><Td mono>dataStore</Td><Td type>DataStore</Td><Td mono>(auto)</Td><Td>External DataStore; ownership NOT transferred — destroy() will not destroy it</Td></tr>
          <tr><Td mono>dataView</Td><Td type>PlotDataView</Td><Td mono>null</Td><Td>External PlotDataView used as the GPU data source in the render loop; bypasses DataStore when set</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>init(webglCanvas, axisCanvas)</Td><Td mono>void</Td><Td>Initialize deck.gl, AxisRenderer, ROIController, event listeners, and start the RAF loop. Must be called once both canvases are in the DOM.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Remove all DOM and window listeners, cancel the RAF loop, and finalize deck.gl. Destroys owned DataStore/DataView; leaves externally-injected ones alive.</Td></tr>
          <tr><Td mono>appendData(chunk)</Td><Td mono>void</Td><Td>Append <code style={inlineCode}>{'{ x, y, size?, color?, metadata? }'}</code> typed arrays to DataStore. Expands domain if autoExpand is on. Emits 'dataAppended'.</Td></tr>
          <tr><Td mono>setAutoExpand(enabled)</Td><Td mono>void</Td><Td>Toggle whether appendData() widens the visible domain to encompass new data.</Td></tr>
          <tr><Td mono>setPanMode(mode)</Td><Td mono>void</Td><Td>Switch between 'follow' (velocity-based, cursor chases) and 'drag' (cursor-locked) pan modes.</Td></tr>
          <tr><Td mono>setMouseButtons(cfg)</Td><Td mono>void</Td><Td>Remap button→action bindings (F38) at runtime. Partial override of {'{ left, middle, right }'}; cancels any in-progress drag. Unrecognized action names fall back to the default with a console warning.</Td></tr>
          <tr><Td mono>setFollowPanSpeed(speed)</Td><Td mono>void</Td><Td>Set follow-pan velocity scalar. Recommended range 0.005–0.1; values below 0.001 are clamped.</Td></tr>
          <tr><Td mono>autoScale()</Td><Td mono>void</Td><Td>Fit both axes to full data extents (±5 % padding) or to the registered home domain if both x and y are set. Emits 'autoScaled'.</Td></tr>
          <tr><Td mono>setHomeDomain(xDomain, yDomain)</Td><Td mono>void</Td><Td>Register explicit home bounds used by autoScale(). Either argument may be <code style={inlineCode}>null</code> to fall back to data extents for that axis.</Td></tr>
          <tr><Td mono>setZoom(factor, focalScreenX, focalScreenY)</Td><Td mono>void</Td><Td>Zoom both axes around a screen-space focal point. factor {'>'} 1 = zoom in. Emits 'zoomChanged'.</Td></tr>
          <tr><Td mono>setDataView(dataView, owns?)</Td><Td mono>void</Td><Td>Swap the active PlotDataView at runtime, wiring dirty/recomputed events. Pass <code style={inlineCode}>owns=false</code> when sharing a view across controllers.</Td></tr>
          <tr><Td mono>registerDataLayer(id, buildFn, props?)</Td><Td mono>void</Td><Td>Register or replace a data-layer factory. buildFn receives a <code style={inlineCode}>RenderContext</code> and must return a Layer, Layer[], or null. Insertion order = deck.gl stack order.</Td></tr>
          <tr><Td mono>unregisterDataLayer(id)</Td><Td mono>void</Td><Td>Remove a registered layer by id. No-op if not found.</Td></tr>
          <tr><Td mono>updateDataLayerProps(id, props)</Td><Td mono>void</Td><Td>Merge static props forwarded into the RenderContext for an already-registered layer.</Td></tr>
          <tr><Td mono>markDirty()</Td><Td mono>void</Td><Td>Schedule a re-render on the next RAF tick. Call when external state (e.g. TraceGroup visibility) changes outside the DataStore/ROI event chain.</Td></tr>
          <tr><Td mono>exportPNG(options?)</Td><Td mono>void</Td><Td>Placeholder for future high-resolution PNG export; currently logs a warning. Options: hideAxes, resolutionMultiplier.</Td></tr>
        </tbody>
      </table>
      <h4 style={h4Style}>Getters</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Getter</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>dataStore</Td><Td type>DataStore</Td><Td>The owned or injected DataStore.</Td></tr>
          <tr><Td mono>xAxis</Td><Td type>AxisController</Td><Td>Config-only x-axis descriptor (scale type, tick format, label). Domain state lives in viewport.</Td></tr>
          <tr><Td mono>yAxis</Td><Td type>AxisController</Td><Td>Config-only y-axis descriptor. Domain state lives in viewport.</Td></tr>
          <tr><Td mono>viewport</Td><Td type>ViewportController</Td><Td>Coordinate-transform helper and domain owner — use viewport.setXDomain() etc. for all domain mutations (ARCH-G).</Td></tr>
          <tr><Td mono>roiController</Td><Td type>ROIController</Td><Td>The ROI system controller.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>domainChanged</Td><Td mono>{'{ xDomain, yDomain }'}</Td><Td>After any axis domain change (zoom, pan, autoScale, appendData with autoExpand)</Td></tr>
          <tr><Td mono>zoomChanged</Td><Td mono>{'{ factor, focalDataX?, focalDataY?, axis? }'}</Td><Td>After wheel zoom, right-click drag zoom, or axis drag zoom</Td></tr>
          <tr><Td mono>panChanged</Td><Td mono>{'{ dx, dy }'}</Td><Td>Each mousemove during drag pan; also each follow-pan velocity tick</Td></tr>
          <tr><Td mono>dataAppended</Td><Td mono>{'{ count, total }'}</Td><Td>After each appendData() call</Td></tr>
          <tr><Td mono>dataExpired</Td><Td mono>{'{ expired, remaining }'}</Td><Td>After ring-buffer eviction in rolling mode</Td></tr>
          <tr><Td mono>autoScaled</Td><Td mono>{'{ xDomain, yDomain }'}</Td><Td>After autoScale() completes</Td></tr>
          <tr><Td mono>roiCreated</Td><Td mono>{'{ roi, type }'}</Td><Td>New ROI finalized (keyboard/programmatic creation)</Td></tr>
          <tr><Td mono>roiUpdated</Td><Td mono>{'{ roi, bounds }'}</Td><Td>Every mousemove during a drag — high-frequency; throttle in UI handlers</Td></tr>
          <tr><Td mono>roiFinalized</Td><Td mono>{'{ roi, bounds, version, updatedAt, domain }'}</Td><Td>On mouseup — version is committed at this point</Td></tr>
          <tr><Td mono>roiDeleted</Td><Td mono>{'{ id }'}</Td><Td>After deleteROI()</Td></tr>
          <tr><Td mono>roiExternalUpdate</Td><Td mono>{'{ roi, version }'}</Td><Td>After updateFromExternal() accepts an incoming version</Td></tr>
          <tr><Td mono>roiSelected</Td><Td mono>{'{ roi }'}</Td><Td>When a ROI receives a mousedown hit</Td></tr>
          <tr><Td mono>roiDeselected</Td><Td mono>{'{ }'}</Td><Td>When a click lands on empty plot area</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── AxisController ────────────────────────────────────────────────────────────

function AxisControllerSection() {
  return (
    <section id="axis-controller" style={classSectionStyle}>
      <h3 style={h3Style}>AxisController</h3>
      <p style={pStyle}>
        <strong>Config-only</strong> axis descriptor (ARCH-G). Holds scale type, tick formatting,
        and label. No domain state — domain is owned by{' '}
        <code style={inlineCode}>ViewportController</code>. Can be shared across multiple{' '}
        <code style={inlineCode}>PlotController</code> instances so they use the same tick
        rules while maintaining independent domains.
      </p>
      <p style={pStyle}>
        Accessed via <code style={inlineCode}>ctrl.xAxis</code> /{' '}
        <code style={inlineCode}>ctrl.yAxis</code>. Can be constructed and passed in as{' '}
        <code style={inlineCode}>opts.xAxis</code> / <code style={inlineCode}>opts.yAxis</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { AxisController } from \'../src/plot/axes/AxisController.js\''}</code>
      </p>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>scaleType</Td><Td type>'linear'|'log'|'time'</Td><Td mono>'linear'</Td><Td>d3 scale type</Td></tr>
          <tr><Td mono>tickCount</Td><Td type>number</Td><Td mono>5</Td><Td>Approximate target tick count</Td></tr>
          <tr><Td mono>label</Td><Td type>string|null</Td><Td mono>null</Td><Td>Axis label text rendered next to the gutter</Td></tr>
          <tr><Td mono>tickFormat</Td><Td type>fn|null</Td><Td mono>null</Td><Td>Custom tick formatter <code style={inlineCode}>(value, index) =&gt; string</code>; defaults to SI/fixed auto-formatter</Td></tr>
          <tr><Td mono colSpan={4} style={{paddingTop:'0.6em',fontStyle:'italic',color:'#888'}}>F35 — Axis positioning mode</Td></tr>
          <tr><Td mono>mode</Td><Td type>'border'|'relative'</Td><Td mono>'border'</Td><Td>'border' — axis rendered at fixed canvas edges (default). 'relative' — axis line tracks a data coordinate and can snap/hide at edges.</Td></tr>
          <tr><Td mono>edges</Td><Td type>string[]|null</Td><Td mono>null</Td><Td>Border mode only. Which edges to render the axis on, e.g. <code style={inlineCode}>['bottom','top']</code> for mirrored axes. null = renderer default (bottom for x, left for y).</Td></tr>
          <tr><Td mono>crossingValue</Td><Td type>number</Td><Td mono>0</Td><Td>Relative mode only. Data coordinate where the axis line sits (e.g. 0 for an axis at y=0).</Td></tr>
          <tr><Td mono>snapTolerancePx</Td><Td type>number</Td><Td mono>0</Td><Td>Relative mode only. Snap the axis to the nearest edge when within this many pixels of it. 0 = stationary (never snaps).</Td></tr>
          <tr><Td mono>offscreen</Td><Td type>'border'|'hide'</Td><Td mono>'border'</Td><Td>Relative mode only. What to do when crossingValue is outside the visible domain: snap to nearest edge or hide entirely.</Td></tr>
          <tr><Td mono>labelSide</Td><Td type>'auto'|'positive'|'negative'</Td><Td mono>'auto'</Td><Td>Relative mode only. Which side of the axis line to draw tick labels. 'auto' flips at the viewport midpoint.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>getScale(domain, range)</Td><Td type>Function</Td><Td>Build and return a fresh d3 scale with the given domain and range. Does not mutate internal state.</Td></tr>
          <tr><Td mono>getTicks(scale)</Td><Td type>object[]</Td><Td>Generate tick descriptors from a pre-built d3 scale: <code style={inlineCode}>{'{ value, screen, label }[]'}</code>. Count controlled by <code style={inlineCode}>tickCount</code>.</Td></tr>
          <tr><Td mono>formatTick(value, index?)</Td><Td type>string</Td><Td>Format a single tick value as a display string using the configured formatter.</Td></tr>
          <tr><Td mono>getTickSize()</Td><Td type>number</Td><Td>Tick mark length in pixels (default 5).</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Domain mutations have moved to ViewportController (ARCH-G).</strong><br />
        Use <code style={inlineCode}>ctrl.viewport.setXDomain([a, b])</code>,{' '}
        <code style={inlineCode}>ctrl.viewport.getXDomain()</code>,{' '}
        <code style={inlineCode}>ctrl.viewport.zoomAroundX(focal, factor)</code>,{' '}
        <code style={inlineCode}>ctrl.viewport.panByPixels({'{ dx, dy }'})</code>, etc.
        See the <strong>ViewportController</strong> section below.
      </div>
    </section>
  );
}

// ── ViewportController ────────────────────────────────────────────────────────

function ViewportControllerSection() {
  return (
    <section id="viewport-controller" style={classSectionStyle}>
      <h3 style={h3Style}>ViewportController</h3>
      <p style={pStyle}>
        Owns canvas dimensions, coordinate transforms (screen ↔ data), and — after ARCH-G —
        all domain state and zoom/pan mutations. Accessed via{' '}
        <code style={inlineCode}>ctrl.viewport</code>. Extends{' '}
        <code style={inlineCode}>EventEmitter</code>.
      </p>

      <h4 style={h4Style}>Domain methods (ARCH-G)</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>setXDomain([min, max])</Td><Td mono>void</Td><Td>Set x-axis domain; rebuilds scales; emits 'domainChanged'.</Td></tr>
          <tr><Td mono>setYDomain([min, max])</Td><Td mono>void</Td><Td>Set y-axis domain; rebuilds scales; emits 'domainChanged'.</Td></tr>
          <tr><Td mono>setDomains(xDomain, yDomain)</Td><Td mono>void</Td><Td>Set both domains atomically — one scale rebuild, one event. Pass null to skip an axis.</Td></tr>
          <tr><Td mono>getXDomain()</Td><Td type>number[]</Td><Td>Returns copy of current x domain [min, max].</Td></tr>
          <tr><Td mono>getYDomain()</Td><Td type>number[]</Td><Td>Returns copy of current y domain [min, max].</Td></tr>
          <tr><Td mono>zoomAroundX(dataCenter, factor)</Td><Td mono>void</Td><Td>Zoom x domain around a focal data coordinate. factor {'>'} 1 = zoom in. Handles log-space.</Td></tr>
          <tr><Td mono>zoomAroundY(dataCenter, factor)</Td><Td mono>void</Td><Td>Zoom y domain around a focal data coordinate.</Td></tr>
          <tr><Td mono>zoomAround(focalX, focalY, factor)</Td><Td mono>void</Td><Td>Zoom both axes simultaneously — one event emitted.</Td></tr>
          <tr><Td mono>panByPixels({'{ dx?, dy? }'})</Td><Td mono>void</Td><Td>Pan x/y domain by pixel deltas. Sign conventions match legacy AxisController.panByPixels — y range inversion is handled internally.</Td></tr>
          <tr><Td mono>scaleDomainFromMidpointX(factor)</Td><Td mono>void</Td><Td>Midpoint zoom for x — used by F21 axis drag where there is no focal data point.</Td></tr>
          <tr><Td mono>scaleDomainFromMidpointY(factor)</Td><Td mono>void</Td><Td>Midpoint zoom for y.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Coordinate transforms</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>dataXToScreen(dataX)</Td><Td type>number</Td><Td>Data x → canvas pixel x.</Td></tr>
          <tr><Td mono>dataYToScreen(dataY)</Td><Td type>number</Td><Td>Data y → canvas pixel y.</Td></tr>
          <tr><Td mono>screenXToData(screenX)</Td><Td type>number</Td><Td>Canvas pixel x → data x (inverse scale).</Td></tr>
          <tr><Td mono>screenYToData(screenY)</Td><Td type>number</Td><Td>Canvas pixel y → data y.</Td></tr>
          <tr><Td mono>isInPlotArea(screenX, screenY)</Td><Td type>boolean</Td><Td>True when the pixel coordinate is inside the plot area (within margins).</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>domainChanged</Td><Td mono>{'{ xDomain, yDomain }'}</Td><Td>After any domain mutation. PlotController re-emits this on itself.</Td></tr>
          <tr><Td mono>resize</Td><Td mono>{'{ width, height, plotArea }'}</Td><Td>After setCanvasSize(). PlotController calls this on canvas resize.</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── ROIController ─────────────────────────────────────────────────────────────

function ROIControllerSection() {
  return (
    <section id="roi-controller" style={classSectionStyle}>
      <h3 style={h3Style}>ROIController</h3>
      <p style={pStyle}>
        Handles all ROI creation, drag, resize, deletion, serialization, and external sync.
        Operates independently of React — all interaction is wired to DOM canvas listeners.
        Accessed via <code style={inlineCode}>ctrl.roiController</code>.
        Extends <code style={inlineCode}>EventEmitter</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { ROIController } from \'../src/plot/ROI/ROIController.js\''}</code>
      </p>

      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new ROIController(viewport)</code> — takes a single{' '}
        <code style={inlineCode}>ViewportController</code> argument (not an opts object).
        PlotController constructs this automatically; you typically access it via{' '}
        <code style={inlineCode}>ctrl.roiController</code>.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>init(canvas)</Td><Td mono>void</Td><Td>Attach mousedown/mousemove/mouseup/mouseenter/mouseleave to canvas and keydown to window. Called automatically by PlotController.init().</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Remove all canvas and window event listeners.</Td></tr>
          <tr><Td mono>getAllROIs()</Td><Td type>ROIBase[]</Td><Td>Returns all ROIs in insertion order.</Td></tr>
          <tr><Td mono>getROI(id)</Td><Td type>ROIBase|undefined</Td><Td>Look up a single ROI by string id.</Td></tr>
          <tr><Td mono>addROI(roi)</Td><Td mono>void</Td><Td>Add a ROI to the internal map. Does not emit events — call <code style={inlineCode}>roi.onCreate()</code> and emit 'roisChanged' manually afterwards.</Td></tr>
          <tr><Td mono>deleteROI(id)</Td><Td mono>void</Td><Td>Delete ROI and all descendants recursively. No-op if <code style={inlineCode}>flags.deletable === false</code>. Emits 'roiDeleted' then 'roisChanged'.</Td></tr>
          <tr><Td mono>setFlags(id, flagsPatch)</Td><Td mono>void</Td><Td>Merge a patch into <code style={inlineCode}>roi.flags</code> (e.g. <code style={inlineCode}>{'{ movable: false, resizable: false }'}</code> to lock, <code style={inlineCode}>{'{ pickable: false }'}</code> to make click-inert). Does not bump version or emit 'roiFinalized' — flags are behavioural, not geometric. Emits 'roisChanged'.</Td></tr>
          <tr><Td mono>serializeAll()</Td><Td type>object[]</Td><Td>Returns <code style={inlineCode}>{'[{ id, type, version, updatedAt, domain, parentId, metadata, flags }]'}</code> for all ROIs.</Td></tr>
          <tr><Td mono>deserializeAll(array)</Td><Td mono>void</Td><Td>Clear all existing ROIs and restore from a serialized array. Emits 'roisChanged' once.</Td></tr>
          <tr><Td mono>updateFromExternal(serializedROI)</Td><Td type>boolean</Td><Td>Version-gated update: rejects silently if <code style={inlineCode}>incoming.version {'<='} current.version</code>. Emits 'roiExternalUpdate' + 'roisChanged' on accept. Returns true if accepted.</Td></tr>
          <tr><Td mono>enterCreateMode(type)</Td><Td mono>void</Td><Td>Put controller in creation mode: 'linear' (2-click), 'rect' (2-click), 'vline' (1-click), 'hline' (1-click). Emits 'modeChanged'.</Td></tr>
          <tr><Td mono>cancelCreateMode()</Td><Td mono>void</Td><Td>Exit creation mode without placing a ROI. Emits 'modeChanged'.</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Behaviour flags</strong> — every ROI has a <code style={inlineCode}>flags</code>{' '}
        object (<code style={inlineCode}>movable</code>, <code style={inlineCode}>resizable</code>,{' '}
        <code style={inlineCode}>visible</code>, <code style={inlineCode}>pickable</code>,{' '}
        <code style={inlineCode}>deletable</code>) consulted by hit-testing and rendering; see{' '}
        <a href="#roi-deep-dive" style={{ color: '#7df' }}>ROI Deep-Dive — Behaviour Flags</a> for the full effect table.
      </div>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>roiCreated</Td><Td mono>{'{ roi, type }'}</Td><Td>New ROI placed (2nd creation click or addROI + onCreate)</Td></tr>
          <tr><Td mono>roiUpdated</Td><Td mono>{'{ roi, bounds }'}</Td><Td>Every mousemove while dragging — high-frequency</Td></tr>
          <tr><Td mono>roiFinalized</Td><Td mono>{'{ roi, bounds, version, updatedAt, domain }'}</Td><Td>Mouseup — version committed; also fired for changed descendants (F19)</Td></tr>
          <tr><Td mono>roiDeleted</Td><Td mono>{'{ id }'}</Td><Td>After deleteROI()</Td></tr>
          <tr><Td mono>roiExternalUpdate</Td><Td mono>{'{ roi, version }'}</Td><Td>After updateFromExternal() accepts an incoming update</Td></tr>
          <tr><Td mono>roisChanged</Td><Td mono>{'{ rois }'}</Td><Td>After any structural change: create, delete, finalize, external update, or deserialize</Td></tr>
          <tr><Td mono>roiSelected</Td><Td mono>{'{ roi }'}</Td><Td>When a ROI receives a mousedown hit</Td></tr>
          <tr><Td mono>modeChanged</Td><Td mono>{'{ mode }'}</Td><Td>After enterCreateMode() or cancelCreateMode()</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Keyboard Bindings</h4>
      <p style={pStyle}>
        Keybinds fire only when the mouse is over the plot canvas (except D, which works globally
        after a ROI is selected from a table row).
      </p>
      <table style={tableStyle}>
        <thead><tr><Th>Key</Th><Th>Action</Th></tr></thead>
        <tbody>
          <tr><Td mono>L</Td><Td>Enter LinearRegion creation mode (2 clicks: x1, then x2)</Td></tr>
          <tr><Td mono>R</Td><Td>Enter RectROI creation mode (2 clicks: top-left, then bottom-right)</Td></tr>
          <tr><Td mono>V</Td><Td>Enter vertical LineROI creation mode (1 click to place)</Td></tr>
          <tr><Td mono>H</Td><Td>Enter horizontal LineROI creation mode (1 click to place)</Td></tr>
          <tr><Td mono>D</Td><Td>Delete the active/selected ROI (works globally, not canvas-scoped)</Td></tr>
          <tr><Td mono>Escape</Td><Td>Cancel creation mode without placing a ROI</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── DataStore ─────────────────────────────────────────────────────────────────

function DataStoreSection() {
  return (
    <section id="data-store" style={classSectionStyle}>
      <h3 style={h3Style}>DataStore</h3>
      <p style={pStyle}>
        GPU-friendly typed-array buffer manager. Holds parallel{' '}
        <code style={inlineCode}>Float32Array</code> buffers for x, y, size and a{' '}
        <code style={inlineCode}>Uint8Array</code> for RGBA colors. Supports two modes:
        non-rolling (doubling-growth) and rolling ring buffer (fixed capacity).
        Extends <code style={inlineCode}>EventEmitter</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { DataStore } from \'../src/plot/DataStore.js\''}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new DataStore(initialCapacity?)</code> — initialCapacity
        defaults to 65 536 points. Pre-allocates all typed arrays at construction time.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>{'enableRolling({ maxPoints?, maxAgeMs? })'}</Td><Td mono>void</Td><Td>Activate ring-buffer mode. Must be called before any appendData(). At least one limit must be finite. Allocates a <code style={inlineCode}>Float64Array</code> timestamp buffer.</Td></tr>
          <tr><Td mono>expireIfNeeded()</Td><Td mono>void</Td><Td>Advance tailIndex to evict points exceeding maxPoints or maxAgeMs. Emits 'dataExpired' if any were removed. Called automatically by PlotController each RAF tick.</Td></tr>
          <tr><Td mono>appendData(chunk)</Td><Td mono>void</Td><Td>Append <code style={inlineCode}>{'{ x, y, size?, color?, metadata? }'}</code>. Non-rolling: doubling-growth via _grow(). Rolling: writes into ring at headIndex. Emits 'dirty'.</Td></tr>
          <tr><Td mono>getGPUAttributes()</Td><Td type>object</Td><Td>Returns <code style={inlineCode}>{'{ x, y, size, color }'}</code> typed arrays. Non-rolling: zero-copy subarrays. Rolling: ordered copy handling wrap-around.</Td></tr>
          <tr><Td mono>getLogicalData()</Td><Td type>object</Td><Td>Same shape as getGPUAttributes() but always returns correctly-ordered data safe for CPU-side use (domain recalc, histogram, filtering).</Td></tr>
          <tr><Td mono>getPointCount()</Td><Td type>number</Td><Td>Live point count (excludes evicted points in rolling mode).</Td></tr>
          <tr><Td mono>getMetadata(index)</Td><Td type>object|undefined</Td><Td>Per-point JS metadata by numeric index (not GPU-resident).</Td></tr>
          <tr><Td mono>clear()</Td><Td mono>void</Td><Td>Reset count and ring indices to zero without de-allocating typed-array buffers.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>dirty</Td><Td mono>{'{ }'}</Td><Td>After every appendData() call</Td></tr>
          <tr><Td mono>dataExpired</Td><Td mono>{'{ expired, remaining }'}</Td><Td>After expireIfNeeded() removes at least one point</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── PlotDataView ──────────────────────────────────────────────────────────────

function PlotDataViewSection() {
  return (
    <section id="plot-data-view" style={classSectionStyle}>
      <h3 style={h3Style}>PlotDataView</h3>
      <p style={pStyle}>
        Lazily-evaluated, dirty-flag-cached derived view over a DataStore or another
        PlotDataView. Views never mutate their source. Multiple plots may share a single
        PlotDataView — it recomputes only when dirty and only on the first getData() call
        after the flag is set. Extends <code style={inlineCode}>EventEmitter</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { PlotDataView } from \'../src/plot/PlotDataView.js\''}</code>
      </p>

      <h4 style={h4Style}>Constructor</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Parameter</Th><Th>Type</Th><Th>Required</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>source</Td><Td type>DataStore|PlotDataView</Td><Td>yes</Td><Td>Data source; the view listens to its 'dirty' and 'dataExpired' events</Td></tr>
          <tr><Td mono>transformFn</Td><Td type>{'(data) => data'}</Td><Td>no</Td><Td>Transform applied to source data on recompute; null = identity passthrough</Td></tr>
          <tr><Td mono>opts.roiController</Td><Td type>ROIController</Td><Td>no</Td><Td>Required for filterByROI(); also wires dirty propagation on roiFinalized/roiExternalUpdate</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>getData()</Td><Td type>object</Td><Td>Return cached <code style={inlineCode}>{'{ x, y, size, color }'}</code> snapshot, recomputing if dirty. Calling twice without a dirty event returns the same object reference (zero reallocation).</Td></tr>
          <tr><Td mono>markDirty()</Td><Td mono>void</Td><Td>Set the dirty flag and emit 'dirty' so child views cascade automatically.</Td></tr>
          <tr><Td mono>filterByDomain(domain)</Td><Td type>PlotDataView</Td><Td>Return a new child view keeping only points within <code style={inlineCode}>{'{ x?: [min,max], y?: [min,max] }'}</code>. Both bounds are optional.</Td></tr>
          <tr><Td mono>filterByROI(roiId)</Td><Td type>PlotDataView</Td><Td>Return a new child view filtered to points inside the named ROI bounding box. Requires opts.roiController to have been set.</Td></tr>
          <tr><Td mono>{'histogram({ field, bins })'}</Td><Td type>object</Td><Td>Compute <code style={inlineCode}>{'{ counts: Float32Array, edges: Float32Array }'}</code> over field 'x', 'y', or 'size'. edges.length === bins + 1.</Td></tr>
          <tr><Td mono>snapshot()</Td><Td type>object</Td><Td>Deep copy via .slice() on all typed arrays. Mutating the returned object does not affect the internal cache.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Remove all event listeners registered by this view. Must be called when the view is no longer needed to prevent listener leaks.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>dirty</Td><Td mono>{'{ }'}</Td><Td>Emitted by markDirty(); consumed by child views to cascade the dirty flag</Td></tr>
          <tr><Td mono>recomputed</Td><Td mono>{'{ count }'}</Td><Td>Emitted by getData() after a recompute cycle completes</Td></tr>
        </tbody>
      </table>
      <div style={calloutStyle}>
        <strong>Dirty propagation rules:</strong> marks dirty on source 'dirty', source
        'dataExpired', ROIController 'roiFinalized', and 'roiExternalUpdate'. Does{' '}
        <strong>NOT</strong> mark dirty on 'roiUpdated' — drag events must not trigger
        expensive recomputes on every mousemove frame.
      </div>
    </section>
  );
}

// ── TraceGroup ────────────────────────────────────────────────────────────────

function TraceGroupSection() {
  return (
    <section id="trace-group" style={classSectionStyle}>
      <h3 style={h3Style}>TraceGroup</h3>
      <p style={pStyle}>
        Generic multi-trace data layer. Partitions bulk data by a string{' '}
        <code style={inlineCode}>tag</code> field into per-tag{' '}
        <code style={inlineCode}>Float32Array</code> buffers in a single O(n) pass, with
        doubling-growth per tag. Resolves per-trace attributes (color, opacity, size) via a
        configurable palette cycling system. Integrates with PlotController via{' '}
        <code style={inlineCode}>registerDataLayer()</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { TraceGroup } from \'../src/plot/layers/TraceGroup.js\''}</code>
      </p>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Required</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>palette</Td><Td type>Array&lt;[R,G,B,A]&gt;</Td><Td>yes</Td><Td>Color palette cycled by tag insertion order. Each entry is [0-255, 0-255, 0-255, 0-255].</Td></tr>
          <tr><Td mono>buildLayer</Td><Td type>{'(traceId, traceData, attrs, ctx) => Layer|null'}</Td><Td>yes</Td><Td>Factory called once per visible trace inside toLayerDef().build(). Return null to skip a trace.</Td></tr>
          <tr><Td mono>traceAttrs</Td><Td type>{'{ [tag]: attrs }'}</Td><Td>no</Td><Td>Per-tag attribute overrides set at construction time</Td></tr>
          <tr><Td mono>defaultAttrs</Td><Td type>object</Td><Td>no</Td><Td>Instance-wide defaults below palette in the priority chain</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>{'appendData({ x, y, tag, size? })'}</Td><Td mono>void</Td><Td>O(n) partition into per-tag Float32Array buffers. New tags are automatically registered with the next palette slot.</Td></tr>
          <tr><Td mono>setTraceVisible(tag, visible)</Td><Td mono>void</Td><Td>Show or hide a trace. Takes effect on the next RAF tick build() call — no manual markDirty() needed.</Td></tr>
          <tr><Td mono>getTraceVisible(tag)</Td><Td type>boolean</Td><Td>Query current visibility state for a tag.</Td></tr>
          <tr><Td mono>setTraceAttr(tag, attrs)</Td><Td mono>void</Td><Td>Merge per-tag attribute overrides post-construction. Highest priority in the resolution chain.</Td></tr>
          <tr><Td mono>setPalette(palette)</Td><Td mono>void</Td><Td>Replace the palette array. Existing tags keep their insertionIndex; only the color at that index changes.</Td></tr>
          <tr><Td mono>getAllTags()</Td><Td type>string[]</Td><Td>All registered tag strings in insertion order.</Td></tr>
          <tr><Td mono>getTrace(tag)</Td><Td type>TraceEntry|undefined</Td><Td>Raw entry <code style={inlineCode}>{'{ x, y, size, count, capacity, version, visible, insertionIndex }'}</code> for advanced use.</Td></tr>
          <tr><Td mono>resolveAttrs(tag)</Td><Td type>object</Td><Td>Compute final attributes for a tag using the 4-level priority chain (see note below).</Td></tr>
          <tr><Td mono>toLayerDef()</Td><Td type>DataLayerDef</Td><Td>Returns <code style={inlineCode}>{'{ id: \'trace-group\', build }'}</code> for PlotController.registerDataLayer().</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>No events — polled each RAF tick.</strong> PlotController calls build()
        every animation frame. Changes to visibility or attrs take effect on the very next
        frame with no extra wiring required.
      </div>

      <CodeBlock code={TRACE_GROUP_PRIORITY_CODE} language="javascript" />
    </section>
  );
}

// ── SignalStore ───────────────────────────────────────────────────────────────

function SignalStoreSection() {
  return (
    <section id="signal-store" style={classSectionStyle}>
      <h3 style={h3Style}>SignalStore</h3>
      <p style={pStyle}>
        Signal store and PathLayer builder for line/waveform plots. Manages named signals
        as mutable <code style={inlineCode}>path: [x, y, z][]</code> arrays compatible
        with deck.gl <code style={inlineCode}>PathLayer</code>. Integrates with
        PlotController via <code style={inlineCode}>registerDataLayer()</code> using{' '}
        <code style={inlineCode}>disableDefaultDataLayer: true</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { SignalStore, buildSignalLayers } from \'../src/plot/layers/SignalDataLayer.js\''}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new SignalStore()</code> — no parameters.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>addSignal(id, color)</Td><Td mono>void</Td><Td>Register a named signal. <code style={inlineCode}>color = [R, G, B, A]</code> (0-255). Multiple calls with the same id are idempotent.</Td></tr>
          <tr><Td mono>getSignal(id)</Td><Td type>object|undefined</Td><Td>Returns signal internals <code style={inlineCode}>{'{ path, color, layerData, version }'}</code> for advanced/direct access.</Td></tr>
          <tr><Td mono>appendSignalData(id, yValues, xBase)</Td><Td mono>void</Td><Td>Append y-values; x coordinates are assigned as xBase + index. Bumps version to invalidate deck.gl cache.</Td></tr>
          <tr><Td mono>advanceXCounter(n)</Td><Td mono>void</Td><Td>Advance the shared x counter by n. Call after one round of appendSignalData() calls to track the global x cursor.</Td></tr>
          <tr><Td mono>trimBefore(xMin)</Td><Td mono>void</Td><Td>Remove all path points with x {'<'} xMin via binary search. Used to maintain a rolling time window without a ring buffer.</Td></tr>
          <tr><Td mono>expandDomains()</Td><Td type>object</Td><Td>Compute and return <code style={inlineCode}>{'{ xDomain: [0, xMax], yDomain: [yMin-pad, yMax+pad] }'}</code> from current path data.</Td></tr>
          <tr><Td mono>getPointCount()</Td><Td type>number</Td><Td>Total path points summed across all registered signals.</Td></tr>
          <tr><Td mono>reset()</Td><Td mono>void</Td><Td>Clear all signal paths and reset xCounter to 0. Bumps version on all signals so deck.gl detects the change.</Td></tr>
          <tr><Td mono>toLayerDef()</Td><Td type>DataLayerDef</Td><Td>Returns <code style={inlineCode}>{'{ id: \'signal-data\', build }'}</code> for PlotController.registerDataLayer(). Build calls buildSignalLayers() internally.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Getter</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Getter</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>xCounter</Td><Td type>number</Td><Td>Current value of the shared x counter (advanced by advanceXCounter()).</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>No events — polled each RAF tick.</strong> PlotController calls build()
        every animation frame. SignalStore does not extend EventEmitter.
      </div>

      <CodeBlock code={SIGNAL_LAYERS_CODE} language="javascript" />
    </section>
  );
}

// ── FilterController ──────────────────────────────────────────────────────────

function FilterControllerSection() {
  return (
    <section id="filter-controller" style={classSectionStyle}>
      <h3 style={h3Style}>FilterController</h3>
      <p style={pStyle}>
        Manages biquad filter state and provides offline DSP via{' '}
        <code style={inlineCode}>OfflineAudioContext</code>. Supports lowpass, highpass,
        bandpass, and notch filter types with configurable Butterworth cascade order (2–8)
        for LP/HP. Used by the Spectrogram example and exposed to connected popup windows
        via BroadcastChannel. Extends <code style={inlineCode}>EventEmitter</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{'import { FilterController } from \'../src/audio/FilterController.js\''}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new FilterController()</code> — no parameters.
        Initial state: <code style={inlineCode}>type='none'</code>,{' '}
        <code style={inlineCode}>frequency=1000</code>,{' '}
        <code style={inlineCode}>Q=1.0</code>,{' '}
        <code style={inlineCode}>order=2</code>.
      </div>

      <h4 style={h4Style}>State Fields</h4>
      <p style={pStyle}>
        All state lives in <code style={inlineCode}>fc.state</code> — a plain object
        mutated by the setX() methods. You may read fields directly; always use the setX()
        methods to mutate so that 'changed' is emitted.
      </p>
      <table style={tableStyle}>
        <thead><tr><Th>Field</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>type</Td><Td type>string</Td><Td mono>'none'</Td><Td>'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch'</Td></tr>
          <tr><Td mono>frequency</Td><Td type>number</Td><Td mono>1000</Td><Td>Hz — cutoff for LP/HP; auto-computed geometric-mean center for BP/notch</Td></tr>
          <tr><Td mono>Q</Td><Td type>number</Td><Td mono>1.0</Td><Td>Resonance for LP/HP; bandwidth-derived for BP/notch</Td></tr>
          <tr><Td mono>lowFreq</Td><Td type>number</Td><Td mono>500</Td><Td>Hz — user-facing low edge for BP/notch</Td></tr>
          <tr><Td mono>highFreq</Td><Td type>number</Td><Td mono>2000</Td><Td>Hz — user-facing high edge for BP/notch</Td></tr>
          <tr><Td mono>order</Td><Td type>number</Td><Td mono>2</Td><Td>Butterworth cascade order: 2 | 4 | 6 | 8. Applies to LP/HP only; BP/notch always use a single biquad section.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>setType(type)</Td><Td mono>void</Td><Td>Change filter type. Resets frequency/Q to sensible defaults for the new type mode. Emits 'changed'.</Td></tr>
          <tr><Td mono>setFrequency(freq)</Td><Td mono>void</Td><Td>Set cutoff frequency in Hz. Emits 'changed'.</Td></tr>
          <tr><Td mono>setQ(q)</Td><Td mono>void</Td><Td>Set Q / resonance. Emits 'changed'.</Td></tr>
          <tr><Td mono>setOrder(n)</Td><Td mono>void</Td><Td>Set Butterworth cascade order (2 | 4 | 6 | 8). Values outside this set are clamped to 2. LP/HP only. Emits 'changed'.</Td></tr>
          <tr><Td mono>setLowHighFreq(lowFreq, highFreq)</Td><Td mono>void</Td><Td>Set BP/notch edges in Hz. Auto-computes center = √(l × h) and Q = center / (h − l). Emits 'changed'.</Td></tr>
          <tr><Td mono>applyToSamples(samples, sampleRate)</Td><Td type>{'Promise<Float32Array>'}</Td><Td>Offline DSP via OfflineAudioContext. Cascades order/2 biquads for LP/HP. Returns a new Float32Array — input is not mutated. No-op (returns input) when type='none'.</Td></tr>
          <tr><Td mono>getFrequencyResponse(nPoints?, sampleRate?)</Td><Td type>object|null</Td><Td>Returns <code style={inlineCode}>{'{ freqs: Float32Array, db: Float32Array }'}</code> for nPoints (default 256) log-spaced frequencies from 20 Hz to Nyquist. Multiplies per-section linear magnitudes for LP/HP. Returns null when type='none'.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Static</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Name</Th><Th>Value</Th></tr></thead>
        <tbody>
          <tr><Td mono>FilterController.filterTypes</Td><Td mono>['none', 'lowpass', 'highpass', 'bandpass', 'notch']</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>changed</Td><Td mono>{'{ type, frequency, Q, lowFreq, highFreq, order }'}</Td><Td>Emitted by all setX() methods after mutating state</Td></tr>
        </tbody>
      </table>

      <div style={warnCalloutStyle}>
        <strong>Butterworth Q formula</strong> — used internally by{' '}
        <code style={inlineCode}>_butterworthQValues(order)</code> to compute per-section Q
        values for cascaded LP/HP filters:
      </div>
      <CodeBlock code={BUTTERWORTH_Q_CODE} language="javascript" />
    </section>
  );
}

// ── LUTController ─────────────────────────────────────────────────────────────

function LUTControllerSection() {
  return (
    <section id="lut-controller" style={classSectionStyle}>
      <h3 style={h3Style}>LUTController</h3>
      <p style={pStyle}>
        Pure EventEmitter managing a colormap (LUT) and a contrast window (level_min / level_max).
        BitmapDataLayer uses the duck-typed{' '}
        <code style={inlineCode}>{'{ getLUTArray(), state: { level_min, level_max } }'}</code>{' '}
        interface to CPU-colorize TypedArray sources. The <code style={inlineCode}>version</code>{' '}
        getter is a monotonic counter for use as <code style={inlineCode}>colorTrigger</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { LUTController } from '../src/plot/layers/LUTController.js'"}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new LUTController()</code> — no parameters.
        Default preset: <code style={inlineCode}>viridis</code>,{' '}
        levels <code style={inlineCode}>[0, 1]</code>.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>setLUT(presetName)</Td><Td mono>void</Td><Td>Switch colormap. Bumps version, emits 'lutChanged'. See LUTController.presetNames for valid values.</Td></tr>
          <tr><Td mono>setLevels(min, max)</Td><Td mono>void</Td><Td>Set level window. Bumps version, emits 'levelChanged'.</Td></tr>
          <tr><Td mono>autoLevel(loPct?, hiPct?)</Td><Td mono>void</Td><Td>Set levels to the loPct/hiPct percentiles of the histogram (defaults: 2 / 98). Emits 'levelChanged'.</Td></tr>
          <tr><Td mono>setData(flatArray, globalMin, globalMax)</Td><Td mono>void</Td><Td>Feed a flat numeric array (e.g. STFT power Float32Array). Computes a 256-bin histogram and emits 'dataChanged'. Also available as setSpectrogramData() alias.</Td></tr>
          <tr><Td mono>getLUTArray()</Td><Td type>Uint8Array</Td><Td>Returns the current 256×4 RGBA lookup table array.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Getters</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Getter</Th><Th>Type</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>version</Td><Td type>number</Td><Td>Monotonic counter incremented on every levelChanged or lutChanged. Use as colorTrigger for BitmapDataLayer.</Td></tr>
          <tr><Td mono>state</Td><Td type>object</Td><Td>Plain object with level_min, level_max, lutName, globalMin, globalMax, histogramBins, histogramEdges.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Static</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Name</Th><Th>Value</Th></tr></thead>
        <tbody>
          <tr><Td mono>LUTController.presetNames</Td><Td mono>['viridis', 'grayscale', 'plasma', 'inferno', 'magma', 'hot']</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>levelChanged</Td><Td mono>{'{ level_min, level_max }'}</Td><Td>setLevels() or autoLevel()</Td></tr>
          <tr><Td mono>lutChanged</Td><Td mono>presetName (string)</Td><Td>setLUT()</Td></tr>
          <tr><Td mono>dataChanged</Td><Td mono>{'{ bins, edges, globalMin, globalMax }'}</Td><Td>setData() / setSpectrogramData()</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── LUTHistogramController ────────────────────────────────────────────────────

function LUTHistogramControllerSection() {
  return (
    <section id="lut-histogram-controller" style={classSectionStyle}>
      <h3 style={h3Style}>LUTHistogramController</h3>
      <p style={pStyle}>
        Owns an internal read-only <code style={inlineCode}>PlotController</code>{' '}
        (<code style={inlineCode}>disablePanZoom: true</code>) that renders a horizontal histogram bar
        chart driven by a <code style={inlineCode}>LUTController</code>. Two draggable hline LineROIs
        act as level handles — dragging calls <code style={inlineCode}>lutController.setLevels()</code>,
        which recolorizes connected BitmapDataLayers in real time. Intended as the backing controller
        for <code style={inlineCode}>ui/LUTPanel.jsx</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { LUTHistogramController } from '../src/plot/LUTHistogramController.js'"}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>{'new LUTHistogramController({ lutController, bins? })'}</code>.{' '}
        <code style={inlineCode}>bins</code> defaults to 256.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>init(webglCanvas, axisCanvas)</Td><Td mono>void</Td><Td>Initialize the internal PlotController. Call once after both canvases are mounted in the DOM.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Remove all event listeners and destroy the internal PlotController.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Getters</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Getter</Th><Th>Type</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>plotController</Td><Td type>PlotController</Td><Td>The internal read-only PlotController instance.</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── BitmapDataLayer ───────────────────────────────────────────────────────────

function BitmapDataLayerSection() {
  return (
    <section id="bitmap-data-layer" style={classSectionStyle}>
      <h3 style={h3Style}>BitmapDataLayer</h3>
      <p style={pStyle}>
        deck.gl CompositeLayer that renders any 2D image or numeric array as a spatially positioned
        BitmapLayer inside a PlotController. Supports URL, ImageBitmap, ImageData, HTMLCanvasElement,
        and TypedArray sources. TypedArray sources are CPU-colorized via{' '}
        <code style={inlineCode}>_buildBitmapFromGrid()</code> using an optional{' '}
        <code style={inlineCode}>lutController</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { BitmapDataLayer } from '../src/plot/layers/BitmapDataLayer.js'"}</code>
      </p>

      <p style={pStyle}>
        Live demos:{' '}
        <a href="../spectrogram-v2.html" style={{ color: '#7df' }}>Spectrogram V2 (EX-Spec)</a> — tiled STFT tiles as BitmapDataLayers.{' '}
        <a href="../bitmap.html" style={{ color: '#7df' }}>Bitmap Layers (EX16)</a> — local file, generated heatmap, and URL image.
      </p>

      <h4 style={h4Style}>Props</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Prop</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>source</Td><Td type>string | TypedArray | ImageBitmap | …</Td><Td mono>null</Td><Td>Image source. URL strings are passed directly to deck.gl BitmapLayer. TypedArrays are CPU-colorized.</Td></tr>
          <tr><Td mono>bitMapping</Td><Td type>object</Td><Td mono>—</Td><Td>Required. Either <code style={inlineCode}>{'{ bounds: [l,b,r,t] }'}</code> or <code style={inlineCode}>{'{ origin: [x0,y0], scale: [dx,dy] }'}</code>. Mutually exclusive.</Td></tr>
          <tr><Td mono>width</Td><Td type>number</Td><Td mono>0</Td><Td>Image width in pixels. Required for TypedArray sources and origin+scale bitMapping.</Td></tr>
          <tr><Td mono>height</Td><Td type>number</Td><Td mono>0</Td><Td>Image height in pixels. Same requirements as width.</Td></tr>
          <tr><Td mono>channels</Td><Td type>string</Td><Td mono>'rgba'</Td><Td>'gray' | 'rgb' | 'rgba' | 'gray+alpha'</Td></tr>
          <tr><Td mono>dtype</Td><Td type>string</Td><Td mono>'uint8'</Td><Td>'float32' | 'float64' | 'uint8' | 'uint16' | 'int16' | 'int32'</Td></tr>
          <tr><Td mono>lutController</Td><Td type>LUTController | null</Td><Td mono>null</Td><Td>Duck-typed. Applies LUT colorization to gray-channel TypedArray sources.</Td></tr>
          <tr><Td mono>dataTrigger</Td><Td type>number</Td><Td mono>0</Td><Td>Increment to force re-upload and re-colorize. Use when source data changes.</Td></tr>
          <tr><Td mono>colorTrigger</Td><Td type>number</Td><Td mono>0</Td><Td>Increment to force recolorization only (no re-upload). Use lutController.version here.</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── BitmapViewGenerator ───────────────────────────────────────────────────────

function BitmapViewGeneratorSection() {
  return (
    <section id="bitmap-view-generator" style={classSectionStyle}>
      <h3 style={h3Style}>BitmapViewGenerator</h3>
      <p style={pStyle}>
        Viewport-aware controller that re-generates or re-fetches a{' '}
        <code style={inlineCode}>BitmapDataLayer</code> whenever the visible domain changes.
        Extends <code style={inlineCode}>EventEmitter</code>. Automatically registers a layer
        with the provided <code style={inlineCode}>PlotController</code> and subscribes to{' '}
        <code style={inlineCode}>domainChanged</code> events. Requests are debounced to avoid
        thrashing during rapid pan/zoom.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { BitmapViewGenerator } from '../src/plot/layers/BitmapViewGenerator.js'"}</code>
      </p>
      <p style={pStyle}>
        Live demos:{' '}
        <a href="../bitmap-lod.html" style={{ color: '#7df' }}>Bitmap LOD (EX18)</a> — local bilinear
        LOD and URL fetch with AbortSignal cancellation.
      </p>

      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new BitmapViewGenerator(plotController, opts)</code>
        <br />
        Exactly one of <code style={inlineCode}>opts.generate</code> or{' '}
        <code style={inlineCode}>opts.fetch</code> must be provided.
      </div>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>layerId</Td><Td type>string</Td><Td mono>required</Td><Td>ID passed to <code style={inlineCode}>plotController.registerDataLayer()</code>.</Td></tr>
          <tr><Td mono>generate</Td><Td type>async fn</Td><Td mono>—</Td><Td>Local generator. Receives <code style={inlineCode}>request</code> object. Returns <code style={inlineCode}>{'{ source, width, height, bitMapping? }'}</code>. Mutually exclusive with fetch.</Td></tr>
          <tr><Td mono>fetch</Td><Td type>async fn</Td><Td mono>—</Td><Td>Remote fetcher. Receives <code style={inlineCode}>(request, signal)</code>. Returns same shape as generate. AbortSignal passed to cancel stale requests. Mutually exclusive with generate.</Td></tr>
          <tr><Td mono>debounceMs</Td><Td type>number</Td><Td mono>150</Td><Td>Delay after domainChanged before firing the generate/fetch callback.</Td></tr>
          <tr><Td mono>channels</Td><Td type>string</Td><Td mono>'gray'</Td><Td>Forwarded to BitmapDataLayer channels prop.</Td></tr>
          <tr><Td mono>dtype</Td><Td type>string</Td><Td mono>'float32'</Td><Td>Forwarded to BitmapDataLayer dtype prop.</Td></tr>
          <tr><Td mono>lutController</Td><Td type>LUTController|null</Td><Td mono>null</Td><Td>Forwarded to BitmapDataLayer. Use bumpColorTrigger() to recolorize on LUT change.</Td></tr>
          <tr><Td mono>initialBitMapping</Td><Td type>object|null</Td><Td mono>null</Td><Td>Starting bitMapping so the layer renders immediately before the first request completes.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Request Object (passed to generate / fetch)</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Field</Th><Th>Type</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>xMin, xMax</Td><Td type>number</Td><Td>Current x domain bounds (data space).</Td></tr>
          <tr><Td mono>yMin, yMax</Td><Td type>number</Td><Td>Current y domain bounds (data space).</Td></tr>
          <tr><Td mono>widthPx</Td><Td type>number</Td><Td>Plot area width in pixels (integer).</Td></tr>
          <tr><Td mono>heightPx</Td><Td type>number</Td><Td>Plot area height in pixels (integer).</Td></tr>
          <tr><Td mono>pixelsPerUnitX</Td><Td type>number</Td><Td>widthPx / (xMax - xMin).</Td></tr>
          <tr><Td mono>pixelsPerUnitY</Td><Td type>number</Td><Td>heightPx / (yMax - yMin).</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>bumpColorTrigger()</Td><Td mono>void</Td><Td>Increment colorTrigger and call markDirty(). Forces BitmapDataLayer to recolorize without re-running the generate/fetch callback. Use when LUT levels or colormap change.</Td></tr>
          <tr><Td mono>setLutController(lut)</Td><Td mono>void</Td><Td>Replace the lutController forwarded to BitmapDataLayer. Call markDirty() separately if an immediate repaint is needed.</Td></tr>
          <tr><Td mono>refresh()</Td><Td mono>void</Td><Td>Force an immediate re-request bypassing the debounce timer.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Unsubscribes from plotController, aborts any inflight fetch request, clears debounce timer, unregisters the layer.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>requestStart</Td><Td mono>{'{ request }'}</Td><Td>Debounce fires and generate/fetch begins.</Td></tr>
          <tr><Td mono>requestComplete</Td><Td mono>{'{ request, durationMs }'}</Td><Td>generate/fetch returned a result and the layer state was updated.</Td></tr>
          <tr><Td mono>requestError</Td><Td mono>{'{ request, error }'}</Td><Td>generate/fetch threw an error (AbortError is silently ignored).</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── TableLoaderAdapter ────────────────────────────────────────────────────────

function TableLoaderAdapterSection() {
  return (
    <section id="table-loader-adapter" style={classSectionStyle}>
      <h3 style={h3Style}>TableLoaderAdapter</h3>
      <p style={pStyle}>
        Loads CSV, TSV, or Apache Arrow (<code style={inlineCode}>.arrow</code>) files and streams
        parsed rows into a <code style={inlineCode}>DataStore</code> as typed-array{' '}
        <code style={inlineCode}>bufferStruct</code>s. Extends{' '}
        <code style={inlineCode}>EventEmitter</code>. Located in{' '}
        <code style={inlineCode}>loaders/TableLoaderAdapter.js</code> (not library code — optional
        utility in the <code style={inlineCode}>loaders/</code> directory).
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { TableLoaderAdapter } from '../loaders/TableLoaderAdapter.js'"}</code>
      </p>
      <p style={pStyle}>
        Live demo:{' '}
        <a href="../data-loaders.html" style={{ color: '#7df' }}>Data Loaders (EX19)</a>
      </p>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>x</Td><Td type>string</Td><Td mono>required</Td><Td>Column name to use as X coordinates.</Td></tr>
          <tr><Td mono>y</Td><Td type>string</Td><Td mono>required</Td><Td>Column name to use as Y coordinates.</Td></tr>
          <tr><Td mono>size</Td><Td type>string | number | null</Td><Td mono>4.0</Td><Td>Column name for per-point size, a fixed numeric value, or null to use default.</Td></tr>
          <tr><Td mono>color</Td><Td type>string | fn | null</Td><Td mono>null</Td><Td>Column name, or <code style={inlineCode}>fn(value) → [r,g,b,a]</code>, or null for opaque white.</Td></tr>
          <tr><Td mono>chunkSize</Td><Td type>number</Td><Td mono>50_000</Td><Td>Rows per <code style={inlineCode}>appendData()</code> call; controls streaming granularity.</Td></tr>
          <tr><Td mono>replace</Td><Td type>boolean</Td><Td mono>false</Td><Td>If true, calls <code style={inlineCode}>dataStore.clear()</code> before loading.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>{'async loadFile(file)'}</Td><Td mono>Promise&lt;void&gt;</Td><Td>Parse a <code style={inlineCode}>File</code> object (from input/drop). Loader selected by file extension.</Td></tr>
          <tr><Td mono>{'async loadURL(url, fetchOptions?)'}</Td><Td mono>Promise&lt;void&gt;</Td><Td>Fetch and parse from URL. Loader selected by URL extension.</Td></tr>
          <tr><Td mono>getColumns()</Td><Td mono>string[]</Td><Td>Returns detected column names. Populated after the first successful load.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Clears internal state and nulls dataStore reference.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>loaded</Td><Td mono>{'{ rowCount, columns }'}</Td><Td>All rows loaded and appended to DataStore.</Td></tr>
          <tr><Td mono>chunk</Td><Td mono>{'{ loaded, total }'}</Td><Td>After each <code style={inlineCode}>appendData()</code> call. Use for progress bar updates.</Td></tr>
          <tr><Td mono>parseWarning</Td><Td mono>{'{ message }'}</Td><Td>Null/NaN values replaced with 0, or BigInt precision warning.</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Supported formats:</strong>{' '}
        <code style={inlineCode}>.csv</code> / <code style={inlineCode}>.tsv</code> via{' '}
        <code style={inlineCode}>@loaders.gl/csv</code> CSVLoader;{' '}
        <code style={inlineCode}>.arrow</code> via <code style={inlineCode}>@loaders.gl/arrow</code>{' '}
        ArrowLoader. Parquet is attempted via ArrowLoader with a console warning.
      </div>
    </section>
  );
}

// ── RasterLoaderAdapter ───────────────────────────────────────────────────────

function RasterLoaderAdapterSection() {
  return (
    <section id="raster-loader-adapter" style={classSectionStyle}>
      <h3 style={h3Style}>RasterLoaderAdapter</h3>
      <p style={pStyle}>
        Loads a gridded dataset (NetCDF3 or image file) and registers a{' '}
        <code style={inlineCode}>BitmapDataLayer</code> on a <code style={inlineCode}>PlotController</code>{' '}
        with <code style={inlineCode}>bitMapping.bounds</code> inferred from coordinate arrays (NetCDF)
        or image dimensions. Extends <code style={inlineCode}>EventEmitter</code>. Located in{' '}
        <code style={inlineCode}>loaders/RasterLoaderAdapter.js</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { RasterLoaderAdapter } from '../loaders/RasterLoaderAdapter.js'"}</code>
      </p>
      <p style={pStyle}>
        Live demo:{' '}
        <a href="../data-loaders.html" style={{ color: '#7df' }}>Data Loaders (EX19)</a>
      </p>

      <h4 style={h4Style}>Constructor Options</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Option</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>layerId</Td><Td type>string</Td><Td mono>'raster'</Td><Td>Layer ID passed to <code style={inlineCode}>plotController.registerDataLayer()</code>.</Td></tr>
          <tr><Td mono>variable</Td><Td type>string | null</Td><Td mono>null</Td><Td>NetCDF variable name to display. Auto-detected (first non-coordinate variable) if null.</Td></tr>
          <tr><Td mono>xDim</Td><Td type>string</Td><Td mono>'lon'</Td><Td>NetCDF dimension name for the X axis.</Td></tr>
          <tr><Td mono>yDim</Td><Td type>string</Td><Td mono>'lat'</Td><Td>NetCDF dimension name for the Y axis.</Td></tr>
          <tr><Td mono>lutController</Td><Td type>LUTController | null</Td><Td mono>null</Td><Td>Forwarded to BitmapDataLayer. Data is also fed to <code style={inlineCode}>setData()</code> for histogram + auto-level.</Td></tr>
          <tr><Td mono>flipY</Td><Td type>boolean</Td><Td mono>true</Td><Td>Flip row order so row-0 = bottom (standard raster convention). Set false if data is already bottom-up.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>{'async loadFile(file)'}</Td><Td mono>Promise&lt;void&gt;</Td><Td>Parses file; routes .nc/.cdf to NetCDFLoader and other extensions to <code style={inlineCode}>createImageBitmap</code>.</Td></tr>
          <tr><Td mono>{'async loadURL(url, fetchOptions?)'}</Td><Td mono>Promise&lt;void&gt;</Td><Td>Fetch and parse from URL.</Td></tr>
          <tr><Td mono>{'loadArray(data, w, h, opts?)'}</Td><Td mono>void</Td><Td>Register directly from a typed array. <code style={inlineCode}>opts.bounds</code> defaults to pixel dimensions.</Td></tr>
          <tr><Td mono>getVariables()</Td><Td mono>string[]</Td><Td>NetCDF variable names (empty for image formats; populated after load).</Td></tr>
          <tr><Td mono>getDimensions()</Td><Td mono>{'{ [varName]: string[] }'}</Td><Td>Dimension names per variable (empty for image formats).</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Unregisters layer and removes LUT listeners.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>loaded</Td><Td mono>{'{ width, height, variable, bounds }'}</Td><Td>Layer registered on PlotController. Use to auto-scale axes.</Td></tr>
          <tr><Td mono>parseWarning</Td><Td mono>{'{ message }'}</Td><Td>Missing coordinate arrays or other non-fatal parse issues.</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>NetCDF note:</strong> Only NetCDF v3 classic format is supported (magic bytes{' '}
        <code style={inlineCode}>CDF</code>). NetCDF4/HDF5 (.nc4) files will throw a parse error.
        For image formats, <code style={inlineCode}>bitMapping.bounds</code> defaults to{' '}
        <code style={inlineCode}>[0, 0, width, height]</code> — set axes manually if geographic
        coordinates are needed.
      </div>
    </section>
  );
}

// ── AudioController ───────────────────────────────────────────────────────────

function AudioControllerSection() {
  return (
    <section id="audio-controller" style={classSectionStyle}>
      <h3 style={h3Style}>AudioController</h3>
      <p style={pStyle}>
        Unified audio management controller. Handles audio loading (file or raw Float32Array),
        playback (play/pause/stop/seek), tiled STFT computation, streaming append with last-tile
        recomputation, and a stateless filter bridge. Extends{' '}
        <code style={inlineCode}>EventEmitter</code>.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import { AudioController } from '../src/audio/AudioController.js'"}</code>
      </p>
      <div style={calloutStyle}>
        <strong>Constructor:</strong>{' '}
        <code style={inlineCode}>new AudioController()</code> — no parameters.
      </div>

      <h4 style={h4Style}>Methods</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Method</Th><Th>Returns</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>loadFile(arrayBuffer)</Td><Td type>Promise&lt;void&gt;</Td><Td>Decode an ArrayBuffer using Web Audio API. Emits 'loaded' when done.</Td></tr>
          <tr><Td mono>loadBuffer(samples, sampleRate)</Td><Td type>Promise&lt;void&gt;</Td><Td>Load directly from a Float32Array. Emits 'loaded' when done.</Td></tr>
          <tr><Td mono>appendSamples(newSamples)</Td><Td mono>void</Td><Td>Extend current buffer (streaming). Starts streaming timer to recompute last STFT tile if computeSTFT() was already called.</Td></tr>
          <tr><Td mono>setFilterFn(fn)</Td><Td mono>void</Td><Td>Set stateless filter transform: <code style={inlineCode}>{'(samples: Float32Array, sr: number) => Float32Array'}</code>. Pass null to clear. Bridge to FilterController: <code style={inlineCode}>{'(s, sr) => filterCtrl.applyToSamples(s, sr)'}</code>.</Td></tr>
          <tr><Td mono>computeSTFT(opts)</Td><Td type>Promise&lt;void&gt;</Td><Td>Compute tiled STFT. opts: windowSize (default 1024), hopSize (default windowSize/2), windowFn ('hann'|'hamming'|'blackman'|'rectangular'), tileWidthSec (default 30). Emits tileReady per tile, stftComplete when done.</Td></tr>
          <tr><Td mono>play(offsetSec?)</Td><Td type>Promise&lt;void&gt;</Td><Td>Start or resume playback. Emits 'stateChanged' playing.</Td></tr>
          <tr><Td mono>pause()</Td><Td mono>void</Td><Td>Pause playback. Saves current offset. Emits 'stateChanged' paused.</Td></tr>
          <tr><Td mono>stop()</Td><Td mono>void</Td><Td>Stop and reset to time 0. Emits 'stateChanged' stopped.</Td></tr>
          <tr><Td mono>seek(timeSec)</Td><Td mono>void</Td><Td>Jump to timeSec. Resumes if was playing.</Td></tr>
          <tr><Td mono>destroy()</Td><Td mono>void</Td><Td>Stop playback, clear timers, close AudioContext, remove all listeners.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Getters</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Getter</Th><Th>Type</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>isPlaying</Td><Td type>boolean</Td><Td>True while playback is active.</Td></tr>
          <tr><Td mono>sampleRate</Td><Td type>number</Td><Td>Sample rate of the loaded audio in Hz.</Td></tr>
          <tr><Td mono>duration</Td><Td type>number</Td><Td>Duration of the loaded audio in seconds.</Td></tr>
          <tr><Td mono>currentTime</Td><Td type>number</Td><Td>Current playback position in seconds.</Td></tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Events</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Event</Th><Th>Payload</Th><Th>When emitted</Th></tr></thead>
        <tbody>
          <tr><Td mono>loaded</Td><Td mono>{'{ duration, sampleRate, samples: Float32Array }'}</Td><Td>loadFile() or loadBuffer() completed</Td></tr>
          <tr><Td mono>stateChanged</Td><Td mono>{'{ state: "playing"|"paused"|"stopped" }'}</Td><Td>play(), pause(), stop()</Td></tr>
          <tr><Td mono>timeUpdate</Td><Td mono>{'{ currentTime }'}</Td><Td>~10 Hz during playback</Td></tr>
          <tr><Td mono>tileReady</Td><Td mono>{'{ tileIndex, power: Float32Array, width, height, globalMin, globalMax, bounds: [tStart, 0, tEnd, nyquist] }'}</Td><Td>Each STFT tile completed during computeSTFT()</Td></tr>
          <tr><Td mono>stftComplete</Td><Td mono>—</Td><Td>All tiles finished</Td></tr>
          <tr><Td mono>streamingTick</Td><Td mono>—</Td><Td>Streaming timer interval; last tile recomputed just before this fires</Td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ── LUTPanel ──────────────────────────────────────────────────────────────────

function LUTPanelSection() {
  return (
    <section id="lut-panel" style={classSectionStyle}>
      <h3 style={h3Style}>LUTPanel</h3>
      <p style={pStyle}>
        Optional React UI component (in <code style={inlineCode}>ui/</code>) that renders a compact
        LUT histogram panel: histogram bars with draggable hline level handles, a 12 px LUT gradient
        strip, a colormap <code style={inlineCode}>{'<select>'}</code>, and an Auto Level button.
        Backed by a <code style={inlineCode}>LUTHistogramController</code> and a{' '}
        <code style={inlineCode}>LUTController</code> — both must be constructed separately and
        passed as props. Users may replace this component with their own UI built on the same
        controller events.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import LUTPanel from '../ui/LUTPanel.jsx'"}</code>
      </p>

      <h4 style={h4Style}>Props</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Prop</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>lutController</Td><Td type>LUTController</Td><Td mono>—</Td><Td>Required. Manages colormap and level window. Drives gradient strip and colormap select.</Td></tr>
          <tr><Td mono>lutHistCtrl</Td><Td type>LUTHistogramController</Td><Td mono>—</Td><Td>Required. Owns the internal PlotController that renders histogram bars and hline handles.</Td></tr>
          <tr><Td mono>width</Td><Td type>number</Td><Td mono>160</Td><Td>Total panel width in pixels (left histogram area + 12 px gradient strip).</Td></tr>
          <tr><Td mono>height</Td><Td type>string|number</Td><Td mono>'100%'</Td><Td>Panel height CSS value. '100%' fills the parent container.</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Usage pattern:</strong> construct <code style={inlineCode}>LUTController</code> and{' '}
        <code style={inlineCode}>LUTHistogramController</code> at module level (outside React), feed
        STFT/heatmap data via <code style={inlineCode}>lutController.setData()</code>, then render{' '}
        <code style={inlineCode}>{'<LUTPanel lutController={lc} lutHistCtrl={lhc} width={160} />'}</code>{' '}
        in a fixed-width sidebar column next to the plot. Level drag is handled entirely via hline
        LineROIs inside the histogram plot — no extra React handlers needed.
      </div>
    </section>
  );
}

// ── HelpOverlay ───────────────────────────────────────────────────────────────

function HelpOverlaySection() {
  return (
    <section id="help-overlay" style={classSectionStyle}>
      <h3 style={h3Style}>HelpOverlay</h3>
      <p style={pStyle}>
        Optional React UI component (in <code style={inlineCode}>ui/</code>) that renders an
        always-visible <code style={inlineCode}>?</code> button and a modal keybind cheatsheet.
        On first page visit (localStorage key absent) the overlay opens automatically. Closing
        it writes the key so it won't re-open on refresh; the <code style={inlineCode}>?</code>{' '}
        button always re-opens it.
      </p>
      <p style={pStyle}>
        Import: <code style={inlineCode}>{"import HelpOverlay from '../ui/HelpOverlay.jsx'"}</code>
      </p>

      <h4 style={h4Style}>Props</h4>
      <table style={tableStyle}>
        <thead><tr><Th>Prop</Th><Th>Type</Th><Th>Required</Th><Th>Description</Th></tr></thead>
        <tbody>
          <tr><Td mono>title</Td><Td type>string</Td><Td>yes</Td><Td>Heading shown at the top of the modal (e.g. 'Scatter / ROI Controls').</Td></tr>
          <tr><Td mono>controls</Td><Td type>{'Array<{ key: string, description: string }>'}</Td><Td>yes</Td><Td>Rows of the keybind table. Each entry has a <code style={inlineCode}>key</code> (displayed in monospace amber) and a <code style={inlineCode}>description</code>.</Td></tr>
          <tr><Td mono>storageKey</Td><Td type>string</Td><Td>yes</Td><Td>localStorage key. Must be unique per page — controls the auto-open-once behaviour.</Td></tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Placement:</strong> render inside the outermost page container (which must have{' '}
        <code style={inlineCode}>position: relative</code>). The <code style={inlineCode}>?</code>{' '}
        button renders inline so it should be placed in a header bar or toolbar. The modal uses{' '}
        <code style={inlineCode}>position: fixed</code> so it always centers in the viewport
        regardless of scroll position.
      </div>
    </section>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function ApiReferencePage() {
  return (
    <section id="api-reference" style={sectionStyle}>
      <h2 style={h2Style}>API Reference</h2>
      <p style={pStyle}>
        One section per class, each with Constructor Options, Methods, and Events tables.
        All classes are plain ES modules — no build magic required.
        For architecture-level context see the{' '}
        <a href="#architecture" style={{ color: '#7df' }}>Architecture</a> page.
      </p>

      <PlotControllerSection />
      <AxisControllerSection />
      <ViewportControllerSection />
      <ROIControllerSection />
      <DataStoreSection />
      <PlotDataViewSection />
      <TraceGroupSection />
      <SignalStoreSection />
      <FilterControllerSection />
      <LUTControllerSection />
      <LUTHistogramControllerSection />
      <BitmapDataLayerSection />
      <BitmapViewGeneratorSection />
      <TableLoaderAdapterSection />
      <RasterLoaderAdapterSection />
      <AudioControllerSection />
      <LUTPanelSection />
      <HelpOverlaySection />
    </section>
  );
}
