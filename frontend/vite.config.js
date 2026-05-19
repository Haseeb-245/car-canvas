import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', exclude: [/\.(png|jpg|webp|ktx2)$/] }),
    compression({ algorithm: 'gzip', exclude: [/\.(png|jpg|webp|ktx2)$/] }),
  ],

  build: {
    chunkSizeWarningLimit: 2500,

    rollupOptions: {
      output: {
        // ✅ Use function form — works with Rolldown
        manualChunks(id) {
          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/three/')) {
            return 'vendor-three';
          }
          if (id.includes('@react-three')) {
            return 'vendor-r3f';
          }
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
        },
      },
    },

    // ✅ esbuild is built-in, no extra package needed
    minify: 'esbuild',

    sourcemap: false,
    target: 'es2020',
  },

  optimizeDeps: {
    include: [
      'three',
      'three/addons/loaders/KTX2Loader.js',
      'three/addons/loaders/DRACOLoader.js',
      'three/addons/loaders/GLTFLoader.js',
      '@react-three/fiber',
      '@react-three/drei',
    ],
  },
});