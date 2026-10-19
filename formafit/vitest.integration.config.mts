import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Runs against a real Supabase instance (local: `npm run db:start`).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: loadEnv("test", root, ""),
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
