import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo_misto.jpeg"], 
      manifest: {
        name: "Auto Center Gestão e POS",
        short_name: "AutoCenter",
        description: "Sistema de Ponto de Venda e Gestão de Stock Offline",
        theme_color: "#09090b", 
        background_color: "#09090b",
        display: "standalone", 
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpeg}"],
      },
    }),
  ],
});