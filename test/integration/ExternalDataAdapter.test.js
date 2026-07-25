import { describe, it, expect } from 'vitest';
import { ExternalDataAdapter } from '../../src/integration/ExternalDataAdapter.js';
import { MockDataAdapter } from '../../src/integration/MockDataAdapter.js';
import { DataStore } from '../../src/plot/DataStore.js';

describe('ExternalDataAdapter constructor — registration-time validation (REL7)', () => {
  it('throws if dataStore is omitted', () => {
    expect(() => new ExternalDataAdapter()).toThrow(/dataStore is required/);
  });

  it('throws naming the method when a subclass does not override replaceData/appendData', () => {
    class IncompleteAdapter extends ExternalDataAdapter {}
    expect(() => new IncompleteAdapter(new DataStore())).toThrow(/replaceData/);
  });

  it('throws naming appendData when only replaceData is overridden', () => {
    class PartialAdapter extends ExternalDataAdapter {
      replaceData(buf) { this._dataStore.clear(); this._dataStore.appendData(buf); }
    }
    expect(() => new PartialAdapter(new DataStore())).toThrow(/appendData/);
  });

  it('constructs without throwing once both methods are overridden (MockDataAdapter)', () => {
    expect(() => new MockDataAdapter(new DataStore())).not.toThrow();
  });

  it('rejects direct instantiation of the base class (both methods are the throwing stubs)', () => {
    expect(() => new ExternalDataAdapter(new DataStore())).toThrow(/must override/);
  });
});
