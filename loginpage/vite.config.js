import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Use 127.0.0.1 to avoid potential IPv6/localhost resolution issues on Windows
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  // Vitest configuration
  test: {
    environment: "jsdom",
    setupFiles: ["test/setupTests.js"],
  },
});
