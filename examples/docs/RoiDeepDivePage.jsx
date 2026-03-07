import React from 'react';

const sectionStyle = { marginBottom: 56 };
const h2Style = {
  fontSize: 22, fontWeight: 700, color: '#fff',
  marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #222',
};
const pStyle = { fontSize: 14, lineHeight: 1.8, color: '#bbb', marginBottom: 12 };

export default function RoiDeepDivePage() {
  return (
    <section id="roi-deep-dive" style={sectionStyle}>
      <h2 style={h2Style}>ROI System Deep-Dive</h2>
      <p style={pStyle}>
        Full deep-dive coming in DOC4. This section will cover the ROI class hierarchy,
        creation modes, LineROI variants, ConstraintEngine sequencing, monotonic versioning,
        and the full serialization/external-sync round-trip.
      </p>
    </section>
  );
}
