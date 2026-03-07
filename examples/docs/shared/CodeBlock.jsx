import React, { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-bash';
import 'prismjs/themes/prism-tomorrow.css';

const styles = {
  wrapper: {
    position: 'relative',
    margin: '12px 0',
  },
  pre: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    padding: '14px 16px',
    overflowX: 'auto',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: 'monospace',
  },
  copyBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: '3px 10px',
    fontSize: 11,
    background: '#222',
    border: '1px solid #3a3a3a',
    borderRadius: 4,
    color: '#aaa',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
};

export default function CodeBlock({ code, language = 'javascript' }) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={styles.wrapper}>
      <pre style={styles.pre}>
        <code ref={codeRef} className={`language-${language}`}>{code}</code>
      </pre>
      <button
        style={styles.copyBtn}
        onClick={handleCopy}
        onMouseEnter={e => { e.currentTarget.style.color = '#7df'; e.currentTarget.style.borderColor = '#7df'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#3a3a3a'; }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
