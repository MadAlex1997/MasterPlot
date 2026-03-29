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

import { EventEmitter } from 'events';
import { parse } from '@loaders.gl/core';
import { CSVLoader } from '@loaders.gl/csv';
import { ArrowLoader } from '@loaders.gl/arrow';
import { ParquetLoader } from '@loaders.gl/parquet';
import { ZstdCodec } from 'zstd-codec';
import {
  getTableLength,
  getTableRowAsObject,
  getTableCell,
} from '@loaders.gl/schema';

export class TableLoaderAdapter extends EventEmitter {
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

    this._dataStore    = dataStore;
    this._xCol         = opts.x;
    this._yCol         = opts.y;
    this._sizeOpt      = opts.size   ?? 4.0;
    this._colorOpt     = opts.color  ?? null;
    this._chunkSize    = opts.chunkSize ?? 50_000;
    this._replace      = opts.replace   ?? false;
    this._columns      = [];
    this._bigIntWarned = false;
  }

  /** @returns {string[]} Column names detected after last load (empty before first load). */
  getColumns() { return [...this._columns]; }

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
    this._columns   = [];
    this._dataStore = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _selectLoader(name) {
    const ext = name.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'arrow')   return ArrowLoader;
    if (ext === 'parquet') return ParquetLoader;
    return CSVLoader;
  }

  async _process(arrayBuffer, loader) {
    let table;
    try {
      table = await parse(arrayBuffer, loader, {
        csv: { dynamicTyping: true },
        modules: { 'zstd-codec': ZstdCodec },
      });
    } catch (err) {
      throw new Error(`TableLoaderAdapter: parse failed — ${err.message}`);
    }

    // ── Discover columns — works for schema-less object-row-table (Parquet) ──
    const total = getTableLength(table);
    if (total === 0) throw new Error('TableLoaderAdapter: file parsed but contains no rows — Parquet may use unsupported compression (try snappy or uncompressed)');
    const columns = Object.keys(getTableRowAsObject(table, 0));

    // Always set before any possible throw so getColumns() works for probing
    this._columns = columns;

    if (!columns.includes(this._xCol))
      throw new Error(`TableLoaderAdapter: column "${this._xCol}" not found. Available: ${columns.join(', ')}`);
    if (!columns.includes(this._yCol))
      throw new Error(`TableLoaderAdapter: column "${this._yCol}" not found. Available: ${columns.join(', ')}`);


    if (this._replace) this._dataStore.clear();

    // ── Stream in chunks ───────────────────────────────────────────────────
    let loaded = 0;
    while (loaded < total) {
      const end   = Math.min(loaded + this._chunkSize, total);
      const count = end - loaded;

      const x = new Float32Array(count);
      const y = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        x[i] = this._toFloat(getTableCell(table, loaded + i, this._xCol), this._xCol, loaded + i);
        y[i] = this._toFloat(getTableCell(table, loaded + i, this._yCol), this._yCol, loaded + i);
      }

      const bufferStruct = { x, y };

      // Optional size
      if (typeof this._sizeOpt === 'string' && columns.includes(this._sizeOpt)) {
        const size = new Float32Array(count);
        for (let i = 0; i < count; i++)
          size[i] = this._toFloat(getTableCell(table, loaded + i, this._sizeOpt), this._sizeOpt, loaded + i);
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
      this.emit('chunk', { loaded, total });
    }

    this.emit('loaded', { rowCount: total, columns: this._columns });
  }

  _toFloat(value, colName, rowIndex) {
    if (value == null || (typeof value === 'number' && isNaN(value))) {
      this.emit('parseWarning', { message: `null/NaN at row ${rowIndex} col "${colName}", replaced with 0` });
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
      const raw = colorColName ? getTableCell(table, startRow + i, colorColName) : 0;
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

export default TableLoaderAdapter;
