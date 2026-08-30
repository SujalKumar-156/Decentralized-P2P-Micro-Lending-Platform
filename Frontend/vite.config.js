import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,

    // ── Proxy: forwards /api calls to backend on port 5000 ────────────────
    // This prevents CORS errors during development.
    // fetch("/api/loans") → automatically hits http://localhost:5000/api/loans
    proxy: {
      "/api": {
        target:       "http://localhost:5000",
        changeOrigin: true,
        secure:       false,
      },
    },
  },
});
