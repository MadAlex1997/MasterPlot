import React, { useEffect, useRef, useState } from 'react';

let mermaidReady = false;
let mermaidLoading = null;

function loadMermaid() {
  if (mermaidReady) return Promise.resolve();
  if (mermaidLoading) return mermaidLoading;
  mermaidLoading = import('mermaid').then(mod => {
    const mermaid = mod.default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        background: '#111',
        primaryColor: '#1a3a4a',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#3a6a8a',
        lineColor: '#4a8aaa',
        secondaryColor: '#1a2a3a',
        tertiaryColor: '#0d1a26',
        edgeLabelBackground: '#111',
        clusterBkg: '#0d1a26',
      },
    });
    mermaidReady = true;
  });
  return mermaidLoading;
}

let _idCounter = 0;

export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const idRef = useRef(`mermaid-${++_idCounter}`);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadMermaid().then(async () => {
      if (cancelled || !containerRef.current) return;
      try {
        const { default: mermaid } = await import('mermaid');
        const id = idRef.current;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    });
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div style={{ color: '#f66', fontSize: 12, padding: 8, background: '#1a0a0a', borderRadius: 4 }}>
        Diagram error: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: 6,
        padding: 16,
        margin: '12px 0',
        overflowX: 'auto',
        textAlign: 'center',
      }}
    />
  );
}
