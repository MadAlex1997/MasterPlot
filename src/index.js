import React from 'react';
import { createRoot } from 'react-dom/client';
import ExampleApp from '../examples/ExampleApp';

const root = createRoot(document.getElementById('root'));
root.render(<ExampleApp />);
