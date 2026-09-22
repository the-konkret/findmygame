import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// HashRouter works both in the dev server and when Electron loads the built files from disk.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
