/**
 * AxisRenderer — renders axis ticks, labels, and grid lines to a 2D Canvas overlay.
 *
 * This canvas sits on top of the deck.gl WebGL canvas.  It is styled with
 * pointer-events:none so mouse events pass through to deck.gl.
 *
 * Rendering is triggered by PlotController's render loop (requestAnimationFrame).
 * AxisRenderer does NOT schedule its own rAF — it is called synchronously from
 * PlotController.render().
 */

export class AxisRenderer {
  /**
   * @param {HTMLCanvasElement} canvas  — 2D overlay canvas
   * @param {AxisController}    xAxis
   * @param {AxisController}    yAxis
   * @param {ViewportController} viewport
   */
  constructor(canvas, xAxis, yAxis, viewport) {
    this._canvas   = canvas;
    this._ctx      = canvas.getContext('2d');
    this._xAxis    = xAxis;
    this._yAxis    = yAxis;
    this._viewport = viewport;

    this._visible    = true;
    this._exportMode = false;
    this._bordered   = false;  // F34: fill gutters with container background

    // Style
    this._style = {
      background:    'rgba(13,13,13,0.0)',
      axisColor:     '#666',
      tickColor:     '#888',
      labelColor:    '#ccc',
      gridColor:     'rgba(80,80,80,0.25)',
      fontSize:      11,
      fontFamily:    'monospace',
      tickLength:    5,
      labelPadding:  4,
    };
  }

  // ─── Visibility ───────────────────────────────────────────────────────────────

  setVisible(v) {
    this._visible = v;
  }

  /** In export mode axes can be hidden via options */
  exportMode(hide = false) {
    this._exportMode = hide;
  }

  /** Merge partial style overrides (e.g. { hideXAxis: true }) */
  setStyle(partial) {
    Object.assign(this._style, partial);
  }

