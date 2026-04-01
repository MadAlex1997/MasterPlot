'use strict';

var events = require('events');
var core = require('@loaders.gl/core');
var csv = require('@loaders.gl/csv');
var arrow = require('@loaders.gl/arrow');
var parquet = require('@loaders.gl/parquet');
var zstdCodec = require('zstd-codec');
var schema = require('@loaders.gl/schema');
var netcdf = require('@loaders.gl/netcdf');
var BitmapDataLayer_js = require('../src/plot/layers/BitmapDataLayer.js');

/**
 * TableLoaderAdapter — F32
 *
 * Loads CSV, TSV, Apache Arrow (.arrow), or Parquet (.parquet) files and
 * streams the parsed rows into a MasterPlot DataStore as typed-array bufferStructs.
 *
 * Uses @loaders.gl/schema table accessors as the sole data-access API:
 *   getTableLength     — number of rows
 *   getTableNumCols    — number of columns
 *   getTableColumnName — column name by index
 *   getTableCell       — single cell value by row index + column name
 *
 * Supported loaders:
 *   .csv / .tsv  → @loaders.gl/csv   CSVLoader    (object-row-table)
 *   .arrow       → @loaders.gl/arrow ArrowLoader  (arrow-table)
 *   .parquet     → @loaders.gl/parquet ParquetLoader (object-row-table)
 *
 * Events: 'loaded' { rowCount, columns }, 'chunk' { loaded, total },
 *         'parseWarning' { message }
 */

class TableLoaderAdapter extends events.EventEmitter {
  /**
   * @param {import('../src/plot/DataStore.js').DataStore} dataStore
   * @param {object} opts
   * @param {string}               opts.x          — column name for X axis (required)
   * @param {string}               opts.y          — column name for Y axis (required)
   * @param {string|number|null}  [opts.size]      — column name, fixed number, or null (default 4.0)
   * @param {string|Function|null}[opts.color]     — column name, fn(value)→[r,g,b,a], or null
   * @param {number}              [opts.chunkSize] — rows per appendData call (default 50_000)
   * @param {boolean}             [opts.replace]   — clear DataStore before loading (default false)
   */
  constructor(dataStore, opts = {}) {
    super();
    if (!dataStore) throw new Error('TableLoaderAdapter: dataStore is required');
    if (!opts.x || !opts.y) throw new Error('TableLoaderAdapter: opts.x and opts.y are required');
    this._dataStore = dataStore;
    this._xCol = opts.x;
    this._yCol = opts.y;
    this._sizeOpt = opts.size ?? 4.0;
    this._colorOpt = opts.color ?? null;
    this._chunkSize = opts.chunkSize ?? 50_000;
    this._replace = opts.replace ?? false;
    this._columns = [];
    this._bigIntWarned = false;
  }

  /** @returns {string[]} Column names detected after last load (empty before first load). */
  getColumns() {
    return [...this._columns];
  }

