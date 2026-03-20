/**
 * Point d'entrée principal pour l'application mobile PWA
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import './design-tokens.css';
import './index.css';
import { initTheme } from './theme';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
