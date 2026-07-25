import { describe, it, expect } from 'vitest';
import { ExternalROIAdapter } from '../../src/integration/ExternalROIAdapter.js';
import { MockROIAdapter } from '../../src/integration/MockROIAdapter.js';
import { ROIController } from '../../src/plot/ROI/ROIController.js';

describe('ExternalROIAdapter constructor — registration-time validation (REL7)', () => {
  it('throws if roiController is omitted', () => {
    expect(() => new ExternalROIAdapter()).toThrow(/roiController is required/);
  });

  it('throws naming "load" when a subclass overrides nothing', () => {
    class IncompleteAdapter extends ExternalROIAdapter {}
    expect(() => new IncompleteAdapter(new ROIController(null))).toThrow(/load/);
  });

  it('throws naming "subscribe" when load/save are overridden but subscribe is not', () => {
    class PartialAdapter extends ExternalROIAdapter {
      async load() { return []; }
      async save() {}
    }
    expect(() => new PartialAdapter(new ROIController(null))).toThrow(/subscribe/);
  });

  it('constructs without throwing once all three methods are overridden (MockROIAdapter)', () => {
    expect(() => new MockROIAdapter(new ROIController(null))).not.toThrow();
  });

  it('rejects direct instantiation of the base class', () => {
    expect(() => new ExternalROIAdapter(new ROIController(null))).toThrow(/must override/);
  });
});
