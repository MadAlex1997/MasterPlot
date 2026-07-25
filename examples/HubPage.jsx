export default function HubPage() {
  const docCards = [
    {
      href: 'docs.html#architecture',
      title: 'Architecture Overview',
      desc: 'PlotController orchestration, render loop, event bus, coordinate systems, and GPU data flow.',
    },
    {
      href: 'docs.html#getting-started',
      title: 'Getting Started',
      desc: 'Install, mount a plot, live append, zoom/pan, ROI creation, event listening, shared DataStore.',
    },
    {
      href: 'docs.html#api-reference',
      title: 'API Reference',
      desc: 'Full constructor options, methods, and events for all public classes.',
    },
    {
      href: 'docs.html#roi-deep-dive',
      title: 'ROI Deep-Dive',
      desc: 'Class hierarchy, LineROI modes, ConstraintEngine sequencing, versioning, and external sync.',
    },
    {
      href: 'docs.html#plotcontroller-deep-dive',
      title: 'PlotController Deep-Dive',
      desc: 'Init pipeline, two-canvas model, render loop, layer registry, three zoom modes, coordinate systems, data flow to GPU, ownership model, and full events reference.',
    },
  ];

  const demos = [
    {
      href: 'example.html',
      title: 'Scatter / ROI',
      desc: '10k default / up to 10M via dropdown. Live append every 2 s. ROI creation: L (LinearRegion), R (RectROI), V (vertical LineROI), H (horizontal LineROI). LinearRegion constraint propagation + cascading child versioning (F19). LineROI (F20): full/half variants with canvas-overlay labels, draggable, version-gated sync. ROIs carry monotonic version numbers; serializeAll/updateFromExternal enable persistence. DataStore supports rolling ring buffer; PlotDataView provides lazy filtered views.',
    },
    {
      href: 'live-signals.html',
      title: 'Live Signal Analysis',
      desc: 'Three live sin/cos signals on a configurable rolling window (10 s / 30 s / 60 s). Draw a LinearRegion ROI (L key) to see per-signal statistics — mean, RMS, and peak-to-peak amplitude — updated live as the window scrolls. Pause/Resume, live point count, and rolling expiry events.',
    },
    {
      href: 'spectrogram-v2.html',
      title: 'Spectrogram V2 (EX-Spec)',
      desc: 'Phase 4 spectrogram: AudioController tiled STFT → BitmapDataLayer per tile; LUTController + LUTHistogramController + LUTPanel sidebar for real-time colormap / level adjustment; FilterPanel sidebar with setFilterFn bridge; playhead vline ROI; user RectROI annotations (press R); waveform PathLayer synced to spectrogram x-axis.',
    },
    {
      href: 'bitmap-lod.html',
      title: 'Bitmap LOD (F31 / EX18)',
      desc: 'Two-panel BitmapViewGenerator demo. Panel 1 — local Gaussian heatmap: bilinear LOD slices the visible domain from a 512×512 base grid and resamples to viewport resolution; debounce slider; LUTPanel sidebar. Panel 2 — URL fetch: CDS HiPS2FITS 2MASS K-band all-sky; re-fetches at viewport dimensions on zoom/pan; stale inflight requests cancelled via AbortSignal; loading indicator.',
    },
    {
      href: 'data-loaders.html',
      title: 'Data Loaders (F32 / F33 / EX19)',
      desc: 'Two-panel loaders.gl demo. Panel 1 — Tabular scatter: drag-and-drop CSV/TSV/Arrow/Parquet files; column dropdowns for X/Y/size mapping; streaming progress bar via chunk events; synthetic 10k-row sample. Panel 2 — Raster heatmap: drop .nc (NetCDF3) or image files; automatic bounds from coordinate arrays; LUTPanel sidebar; synthetic 128×128 temperature field sample.',
    },
    {
      href: 'bitmap.html',
      title: 'Bitmap Layers (EX16)',
      desc: 'Three panels demonstrating BitmapDataLayer without audio: (1) local image file loaded via createImageBitmap with configurable bitMapping; (2) 256×256 Float32 Gaussian heatmap with live LUTPanel sidebar — drag level handles, swap colormap; (3) URL image rendered with geographic lon/lat bounds.',
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
      desc: '50 stacked channels with shared X-axis zoom/pan. Each channel has an independent Y-axis and a draggable vline-half-bottom P-wave pick. Sidebar table shows station, label, and position — edits are version-gated via updateFromExternal(). React owns zero geometry.',
    },
    {
      href: 'multi-sensor.html',
      title: 'Multi-Sensor Scatter (F22/EX7)',
      desc: '50 sensors × 10k points each (500k total). TraceGroup partitions bulk data by tag in O(n). 25-color OKLAB-derived palette cycles at sensor_25. Scrollable sidebar with per-sensor visibility checkboxes + color swatches. Show All / Hide All bulk controls. React owns zero arrays.',
    },
    {
      href: 'axis-showcase.html',
      title: 'Axis Options Showcase (EX20)',
      desc: '2×3 grid of independently pannable/zoomable plots covering all F34/F35 axis modes: border (default), no-border fill, mirrored edges, relative/stationary at zero, mobile (snaps to edge), and mobile/hide-when-offscreen. Each plot is seeded with the same 200-point deterministic scatter.',
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

      <div style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
          Documentation
        </div>
        <div style={styles.grid}>
          {docCards.map(d => (
            <a key={d.href} href={d.href} style={{ ...styles.card, borderColor: '#1e2e1e' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#4d8'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2e1e'}
            >
              <span style={{ ...styles.cardTitle, color: '#4d8' }}>{d.title}</span>
              <span style={styles.cardDesc}>{d.desc}</span>
            </a>
          ))}
        </div>
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
