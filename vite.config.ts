import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build 100 % statique (dist/), publié sur GitHub Pages.
// `base: './'` + navigation par « # » : fonctionne dans le sous-dossier /<dépôt>/ sans règle serveur.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'BudgetVision',
        short_name: 'BudgetVision',
        description: 'Calcule, planifie et réalise tes objectifs : épargne, budget, 50/30/20 et scénarios en CDF et USD',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b2a5b',
        background_color: '#f4f7fb',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout le shell applicatif est pré-caché : l'appli s'ouvre sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
