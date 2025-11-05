import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setupTests.ts"],
    reporters: ["default"],
    coverage: {
      reporter: ["text-summary", "cobertura"],
      reportsDirectory: "coverage",
    },
  },
});
