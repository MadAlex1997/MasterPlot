/**
 * ROIController — handles all ROI interaction (creation, drag, resize, delete).
 *
 * Operates entirely independently of React.  Mouse events come from canvas
 * DOM listeners registered during init().  All state is stored in this class.
 *
 * Screen ↔ Data coordinate conversion:
 *   ViewportController.screenXToData / screenYToData handle this using the
 *   current axis scales.  This means ROI positions are always in data space
 *   and remain valid across zoom/pan operations.
 *
 * Creation modes:
 *   'L' key → LinearRegion creation (2 clicks: x1, x2)
 *   'R' key → RectROI creation (2 clicks: top-left, bottom-right)
 *   'D' key → delete active/selected ROI
 *   Escape  → cancel creation
 *
 * Event flow:
 *   ROIController emits → PlotController listens → re-emits on own EventEmitter
 */

import { EventEmitter } from 'events';
import { RectROI, HANDLES } from './RectROI.js';
import { LinearRegion, LR_HANDLES } from './LinearRegion.js';
import { LineROI, LINE_HANDLE } from './LineROI.js';
import { ConstraintEngine } from './ConstraintEngine.js';

export class ROIController extends EventEmitter {
  /**
   * @param {ViewportController} viewport
   */
  constructor(viewport) {
    super();

    this._viewport       = viewport;
    this._constraintEngine = new ConstraintEngine();

    // All ROIs keyed by id
    this._rois = new Map();

    // Interaction state
    this._mode          = 'idle'; // 'idle' | 'createLinear' | 'createRect'
    this._creationStep  = 0;      // 0 = waiting for first click, 1 = waiting for second
    this._creationData  = null;   // partial bounds during creation

    // Drag/resize state
    this._dragging      = false;
    this._dragROI       = null;   // ROI being dragged
    this._dragHandle    = null;   // handle type
    this._dragStartData = null;   // { dataX, dataY } at mousedown
    this._dragStartBounds = null; // ROI bounds at mousedown

    // Currently selected ROI
    this._activeROI     = null;

    // Canvas reference (set during init)
    this._canvas        = null;

    // Track whether the mouse is currently over this controller's canvas.
    // Used to gate keybinds so only the hovered plot responds.
    this._mouseIsOver   = false;

    // Bound handlers for cleanup
    this._onMouseDown   = this._onMouseDown.bind(this);
    this._onMouseMove   = this._onMouseMove.bind(this);
    this._onMouseUp     = this._onMouseUp.bind(this);
    this._onKeyDown     = this._onKeyDown.bind(this);
    this._onMouseEnter  = () => { this._mouseIsOver = true;  };
    this._onMouseLeave  = () => { this._mouseIsOver = false; };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Attach to canvas and start listening for events.
   * @param {HTMLElement} canvas
   */
  init(canvas) {
    this._canvas = canvas;
    canvas.addEventListener('mousedown',  this._onMouseDown);
    canvas.addEventListener('mousemove',  this._onMouseMove);
    canvas.addEventListener('mouseup',    this._onMouseUp);
    canvas.addEventListener('mouseenter', this._onMouseEnter);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('keydown',    this._onKeyDown);
  }

  destroy() {
    if (this._canvas) {
      this._canvas.removeEventListener('mousedown',  this._onMouseDown);
      this._canvas.removeEventListener('mousemove',  this._onMouseMove);
      this._canvas.removeEventListener('mouseup',    this._onMouseUp);
      this._canvas.removeEventListener('mouseenter', this._onMouseEnter);
      this._canvas.removeEventListener('mouseleave', this._onMouseLeave);
    }
    window.removeEventListener('keydown', this._onKeyDown);
  }

  // ─── Public ROI management ───────────────────────────────────────────────────

  getAllROIs() {
    return [...this._rois.values()];
  }

  getROI(id) {
    return this._rois.get(id);
  }

  addROI(roi) {
    this._rois.set(roi.id, roi);
  }

  deleteROI(id) {
    const roi = this._rois.get(id);
    if (!roi) return;

    // Remove children from map recursively
    roi.walkChildren(child => this._rois.delete(child.id));

    roi.onDelete();
    this._rois.delete(id);

    if (this._activeROI && this._activeROI.id === id) {
      this._activeROI = null;
    }

    this.emit('roiDeleted', { id });
    this.emit('roisChanged', { rois: this.getAllROIs() });
  }

  // ─── F14: Serialization API ──────────────────────────────────────────────────

  /**
   * Serialize all ROIs to plain JSON-safe objects.
   * @returns {{ id, type, version, updatedAt, domain, metadata }[]}
   */
  serializeAll() {
    return this.getAllROIs().map(roi => {
      const s = typeof roi.serialize === 'function'
        ? roi.serialize()
        : { id: roi.id, type: roi.type, version: roi.version,
            updatedAt: roi.updatedAt, domain: roi.domain, metadata: roi.metadata };
      s.parentId = roi.parent?.id ?? null;
      return s;
    });
  }

  /**
   * Restore ROIs from a serialized array (initial load only).
   * Clears all existing ROIs; emits 'roisChanged' once.
   * @param {{ id, type, version, updatedAt, domain, metadata }[]} array
   */
  deserializeAll(array) {
    this._rois.clear();
    this._activeROI = null;

    for (const s of array) {
      const roi = this._roiFromSerialized(s);
      if (roi) this._rois.set(roi.id, roi);
    }

    this.emit('roisChanged', { rois: this.getAllROIs() });
  }

  /**
   * Apply an externally-sourced ROI update, gated by version.
   * Rejects silently if incoming.version <= current.version.
   *
   * @param {{ id, type, version, updatedAt, domain, metadata }} serializedROI
   * @returns {boolean} true if accepted, false if rejected
   */
  updateFromExternal(serializedROI) {
    const existing = this._rois.get(serializedROI.id);

    // Reject stale or equal version
    if (existing && serializedROI.version <= existing.version) {
      return false;
    }

    if (existing) {
      // Apply bounds from domain
      if (serializedROI.domain && serializedROI.domain.x) {
        existing.x1 = serializedROI.domain.x[0];
        existing.x2 = serializedROI.domain.x[1];
      }
      if (serializedROI.domain && serializedROI.domain.y) {
        existing.y1 = serializedROI.domain.y[0];
        existing.y2 = serializedROI.domain.y[1];
      }
      // LineROI: sync position from explicit field or from updated bounds
      if (existing.type === 'lineROI') {
        if (serializedROI.position !== undefined) {
          existing.position = serializedROI.position;
          existing._syncBoundsFromPosition();
        } else if (typeof existing._syncPosition === 'function') {
          existing._syncPosition();
        }
        if (serializedROI.label !== undefined) {
          existing.label = serializedROI.label != null
            ? String(serializedROI.label).slice(0, 25)
            : null;
        }
        if (serializedROI.mode !== undefined) existing.mode = serializedROI.mode;
      }
      existing.version   = serializedROI.version;
      existing.updatedAt = serializedROI.updatedAt;
      existing.domain    = serializedROI.domain;
      if (serializedROI.metadata) existing.metadata = serializedROI.metadata;
    } else {
      // ROI not found — create it
      const roi = this._roiFromSerialized(serializedROI);
      if (!roi) return false;
      this._rois.set(roi.id, roi);
    }

    const target = this._rois.get(serializedROI.id);
    this.emit('roiExternalUpdate', { roi: target, version: serializedROI.version });
    this.emit('roisChanged', { rois: this.getAllROIs() });
    return true;
  }

  // ─── Creation mode ────────────────────────────────────────────────────────────

  enterCreateMode(type) {
    this._mode = type === 'linear' ? 'createLinear'
               : type === 'rect'   ? 'createRect'
               : type === 'vline'  ? 'createVLine'
               : type === 'hline'  ? 'createHLine'
               : 'idle';
    this._creationStep = 0;
    this._creationData = null;
    this.emit('modeChanged', { mode: this._mode });
  }

  cancelCreateMode() {
    this._mode         = 'idle';
    this._creationStep = 0;
    this._creationData = null;
    this.emit('modeChanged', { mode: 'idle' });
  }

  // ─── Event handlers ───────────────────────────────────────────────────────────

  _onKeyDown(e) {
    // Only process keybinds when the mouse is over this plot's canvas,
    // so multiple plots on the same page don't all activate simultaneously.
    if (!this._mouseIsOver) return;

    switch (e.key.toLowerCase()) {
      case 'l':
        this.enterCreateMode('linear');
        break;
      case 'r':
        this.enterCreateMode('rect');
        break;
      case 'v':
        this.enterCreateMode('vline');
        break;
      case 'h':
        this.enterCreateMode('hline');
        break;
      case 'd': {
        const target = this._activeROI
          ?? [...this._rois.values()].find(r => r.selected)
          ?? null;
        if (target) this.deleteROI(target.id);
        break;
      }
      case 'escape':
        this.cancelCreateMode();
        break;
      default:
        break;
    }
  }

  _onMouseDown(e) {
    if (e.button !== 0) return; // left button only

    const { dataX, dataY, screenX, screenY } = this._viewport.eventToData(e, this._canvas);

    if (!this._viewport.isInPlotArea(screenX, screenY)) return;

    // ── Creation mode: handle clicks for 2-click workflow ──────────────────
    if (this._mode === 'createLinear') {
      this._handleLinearCreationClick(dataX, dataY);
      return;
    }

    if (this._mode === 'createRect') {
      this._handleRectCreationClick(dataX, dataY);
      return;
    }

    if (this._mode === 'createVLine') {
      this._handleLineROICreationClick(dataX, dataY, 'vertical');
      return;
    }

    if (this._mode === 'createHLine') {
      this._handleLineROICreationClick(dataX, dataY, 'horizontal');
      return;
    }

    // ── Idle mode: check for ROI hit ────────────────────────────────────────
    const hit = this._hitTest(screenX, screenY);

    if (hit) {
      this._activeROI     = hit.roi;
      this._dragging      = true;
      this._dragROI       = hit.roi;
      this._dragHandle    = hit.handle;
      this._dragStartData = { dataX, dataY };
      this._dragStartBounds = hit.roi.getBounds();

      // Deselect all, select hit ROI
      this._selectOnly(hit.roi);
      this.emit('roiSelected', { roi: hit.roi });
    } else {
      // Click on empty space → deselect
      this._deselectAll();
      this._activeROI = null;
      this.emit('roiDeselected', {});
    }
  }

  _onMouseMove(e) {
    const { dataX, dataY, screenX, screenY } = this._viewport.eventToData(e, this._canvas);

    if (this._dragging && this._dragROI) {
      // Compute data-space delta from drag start
      const dx = dataX - this._dragStartData.dataX;
      const dy = dataY - this._dragStartData.dataY;

      const roi = this._dragROI;

      // Restore to start bounds then apply delta (avoids float drift)
      const sb = this._dragStartBounds;
      roi.x1 = sb.x1; roi.x2 = sb.x2;
      roi.y1 = sb.y1; roi.y2 = sb.y2;

      if (roi.type === 'linearRegion') {
        roi.applyDelta(this._dragHandle, dx);
      } else {
        roi.applyDelta(this._dragHandle, dx, dy);
      }

      // Enforce constraints upward (parent might clip this ROI)
      if (roi.parent) {
        // xLocked rects always track parent x bounds exactly
        if (roi.xLocked) {
          roi.x1 = roi.parent.x1;
          roi.x2 = roi.parent.x2;
        } else {
          this._constraintEngine._clampChild(roi, roi.parent);
        }
        // LineROI: write the clamped bound back into position
        if (typeof roi._syncPosition === 'function') {
          roi._syncPosition();
        }
        roi.emit('onUpdate', { roi, bounds: roi.getBounds() });
      }

      // Enforce constraints downward (children follow); collect changed set (F19)
      const delta = roi.type === 'linearRegion'
        ? { dx: roi.x1 - sb.x1, dy: 0 }
        : { dx: roi.x1 - sb.x1, dy: roi.y1 - sb.y1 };

      const changed = this._constraintEngine.applyConstraints(roi, delta);

      // Emit roiUpdated for the active ROI itself
      this.emit('roiUpdated', { roi, bounds: roi.getBounds() });

      // F19: also emit roiUpdated for each child whose bounds actually changed
      changed.forEach(child => {
        this.emit('roiUpdated', { roi: child, bounds: child.getBounds() });
      });

      this.emit('roisChanged', { rois: this.getAllROIs() });
      return;
    }

    // Hover detection (update hovered state for visual feedback)
    for (const roi of this._rois.values()) {
      roi.hovered = false;
    }

    if (this._viewport.isInPlotArea(screenX, screenY)) {
      const hit = this._hitTest(screenX, screenY);
      if (hit) hit.roi.hovered = true;
    }
  }

  _onMouseUp(e) {
    if (this._dragging) {
      const roi = this._dragROI;
      this._dragging      = false;
      this._dragROI       = null;
      this._dragHandle    = null;
      this._dragStartData = null;

      // F14: bump version on commit, emit full versioned payload
      if (roi) {
        roi.bumpVersion();
        this.emit('roiFinalized', {
          roi,
          bounds:    roi.getBounds(),
          version:   roi.version,
          updatedAt: roi.updatedAt,
          domain:    roi.domain,
        });

        // F19: for each descendant whose bounds differ from the last committed
        // domain snapshot, bump its version and emit roiFinalized.
        // Only bumps when bounds actually changed — no false-positive increments.
        roi.walkChildren(child => {
          const d = child.domain;
          const xChanged = child.x1 !== d.x[0] || child.x2 !== d.x[1];
          const yChanged = d.y
            ? (child.y1 !== d.y[0] || child.y2 !== d.y[1])
            : false;

          if (xChanged || yChanged) {
            child.bumpVersion();
            this.emit('roiFinalized', {
              roi:       child,
              bounds:    child.getBounds(),
              version:   child.version,
              updatedAt: child.updatedAt,
              domain:    child.domain,
            });
          }
        });

        this.emit('roisChanged', { rois: this.getAllROIs() });
      }
    }
  }

  // ─── Creation helpers ─────────────────────────────────────────────────────────

  _handleLinearCreationClick(dataX, dataY) {
    if (this._creationStep === 0) {
      this._creationData  = { x1: dataX };
      this._creationStep  = 1;
    } else {
      const { x1 } = this._creationData;
      const x2 = dataX;
      const lr  = new LinearRegion({
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2),
      });

      this._rois.set(lr.id, lr);
      lr.onCreate();
      this._activeROI = lr;
      this._selectOnly(lr);

      this.emit('roiCreated', { roi: lr, type: 'linearRegion' });
      this.emit('roisChanged', { rois: this.getAllROIs() });
      this.cancelCreateMode();
    }
  }

