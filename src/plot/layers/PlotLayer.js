import { CompositeLayer } from '@deck.gl/core';

/**
 * PlotLayer — CompositeLayer that aggregates all registered data layers
 * and the ROILayer into a single composable unit for deck.gl.
 *
 * Props:
 *   dataLayers  {Layer[]}  — ordered array of data layers (scatter, line, spectrogram, etc.)
 *   roiLayer    {Layer}    — ROILayer instance (always rendered last / on top)
 */
export class PlotLayer extends CompositeLayer {
  static get layerName() { return 'PlotLayer'; }

  renderLayers() {
    const { dataLayers = [], roiLayer } = this.props;
    return roiLayer ? [...dataLayers, roiLayer] : dataLayers;
  }
}

PlotLayer.defaultProps = {
  dataLayers: { type: 'array',  value: [] },
  roiLayer:   { type: 'object', value: null, optional: true },
};
