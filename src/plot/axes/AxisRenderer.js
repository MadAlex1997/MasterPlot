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

    ctx.save();

    // Plot area border
    ctx.strokeStyle = this._style.axisColor;
    ctx.lineWidth   = 1;
    ctx.strokeRect(pa.x, pa.y, pa.width, pa.height);

    // X-axis ticks
    this._renderXTicks(ctx, pa);

    // Y-axis ticks
    this._renderYTicks(ctx, pa);

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

  _renderXTicks(ctx, pa) {
    const s = this._style;
    const ticks = this._xAxis.getTicks(10);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.fillStyle    = s.labelColor;
    ctx.strokeStyle  = s.tickColor;
    ctx.lineWidth    = 1;

    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;

      // Grid line
      ctx.strokeStyle = s.gridColor;
      ctx.beginPath();
      ctx.moveTo(sx, pa.y);
      ctx.lineTo(sx, pa.y + pa.height);
      ctx.stroke();

      // Tick mark
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(sx, pa.y + pa.height);
      ctx.lineTo(sx, pa.y + pa.height + s.tickLength);
      ctx.stroke();

      // Label
      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, sx, pa.y + pa.height + s.tickLength + s.labelPadding);
    }

    // X axis label (bottom center)
    if (this._xAxis.label) {
      ctx.fillText(this._xAxis.label, pa.x + pa.width / 2, pa.y + pa.height + 30);
    }
  }

  _renderYTicks(ctx, pa) {
    const s = this._style;
    const ticks = this._yAxis.getTicks(8);

    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.font         = `${s.fontSize}px ${s.fontFamily}`;
    ctx.fillStyle    = s.labelColor;
    ctx.lineWidth    = 1;

    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;

      // Grid line
      ctx.strokeStyle = s.gridColor;
      ctx.beginPath();
      ctx.moveTo(pa.x, sy);
      ctx.lineTo(pa.x + pa.width, sy);
      ctx.stroke();

      // Tick mark
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(pa.x - s.tickLength, sy);
      ctx.lineTo(pa.x, sy);
      ctx.stroke();

      // Label
      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, pa.x - s.tickLength - s.labelPadding, sy);
    }

    // Y axis label (rotated, left side)
    if (this._yAxis.label) {
      ctx.save();
      ctx.translate(12, pa.y + pa.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._yAxis.label, 0, 0);
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
