import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base:"./" keeps asset paths relative (for later static hosting).
// The dev proxy forwards /api/* to the Node API on :4000, so the app can just
// fetch("/api/...") with no CORS or hardcoded host.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
