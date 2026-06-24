// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.'
        },
        {
          src: 'uninstall.js',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000, 
    sourcemap: false,
    rollupOptions: {
      input: {
        desktop: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'background.html'),
        worker: resolve(__dirname, 'worker.html'),
        uninstall: resolve(__dirname, 'uninstall.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'recharts';
            }
            if (id.includes('react-icons')) {
              return 'icons';
            }
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            return 'vendor';
          }
        },
      },
    },
    outDir: 'dist',
  },
});