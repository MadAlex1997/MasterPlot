import React from 'react';
import { createRoot } from 'react-dom/client';
import SpectrogramExample from '../examples/SpectrogramExample';

const root = createRoot(document.getElementById('root'));
root.render(<SpectrogramExample />);
