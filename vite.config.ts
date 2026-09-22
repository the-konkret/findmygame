import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the built app loads from disk inside Electron.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
