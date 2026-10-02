import { defineConfig } from "vitest/config";
import config from "./vitest.config.mjs";

export default defineConfig({
  ...config,
  test: { ...config.test, include: ["tests/integration/**/*.test.ts"], setupFiles: ["./tests/database-env.ts"], fileParallelism: false, testTimeout: 20_000 },
});
