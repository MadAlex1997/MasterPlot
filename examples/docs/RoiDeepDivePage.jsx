import React from 'react';
import MermaidDiagram from './shared/MermaidDiagram';
import CodeBlock from './shared/CodeBlock';

// ── Shared styles ─────────────────────────────────────────────────────────────

const sectionStyle = { marginBottom: 72 };

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
  background: '#0d1f2d',
  border: '1px solid #1a4060',
  borderRadius: 6,
  padding: '10px 14px',
  margin: '12px 0',
  fontSize: 13,
  color: '#9cf',
  lineHeight: 1.7,
};

const warnCalloutStyle = {
  ...calloutStyle,
  background: '#1f1a0d',
  border: '1px solid #604010',
  color: '#fca',
};

const preAsciiStyle = {
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: 6,
  padding: '10px 14px',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#9cf',
  overflowX: 'auto',
  lineHeight: 1.5,
  margin: '8px 0 12px',
};

// ── Mermaid diagrams ──────────────────────────────────────────────────────────

const CLASS_HIERARCHY_DIAGRAM = `classDiagram
  class ROIBase {
    +string id
    +string type
    +number x1
    +number x2
    +number y1
    +number y2
    +ROIBase parent
    +ROIBase[] children
    +number version
    +number updatedAt
    +object domain
    +bumpVersion()
    +getBounds()
    +setBounds()
    +walkChildren()
    +onCreate()
    +onDelete()
  }
  class LinearRegion {
    +type = linearRegion
    +bumpVersion()
    +applyDelta()
    +hitTest()
  }
  class RectROI {
    +type = rect
    +boolean xLocked
    +applyDelta()
    +hitTestHandles()
  }
  class LineROI {
    +type = lineROI
    +string orientation
    +string mode
    +number position
    +string label
    +bumpVersion()
    +applyDelta()
    +hitTest()
    +serialize()
    +_syncPosition()
    +_syncBoundsFromPosition()
  }
  ROIBase <|-- LinearRegion
  ROIBase <|-- RectROI
  ROIBase <|-- LineROI
`;

const CONSTRAINT_DRAG_DIAGRAM = `sequenceDiagram
  participant UI as MouseMove
  participant RC as ROIController
  participant ROI as DraggedROI
  participant CE as ConstraintEngine
  participant CHD as Children

  UI->>RC: _onMouseMove(e)
  RC->>ROI: restore bounds to dragStartBounds
  RC->>ROI: applyDelta(handle, dx, dy)
  RC->>CE: applyConstraints(roi, delta)
  CE->>CHD: shift each child by delta
  CE->>CHD: clamp each child within parent bounds
  CE->>CHD: _syncPosition() for LineROI children
  CE-->>RC: Set~ROIBase~ of changed descendants
  RC->>RC: emit roiUpdated (active ROI)
  RC->>RC: emit roiUpdated (each changed child)
  RC->>RC: emit roisChanged
`;

const CONSTRAINT_MOUSEUP_DIAGRAM = `sequenceDiagram
  participant UI as MouseUp
  participant RC as ROIController
  participant ROI as DraggedROI
  participant CHD as Descendants

  UI->>RC: _onMouseUp(e)
  RC->>ROI: bumpVersion()
  RC->>RC: emit roiFinalized (active ROI)
  RC->>ROI: walkChildren(fn)
  ROI->>CHD: for each descendant (depth-first)
  CHD->>CHD: compare bounds vs domain snapshot
  alt bounds differ from domain snapshot
    RC->>CHD: bumpVersion()
    RC->>RC: emit roiFinalized (child)
  end
  RC->>RC: emit roisChanged
`;

// ── Code samples ──────────────────────────────────────────────────────────────

const SERIALIZE_ALL_OUTPUT = `// rc.serializeAll() — example output
[
  {
    id:        'roi_1',
    type:      'linearRegion',
    version:   3,
    updatedAt: 1741300000000,
    domain:    { x: [10, 50] },
    parentId:  null,
    metadata:  {},
  },
  {
    id:          'roi_2',
    type:        'lineROI',
    orientation: 'vertical',
    mode:        'vline-half-bottom',
    position:    25.0,
    label:       'P-wave',
    version:     2,
    updatedAt:   1741300001000,
    domain:      { x: [25, 25] },
    parentId:    'roi_1',
    metadata:    {},
  },
  {
    id:        'roi_3',
    type:      'rect',
    version:   1,
    updatedAt: 1741300002000,
    domain:    { x: [10, 50], y: [20, 80] },
    parentId:  'roi_1',
    metadata:  {},
  },
]`;

