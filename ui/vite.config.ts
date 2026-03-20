import { defineConfig, Plugin, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Plugin personnalisé pour le routing MPA (Multi-Page App)
// Redirige /colab/mobile/* vers mobile.html, le reste vers index.html
function mpaFallbackPlugin(): Plugin {
  return {
    name: 'mpa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        
        // Ignorer les fichiers statiques et les requêtes API
        if (
          url.startsWith('/api') ||
          url.startsWith('/src') ||
          url.startsWith('/node_modules') ||
          url.startsWith('/@') ||
          url.includes('.') // fichiers avec extension
        ) {
          return next()
        }
        
        // Routes PWA mobile → mobile.html
        if (url.startsWith('/colab/mobile')) {
          req.url = '/mobile.html'
        } else if (url.startsWith('/login')) {
          req.url = '/login.html'
        } else if (url.startsWith('/splash')) {
          req.url = '/splash.html'
        } else if (url.startsWith('/installer')) {
          req.url = '/installer.html'
        } else {
          // Toutes les autres routes → index.html
          req.url = '/index.html'
        }
        
        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8000'

  return {
    server: {
      port: 1420,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 1420,
      },
      watch: {
        ignored: ['**/src-tauri/**']
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, req) => {
              console.error(`[PROXY ERROR] ${req.method} ${req.url} -> ${err.message}`)
            })
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log(`[PROXY] ${req.method} ${req.url}`)
            })
          },
        }
      },
    },
    plugins: [
    mpaFallbackPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      devOptions: {
        enabled: false  // SW désactivé en dev
      },
      includeAssets: ['favicon.ico', 'icons/*.png'],
      scope: '/colab/mobile/',
      manifest: {
        name: 'Atlas Survey - Terrain',
        short_name: 'Atlas Survey',
        description: 'Application terrain pour la gestion des missions géotechniques',
        theme_color: '#1e40af',
        background_color: '#1e40af',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/colab/mobile/',
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
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        dbManager: path.resolve(__dirname, 'db-manager.html'),
        mobile: path.resolve(__dirname, 'mobile.html'),
        installer: path.resolve(__dirname, 'installer.html'),
        splash: path.resolve(__dirname, 'splash.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet', 'leaflet.heat'],
          'vendor-charts': ['chart.js'],
          'vendor-export': ['exceljs', 'jspdf', 'html2canvas', 'file-saver'],
        },
      },
    },
  },
  }
})
