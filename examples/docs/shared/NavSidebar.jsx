import React, { useEffect, useRef, useState } from 'react';

const NAV_ITEMS = [
  { id: 'architecture',    label: 'Architecture' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'api-reference',   label: 'API Reference' },
  { id: 'roi-deep-dive',   label: 'ROI Deep-Dive' },
];

const styles = {
  sidebar: {
    width: 200,
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#111',
    borderRight: '1px solid #222',
    padding: '24px 0',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#555',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    padding: '0 20px 16px',
  },
  link: {
    display: 'block',
    padding: '8px 20px',
    fontSize: 13,
    color: '#888',
    textDecoration: 'none',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  },
  linkActive: {
    color: '#7df',
    borderLeftColor: '#7df',
  },
};

export default function NavSidebar() {
  const [activeId, setActiveId] = useState('architecture');
  const observerRef = useRef(null);

  useEffect(() => {
    const sections = NAV_ITEMS.map(n => document.getElementById(n.id)).filter(Boolean);

    observerRef.current = new IntersectionObserver(
      entries => {
        // Pick the topmost visible section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(s => observerRef.current.observe(s));
    return () => observerRef.current && observerRef.current.disconnect();
  }, []);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav style={styles.sidebar}>
      <div style={styles.sidebarTitle}>Docs</div>
      {NAV_ITEMS.map(item => (
        <a
          key={item.id}
          style={{ ...styles.link, ...(activeId === item.id ? styles.linkActive : {}) }}
          onClick={() => scrollTo(item.id)}
          onMouseEnter={e => { if (activeId !== item.id) e.currentTarget.style.color = '#ccc'; }}
          onMouseLeave={e => { if (activeId !== item.id) e.currentTarget.style.color = '#888'; }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
