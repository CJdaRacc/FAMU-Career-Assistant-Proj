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
      // Bind to IPv4 to avoid Windows/IPv6 (::1) permission issues and force desired port
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
    test: {
      // Vitest options are in vitest.config.ts, this is here for Vite awareness only
    },
  };
});