const ROUND_TRIP_CODE = `import { ROIController } from './src/plot/ROI/ROIController.js';

const rc = plotController.roiController;

// ── Serialize ─────────────────────────────────────────────────────────────
const snapshot = rc.serializeAll();
// snapshot is a plain JSON-safe array — safe to store or send over the wire
localStorage.setItem('rois', JSON.stringify(snapshot));

// ── Restore (initial load) ────────────────────────────────────────────────
const saved = JSON.parse(localStorage.getItem('rois') ?? '[]');
rc.deserializeAll(saved);  // clears existing ROIs; emits roisChanged once

// ── External update (version-gated) ──────────────────────────────────────
const roi = rc.getROI('roi_2');

const accepted = rc.updateFromExternal({
  id:          roi.id,
  type:        roi.type,
  orientation: roi.orientation,
  mode:        roi.mode,
  position:    42.5,             // new position
  label:       'S-wave',         // updated label
  version:     roi.version + 1,  // MUST be strictly greater
  updatedAt:   Date.now(),
  domain:      { x: [42.5, 42.5] },
  metadata:    roi.metadata,
});

if (accepted) {
  // roi is now at position 42.5, version incremented
  // roiExternalUpdate + roisChanged were emitted
} else {
  // incoming.version <= existing.version — silently rejected
}`;

