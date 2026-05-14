import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const APP_VERSION = pkg.version;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // In development, VITE_API_URL=http://localhost:8000 (from .env.development.local)
  // In production build, falls back to the Railway URL
  const apiTarget = env.VITE_API_URL || 'https://web-production-2d737.up.railway.app';

  return {
    plugins: [
      svelte(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['apple-touch-icon.png', 'masked-icon.svg', 'favicon-32.png'],
        manifest: {
          id: '/',
          name: 'DAGMA 360',
          short_name: 'DAGMA 360',
          description: 'Captura y gestión de intervenciones ambientales DAGMA',
          lang: 'es',
          version: APP_VERSION,
          theme_color: '#059669',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/?source=pwa',
          categories: ['productivity', 'utilities', 'government'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          globIgnores: [
            '**/images/**',
            '**/tiles/**',
            '**/basemaps/**',
            '**/cartografia_base/**',
            '**/*.jpg',
            '**/*.jpeg',
            '**/*.webp'
          ],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
        },
        devOptions: {
          enabled: false,
          type: 'module'
        }
      })
    ],
      define: {
        __APP_VERSION__: JSON.stringify(APP_VERSION),
      },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false
        },
        '/api-capturas': {
          target: 'https://gestorproyectoapi-production.up.railway.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-capturas/, ''),
          secure: false
        }
      }
    },
    // Mismo proxy en preview para validar el SW localmente contra Railway
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false
        },
        '/api-capturas': {
          target: 'https://gestorproyectoapi-production.up.railway.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-capturas/, ''),
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Subir un poco el umbral para no spamear warnings en chunks legitimos
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore'
            ],
            leaflet: ['leaflet'],
            charts: ['chart.js', 'svelte-chartjs']
          }
        }
      }
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.test.ts'],
    }
  };
});
