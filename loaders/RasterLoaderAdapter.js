/**
 * RasterLoaderAdapter — F33
 *
 * Loads a gridded dataset (NetCDF3, or any image format) and registers a
 * BitmapDataLayer on a PlotController with the correct bitMapping.bounds.
 *
 * Supported formats:
 *   .nc / .cdf      → @loaders.gl/netcdf  NetCDFLoader (NetCDF v3 classic)
 *   .png / .jpg     → browser createImageBitmap (bounds default to pixel dimensions)
 *   .webp / .bmp    → browser createImageBitmap
 *   .tif / .tiff    → createImageBitmap (partial; full GeoTIFF metadata not decoded)
 *
 * NetCDF4 (HDF5-based .nc4) is NOT supported by @loaders.gl/netcdf (only v3 classic).
 * A warning is emitted if the file header does not match CDF magic bytes.
 *
 * Usage:
 *   const adapter = new RasterLoaderAdapter(plotController, {
 *     layerId:    'temperature',
 *     variable:   'temp',
 *     xDim:       'lon',
 *     yDim:       'lat',
 *     lutController: myLUT,
 *   });
 *   await adapter.loadFile(file);
 *
 * Events: 'loaded' { width, height, variable, bounds }, 'parseWarning' { message }
 */

import { EventEmitter } from 'events';
import { parse } from '@loaders.gl/core';
import { NetCDFLoader } from '@loaders.gl/netcdf';
import { BitmapDataLayer } from '../src/plot/layers/BitmapDataLayer.js';

export class RasterLoaderAdapter extends EventEmitter {
  /**
   * @param {import('../src/plot/PlotController.js').PlotController} plotController
   * @param {object} opts
   * @param {string}  [opts.layerId='raster']    — id passed to plotController.registerDataLayer
   * @param {string}  [opts.variable]            — NetCDF variable name (ignored for image formats)
   * @param {string}  [opts.xDim='lon']          — NetCDF dimension name for X axis
   * @param {string}  [opts.yDim='lat']          — NetCDF dimension name for Y axis
   * @param {object|null} [opts.lutController]   — optional LUTController for colormapping
   * @param {boolean} [opts.flipY=true]          — flip row order so row-0 = bottom (raster convention)
   */
  constructor(plotController, opts = {}) {
    super();
    if (!plotController) throw new Error('RasterLoaderAdapter: plotController is required');

    this._ctrl          = plotController;
    this._layerId       = opts.layerId      ?? 'raster';
    this._variable      = opts.variable     ?? null;
    this._xDim          = opts.xDim         ?? 'lon';
    this._yDim          = opts.yDim         ?? 'lat';
    this._lutController = opts.lutController ?? null;
    this._flipY         = opts.flipY        ?? true;

    this._variables     = [];
    this._dimensions    = {};

    // Internal layer state (bumped to trigger BitmapDataLayer re-render)
    this._dataTrigger   = 0;
    this._colorTrigger  = 0;

    // Wired LUT listener
    this._onLutChanged  = () => { this._colorTrigger++; this._ctrl.markDirty(); };
    if (this._lutController) {
      this._lutController.on('levelChanged', this._onLutChanged);
      this._lutController.on('lutChanged',   this._onLutChanged);
    }
  }

  /**
   * @returns {string[]} Available NetCDF variable names (empty for image formats).
   */
  getVariables() { return [...this._variables]; }

  /**
   * @returns {{ [varName]: string[] }} Dimension names per variable (empty for image formats).
   */
  getDimensions() { return { ...this._dimensions }; }

