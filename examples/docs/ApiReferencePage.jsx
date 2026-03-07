import React from 'react';

const sectionStyle = { marginBottom: 56 };
const h2Style = {
  fontSize: 22, fontWeight: 700, color: '#fff',
  marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #222',
};
const pStyle = { fontSize: 14, lineHeight: 1.8, color: '#bbb', marginBottom: 12 };

export default function ApiReferencePage() {
  return (
    <section id="api-reference" style={sectionStyle}>
      <h2 style={h2Style}>API Reference</h2>
      <p style={pStyle}>
        Full API reference coming in DOC3. This section will cover all public constructors,
        methods, and events for: PlotController, AxisController, ROIController, DataStore,
        PlotDataView, TraceGroup, SignalStore, and FilterController.
      </p>
    </section>
  );
}
