export default function HubPage() {
  const demos = [
    {
      href: 'example.html',
      title: 'Scatter / ROI',
      desc: '1M points + live append every 2 s. ROI creation: L (LinearRegion), R (RectROI), V (vertical LineROI), H (horizontal LineROI). LinearRegion constraint propagation + cascading child versioning (F19). LineROI (F20): full/half variants with canvas-overlay labels, draggable, version-gated sync. ROIs carry monotonic version numbers; serializeAll/updateFromExternal enable persistence. DataStore supports rolling ring buffer; PlotDataView provides lazy filtered views.',
    },
    {
      href: 'live-signals.html',
      title: 'Live Signal Analysis',
      desc: 'Three live sin/cos signals on a configurable rolling window (10 s / 30 s / 60 s). Draw a LinearRegion ROI (L key) to see per-signal statistics — mean, RMS, and peak-to-peak amplitude — updated live as the window scrolls. Pause/Resume, live point count, and rolling expiry events.',
    },
    {
      href: 'spectrogram.html',
      title: 'Spectrogram (EX9)',
      desc: 'Real-time STFT with pluggable window functions (Hann/Hamming/Blackman/Rectangular), preset sound loading, per-type DSP filter UI (single cutoff+Q for lowpass/highpass; dual freq sliders for bandpass/notch with computed center+Q and dual canvas markers), auto-zoom y-axis after Apply, HistogramLUT with clamped level handles, synchronized waveform, and playback.',
    },
    {
      href: 'shared-data.html',
      title: 'Shared Data (F17)',
      desc: 'Two PlotControllers sharing a single DataStore. Plot A shows all points; Plot B shows only points inside a LinearRegion drawn on Plot A — lazy PlotDataView recomputes on roiFinalized, not on drag.',
    },
    {
      href: 'https://github.com/MadAlex1997/MasterPlot#external-integration-f18',
      title: 'Integration Guide (F18)',
      desc: 'ExternalDataAdapter + ExternalROIAdapter contracts. MockDataAdapter (random batches on timer) and MockROIAdapter (localStorage-backed ROI persistence). README → External Integration section.',
    },
    {
      href: 'seismography.html',
      title: 'Seismography (EX5)',
      desc: '10 stacked channels with shared X-axis zoom/pan. Each channel has an independent Y-axis and a draggable vline-half-bottom P-wave pick. Sidebar table shows station, label, and position — edits are version-gated via updateFromExternal(). React owns zero geometry.',
    },
    {
      href: 'multi-sensor.html',
      title: 'Multi-Sensor Scatter (F22/EX7)',
      desc: '50 sensors × 10k points each (500k total). TraceGroup partitions bulk data by tag in O(n). 25-color OKLAB-derived palette cycles at sensor_25. Scrollable sidebar with per-sensor visibility checkboxes + color swatches. Show All / Hide All bulk controls. React owns zero arrays.',
    },
  ];

  const styles = {
    page: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0d0d0d',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      gap: 32,
      padding: 32,
    },
    heading: {
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: 2,
      color: '#fff',
      margin: 0,
    },
    sub: {
      fontSize: 13,
      color: '#555',
      margin: 0,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 20,
      width: '100%',
      maxWidth: 900,
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '20px 24px',
      background: '#151515',
      border: '1px solid #282828',
      borderRadius: 6,
      textDecoration: 'none',
      color: 'inherit',
      transition: 'border-color 0.15s',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: 700,
      color: '#7df',
    },
    cardDesc: {
      fontSize: 12,
      color: '#666',
      lineHeight: 1.6,
    },
  };

  return (
    <div style={styles.page}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={styles.heading}>MasterPlot</h1>
        <p style={styles.sub}>Production-grade scientific plotting engine · WebGL</p>
      </div>

      <div style={styles.grid}>
        {demos.map(d => (
          <a key={d.href} href={d.href} style={styles.card}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7df'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#282828'}
          >
            <span style={styles.cardTitle}>{d.title}</span>
            <span style={styles.cardDesc}>{d.desc}</span>
          </a>
        ))}
      </div>

      <a
        href="https://github.com/MadAlex1997/MasterPlot"
        style={{ fontSize: 12, color: '#444', textDecoration: 'none' }}
      >
        github.com/MadAlex1997/MasterPlot
      </a>
    </div>
  );
}