  /**
   * F34: enable/disable gutter fill.
   * When true, the four margin rectangles are filled with the container's
   * CSS background color before ticks are drawn, so data never bleeds
   * visually behind tick labels.
   * @param {boolean} on
   */
  setBordered(on) {
    this._bordered = !!on;
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  /**
   * Render axes and optional LineROI labels onto the 2D canvas overlay.
   *
   * @param {import('../ROI/ROIBase').ROIBase[]} [rois=[]] — current ROI list;
   *   half-variant LineROI labels are drawn here per spec (NOT in WebGL).
   */
  render(rois = []) {
    if (!this._visible || this._exportMode) {
      this._clear();
      return;
    }

    const ctx = this._ctx;
    const { canvasWidth: W, canvasHeight: H, plotArea: pa } = this._viewport;

    // Resize canvas to match display
    if (this._canvas.width !== W || this._canvas.height !== H) {
      this._canvas.width  = W;
      this._canvas.height = H;
    }

    this._clear();

    // F34: fill gutters with container background before drawing any ticks/labels
    if (this._bordered) this._fillGutters(ctx, W, H, pa);

    ctx.save();

    // Plot area border
    ctx.strokeStyle = this._style.axisColor;
    ctx.lineWidth   = 1;
    ctx.strokeRect(pa.x, pa.y, pa.width, pa.height);

    // F35: dispatch to mode-aware x/y axis renderers
    if (!this._style.hideXAxis) this._renderXAxis(ctx, pa);
    this._renderYAxis(ctx, pa);

    // LineROI labels (half-variants only; canvas overlay per spec)
    this._renderLineROILabels(ctx, rois, pa);

    ctx.restore();
  }

  // ─── Axis hit-test (F21) ─────────────────────────────────────────────────────

  /**
   * Determine whether a canvas pixel position falls inside an axis gutter.
   *
   * X-axis gutter: below the plot bottom edge, within the plot's x extent.
   * Y-axis gutter: left of the plot left edge, within the plot's y extent.
   *
   * @param {number} px — canvas pixel x
   * @param {number} py — canvas pixel y
   * @returns {'x'|'y'|null}
   */
  getAxisHit(px, py) {
    const { plotArea: pa } = this._viewport;

    // X-axis gutter — below plot area, horizontally within plot
    if (py > pa.y + pa.height && px >= pa.x && px <= pa.x + pa.width) {
      return 'x';
    }

    // Y-axis gutter — left of plot area, vertically within plot
    if (px < pa.x && py >= pa.y && py <= pa.y + pa.height) {
      return 'y';
    }

    return null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _clear() {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * F34: fill the four gutter rectangles (margins outside the plot area) with
   * the container's CSS background color so data cannot bleed behind tick labels.
   *
   * Uses `getComputedStyle(canvas.parentElement).backgroundColor` so the color
   * automatically matches whatever the host application sets on the container.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W   — canvas width
   * @param {number} H   — canvas height
   * @param {{ x, y, width, height, right, bottom }} pa  — plot area
   */
  _fillGutters(ctx, W, H, pa) {
    // Walk up the DOM until we find a non-transparent background color.
    // This handles cases where the immediate parent has no background set
    // (e.g. a flex wrapper with only layout styles).
    const isTransparent = c => !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
    let bg = 'transparent';
    let el = this._canvas.parentElement;
    while (el && el !== document.documentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (!isTransparent(c)) { bg = c; break; }
      el = el.parentElement;
    }

    // Skip if no opaque background found
    if (isTransparent(bg)) return;

    ctx.save();
    ctx.fillStyle = bg;

    // Top gutter   (full width, above plot area)
    ctx.fillRect(0, 0, W, pa.y);
    // Bottom gutter (full width, below plot area)
    ctx.fillRect(0, pa.bottom, W, H - pa.bottom);
    // Left gutter   (between top and bottom gutters, left of plot area)
    ctx.fillRect(0, pa.y, pa.x, pa.height);
    // Right gutter  (between top and bottom gutters, right of plot area)
    ctx.fillRect(pa.right, pa.y, W - pa.right, pa.height);

    ctx.restore();
  }

  // ─── F35: X-axis dispatch ────────────────────────────────────────────────────

  _renderXAxis(ctx, pa) {
    const xScale = this._viewport.getXScale();
    if (!xScale) return;
    const ticks = this._xAxis.getTicks(xScale);
    const mode  = this._xAxis.mode || 'border';

    if (mode === 'relative') {
      this._renderXAxisRelative(ctx, pa, ticks);
    } else {
      // border mode — render grid once, then per-edge ticks
      const edges = this._xAxis.edges ?? ['bottom'];
      this._renderXGrid(ctx, pa, ticks);
      for (const edge of edges) {
        this._renderXTicksAtEdge(ctx, pa, ticks, edge);
      }
      // axis label at outermost of the listed edges (bottom if available, else top)
      if (this._xAxis.label) {
        const labelEdge = edges.includes('bottom') ? 'bottom' : (edges[0] ?? 'bottom');
        this._renderXLabel(ctx, pa, labelEdge);
      }
    }
  }

  /** Grid lines only — rendered once regardless of number of edges. */
  _renderXGrid(ctx, pa, ticks) {
    const s = this._style;
    ctx.strokeStyle = s.gridColor;
    ctx.lineWidth   = 1;
    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;
      ctx.beginPath();
      ctx.moveTo(sx, pa.y);
      ctx.lineTo(sx, pa.y + pa.height);
      ctx.stroke();
    }
  }

  /**
   * Tick marks + labels at a single x-axis edge.
   * @param {'top'|'bottom'} edge
   */
  _renderXTicksAtEdge(ctx, pa, ticks, edge) {
    const s          = this._style;
    const tickLength = this._xAxis.getTickSize();
    const atBottom   = edge !== 'top';
    const baseY      = atBottom ? pa.y + pa.height : pa.y;
    // Outward direction: +1 = downward (outward from bottom), -1 = upward (outward from top)
    const outDir     = atBottom ? 1 : -1;

    ctx.textAlign    = 'center';
    ctx.textBaseline = atBottom ? 'top' : 'bottom';
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.lineWidth    = 1;

    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;

      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx, baseY + outDir * tickLength);
      ctx.stroke();

      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, sx, baseY + outDir * (tickLength + s.labelPadding));
    }
  }

  _renderXLabel(ctx, pa, edge) {
    const s      = this._style;
    const atBottom = edge !== 'top';
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign    = 'center';
    ctx.fillStyle    = s.labelColor;
    if (atBottom) {
      ctx.textBaseline = 'top';
      ctx.fillText(this._xAxis.label, pa.x + pa.width / 2, pa.y + pa.height + 30);
    } else {
      ctx.textBaseline = 'bottom';
      ctx.fillText(this._xAxis.label, pa.x + pa.width / 2, pa.y - 18);
    }
  }

  /**
   * Relative-mode x-axis: the axis line is horizontal, anchored at a y-data
   * value (`crossingValue`), and can snap to edges or hide when off-screen.
   */
  _renderXAxisRelative(ctx, pa, ticks) {
    const yScale         = this._viewport.getYScale();
    if (!yScale) return;
    const ax             = this._xAxis;
    const crossVal       = ax.crossingValue ?? 0;
    const [yMin, yMax]   = this._viewport.getYDomain();

    // Off-screen check
    const inDomain = crossVal >= Math.min(yMin, yMax) && crossVal <= Math.max(yMin, yMax);
    if (!inDomain) {
      if (ax.offscreen === 'hide') return;
      // 'border' → nearest edge
      // y domain min/max doesn't directly map to bottom/top because of inverted range
      // screenY at domain edge: yMin maps to plotBottom (pa.y+pa.height), yMax to pa.y
      // crossVal < yMin → off the bottom of data → screen bottom edge
      const [rangeA, rangeB] = [yScale.range()[0], yScale.range()[1]];
      const screenBottomVal  = rangeA > rangeB ? rangeA : rangeB; // larger screen-y = bottom
      const offEdge = (yScale(crossVal) > screenBottomVal) ? 'bottom' : 'top';
      this._renderXGrid(ctx, pa, ticks);
      this._renderXTicksAtEdge(ctx, pa, ticks, offEdge);
      if (ax.label) this._renderXLabel(ctx, pa, offEdge);
      return;
    }

    const screenY = yScale(crossVal);

    // Snap check
    const snap = ax.snapTolerancePx ?? 0;
    if (snap > 0) {
      const distBottom = Math.abs(screenY - (pa.y + pa.height));
      const distTop    = Math.abs(screenY - pa.y);
      if (distBottom <= snap || distTop <= snap) {
        const snapEdge = distBottom <= distTop ? 'bottom' : 'top';
        this._renderXGrid(ctx, pa, ticks);
        this._renderXTicksAtEdge(ctx, pa, ticks, snapEdge);
        if (ax.label) this._renderXLabel(ctx, pa, snapEdge);
        return;
      }
    }

    // Mid-plot render
    const s = this._style;

    // Grid lines (at each x-tick position, full plot height)
    this._renderXGrid(ctx, pa, ticks);

    // Axis line (horizontal at screenY, full plot width)
    ctx.strokeStyle = s.axisColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pa.x, screenY);
    ctx.lineTo(pa.x + pa.width, screenY);
    ctx.stroke();

    // Tick direction: toward nearer edge
    const midY     = pa.y + pa.height / 2;
    // Ticks point outward toward nearest edge:
    //   upper half (screenY < midY) → ticks go upward (-1)
    //   lower half (screenY >= midY) → ticks go downward (+1)
    const tickDir  = screenY < midY ? -1 : 1;
    const tickLen  = ax.getTickSize();

    // Label side: resolve from labelSide option
    // 'auto'     → same side as ticks (toward nearest edge)
    // 'positive' → above the line (data-positive y direction = lower screen y)
    // 'negative' → below the line (data-negative y direction = higher screen y)
    let labelDir;
    if (ax.labelSide === 'positive') {
      // positive y in data = smaller screen y (inverted range)
      labelDir = -1;
    } else if (ax.labelSide === 'negative') {
      labelDir = 1;
    } else {
      // 'auto' → same direction as ticks
      labelDir = tickDir;
    }
    const labelBaseline = labelDir < 0 ? 'bottom' : 'top';

    ctx.font      = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 1;

    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;

      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(sx, screenY);
      ctx.lineTo(sx, screenY + tickDir * tickLen);
      ctx.stroke();

      ctx.fillStyle    = s.labelColor;
      ctx.textBaseline = labelBaseline;
      ctx.fillText(tick.label, sx, screenY + labelDir * (tickLen + s.labelPadding));
    }

    if (ax.label) {
      ctx.fillStyle    = s.labelColor;
      ctx.textAlign    = 'center';
      ctx.textBaseline = labelBaseline;
      ctx.fillText(ax.label, pa.x + pa.width / 2,
        screenY + labelDir * (tickLen + s.labelPadding + 14));
    }
  }

  // ─── F35: Y-axis dispatch ────────────────────────────────────────────────────

  _renderYAxis(ctx, pa) {
    const yScale = this._viewport.getYScale();
    if (!yScale) return;
    const ticks = this._yAxis.getTicks(yScale);
    const mode  = this._yAxis.mode || 'border';

    if (mode === 'relative') {
      this._renderYAxisRelative(ctx, pa, ticks);
    } else {
      const edges = this._yAxis.edges ?? ['left'];
      this._renderYGrid(ctx, pa, ticks);
      for (const edge of edges) {
        this._renderYTicksAtEdge(ctx, pa, ticks, edge);
      }
      if (this._yAxis.label) {
        const labelEdge = edges.includes('left') ? 'left' : (edges[0] ?? 'left');
        this._renderYLabel(ctx, pa, labelEdge);
      }
    }
  }

  _renderYGrid(ctx, pa, ticks) {
    const s = this._style;
    ctx.strokeStyle = s.gridColor;
    ctx.lineWidth   = 1;
    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, sy);
      ctx.lineTo(pa.x + pa.width, sy);
      ctx.stroke();
    }
  }

  /**
   * Tick marks + labels at a single y-axis edge.
   * @param {'left'|'right'} edge
   */
  _renderYTicksAtEdge(ctx, pa, ticks, edge) {
    const s          = this._style;
    const tickLength = this._yAxis.getTickSize();
    const atLeft     = edge !== 'right';
    const baseX      = atLeft ? pa.x : pa.x + pa.width;
    // Outward: -1 = leftward (outward from left edge), +1 = rightward (outward from right)
    const outDir     = atLeft ? -1 : 1;

    ctx.textBaseline = 'middle';
    ctx.textAlign    = atLeft ? 'right' : 'left';
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.lineWidth    = 1;

    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;

      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(baseX, sy);
      ctx.lineTo(baseX + outDir * tickLength, sy);
      ctx.stroke();

      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, baseX + outDir * (tickLength + s.labelPadding), sy);
    }
  }

  _renderYLabel(ctx, pa, edge) {
    const s      = this._style;
    const atLeft = edge !== 'right';
    ctx.save();
    if (atLeft) {
      ctx.translate(12, pa.y + pa.height / 2);
    } else {
      ctx.translate(pa.x + pa.width + this._viewport.marginRight - 12, pa.y + pa.height / 2);
    }
    ctx.rotate(-Math.PI / 2);
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = s.labelColor;
    ctx.fillText(this._yAxis.label, 0, 0);
    ctx.restore();
  }

  /**
   * Relative-mode y-axis: the axis line is vertical, anchored at an x-data
   * value (`crossingValue`), with snap/offscreen/labelSide support.
   */
  _renderYAxisRelative(ctx, pa, ticks) {
    const xScale         = this._viewport.getXScale();
    if (!xScale) return;
    const ay             = this._yAxis;
    const crossVal       = ay.crossingValue ?? 0;
    const [xMin, xMax]   = this._viewport.getXDomain();

    // Off-screen check
    const inDomain = crossVal >= Math.min(xMin, xMax) && crossVal <= Math.max(xMin, xMax);
    if (!inDomain) {
      if (ay.offscreen === 'hide') return;
      const offEdge = crossVal < Math.min(xMin, xMax) ? 'left' : 'right';
      this._renderYGrid(ctx, pa, ticks);
      this._renderYTicksAtEdge(ctx, pa, ticks, offEdge);
      if (ay.label) this._renderYLabel(ctx, pa, offEdge);
      return;
    }

    const screenX = xScale(crossVal);

    // Snap check
    const snap = ay.snapTolerancePx ?? 0;
    if (snap > 0) {
      const distLeft  = Math.abs(screenX - pa.x);
      const distRight = Math.abs(screenX - (pa.x + pa.width));
      if (distLeft <= snap || distRight <= snap) {
        const snapEdge = distLeft <= distRight ? 'left' : 'right';
        this._renderYGrid(ctx, pa, ticks);
        this._renderYTicksAtEdge(ctx, pa, ticks, snapEdge);
        if (ay.label) this._renderYLabel(ctx, pa, snapEdge);
        return;
      }
    }

    // Mid-plot render
    const s = this._style;

    this._renderYGrid(ctx, pa, ticks);

    // Axis line (vertical at screenX, full plot height)
    ctx.strokeStyle = s.axisColor;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(screenX, pa.y);
    ctx.lineTo(screenX, pa.y + pa.height);
    ctx.stroke();

    // Tick direction: toward nearer edge
    const midX    = pa.x + pa.width / 2;
    // Left half  (screenX < midX) → ticks go left  (-1)
    // Right half (screenX >= midX) → ticks go right (+1)
    const tickDir = screenX < midX ? -1 : 1;
    const tickLen = ay.getTickSize();

    // Label side
    let labelDir;
    if (ay.labelSide === 'positive') {
      // positive x direction = rightward (+1)
      labelDir = 1;
    } else if (ay.labelSide === 'negative') {
      labelDir = -1;
    } else {
      // 'auto' → same as ticks
      labelDir = tickDir;
    }
    const textAlign = labelDir < 0 ? 'right' : 'left';

    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth    = 1;

    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;

      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(screenX, sy);
      ctx.lineTo(screenX + tickDir * tickLen, sy);
      ctx.stroke();

      ctx.fillStyle = s.labelColor;
      ctx.textAlign = textAlign;
      ctx.fillText(tick.label, screenX + labelDir * (tickLen + s.labelPadding), sy);
    }

    if (ay.label) {
      ctx.save();
      ctx.translate(screenX + labelDir * (tickLen + s.labelPadding + 14),
                    pa.y + pa.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = s.labelColor;
      ctx.fillText(ay.label, 0, 0);
      ctx.restore();
    }
  }

  // ─── LineROI labels ──────────────────────────────────────────────────────────

  /**
   * Render text labels for LineROI half-variants onto the canvas overlay.
   *
   * Rules (from spec):
   *   - Labels only render on half variants (mode contains 'half')
   *   - Positioned near the tip (the "open" end of the half-line)
   *   - Centered perpendicular to the line direction
   *   - Clipped to plot area
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../ROI/ROIBase').ROIBase[]} rois
   * @param {{ x, y, width, height }} pa  — plot area bounds
   */
  _renderLineROILabels(ctx, rois, pa) {
    const s = this._style;

    for (const roi of rois) {
      if (roi.type !== 'lineROI') continue;
      if (!roi.flags.visible) continue;
      if (!roi.label) continue;
      if (!roi.mode.includes('half')) continue;

      const LABEL_PAD = 14; // pixels from the tip edge

      ctx.save();
      ctx.font      = `bold ${s.fontSize}px ${s.fontFamily}`;
      ctx.lineWidth = 3;
      // Dark stroke behind text for legibility over the plot
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';

      if (roi.orientation === 'vertical') {
        const lx = this._viewport.dataXToScreen(roi.position);
        // Only render if within plot x-range
        if (lx < pa.x || lx > pa.x + pa.width) { ctx.restore(); continue; }

        ctx.textAlign = 'center';
        let ly;
        if (roi.mode === 'vline-half-top') {
          // Tip is at the top of the plot area
          ly = pa.y + LABEL_PAD;
          ctx.textBaseline = 'top';
        } else {
          // vline-half-bottom: tip is at the bottom
          ly = pa.y + pa.height - LABEL_PAD;
          ctx.textBaseline = 'bottom';
        }
        ctx.strokeText(roi.label, lx, ly);
        ctx.fillStyle = '#fff';
        ctx.fillText(roi.label, lx, ly);

      } else {
        const ly = this._viewport.dataYToScreen(roi.position);
        // Only render if within plot y-range
        if (ly < pa.y || ly > pa.y + pa.height) { ctx.restore(); continue; }

        ctx.textBaseline = 'bottom';
        let lx;
        if (roi.mode === 'hline-half-left') {
          // Tip is at the left edge of the plot
          lx = pa.x + LABEL_PAD;
          ctx.textAlign = 'left';
        } else {
          // hline-half-right: tip is at the right edge
          lx = pa.x + pa.width - LABEL_PAD;
          ctx.textAlign = 'right';
        }
        ctx.strokeText(roi.label, lx, ly - 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(roi.label, lx, ly - 2);
      }

      ctx.restore();
    }
  }
}

export default AxisRenderer;
