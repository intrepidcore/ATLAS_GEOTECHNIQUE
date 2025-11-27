import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import mpa from 'vite-plugin-mpa-plus'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    mpa({
      pages: {
        main: {
          entry: 'src/main.tsx',
          filename: 'index.html',
          template: 'index.html',
        },
        mobile: {
          entry: 'src/mobile-main.tsx',
          filename: 'mobile.html',
          template: 'mobile.html',
        },
      },
      historyApiFallback: {
        rewrites: [
          // PWA terrain routes → mobile.html
          { from: /^\/colab\/mobile(\/.*)?$/, to: '/mobile.html' },
          // Tout le reste → index.html
          { from: /./, to: '/index.html' },
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Atlas Colab - Terrain',
        short_name: 'Atlas Colab',
        description: 'Application terrain pour la gestion des missions géotechniques',
        theme_color: '#1e40af',
        background_color: '#1e40af',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/colab/mobile/missions',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\/api\/colab\/mobile\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'colab-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Les entrées sont gérées par vite-plugin-mpa-plus
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  // Configuration pour le plugin vite-plugin-history-fallback n'existe pas nativement
  // On utilise un middleware custom via appType: 'custom' ou on gère via le fichier public/_redirects
  appType: 'mpa',
})
