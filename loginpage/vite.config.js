import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables. Prefix "" loads all (not just VITE_*) for config-time use.
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT || env.PORT || 5174);

  return {
    plugins: [react()],
    server: {
      // Explicitly set the dev server port; allow auto-pick if busy
      port,
      strictPort: false,
      proxy: {
        "/api": {
          // Use 127.0.0.1 to avoid potential IPv6/localhost resolution issues on Windows
          target: "http://127.0.0.1:5002",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      strictPort: false,
    },
    // Vitest configuration
    test: {
      environment: "jsdom",
      setupFiles: ["test/setupTests.js"],
    },
  };
});
