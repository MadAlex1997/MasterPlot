export default function HubPage() {
  const demos = [
    {
      href: 'example.html',
      title: 'Scatter / ROI',
      desc: '1M points + live append every 2 s. ROI creation (L/R keys), LinearRegion constraint propagation, event log. DataStore supports rolling ring buffer (count + age expiration).',
    },
    {
      href: 'line.html',
      title: 'Line Plot',
      desc: '1M points rendered via WebGL. Zoom, pan, ROI selection.',
    },
    {
      href: 'spectrogram.html',
      title: 'Spectrogram',
      desc: 'Real-time STFT spectrogram with audio file loading, HistogramLUT, playback, and biquad filters.',
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
