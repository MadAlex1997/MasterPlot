/**
 * TableLoaderAdapter — F32
 *
 * Loads CSV, TSV, or Apache Arrow (.arrow) files and streams the parsed rows
 * into a MasterPlot DataStore as typed-array bufferStructs.
 *
 * Supported formats (via @loaders.gl):
 *   .csv / .tsv  → @loaders.gl/csv  CSVLoader
 *   .arrow       → @loaders.gl/arrow ArrowLoader
 *   .parquet     → @loaders.gl/parquet ParquetLoader (parquetjs; no WASM required)
 *
 * Usage:
 *   const adapter = new TableLoaderAdapter(dataStore, { x: 'time', y: 'amplitude' });
 *   await adapter.loadFile(file);
 *
 * Events: 'loaded' { rowCount, columns }, 'chunk' { loaded, total }, 'parseWarning' { message }
 */

import { EventEmitter } from 'events';
import { parse } from '@loaders.gl/core';
import { CSVLoader } from '@loaders.gl/csv';
import { ArrowLoader } from '@loaders.gl/arrow';
import { ParquetLoader } from '@loaders.gl/parquet';

export class TableLoaderAdapter extends EventEmitter {
  /**
   * @param {import('../src/plot/DataStore.js').DataStore} dataStore
   * @param {object} opts
   * @param {string}              opts.x         — column name for X axis (required)
   * @param {string}              opts.y         — column name for Y axis (required)
   * @param {string|number|null}  [opts.size]    — column name, fixed number, or null (default 4.0)
   * @param {string|Function|null}[opts.color]   — column name, fn(value)→[r,g,b,a], or null
   * @param {number}              [opts.chunkSize=50_000] — rows per appendData call
   * @param {boolean}             [opts.replace=false]   — if true, clears store before loading
   */
  constructor(dataStore, opts = {}) {
    super();
    if (!dataStore) throw new Error('TableLoaderAdapter: dataStore is required');
    if (!opts.x || !opts.y) throw new Error('TableLoaderAdapter: opts.x and opts.y are required');

    this._dataStore     = dataStore;
    this._xCol          = opts.x;
    this._yCol          = opts.y;
    this._sizeOpt       = opts.size   ?? 4.0;
    this._colorOpt      = opts.color  ?? null;
    this._chunkSize     = opts.chunkSize ?? 50_000;
    this._replace       = opts.replace   ?? false;
    this._columns       = [];
    this._bigIntWarned  = false;
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
    await this._processArrayBuffer(arrayBuffer, loader);
  }

