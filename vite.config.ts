import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; CI sets DEPLOY_BASE to that
  // path. Local dev and preview stay at "/".
  base: process.env.DEPLOY_BASE ?? "/",
  plugins: [react()],
  // jszip is loaded lazily (xlsx import); pre-bundle it so the dev server
  // does not full-page-reload mid-session on first use.
  optimizeDeps: {
    include: ["jszip"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