  /**
   * Parse a File object (from <input type="file"> or drag-and-drop).
   * @param {File} file
   */
  async loadFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const loader = this._selectLoader(file.name);
    await this._process(arrayBuffer, loader);
  }

  /**
   * Parse a remote URL.
   * @param {string} url
   * @param {RequestInit} [fetchOptions]
   */
  async loadURL(url, fetchOptions = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`TableLoaderAdapter: fetch failed ${response.status} ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    await this._process(arrayBuffer, this._selectLoader(url));
  }
  destroy() {
    this._columns = [];
    this._dataStore = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _selectLoader(name) {
    const ext = name.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'arrow') return arrow.ArrowLoader;
    if (ext === 'parquet') return parquet.ParquetLoader;
    return csv.CSVLoader;
  }
  async _process(arrayBuffer, loader) {
    let table;
    try {
      table = await core.parse(arrayBuffer, loader, {
        csv: {
          dynamicTyping: true
        },
        modules: {
          'zstd-codec': zstdCodec.ZstdCodec
        }
      });
    } catch (err) {
      throw new Error(`TableLoaderAdapter: parse failed — ${err.message}`);
    }

    // ── Discover columns — works for schema-less object-row-table (Parquet) ──
    const total = schema.getTableLength(table);
    if (total === 0) throw new Error('TableLoaderAdapter: file parsed but contains no rows — Parquet may use unsupported compression (try snappy or uncompressed)');
    const columns = Object.keys(schema.getTableRowAsObject(table, 0));

    // Always set before any possible throw so getColumns() works for probing
    this._columns = columns;
    if (!columns.includes(this._xCol)) throw new Error(`TableLoaderAdapter: column "${this._xCol}" not found. Available: ${columns.join(', ')}`);
    if (!columns.includes(this._yCol)) throw new Error(`TableLoaderAdapter: column "${this._yCol}" not found. Available: ${columns.join(', ')}`);
    if (this._replace) this._dataStore.clear();

    // ── Stream in chunks ───────────────────────────────────────────────────
    let loaded = 0;
    while (loaded < total) {
      const end = Math.min(loaded + this._chunkSize, total);
      const count = end - loaded;
      const x = new Float32Array(count);
      const y = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        x[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._xCol), this._xCol, loaded + i);
        y[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._yCol), this._yCol, loaded + i);
      }
      const bufferStruct = {
        x,
        y
      };

      // Optional size
      if (typeof this._sizeOpt === 'string' && columns.includes(this._sizeOpt)) {
        const size = new Float32Array(count);
        for (let i = 0; i < count; i++) size[i] = this._toFloat(schema.getTableCell(table, loaded + i, this._sizeOpt), this._sizeOpt, loaded + i);
        bufferStruct.size = size;
      } else if (typeof this._sizeOpt === 'number') {
        bufferStruct.size = new Float32Array(count).fill(this._sizeOpt);
      }

      // Optional color
      if (typeof this._colorOpt === 'function') {
        bufferStruct.color = this._buildColor(table, loaded, count, null);
      } else if (typeof this._colorOpt === 'string' && columns.includes(this._colorOpt)) {
        bufferStruct.color = this._buildColor(table, loaded, count, this._colorOpt);
      }
      this._dataStore.appendData(bufferStruct);
      loaded = end;
      this.emit('chunk', {
        loaded,
        total
      });
    }
    this.emit('loaded', {
      rowCount: total,
      columns: this._columns
    });
  }
  _toFloat(value, colName, rowIndex) {
    if (value == null || typeof value === 'number' && isNaN(value)) {
      this.emit('parseWarning', {
        message: `null/NaN at row ${rowIndex} col "${colName}", replaced with 0`
      });
      return 0;
    }
    if (typeof value === 'bigint') {
      if (!this._bigIntWarned) {
        console.warn(`TableLoaderAdapter: BigInt column "${colName}" converted to Float32 — precision may be lost.`);
        this._bigIntWarned = true;
      }
      return Number(value);
    }
    return Number(value);
  }
  _buildColor(table, startRow, count, colorColName) {
    const result = new Uint8Array(count * 4);
    const fn = typeof this._colorOpt === 'function' ? this._colorOpt : null;
    for (let i = 0; i < count; i++) {
      const raw = colorColName ? schema.getTableCell(table, startRow + i, colorColName) : 0;
      const rgba = fn ? fn(raw) : [255, 255, 255, 255];
      if (Array.isArray(rgba) && rgba.length >= 3) {
        result[i * 4 + 0] = rgba[0] & 0xff;
        result[i * 4 + 1] = rgba[1] & 0xff;
        result[i * 4 + 2] = rgba[2] & 0xff;
        result[i * 4 + 3] = rgba[3] != null ? rgba[3] & 0xff : 255;
      } else {
        result[i * 4 + 0] = result[i * 4 + 1] = result[i * 4 + 2] = result[i * 4 + 3] = 255;
      }
    }
    return result;
  }
}

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

class RasterLoaderAdapter extends events.EventEmitter {
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
    this._ctrl = plotController;
    this._layerId = opts.layerId ?? 'raster';
    this._variable = opts.variable ?? null;
    this._xDim = opts.xDim ?? 'lon';
    this._yDim = opts.yDim ?? 'lat';
    this._lutController = opts.lutController ?? null;
    this._flipY = opts.flipY ?? true;
    this._variables = [];
    this._dimensions = {};

    // Internal layer state (bumped to trigger BitmapDataLayer re-render)
    this._dataTrigger = 0;
    this._colorTrigger = 0;

    // Wired LUT listener
    this._onLutChanged = () => {
      this._colorTrigger++;
      this._ctrl.markDirty();
    };
    if (this._lutController) {
      this._lutController.on('levelChanged', this._onLutChanged);
      this._lutController.on('lutChanged', this._onLutChanged);
    }
  }

  /**
   * @returns {string[]} Available NetCDF variable names (empty for image formats).
   */
  getVariables() {
    return [...this._variables];
  }

  /**
   * @returns {{ [varName]: string[] }} Dimension names per variable (empty for image formats).
   */
  getDimensions() {
    return {
      ...this._dimensions
    };
  }

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
      const blobFile = new File([blob], url, {
        type: this._guessMimeType(url)
      });
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
    const bounds = opts.bounds ?? [0, 0, width, height];
    const channels = opts.channels ?? 'gray';
    const dtype = opts.dtype ?? 'float32';
    const grid = this._flipY && channels === 'gray' ? this._flipRows(new Float32Array(data), width, height) : data;
    if (this._lutController && channels === 'gray') {
      this._lutController.setData(grid, this._arrayMin(grid), this._arrayMax(grid));
    }
    this._registerLayer({
      source: grid,
      width,
      height,
      channels,
      dtype,
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: null,
      bounds
    });
  }

  /** Remove the registered BitmapDataLayer and clean up listeners. */
  destroy() {
    this._ctrl.unregisterDataLayer(this._layerId);
    if (this._lutController) {
      this._lutController.off('levelChanged', this._onLutChanged);
      this._lutController.off('lutChanged', this._onLutChanged);
    }
    this._ctrl = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async _loadNetCDF(arrayBuffer) {
    let parsed;
    try {
      parsed = await core.parse(arrayBuffer, netcdf.NetCDFLoader, {
        netcdf: {
          loadData: true
        }
      });
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: NetCDF parse failed — ${err.message}. ` + 'Note: only NetCDF v3 classic format is supported by @loaders.gl/netcdf.');
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
    const varName = this._variable ?? this._variables.find(n => !this._isDimCoord(n, header)) ?? this._variables[0];
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
    const height = yDimMeta?.size ?? 1;
    const width = xDimMeta?.size ?? 1;

    // Try to read coordinate arrays (dimension coordinate variables named after dims)
    const xCoords = parsed.data[xDimMeta.name] ?? null;
    const yCoords = parsed.data[yDimMeta.name] ?? null;
    let bounds;
    if (xCoords && xCoords.length >= 2 && yCoords && yCoords.length >= 2) {
      // Infer grid spacing (half-cell padding for correct edge alignment)
      const xMin = xCoords[0];
      const xMax = xCoords[xCoords.length - 1];
      const yMin = yCoords[0];
      const yMax = yCoords[yCoords.length - 1];
      const dxHalf = Math.abs(xMax - xMin) / Math.max(1, xCoords.length - 1) / 2;
      const dyHalf = Math.abs(yMax - yMin) / Math.max(1, yCoords.length - 1) / 2;
      bounds = [Math.min(xMin, xMax) - dxHalf, Math.min(yMin, yMax) - dyHalf, Math.max(xMin, xMax) + dxHalf, Math.max(yMin, yMax) + dyHalf];
    } else {
      // No coordinate variables — use pixel indices
      bounds = [0, 0, width, height];
      this.emit('parseWarning', {
        message: `No coordinate arrays found for dims "${xDimMeta.name}"/"${yDimMeta.name}" — using pixel bounds [0,0,${width},${height}]`
      });
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
    this._registerLayer({
      source: grid,
      width,
      height,
      channels: 'gray',
      dtype: 'float32',
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: varName,
      bounds
    });
  }
  async _loadImageFile(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (err) {
      throw new Error(`RasterLoaderAdapter: createImageBitmap failed — ${err.message}`);
    }
    const width = bitmap.width;
    const height = bitmap.height;
    const bounds = [0, 0, width, height];
    this._registerLayer({
      source: bitmap,
      width,
      height,
      channels: 'rgba',
      dtype: 'uint8',
      bounds
    });
    this.emit('loaded', {
      width,
      height,
      variable: null,
      bounds
    });
  }
  _registerLayer({
    source,
    width,
    height,
    channels,
    dtype,
    bounds
  }) {
    const dataTrigger = ++this._dataTrigger;
    const colorTrigger = this._colorTrigger;
    const lutController = this._lutController;
    this._ctrl.registerDataLayer(this._layerId, () => new BitmapDataLayer_js.BitmapDataLayer({
      id: this._layerId,
      source,
      width,
      height,
      channels,
      dtype,
      bitMapping: {
        bounds
      },
      lutController,
      dataTrigger,
      colorTrigger
    }));
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
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif'
    };
    return map[ext] || 'application/octet-stream';
  }
}

exports.RasterLoaderAdapter = RasterLoaderAdapter;
exports.TableLoaderAdapter = TableLoaderAdapter;
//# sourceMappingURL=loaders.cjs.js.map
