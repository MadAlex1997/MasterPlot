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

  render() {
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

    ctx.restore();
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
}

export default AxisRenderer;
