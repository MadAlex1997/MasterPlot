// MasterPlot — TypeScript declarations for the optional `masterplot/loaders` subpath
// (mirrors loaders/index.js). Hand-written (REL4) — not generated from JSDoc.
// Requires @loaders.gl/* (and zstd-codec for Parquet) as optional peer dependencies.

import { EventEmitter } from 'events';
import type { DataStore, PlotController, LUTController } from '../src/index.js';

export type TableColorAccessor = (value: unknown) => [number, number, number, number?];

export interface TableLoaderAdapterOptions {
  /** Required. Column name for the X axis. */
  x: string;
  /** Required. Column name for the Y axis. */
  y: string;
  /** Column name, fixed number, or null. @default 4.0 */
  size?: string | number | null;
  /** Column name, fn(value) => [r,g,b,a?], or null. @default null */
  color?: string | TableColorAccessor | null;
  /** Rows per appendData() call while streaming. @default 50000 */
  chunkSize?: number;
  /** Clear the DataStore before loading. @default false */
  replace?: boolean;
}

export interface TableChunkPayload {
  loaded: number;
  total: number;
}
export interface TableLoadedPayload {
  rowCount: number;
  columns: string[];
}
export interface ParseWarningPayload {
  message: string;
}

/**
 * Loads CSV/TSV/Arrow/Parquet tabular files into a DataStore, streaming in
 * chunkSize-row batches. Requires @loaders.gl/core plus the format-specific
 * loader package(s) for the formats actually used.
 */
export class TableLoaderAdapter extends EventEmitter {
  constructor(dataStore: DataStore, opts: TableLoaderAdapterOptions);

  getColumns(): string[];
  loadFile(file: File): Promise<void>;
  loadURL(url: string, fetchOptions?: RequestInit): Promise<void>;
  destroy(): void;

  on(event: 'chunk', listener: (payload: TableChunkPayload) => void): this;
  on(event: 'loaded', listener: (payload: TableLoadedPayload) => void): this;
  on(event: 'parseWarning', listener: (payload: ParseWarningPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'chunk', payload: TableChunkPayload): boolean;
  emit(event: 'loaded', payload: TableLoadedPayload): boolean;
  emit(event: 'parseWarning', payload: ParseWarningPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}

export interface RasterLoaderAdapterOptions {
  /** Passed to plotController.registerDataLayer(). @default 'raster' */
  layerId?: string;
  /** NetCDF variable name; ignored for image formats. @default null */
  variable?: string | null;
  /** NetCDF dimension name for the X axis. @default 'lon' */
  xDim?: string;
  /** NetCDF dimension name for the Y axis. @default 'lat' */
  yDim?: string;
  lutController?: LUTController | null;
  /** Flip row order so row 0 = bottom. @default true */
  flipY?: boolean;
}

export interface RasterLoadArrayOptions {
  /** [left, bottom, right, top]. @default [0, 0, width, height] */
  bounds?: [number, number, number, number];
  /** @default 'gray' */
  channels?: 'gray' | 'rgb' | 'rgba';
  /** @default 'float32' */
  dtype?: string;
}

export interface RasterLoadedPayload {
  width: number;
  height: number;
  /** NetCDF variable name, or null for image-file/loadArray() loads. */
  variable: string | null;
  bounds: number[];
}

/**
 * Loads NetCDF (v3 classic; NetCDF4/HDF5 .nc4 is NOT supported by
 * @loaders.gl/netcdf) or common raster image formats (PNG/JPEG/WebP/BMP/TIFF)
 * into a BitmapDataLayer registered on a PlotController.
 */
export class RasterLoaderAdapter extends EventEmitter {
  constructor(plotController: PlotController, opts?: RasterLoaderAdapterOptions);

  getVariables(): string[];
  getDimensions(): Record<string, string[]>;
  loadFile(file: File): Promise<void>;
  loadURL(url: string, fetchOptions?: RequestInit): Promise<void>;
  /** Synchronous — registers a bitmap layer directly from an in-memory array. */
  loadArray(
    data: Float32Array | Uint8Array,
    width: number,
    height: number,
    opts?: RasterLoadArrayOptions
  ): void;
  destroy(): void;

  on(event: 'loaded', listener: (payload: RasterLoadedPayload) => void): this;
  on(event: 'parseWarning', listener: (payload: ParseWarningPayload) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: 'loaded', payload: RasterLoadedPayload): boolean;
  emit(event: 'parseWarning', payload: ParseWarningPayload): boolean;
  emit(event: string, ...args: any[]): boolean;
}