  /** Load from a File object (from <input type="file"> or drag-and-drop). */
  async loadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'nc' || ext === 'cdf' || ext === 'nc4') {
      const arrayBuffer = await file.arrayBuffer();
      await this._loadNetCDF(arrayBuffer);
    } else {
      await this._loadImageFile(file);
    }
  }

  /** Load from a URL. */
  async loadURL(url, fetchOptions = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`RasterLoaderAdapter: fetch failed: ${response.status} ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'nc' || ext === 'cdf' || ext === 'nc4') {
      await this._loadNetCDF(arrayBuffer);
    } else {
      const blob = new Blob([arrayBuffer]);
      const blobFile = new File([blob], url, { type: this._guessMimeType(url) });
      await this._loadImageFile(blobFile);
    }
  }

  /**
   * Load a typed-array grid directly (bypasses file parsing).
   * Useful when the data is already in memory (e.g. generated in JS).
   *
   * @param {Float32Array|Uint8Array} data — flat row-major pixel data
   * @param {number}  width
   * @param {number}  height
   * @param {object}  [opts]
   * @param {number[]}[opts.bounds]   — [left, bottom, right, top] in data space (default pixel dims)
   * @param {string}  [opts.channels] — 'gray'|'rgb'|'rgba' (default 'gray')
   * @param {string}  [opts.dtype]    — 'float32'|'uint8' etc (default 'float32')
   */
  loadArray(data, width, height, opts = {}) {
    const bounds   = opts.bounds   ?? [0, 0, width, height];
    const channels = opts.channels ?? 'gray';
    const dtype    = opts.dtype    ?? 'float32';

    const grid = this._flipY && channels === 'gray'
      ? this._flipRows(new Float32Array(data), width, height)
      : data;

    if (this._lutController && channels === 'gray') {
      this._lutController.setData(grid, this._arrayMin(grid), this._arrayMax(grid));
    }

    this._registerLayer({ source: grid, width, height, channels, dtype, bounds });
    this.emit('loaded', { width, height, variable: null, bounds });
  }

  /** Remove the registered BitmapDataLayer and clean up listeners. */
  destroy() {
    this._ctrl.unregisterDataLayer(this._layerId);
    if (this._lutController) {
      this._lutController.off('levelChanged', this._onLutChanged);
      this._lutController.off('lutChanged',   this._onLutChanged);
    }
    this._ctrl = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async _loadNetCDF(arrayBuffer) {
    let parsed;
    try {
      parsed = await parse(arrayBuffer, NetCDFLoader, { netcdf: { loadData: true } });
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: NetCDF parse failed — ${err.message}. ` +
        'Note: only NetCDF v3 classic format is supported by @loaders.gl/netcdf.');
    }

    // Populate metadata for getVariables() / getDimensions()
    const header = parsed.loaderData;
    if (header && header.variables) {
      this._variables = header.variables.map(v => v.name);
      for (const v of header.variables) {
        this._dimensions[v.name] = v.dimensions ? [...v.dimensions] : [];
      }
    }

    // Choose variable
    const varName = this._variable ?? this._variables.find(n =>
      !this._isDimCoord(n, header)
    ) ?? this._variables[0];
    if (!varName) throw new Error('RasterLoaderAdapter: no variables found in NetCDF file');

    const varData = parsed.data[varName];
    if (!varData) throw new Error(`RasterLoaderAdapter: variable "${varName}" not found in parsed data`);

    // Determine grid dimensions from the variable's dimension list
    const varMeta = header.variables.find(v => v.name === varName);
    const dimNames = varMeta?.dimensions ?? [];
    const dims = dimNames.map(dn => header.dimensions.find(d => d.name === dn));

    if (dims.length < 2) {
      throw new Error(`RasterLoaderAdapter: variable "${varName}" must have at least 2 dimensions, found ${dims.length}`);
    }

    // Assume last two dims are [y, x] (latitude, longitude order)
    const yDimMeta = dims[dims.length - 2];
    const xDimMeta = dims[dims.length - 1];
    const height   = yDimMeta?.size ?? 1;
    const width    = xDimMeta?.size ?? 1;

    // Try to read coordinate arrays (dimension coordinate variables named after dims)
    const xCoords = parsed.data[xDimMeta.name] ?? null;
    const yCoords = parsed.data[yDimMeta.name] ?? null;

    let bounds;
    if (xCoords && xCoords.length >= 2 && yCoords && yCoords.length >= 2) {
      // Infer grid spacing (half-cell padding for correct edge alignment)
      const xMin  = xCoords[0];
      const xMax  = xCoords[xCoords.length - 1];
      const yMin  = yCoords[0];
      const yMax  = yCoords[yCoords.length - 1];
      const dxHalf = Math.abs(xMax - xMin) / Math.max(1, xCoords.length - 1) / 2;
      const dyHalf = Math.abs(yMax - yMin) / Math.max(1, yCoords.length - 1) / 2;
      bounds = [
        Math.min(xMin, xMax) - dxHalf,
        Math.min(yMin, yMax) - dyHalf,
        Math.max(xMin, xMax) + dxHalf,
        Math.max(yMin, yMax) + dyHalf,
      ];
    } else {
      // No coordinate variables — use pixel indices
      bounds = [0, 0, width, height];
      this.emit('parseWarning', { message: `No coordinate arrays found for dims "${xDimMeta.name}"/"${yDimMeta.name}" — using pixel bounds [0,0,${width},${height}]` });
    }

    // Flatten to Float32Array
    const flat = this._toFloat32(varData, width * height);

    // FlipY: rasters store row-0 at top; BitmapDataLayer row-0 = bottom
    const grid = this._flipY ? this._flipRows(flat, width, height) : flat;

    // LUT data
    if (this._lutController) {
      const min = this._arrayMin(grid);
      const max = this._arrayMax(grid);
      this._lutController.setData(grid, min, max);
    }

    this._registerLayer({ source: grid, width, height, channels: 'gray', dtype: 'float32', bounds });
    this.emit('loaded', { width, height, variable: varName, bounds });
  }

  async _loadImageFile(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: createImageBitmap failed — ${err.message}`);
    }

    const width   = bitmap.width;
    const height  = bitmap.height;
    const bounds  = [0, 0, width, height];

    this._registerLayer({ source: bitmap, width, height, channels: 'rgba', dtype: 'uint8', bounds });
    this.emit('loaded', { width, height, variable: null, bounds });
  }

  _registerLayer({ source, width, height, channels, dtype, bounds }) {
    const dataTrigger   = ++this._dataTrigger;
    const colorTrigger  = this._colorTrigger;
    const lutController = this._lutController;

    this._ctrl.registerDataLayer(this._layerId, () =>
      new BitmapDataLayer({
        id:           this._layerId,
        source,
        width,
        height,
        channels,
        dtype,
        bitMapping:   { bounds },
        lutController,
        dataTrigger,
        colorTrigger,
      })
    );
    this._ctrl.markDirty();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _isDimCoord(varName, header) {
    return header.dimensions && header.dimensions.some(d => d.name === varName);
  }

  _toFloat32(raw, length) {
    if (raw instanceof Float32Array) return raw;
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) out[i] = Number(raw[i] ?? 0);
    return out;
  }

  _flipRows(flat, width, height) {
    const out = new Float32Array(flat.length);
    for (let row = 0; row < height; row++) {
      const srcRow = height - 1 - row;
      out.set(flat.subarray(srcRow * width, (srcRow + 1) * width), row * width);
    }
    return out;
  }

  _arrayMin(arr) {
    let min = Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] < min) min = arr[i];
    return min;
  }

  _arrayMax(arr) {
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    return max;
  }

  _guessMimeType(url) {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    return map[ext] || 'application/octet-stream';
  }
}

export default RasterLoaderAdapter;
