import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome100',
    outDir: 'dist',
    sourcemap: false,
    cssTarget: 'chrome100',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'dexie', 'lucide-react'],
          xlsx: ['xlsx']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});