  _handleRectCreationClick(dataX, dataY) {
    if (this._creationStep === 0) {
      this._creationData = { x1: dataX, y1: dataY };
      this._creationStep = 1;
    } else {
      const { x1, y1 } = this._creationData;
      const x2 = dataX;
      const y2 = dataY;

      const rect = new RectROI({
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2),
        y1: Math.min(y1, y2),
        y2: Math.max(y1, y2),
      });

      // Try to parent this rect inside the first LinearRegion it overlaps
      const parent = this._findLinearRegionParent(rect);
      if (parent) {
        rect.setParent(parent);
        // Bind x bounds exactly to the parent LinearRegion
        rect.xLocked = true;
        rect.x1 = parent.x1;
        rect.x2 = parent.x2;
        // Clamp y within parent (no-op for LinearRegion which has ±Infinity y)
        this._constraintEngine._clampChild(rect, parent);
      }

      this._rois.set(rect.id, rect);
      rect.onCreate();
      this._activeROI = rect;
      this._selectOnly(rect);

      this.emit('roiCreated', { roi: rect, type: 'rect' });
      this.emit('roisChanged', { rois: this.getAllROIs() });
      this.cancelCreateMode();
    }
  }

  /**
   * Single-click creation of a LineROI.
   * V key → vertical vline, H key → horizontal hline.
   *
   * Vertical LineROIs are auto-parented to the first LinearRegion whose
   * x-range contains the click position.
   *
   * @param {number} dataX
   * @param {number} dataY
   * @param {'vertical'|'horizontal'} orientation
   */
  _handleLineROICreationClick(dataX, dataY, orientation) {
    const position = orientation === 'vertical' ? dataX : dataY;
    const mode     = orientation === 'vertical' ? 'vline' : 'hline';

    const lineROI = new LineROI({ orientation, mode, position });

    // Auto-parent vertical LineROI inside the first enclosing LinearRegion
    if (orientation === 'vertical') {
      const parent = this._findLineROIParent(lineROI);
      if (parent) lineROI.setParent(parent);
    }

    this._rois.set(lineROI.id, lineROI);
    lineROI.onCreate();
    this._activeROI = lineROI;
    this._selectOnly(lineROI);

    this.emit('roiCreated', { roi: lineROI, type: 'lineROI' });
    this.emit('roisChanged', { rois: this.getAllROIs() });
    this.cancelCreateMode();
  }

  /**
   * Find the first LinearRegion whose x-range contains the LineROI's position.
   * @param {LineROI} lineROI
   * @returns {LinearRegion|null}
   */
  _findLineROIParent(lineROI) {
    for (const roi of this._rois.values()) {
      if (roi.type !== 'linearRegion') continue;
      if (lineROI.position >= roi.x1 && lineROI.position <= roi.x2) {
        return roi;
      }
    }
    return null;
  }

  /**
   * Reconstruct a ROI instance from a serialized object.
   * @param {{ id, type, version, updatedAt, domain, metadata }} s
   * @returns {ROIBase|null}
   */
  _roiFromSerialized(s) {
    let roi;
    if (s.type === 'linearRegion') {
      const [x1, x2] = s.domain.x;
      roi = new LinearRegion({ id: s.id, x1, x2, metadata: s.metadata || {} });
    } else if (s.type === 'rect') {
      const [x1, x2] = s.domain.x;
      const [y1, y2] = s.domain.y;
      roi = new RectROI({ id: s.id, x1, x2, y1, y2, metadata: s.metadata || {} });
    } else if (s.type === 'lineROI') {
      // Recover position: prefer explicit field, fall back to domain
      const position = s.position !== undefined
        ? s.position
        : (s.orientation === 'horizontal'
            ? (s.domain?.y?.[0] ?? 0)
            : (s.domain?.x?.[0] ?? 0));
      roi = new LineROI({
        id:          s.id,
        orientation: s.orientation || 'vertical',
        mode:        s.mode        || (s.orientation === 'horizontal' ? 'hline' : 'vline'),
        position,
        label:       s.label  || null,
        domain:      s.domain || undefined,
        metadata:    s.metadata || {},
      });
    } else {
      return null;
    }
    roi.version   = s.version;
    roi.updatedAt = s.updatedAt;
    roi.domain    = s.domain;
    return roi;
  }

  /**
   * Find the first LinearRegion that contains the given RectROI (by x-overlap).
   */
  _findLinearRegionParent(rect) {
    for (const roi of this._rois.values()) {
      if (roi.type !== 'linearRegion') continue;
      if (rect.x1 >= roi.x1 && rect.x2 <= roi.x2) {
        return roi;
      }
    }
    return null;
  }

  // ─── Hit testing ─────────────────────────────────────────────────────────────

  /**
   * Find the topmost ROI under screen position.
   * @returns {{ roi, handle } | null}
   */
  _hitTest(screenX, screenY) {
    // Iterate in reverse insertion order (later = on top)
    const rois = [...this._rois.values()].reverse();

    for (const roi of rois) {
      if (!roi.flags.visible) continue;

      if (roi.type === 'linearRegion') {
        const handle = roi.hitTest(screenX, screenY, this._viewport);
        if (handle !== LR_HANDLES.NONE) return { roi, handle };
      } else if (roi.type === 'lineROI') {
        const handle = roi.hitTest(screenX, screenY, this._viewport);
        if (handle !== LINE_HANDLE.NONE) return { roi, handle };
      } else {
        const handle = roi.hitTestHandles(screenX, screenY, this._viewport);
        if (handle !== HANDLES.NONE) return { roi, handle };
      }
    }

    return null;
  }

  // ─── Selection helpers ────────────────────────────────────────────────────────

  _selectOnly(target) {
    for (const roi of this._rois.values()) {
      roi.selected = roi === target;
    }
  }

  _deselectAll() {
    for (const roi of this._rois.values()) {
      roi.selected = false;
    }
  }
}

export default ROIController;
