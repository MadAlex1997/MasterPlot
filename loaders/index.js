// MasterPlot optional data loaders (CSV, Arrow, Parquet, NetCDF, Zstd)
// import { TableLoaderAdapter, RasterLoaderAdapter } from 'masterplot/loaders';
// Requires @loaders.gl/* and zstd-codec to be installed.

export { default as TableLoaderAdapter }  from './TableLoaderAdapter.js';
export { default as RasterLoaderAdapter } from './RasterLoaderAdapter.js';
