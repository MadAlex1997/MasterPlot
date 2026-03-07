import React from 'react';
import NavSidebar from './docs/shared/NavSidebar';
import ArchitecturePage from './docs/ArchitecturePage';
import GettingStartedPage from './docs/GettingStartedPage';
import ApiReferencePage from './docs/ApiReferencePage';
import RoiDeepDivePage from './docs/RoiDeepDivePage';

const styles = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0d0d0d',
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    background: '#0d0d0d',
    borderBottom: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 1,
    color: '#fff',
  },
  backLink: {
    fontSize: 12,
    color: '#7df',
    textDecoration: 'none',
  },
  layout: {
    display: 'flex',
    flex: 1,
    marginTop: 48,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '40px 48px',
    maxWidth: 900,
  },
};

export default function DocsPage() {
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>MasterPlot Documentation</span>
        <a href="index.html" style={styles.backLink}>&larr; Back to hub</a>
      </div>
      <div style={styles.layout}>
        <NavSidebar />
        <main style={styles.main}>
          <ArchitecturePage />
          <GettingStartedPage />
          <ApiReferencePage />
          <RoiDeepDivePage />
        </main>
      </div>
    </div>
  );
}
