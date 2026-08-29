import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; CI sets DEPLOY_BASE to that
  // path. Local dev and preview stay at "/".
  base: process.env.DEPLOY_BASE ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
