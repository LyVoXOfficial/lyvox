import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir, "apps/web/src"),
      // server-only is a Next.js guard package that is not installed as a
      // standalone package (it lives inside Next's compiled tree). Tests that
      // import server-only files need this no-op alias so Vitest can resolve
      // the import without the Next runtime.
      "server-only": resolve(rootDir, "vitest.server-only-stub.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/web/src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
