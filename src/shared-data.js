import React from 'react';
import { createRoot } from 'react-dom/client';
import SharedDataExample from '../examples/SharedDataExample';

const root = createRoot(document.getElementById('root'));
root.render(<SharedDataExample />);
