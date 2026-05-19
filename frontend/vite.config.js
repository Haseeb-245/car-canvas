import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Brotli compression for .js/.css/.glb files → 60-80% smaller on CDN
    compression({ algorithm: 'brotliCompress', exclude: [/\.(png|jpg|webp|ktx2)$/] }),
    // Gzip fallback for older hosts
    compression({ algorithm: 'gzip', exclude: [/\.(png|jpg|webp|ktx2)$/] }),
  ],

  build: {
    // Increase chunk warning threshold (Three.js is large by design)
    chunkSizeWarningLimit: 2500,

    rollupOptions: {
      output: {
        // Manual chunk splitting – keeps initial bundle tiny
        manualChunks: {
          // React core – loaded first, tiny
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Three.js core – large, cache independently
          'vendor-three': ['three'],

          // R3F ecosystem – lazy-loaded after THREE
          'vendor-r3f': [
            '@react-three/fiber',
            '@react-three/drei',
            '@react-three/postprocessing',
          ],

          // Animation – only on pages that use it
          'vendor-motion': ['framer-motion'],
        },
      },
    },

    // Terser minification for smallest JS bundles
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // strip console.* in production
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug', 'console.warn'],
      },
    },

    // Enable source maps only for staging (disable for prod deploy)
    sourcemap: false,

    // Target modern browsers that support WebGL 2 (every 2024+ browser)
    target: 'es2020',
  },

  // Optimise dev-server pre-bundling so Three.js addons load instantly
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

