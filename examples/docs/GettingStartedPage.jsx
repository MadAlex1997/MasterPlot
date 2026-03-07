import React from 'react';

const sectionStyle = { marginBottom: 56 };
const h2Style = {
  fontSize: 22, fontWeight: 700, color: '#fff',
  marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #222',
};
const pStyle = { fontSize: 14, lineHeight: 1.8, color: '#bbb', marginBottom: 12 };

export default function GettingStartedPage() {
  return (
    <section id="getting-started" style={sectionStyle}>
      <h2 style={h2Style}>Getting Started</h2>
      <p style={pStyle}>
        Full tutorial coming in DOC2. This section will cover installation, mounting a plot,
        live data append, zoom/pan, ROI creation, event listening, and shared DataStore usage —
        each step with syntax-highlighted code blocks and copy buttons.
      </p>
    </section>
  );
}
