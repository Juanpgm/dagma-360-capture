import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // In development, VITE_API_URL=http://localhost:8000 (from .env.development.local)
  // In production build, falls back to the Railway URL
  const apiTarget = env.VITE_API_URL || 'https://web-production-2d737.up.railway.app';

  return {
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'CaliTrack 360',
          short_name: 'CaliTrack',
          description: 'Captura de información de proyectos de infraestructura',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
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
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.test.ts'],
    }
  };
});