  /**
   * Parse a remote URL.
   * @param {string} url
   * @param {RequestInit} [fetchOptions]
   */
  async loadURL(url, fetchOptions = {}) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`TableLoaderAdapter: fetch failed: ${response.status} ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const loader = this._selectLoader(url);
    await this._processArrayBuffer(arrayBuffer, loader);
  }

  destroy() {
    this._columns   = [];
    this._dataStore = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _selectLoader(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'arrow')   return ArrowLoader;
    if (ext === 'parquet') return ParquetLoader;
    return CSVLoader;  // csv, tsv, and anything else
  }

  async _processArrayBuffer(arrayBuffer, loader) {
    // ── Parse ────────────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = await parse(arrayBuffer, loader, { csv: { dynamicTyping: true } });
    } catch (err) {
      throw new Error(`TableLoaderAdapter: parse failed — ${err.message}`);
    }

    // ── Normalize to a column map ────────────────────────────────────────────
    const columns = this._normalizeToColumns(parsed);

    // Set columns before validation so getColumns() works even if load fails
    this._columns = Object.keys(columns);

    // ── Validate required columns ────────────────────────────────────────────
    if (!columns[this._xCol]) throw new Error(`TableLoaderAdapter: column "${this._xCol}" not found. Available: ${this._columns.join(', ')}`);
    if (!columns[this._yCol]) throw new Error(`TableLoaderAdapter: column "${this._yCol}" not found. Available: ${this._columns.join(', ')}`);

    const xRaw  = columns[this._xCol];
    const yRaw  = columns[this._yCol];
    const total = xRaw.length;

    if (this._replace) {
      this._dataStore.clear();
    }

    // ── Stream in chunks ──────────────────────────────────────────────────────
    let loaded = 0;
    while (loaded < total) {
      const end    = Math.min(loaded + this._chunkSize, total);
      const count  = end - loaded;

      const xSlice = this._toFloat32Slice(xRaw, loaded, end, 'x');
      const ySlice = this._toFloat32Slice(yRaw, loaded, end, 'y');

      const bufferStruct = { x: xSlice, y: ySlice };

      // Optional size column
      const sizeRaw = (typeof this._sizeOpt === 'string') ? columns[this._sizeOpt] : null;
      if (sizeRaw) {
        bufferStruct.size = this._toFloat32Slice(sizeRaw, loaded, end, 'size');
      } else if (typeof this._sizeOpt === 'number') {
        bufferStruct.size = new Float32Array(count).fill(this._sizeOpt);
      }

      // Optional color column
      if (this._colorOpt !== null) {
        const colorRaw = (typeof this._colorOpt === 'string') ? columns[this._colorOpt] : null;
        if (typeof this._colorOpt === 'function') {
          bufferStruct.color = this._buildColorFromFn(xRaw, loaded, end, this._colorOpt, colorRaw);
        } else if (colorRaw) {
          bufferStruct.color = this._buildColorFromFn(colorRaw, loaded, end, this._colorOpt, colorRaw);
        }
      }

      this._dataStore.appendData(bufferStruct);
      loaded = end;
      this.emit('chunk', { loaded, total });
    }

    this.emit('loaded', { rowCount: total, columns: this._columns });
  }

  /**
   * Normalize the parsed result (CSV object-row-table OR Arrow Table) to
   * a plain `{ colName: Array | TypedArray }` map.
   */
  _normalizeToColumns(parsed) {
    // ── CSV: { shape: 'object-row-table', data: [{col: val}, ...] } ───────────
    if (parsed && parsed.shape === 'object-row-table' && Array.isArray(parsed.data)) {
      const rows = parsed.data;
      if (rows.length === 0) return {};
      const colNames = Object.keys(rows[0]);
      const result = {};
      for (const name of colNames) {
        result[name] = rows.map(r => r[name]);
      }
      return result;
    }

    // ── Arrow Table: has .schema.fields and .getChild() ───────────────────────
    if (parsed && parsed.schema && parsed.schema.fields) {
      const result = {};
      for (const field of parsed.schema.fields) {
        const col = parsed.getChild(field.name);
        if (col) result[field.name] = col.toArray();
      }
      return result;
    }

    // ── Fallback: if it's already an array of objects ─────────────────────────
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      const colNames = Object.keys(parsed[0]);
      const result = {};
      for (const name of colNames) {
        result[name] = parsed.map(r => r[name]);
      }
      return result;
    }

    throw new Error('TableLoaderAdapter: unrecognized parsed table format');
  }

  /**
   * Convert a slice of a raw column (any numeric type) to Float32Array.
   * Handles BigInt64Array with one-time console warning.
   */
  _toFloat32Slice(raw, start, end, fieldName) {
    const count  = end - start;
    const result = new Float32Array(count);
    let nullCount = 0;

    for (let i = 0; i < count; i++) {
      const v = raw[start + i];
      if (v == null || (typeof v === 'number' && isNaN(v))) {
        result[i] = 0;
        nullCount++;
      } else if (typeof v === 'bigint') {
        if (!this._bigIntWarned) {
          console.warn(`TableLoaderAdapter: BigInt column "${fieldName}" converted to Float32 — precision may be lost.`);
          this._bigIntWarned = true;
        }
        result[i] = Number(v);
      } else {
        result[i] = Number(v);
      }
    }

    if (nullCount > 0) {
      this.emit('parseWarning', { message: `${nullCount} null/NaN values in "${fieldName}" (offset ${start}–${end}) replaced with 0` });
    }

    return result;
  }

  /**
   * Build a Uint8Array RGBA color buffer by calling colorFn(value) per row,
   * or treating the raw column as a packed uint32 ARGB color if fn is a string.
   */
  _buildColorFromFn(rawOrUnused, start, end, colorFn, rawCol) {
    const count  = end - start;
    const result = new Uint8Array(count * 4);
    const col    = rawCol || rawOrUnused;

    for (let i = 0; i < count; i++) {
      const rgba = colorFn(col ? col[start + i] : 0);
      if (Array.isArray(rgba) && rgba.length >= 3) {
        result[i * 4 + 0] = rgba[0] & 0xff;
        result[i * 4 + 1] = rgba[1] & 0xff;
        result[i * 4 + 2] = rgba[2] & 0xff;
        result[i * 4 + 3] = rgba[3] != null ? rgba[3] & 0xff : 255;
      } else {
        // Fallback: opaque white
        result[i * 4 + 0] = 255;
        result[i * 4 + 1] = 255;
        result[i * 4 + 2] = 255;
        result[i * 4 + 3] = 255;
      }
    }
    return result;
  }
}

export default TableLoaderAdapter;