const BUMP_VERSION_CODE = `// bumpVersion() is called automatically by ROIController on mouseup.
// You rarely call it directly — only when programmatically creating or
// seeding an ROI before adding it to the controller.

const roi = new LineROI({ orientation: 'vertical', mode: 'vline', position: 10 });
roi.bumpVersion();           // sets version=2, updatedAt=now, domain snapshot
rc.addROI(roi);
roi.onCreate();
rc.emit('roisChanged', { rois: rc.getAllROIs() });

// What bumpVersion() does for each type:
// ROIBase / RectROI:   domain = { x: [x1,x2], y: [y1,y2] }
// LinearRegion:        domain = { x: [x1,x2] }   (no y — LinearRegion spans ±Inf y)
// LineROI (vertical):  domain = { x: [pos, pos] }
// LineROI (horizontal):domain = { y: [pos, pos] }`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoiDeepDivePage() {
  return (
    <section id="roi-deep-dive" style={sectionStyle}>
      <h2 style={h2Style}>ROI System Deep-Dive</h2>

      <p style={pStyle}>
        MasterPlot's Region-of-Interest (ROI) system is modelled after pyqtgraph's ROI API.
        All ROIs live in data-space coordinates and are managed by <code>ROIController</code>,
        which operates entirely independently of React. Constraints between parent and child
        ROIs are enforced by <code>ConstraintEngine</code> on every drag tick, and a monotonic
        version counter ensures external updates are never applied out of order.
      </p>

      {/* ── 1. Class Hierarchy ─────────────────────────────────────────────── */}
      <h3 style={h3Style}>1. Class Hierarchy</h3>

      <p style={pStyle}>
        All ROI types extend <code>ROIBase</code>, which provides the common property bag
        (bounds, flags, versioning, tree linkage) and lifecycle events. Subclasses override
        <code> bumpVersion()</code>, <code>applyDelta()</code>, and hit-test methods.
      </p>

      <MermaidDiagram chart={CLASS_HIERARCHY_DIAGRAM} />

      <h4 style={h4Style}>Key properties per class</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Class</th>
            <th style={thStyle}>Notable properties</th>
            <th style={thStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>ROIBase</td>
            <td style={tdStyle}><code>x1 x2 y1 y2</code>, <code>version</code>, <code>updatedAt</code>, <code>domain</code>, <code>parent</code>, <code>children</code>, <code>flags</code></td>
            <td style={tdStyle}>Abstract base; stores bounds in data space</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>LinearRegion</td>
            <td style={tdStyle}><code>x1 x2</code> (y = ±Infinity)</td>
            <td style={tdStyle}>Vertical band; <code>domain</code> omits y; children constrained in x only</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>RectROI</td>
            <td style={tdStyle}><code>x1 x2 y1 y2</code>, <code>xLocked</code></td>
            <td style={tdStyle}><code>xLocked=true</code> when created inside a LinearRegion — x tracks parent exactly</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>LineROI</td>
            <td style={tdStyle}><code>orientation</code>, <code>mode</code>, <code>position</code>, <code>label</code></td>
            <td style={tdStyle}>Single line; <code>flags.resizable = false</code>; bounds kept in sync with <code>position</code></td>
          </tr>
        </tbody>
      </table>

      {/* ── 2. Creation Modes ──────────────────────────────────────────────── */}
      <h3 style={h3Style}>2. Creation Modes</h3>

      <p style={pStyle}>
        ROIController listens for keyboard events on <code>window</code> (scoped to the
        hovered canvas via <code>_mouseIsOver</code>). Most ROI types require one or two
        clicks on the plot canvas to define their geometry.
      </p>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Key</th>
            <th style={thStyle}>ROI Type</th>
            <th style={thStyle}>Clicks</th>
            <th style={thStyle}>Click semantics</th>
            <th style={thStyle}>Auto-parent rule</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>L</td>
            <td style={tdStyle}>LinearRegion</td>
            <td style={tdStyle}>2</td>
            <td style={tdStyle}>Click 1 → x1 &nbsp; Click 2 → x2 (order irrelevant, sorted)</td>
            <td style={tdStyle}>None</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>R</td>
            <td style={tdStyle}>RectROI</td>
            <td style={tdStyle}>2</td>
            <td style={tdStyle}>Click 1 → top-left &nbsp; Click 2 → bottom-right</td>
            <td style={tdStyle}>Auto-parented to the first LinearRegion whose x-range fully contains the rect; <code>xLocked = true</code></td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>V</td>
            <td style={tdStyle}>LineROI (vertical)</td>
            <td style={tdStyle}>1</td>
            <td style={tdStyle}>Single click → position</td>
            <td style={tdStyle}>Auto-parented to the first LinearRegion whose x-range contains the click position</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>H</td>
            <td style={tdStyle}>LineROI (horizontal)</td>
            <td style={tdStyle}>1</td>
            <td style={tdStyle}>Single click → position</td>
            <td style={tdStyle}>None</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>D</td>
            <td style={tdStyle}>—</td>
            <td style={tdStyle}>0</td>
            <td style={tdStyle}>Deletes the active/selected ROI (fires from any canvas)</td>
            <td style={tdStyle}>—</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>Escape</td>
            <td style={tdStyle}>—</td>
            <td style={tdStyle}>0</td>
            <td style={tdStyle}>Cancels any in-progress creation mode</td>
            <td style={tdStyle}>—</td>
          </tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Programmatic creation</strong> — you can bypass keyboard interaction entirely by
        constructing an ROI instance, calling <code>roi.bumpVersion()</code>, then
        <code> rc.addROI(roi)</code> + <code>roi.onCreate()</code> +
        <code> rc.emit('roisChanged', …)</code>. See the MEMORY.md LineROI pattern.
      </div>

      {/* ── 3. LineROI Modes ───────────────────────────────────────────────── */}
      <h3 style={h3Style}>3. LineROI Modes</h3>

      <p style={pStyle}>
        <code>LineROI</code> supports six modes controlling which segment of the line is
        rendered. Half-variant modes render only one side of the midpoint and optionally
        display a text label on the canvas 2D overlay (not in WebGL).
      </p>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Mode</th>
            <th style={thStyle}>Orientation</th>
            <th style={thStyle}>Rendered segment</th>
            <th style={thStyle}>Label supported</th>
            <th style={thStyle}>ASCII sketch</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>vline</td>
            <td style={tdStyle}>vertical</td>
            <td style={tdStyle}>Full plot height</td>
            <td style={tdStyle}>No</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│  |   │
│  |   │
│  |   │
└──────┘`
              }</pre>
            </td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>hline</td>
            <td style={tdStyle}>horizontal</td>
            <td style={tdStyle}>Full plot width</td>
            <td style={tdStyle}>No</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│      │
│──────│
│      │
└──────┘`
              }</pre>
            </td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>vline-half-top</td>
            <td style={tdStyle}>vertical</td>
            <td style={tdStyle}>Midpoint → top edge</td>
            <td style={tdStyle}>Yes (near top)</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│  |   │
│  |   │
│      │
└──────┘`
              }</pre>
            </td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>vline-half-bottom</td>
            <td style={tdStyle}>vertical</td>
            <td style={tdStyle}>Bottom edge → midpoint</td>
            <td style={tdStyle}>Yes (near bottom)</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│      │
│  |   │
│  |   │
└──────┘`
              }</pre>
            </td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>hline-half-left</td>
            <td style={tdStyle}>horizontal</td>
            <td style={tdStyle}>Left edge → midpoint</td>
            <td style={tdStyle}>Yes (near left)</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│      │
│───   │
│      │
└──────┘`
              }</pre>
            </td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>hline-half-right</td>
            <td style={tdStyle}>horizontal</td>
            <td style={tdStyle}>Midpoint → right edge</td>
            <td style={tdStyle}>Yes (near right)</td>
            <td style={tdStyle}>
              <pre style={{ ...preAsciiStyle, margin: 0 }}>{
`┌──────┐
│      │
│   ───│
│      │
└──────┘`
              }</pre>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Label constraint</strong> — labels are capped at 25 characters.
        The <code>LineROI</code> constructor silently truncates longer strings:
        {' '}<code>String(opts.label).slice(0, 25)</code>.
        Labels are ignored for full-line modes (<code>vline</code> / <code>hline</code>).
      </div>

      <div style={calloutStyle}>
        <strong>Bounds convention for LineROI</strong> — the ROIBase x1/x2/y1/y2 fields
        are kept in sync with <code>position</code> so ConstraintEngine can reason about
        them uniformly:
        <br />
        • Vertical: <code>x1 = x2 = position</code>, <code>y1 = -Inf</code>, <code>y2 = +Inf</code>
        <br />
        • Horizontal: <code>y1 = y2 = position</code>, <code>x1 = -Inf</code>, <code>x2 = +Inf</code>
        <br />
        After ConstraintEngine clamps the bounds it calls <code>child._syncPosition()</code>
        to write the clamped bound back into <code>this.position</code>.
      </div>

      {/* ── 4. ConstraintEngine ────────────────────────────────────────────── */}
      <h3 style={h3Style}>4. ConstraintEngine — Drag Sequencing</h3>

      <p style={pStyle}>
        <code>ConstraintEngine</code> is a stateless algorithm class. It is invoked by
        <code> ROIController</code> on every mouse-move tick (drag) and on mouse-up (commit).
        The engine walks descendants depth-first, shifting each child by the parent's delta
        and then clamping it within the parent's bounds. It returns a <code>Set</code> of
        the descendants whose bounds actually changed (numeric comparison), which
        <code> ROIController</code> uses to emit selective events.
      </p>

      <h4 style={h4Style}>During drag (mouse-move)</h4>
      <MermaidDiagram chart={CONSTRAINT_DRAG_DIAGRAM} />

      <h4 style={h4Style}>On commit (mouse-up)</h4>
      <MermaidDiagram chart={CONSTRAINT_MOUSEUP_DIAGRAM} />

      <div style={calloutStyle}>
        <strong>Restore-and-reapply pattern</strong> — on every mouse-move tick,
        ROIController first restores the dragged ROI's bounds to
        <code> dragStartBounds</code> before calling <code>applyDelta()</code>.
        This prevents floating-point drift from accumulating across hundreds of move events.
      </div>

      <div style={calloutStyle}>
        <strong>xLocked children</strong> — a RectROI created inside a LinearRegion gets
        <code> xLocked = true</code>. ConstraintEngine sets its <code>x1 = parent.x1</code>,
        <code> x2 = parent.x2</code> directly instead of clamping, so it always spans the
        full parent width regardless of how the parent is resized.
      </div>

      <div style={warnCalloutStyle}>
        <strong>roiUpdated vs roiFinalized</strong> — <code>roiUpdated</code> fires on
        every mouse-move (high frequency; do not trigger expensive computation here).
        <code> roiFinalized</code> fires only on mouse-up and only for ROIs whose bounds
        actually changed relative to their last committed <code>domain</code> snapshot.
        <code> PlotDataView</code> marks itself dirty on <code>roiFinalized</code>, not on
        <code> roiUpdated</code>.
      </div>

      {/* ── 5. Versioning ──────────────────────────────────────────────────── */}
      <h3 style={h3Style}>5. Versioning</h3>

      <p style={pStyle}>
        Every ROI carries a monotonic <code>version</code> integer, a millisecond
        <code> updatedAt</code> timestamp, and a <code>domain</code> snapshot — a
        JSON-safe object capturing the ROI's committed position. Together these fields
        power external synchronisation: an incoming update is accepted only when its
        version is strictly greater than the current version.
      </p>

      <h4 style={h4Style}>domain snapshot shape per type</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>ROI type</th>
            <th style={thStyle}>domain shape</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>ROIBase / RectROI</td>
            <td style={tdMonoStyle}>{'{ x: [x1, x2], y: [y1, y2] }'}</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>LinearRegion</td>
            <td style={tdMonoStyle}>{'{ x: [x1, x2] }'} <span style={{ color: '#888', fontFamily: 'sans-serif' }}>(no y — spans ±Infinity)</span></td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>LineROI (vertical)</td>
            <td style={tdMonoStyle}>{'{ x: [pos, pos] }'}</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>LineROI (horizontal)</td>
            <td style={tdMonoStyle}>{'{ y: [pos, pos] }'}</td>
          </tr>
        </tbody>
      </table>

      <h4 style={h4Style}>What triggers a version bump</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Event</th>
            <th style={thStyle}>Version bumped?</th>
            <th style={thStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>User finishes dragging an ROI (mouse-up)</td>
            <td style={{ ...tdStyle, color: '#8f8' }}>Yes</td>
            <td style={tdStyle}>Always bumps the dragged ROI; bumps children only when bounds differ from domain snapshot</td>
          </tr>
          <tr>
            <td style={tdStyle}>User is mid-drag (mouse-move)</td>
            <td style={{ ...tdStyle, color: '#f88' }}>No</td>
            <td style={tdStyle}><code>roiUpdated</code> fires instead; no domain snapshot update</td>
          </tr>
          <tr>
            <td style={tdStyle}>ROI created by user (creation mode)</td>
            <td style={{ ...tdStyle, color: '#f88' }}>No</td>
            <td style={tdStyle}>ROI starts at <code>version = 1</code>; bumpVersion is not called at creation</td>
          </tr>
          <tr>
            <td style={tdStyle}>Programmatic creation with <code>roi.bumpVersion()</code></td>
            <td style={{ ...tdStyle, color: '#8f8' }}>Yes</td>
            <td style={tdStyle}>Caller's responsibility when seeding ROIs before adding to controller</td>
          </tr>
          <tr>
            <td style={tdStyle}><code>updateFromExternal()</code> accepted</td>
            <td style={{ ...tdStyle, color: '#f88' }}>No</td>
            <td style={tdStyle}>Version is set directly from <code>serializedROI.version</code> — no increment</td>
          </tr>
          <tr>
            <td style={tdStyle}><code>updateFromExternal()</code> rejected (stale)</td>
            <td style={{ ...tdStyle, color: '#f88' }}>No</td>
            <td style={tdStyle}>Silently ignored; no mutation, no event</td>
          </tr>
          <tr>
            <td style={tdStyle}>Zoom / pan (viewport change)</td>
            <td style={{ ...tdStyle, color: '#f88' }}>No</td>
            <td style={tdStyle}>ROI positions are in data space; zoom/pan does not move ROIs</td>
          </tr>
        </tbody>
      </table>

      <CodeBlock code={BUMP_VERSION_CODE} language="javascript" />

      {/* ── 6. Serialization & External Sync ───────────────────────────────── */}
      <h3 style={h3Style}>6. Serialization &amp; External Sync</h3>

      <p style={pStyle}>
        <code>ROIController</code> provides three methods for persistence and external
        synchronisation. All output is plain JSON — no class instances escape the boundary.
      </p>

      <h4 style={h4Style}>serializeAll() — output shape</h4>
      <CodeBlock code={SERIALIZE_ALL_OUTPUT} language="javascript" />

      <div style={calloutStyle}>
        <strong>parentId</strong> is added by <code>serializeAll()</code> (not stored on the
        ROI itself). Use it when restoring via <code>deserializeAll()</code> to re-establish
        the parent–child tree — the method handles this automatically via
        <code> _roiFromSerialized()</code> for ROI creation, though parent linkage is not
        automatically re-wired in the current implementation; call <code>roi.setParent()</code>
        after deserialization if you need the full tree.
      </div>

      <h4 style={h4Style}>updateFromExternal() — version gating</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Condition</th>
            <th style={thStyle}>Result</th>
            <th style={thStyle}>Events emitted</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}><code>incoming.version &gt; existing.version</code></td>
            <td style={{ ...tdStyle, color: '#8f8' }}>Accepted — bounds, label, metadata updated</td>
            <td style={tdStyle}><code>roiExternalUpdate</code>, <code>roisChanged</code></td>
          </tr>
          <tr>
            <td style={tdStyle}><code>incoming.version &lt;= existing.version</code></td>
            <td style={{ ...tdStyle, color: '#f88' }}>Rejected — no mutation</td>
            <td style={tdStyle}>None</td>
          </tr>
          <tr>
            <td style={tdStyle}>ROI id not found in map</td>
            <td style={{ ...tdStyle, color: '#8f8' }}>Accepted — ROI is created from serialized data</td>
            <td style={tdStyle}><code>roiExternalUpdate</code>, <code>roisChanged</code></td>
          </tr>
        </tbody>
      </table>

      <h4 style={h4Style}>Full round-trip example</h4>
      <CodeBlock code={ROUND_TRIP_CODE} language="javascript" />

      <div style={warnCalloutStyle}>
        <strong>Version discipline</strong> — when submitting an external update you must
        supply <code>version: roi.version + 1</code>. Supplying the same version or a lower
        one will silently drop the update. This design prevents late-arriving network
        messages from overwriting fresher local edits.
      </div>

      {/* ── 7. Behaviour Flags ─────────────────────────────────────────────── */}
      <h3 style={h3Style}>7. Behaviour Flags</h3>

      <p style={pStyle}>
        Every ROI carries a <code>flags</code> object controlling how it responds to user
        interaction. Flags are plain booleans — toggling them does not bump <code>version</code>
        or emit <code>roiFinalized</code>, since they are behavioural state, not geometry.
        Use <code>roiController.setFlags(id, patch)</code> to change them; it merges the patch
        into <code>roi.flags</code> and emits <code>roisChanged</code>.
      </p>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Flag</th>
            <th style={thStyle}>Default</th>
            <th style={thStyle}>Effect when <code>false</code></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>movable</td>
            <td style={tdStyle}><code>true</code></td>
            <td style={tdStyle}>Dragging the ROI body (the MOVE handle) has no effect. The ROI remains selectable/clickable and resize handles (if <code>resizable</code>) still work.</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>resizable</td>
            <td style={tdStyle}><code>true</code></td>
            <td style={tdStyle}>Corner/edge resize handles have no effect. The ROI can still be moved (if <code>movable</code>) and selected.</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>visible</td>
            <td style={tdStyle}><code>true</code></td>
            <td style={tdStyle}>Not rendered by <code>ROILayer</code> and excluded from hit-testing entirely.</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>pickable</td>
            <td style={tdStyle}><code>true</code></td>
            <td style={tdStyle}>ROI becomes fully inert to clicks — excluded from <code>ROIController._hitTest</code> (no select, no drag, no resize, no hover) <em>and</em> the deck.gl fill layer's <code>pickable</code> prop is set to <code>false</code> (no <code>onROIClick</code>, no <code>autoHighlight</code>). The ROI remains visible if <code>visible</code> is true — useful for a reference band that shouldn't intercept clicks meant for ROIs layered on top of it.</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>deletable</td>
            <td style={tdStyle}><code>true</code></td>
            <td style={tdStyle}><code>roiController.deleteROI(id)</code> (including the 'D' keybind) is a no-op.</td>
          </tr>
        </tbody>
      </table>

      <div style={calloutStyle}>
        <strong>Locked vs. non-pickable</strong> — these are different levels of restriction.
        A locked ROI (<code>movable: false, resizable: false</code>) can still be clicked,
        selected, and shown in a table/inspector — it just won't move. A non-pickable ROI
        (<code>pickable: false</code>) is invisible to all click/hover/drag interaction while
        still rendering, as if it were a static background decoration.
      </div>
    </section>
  );
}
