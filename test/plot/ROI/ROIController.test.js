import { describe, it, expect, vi } from 'vitest';
import { ROIController } from '../../../src/plot/ROI/ROIController.js';
import { RectROI } from '../../../src/plot/ROI/RectROI.js';

// F41: configurable ROI-creation keybinds. init() only attaches DOM listeners
// (no WebGL/getContext calls), so a plain document.createElement('canvas')
// works fine in jsdom.

describe('ROIController — default keybinds (F41)', () => {
  it('l/r/v/h enter the matching creation mode when the mouse is over the canvas', () => {
    const ctrl = new ROIController(null);
    ctrl._mouseIsOver = true;

    ctrl._onKeyDown({ key: 'l' });
    expect(ctrl._mode).toBe('createLinear');

    ctrl._onKeyDown({ key: 'r' });
    expect(ctrl._mode).toBe('createRect');

    ctrl._onKeyDown({ key: 'v' });
    expect(ctrl._mode).toBe('createVLine');

    ctrl._onKeyDown({ key: 'h' });
    expect(ctrl._mode).toBe('createHLine');
  });

  it('Escape cancels creation mode', () => {
    const ctrl = new ROIController(null);
    ctrl._mouseIsOver = true;
    ctrl._onKeyDown({ key: 'l' });
    expect(ctrl._mode).toBe('createLinear');

    ctrl._onKeyDown({ key: 'Escape' });
    expect(ctrl._mode).toBe('idle');
  });

  it('l/r/v/h/Escape do nothing when the mouse is not over the canvas', () => {
    const ctrl = new ROIController(null);
    ctrl._mouseIsOver = false;

    ctrl._onKeyDown({ key: 'l' });
    expect(ctrl._mode).toBe('idle');
  });

  it('d deletes the active ROI regardless of _mouseIsOver', () => {
    const ctrl = new ROIController(null);
    const roi = new RectROI({ id: 'r1', x1: 0, x2: 1, y1: 0, y2: 1 });
    ctrl.addROI(roi);
    ctrl._activeROI = roi;
    ctrl._mouseIsOver = false;

    ctrl._onKeyDown({ key: 'd' });

    expect(ctrl.getROI('r1')).toBeUndefined();
  });

  it('d deletes a selected (not active) ROI when none is active', () => {
    const ctrl = new ROIController(null);
    const roi = new RectROI({ id: 'r1', x1: 0, x2: 1, y1: 0, y2: 1 });
    roi.selected = true;
    ctrl.addROI(roi);

    ctrl._onKeyDown({ key: 'd' });

    expect(ctrl.getROI('r1')).toBeUndefined();
  });
});

describe('ROIController — setKeyBindings (F41)', () => {
  it('remaps a key at runtime; the old key stops working and the new one takes over', () => {
    const ctrl = new ROIController(null);
    ctrl._mouseIsOver = true;
    ctrl.setKeyBindings({ createLinear: 'q' });

    ctrl._onKeyDown({ key: 'l' });
    expect(ctrl._mode).toBe('idle'); // old key no longer bound

    ctrl._onKeyDown({ key: 'q' });
    expect(ctrl._mode).toBe('createLinear');
  });

  it('remaps deleteROI and it still bypasses the _mouseIsOver gate', () => {
    const ctrl = new ROIController(null);
    ctrl.setKeyBindings({ deleteROI: 'x' });
    const roi = new RectROI({ id: 'r1', x1: 0, x2: 1, y1: 0, y2: 1 });
    ctrl.addROI(roi);
    ctrl._activeROI = roi;
    ctrl._mouseIsOver = false;

    ctrl._onKeyDown({ key: 'd' }); // old key: no-op
    expect(ctrl.getROI('r1')).toBeDefined();

    ctrl._onKeyDown({ key: 'x' }); // new key: deletes
    expect(ctrl.getROI('r1')).toBeUndefined();
  });

  it('constructor accepts opts.keyBindings directly', () => {
    const ctrl = new ROIController(null, { keyBindings: { createRect: 'z' } });
    ctrl._mouseIsOver = true;

    ctrl._onKeyDown({ key: 'r' });
    expect(ctrl._mode).toBe('idle');

    ctrl._onKeyDown({ key: 'z' });
    expect(ctrl._mode).toBe('createRect');
  });

  it('warns and falls back to the default on an invalid (non-string/empty) key value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctrl = new ROIController(null, { keyBindings: { createLinear: '' } });
    ctrl._mouseIsOver = true;

    expect(warn).toHaveBeenCalled();
    ctrl._onKeyDown({ key: 'l' }); // falls back to default 'l'
    expect(ctrl._mode).toBe('createLinear');
    warn.mockRestore();
  });

  it('warns on an unrecognized action name in the supplied config', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new ROIController(null, { keyBindings: { notARealAction: 'q' } });

    expect(warn.mock.calls.some(c => /unknown keyBindings action/.test(c[0]))).toBe(true);
    warn.mockRestore();
  });

  it('warns when two actions are bound to the same key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new ROIController(null, { keyBindings: { createLinear: 'x', createRect: 'x' } });

    expect(warn.mock.calls.some(c => /both bind to "x"/.test(c[0]))).toBe(true);
    warn.mockRestore();
  });
});

describe('ROIController — end-to-end keydown wiring via init()', () => {
  it('a real "keydown" event dispatched on window reaches _onKeyDown and changes mode', () => {
    const canvas = document.createElement('canvas');
    const ctrl = new ROIController(null);
    ctrl.init(canvas);
    ctrl._mouseIsOver = true;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
    expect(ctrl._mode).toBe('createLinear');

    ctrl.destroy();
  });
});
