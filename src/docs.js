import React from 'react';
import { createRoot } from 'react-dom/client';
import DocsPage from '../examples/DocsPage';

const root = createRoot(document.getElementById('root'));
root.render(<DocsPage />);
