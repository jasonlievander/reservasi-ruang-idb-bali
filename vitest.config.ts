import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    env: {
      DATABASE_URL: "file:./test.db",
      APPROVAL_CARD_DIR: "node_modules/.cache/approval-cards",
    },
    globalSetup: ["./tests/global-setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
