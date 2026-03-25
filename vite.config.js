import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api/* to Vercel dev server during local development
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
