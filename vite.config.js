import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import syncPlugin from './server-sync';

export default defineConfig({
  plugins: [react(), syncPlugin()],
  base: './',
  build: { outDir: 'dist' },
  server: { port: 5173, allowedHosts: ['localhost', '.loca.lt'] },
});
