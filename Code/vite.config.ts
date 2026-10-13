/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Relative base so the build works both locally and when served from a
// GitHub Pages project subpath (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    // Recharts is the bulk of the bundle; fine for a local, offline app.
    chunkSizeWarningLimit: 900,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
