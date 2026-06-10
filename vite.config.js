import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import syncPlugin from './server-sync';

export default defineConfig({
  plugins: [react(), syncPlugin()],
  base: './',
  build: { outDir: 'dist', target: 'es2017' },
  server: { port: 5173, allowedHosts: ['localhost', '.loca.lt'] },
});
