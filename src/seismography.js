import React from 'react';
import { createRoot } from 'react-dom/client';
import SeismographyExample from '../examples/SeismographyExample';

const root = createRoot(document.getElementById('root'));
root.render(<SeismographyExample />);
