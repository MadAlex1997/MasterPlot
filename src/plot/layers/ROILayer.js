/**
 * ROILayer — composite deck.gl layer for rendering ROIs (RectROI, LinearRegion).
 *
 * Renders each ROI as:
 *   - A semi-transparent fill rectangle (PolygonLayer)
 *   - A border outline
 *   - Corner/edge handles (ScatterplotLayer) when selected
 *
 * ROILayer is rebuilt from scratch on every render because ROI count is small
 * (typically < 100) and structural changes (add/remove ROI) require new layers.
 * This is fine — deck.gl diffing handles it efficiently.
 *
 * Coordinate system: ROI bounds are in DATA coordinates. deck.gl's
 * OrthographicView maps data coordinates directly to screen pixels when the
 * view state is set accordingly by PlotController.
 */

import { PolygonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { CompositeLayer } from '@deck.gl/core';

const FILL_ALPHA     = 40;
const SELECTED_ALPHA = 70;
const HANDLE_RADIUS  = 5;

export class ROILayer extends CompositeLayer {
  static get layerName() { return 'ROILayer'; }

  renderLayers() {
    const rois = this.props.rois || [];
    if (rois.length === 0) return [];

    const xIsLog = this.props.xIsLog || false;
    const yIsLog = this.props.yIsLog || false;
    const toX = v => xIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
    const toY = v => yIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
    const { plotYMin, plotYMax, plotXMin, plotXMax } = this.props;
    // Convert plot extents to deck.gl space
    const deckYMin = toY(plotYMin);
    const deckYMax = toY(plotYMax);
    const deckXMin = toX(plotXMin);
    const deckXMax = toX(plotXMax);

    const layers = [];

    for (const roi of rois) {
      if (!roi.flags.visible) continue;

      const alpha  = roi.selected ? SELECTED_ALPHA : FILL_ALPHA;
      const color  = roi.color || (
        roi.type === 'linearRegion' ? [100, 160, 255] :
        roi.type === 'lineROI'      ? [255, 80, 80]   :
        [255, 140, 60]  // rect
      );

      if (roi.type === 'linearRegion') {
        // LinearRegion: vertical stripe — use plot y-extent for height
        const polygon = [
          [toX(roi.x1), deckYMin],
          [toX(roi.x2), deckYMin],
          [toX(roi.x2), deckYMax],
          [toX(roi.x1), deckYMax],
        ];

        layers.push(new PolygonLayer({
          id:            `${roi.id}-fill`,
          data:          [{ polygon }],
          getPolygon:    d => d.polygon,
          getFillColor:  [...color, alpha],
          getLineColor:  [...color, 200],
          lineWidthMinPixels: 1,
          pickable:      true,
          autoHighlight: true,
          onClick:       () => this.props.onROIClick && this.props.onROIClick(roi),
        }));

        // Left & right edge lines (highlighted when hovered)
        const edgeColor = roi.hovered ? [255, 255, 100, 220] : [...color, 180];
        layers.push(new PathLayer({
          id:       `${roi.id}-edges`,
          data:     [
            { path: [[toX(roi.x1), deckYMin, 0], [toX(roi.x1), deckYMax, 0]] },
            { path: [[toX(roi.x2), deckYMin, 0], [toX(roi.x2), deckYMax, 0]] },
          ],
          getPath:  d => d.path,
          getColor: edgeColor,
          getWidth: roi.selected ? 2 : 1,
          widthUnits: 'pixels',
          pickable: false,
        }));

      } else if (roi.type === 'lineROI') {
        // LineROI: rendered as a PathLayer line in deck.gl coordinate space.
        // Labels for half-variants are drawn on the canvas overlay by AxisRenderer.
        const lineAlpha = roi.selected ? 240 : 180;
        const lineWidth = roi.selected ? 2 : 1;

        const midX = (deckXMin + deckXMax) / 2;
        const midY = (deckYMin + deckYMax) / 2;

        let path;
        if (roi.orientation === 'vertical') {
          const lx = toX(roi.position);
          switch (roi.mode) {
            case 'vline-half-top':    path = [[lx, midY, 0], [lx, deckYMax, 0]]; break;
            case 'vline-half-bottom': path = [[lx, deckYMin, 0], [lx, midY, 0]]; break;
            default:                  path = [[lx, deckYMin, 0], [lx, deckYMax, 0]]; // vline
          }
        } else {
          const ly = toY(roi.position);
          switch (roi.mode) {
            case 'hline-half-left':  path = [[deckXMin, ly, 0], [midX, ly, 0]]; break;
            case 'hline-half-right': path = [[midX, ly, 0], [deckXMax, ly, 0]]; break;
            default:                 path = [[deckXMin, ly, 0], [deckXMax, ly, 0]]; // hline
          }
        }

        layers.push(new PathLayer({
          id:         `${roi.id}-line`,
          data:       [{ path }],
          getPath:    d => d.path,
          getColor:   [...color, lineAlpha],
          getWidth:   lineWidth,
          widthUnits: 'pixels',
          pickable:   false,
        }));

        // Move handle (midpoint dot) when selected
        if (roi.selected) {
          const handlePos = roi.orientation === 'vertical'
            ? [toX(roi.position), midY, 0]
            : [midX, toY(roi.position), 0];

          layers.push(new ScatterplotLayer({
            id:             `${roi.id}-handle`,
            data:           [{ position: handlePos }],
            getPosition:    d => d.position,
            getRadius:      HANDLE_RADIUS,
            getFillColor:   [255, 255, 255, 220],
            getLineColor:   [0, 0, 0, 255],
            stroked:        true,
            getLineWidth:   1,
            radiusUnits:    'pixels',
            lineWidthUnits: 'pixels',
            pickable:       false,
          }));
        }

      } else {
        // RectROI: filled rectangle with border
        const dx1 = toX(roi.x1), dx2 = toX(roi.x2);
        const dy1 = toY(roi.y1), dy2 = toY(roi.y2);
        const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];

        layers.push(new PolygonLayer({
          id:            `${roi.id}-fill`,
          data:          [{ polygon }],
          getPolygon:    d => d.polygon,
          getFillColor:  [...color, alpha],
          getLineColor:  [...color, 200],
          lineWidthMinPixels: 1,
          pickable:      true,
          autoHighlight: true,
          onClick:       () => this.props.onROIClick && this.props.onROIClick(roi),
        }));

        // Corner handles when selected.
        // xLocked rects only expose top/bottom midpoint handles (no x controls).
        if (roi.selected) {
          const handlePositions = roi.xLocked
            ? [
                [(dx1+dx2)/2, dy2],  // top-center  (y2 = visual top)
                [(dx1+dx2)/2, dy1],  // bottom-center (y1 = visual bottom)
              ]
            : [
                [dx1, dy1], [dx2, dy1], [dx1, dy2], [dx2, dy2],
                [(dx1+dx2)/2, dy1], [(dx1+dx2)/2, dy2],
                [dx1, (dy1+dy2)/2], [dx2, (dy1+dy2)/2],
              ];
          const handles = handlePositions.map(([hx, hy]) => ({ position: [hx, hy, 0] }));

          layers.push(new ScatterplotLayer({
            id:              `${roi.id}-handles`,
            data:            handles,
            getPosition:     d => d.position,
            getRadius:       HANDLE_RADIUS,
            getFillColor:    [255, 255, 255, 220],
            getLineColor:    [0, 0, 0, 255],
            stroked:         true,
            getLineWidth:    1,
            radiusUnits:     'pixels',
            lineWidthUnits:  'pixels',
            pickable:        false,
          }));
        }
      }
    }

    return layers;
  }
}

ROILayer.defaultProps = {
  rois:       { type: 'array',    value: [] },
  plotXMin:   { type: 'number',   value: 0   },
  plotXMax:   { type: 'number',   value: 1   },
  plotYMin:   { type: 'number',   value: 0   },
  plotYMax:   { type: 'number',   value: 100  },
  xIsLog:     { type: 'boolean',  value: false },
  yIsLog:     { type: 'boolean',  value: false },
  onROIClick: { type: 'function', value: null, optional: true },
};

export default ROILayer;
