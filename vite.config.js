import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project sites serve from /<repo>/ — the deploy workflow passes
// BASE_PATH from actions/configure-pages; Cloudflare/custom-domain builds get "/".
//
// CAP_BUILD=1 marks the Android (Capacitor) build: assets ship inside the APK,
// so the base is "/" and the service worker is dropped entirely — the native
// shell has no worker to install, and a stray one would only fight the
// WebView's own cache. APK_BUILD carries the Actions run number into the app
// for the in-app update check (0 on the web).
const capBuild = !!process.env.CAP_BUILD
const base = capBuild ? '/' : `${process.env.BASE_PATH || ''}/`

export default defineConfig({
  base,
  define: {
    __APK_BUILD__: JSON.stringify(Number(process.env.APK_BUILD || 0)),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          db: ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(capBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'og.png', 'logo.png'],
      manifest: {
        name: 'Hockey.AI',
        short_name: 'Hockey.AI',
        description: 'AI stories, match intelligence, simulations and visual analytics for the FIH Hockey World Cup 2026.',
        id: `${base}?v=1`,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0b1736',
        background_color: '#0b1736',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        // A new deploy must take over immediately, not sit behind the old
        // worker until every tab closes — that stickiness is what left
        // installed apps showing stale results. clientsClaim + skipWaiting
        // hand control to the fresh worker on first load; cleanupOutdatedCaches
        // evicts the previous precache so no stale shell lingers.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hockeyai-data',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 50, maxAgeSeconds: 604800 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'hockeyai-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 31536000 }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hockeyai-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 2592000 }
            }
          }
        ]
      }
    })]),
  ]
})
