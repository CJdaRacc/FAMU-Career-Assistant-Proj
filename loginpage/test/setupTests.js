import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Ensure each test starts with a clean DOM and restored mocks
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
