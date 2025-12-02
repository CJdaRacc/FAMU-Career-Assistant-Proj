import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Base dev port; if taken, Vite will auto-pick the next available
    port: 5174,
    strictPort: false,
  },
  preview: {
    // Match the dev server base port; also allow auto-pick if busy
    port: 5174,
    strictPort: false,
  },
  test: {
    // Vitest options are in vitest.config.ts, this is here for Vite awareness only
  },
});
