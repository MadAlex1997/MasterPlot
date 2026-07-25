// MasterPlot — TypeScript declarations for the optional `masterplot/ui` subpath
// (mirrors ui/index.js). Hand-written (REL4) — not generated from JSDoc.
// Requires react >= 18 as a peer dependency.

import type * as React from 'react';
import type { FilterController, LUTController, LUTHistogramController } from '../src/index.js';

export interface FilterPanelProps {
  /** Required. */
  controller: FilterController;
  /** @default 44100 */
  sampleRate?: number;
  /** Called with no arguments on Apply click. */
  onApply?: () => void;
  /** @default false */
  applying?: boolean;
}

/** Filter type/order/frequency/Q controls + a live frequency-response plot, bound to a FilterController. */
export function FilterPanel(props: FilterPanelProps): React.ReactElement | null;

export interface LUTPanelProps {
  /** Required. Manages colormap + levels. */
  lutController: LUTController;
  /** Required. Owns the internal histogram PlotController. */
  lutHistCtrl: LUTHistogramController;
  /** @default 160 */
  width?: number;
  /** @default '100%' */
  height?: string | number;
}

/** Colormap picker + level histogram panel, bound to a LUTController/LUTHistogramController pair. */
export function LUTPanel(props: LUTPanelProps): React.ReactElement | null;

export interface HelpOverlayControl {
  key: string;
  description: string;
}

export interface HelpOverlayProps {
  /** Overlay heading text. */
  title: string;
  /** Rows rendered in the controls table. */
  controls: HelpOverlayControl[];
  /** localStorage key used to persist "seen" (auto-open-once) state. */
  storageKey: string;
}

/** Always-visible "?" button + a dismissible full-screen controls-reference modal. */
export function HelpOverlay(props: HelpOverlayProps): React.ReactElement;
