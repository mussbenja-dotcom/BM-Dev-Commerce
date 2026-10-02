import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

if (process.env.E2E_DATABASE_URL) process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: { APP_URL: "http://localhost:3100", PLATFORM_HOSTS: "localhost:3100,localhost", DATABASE_URL: process.env.DATABASE_URL!, DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX ?? "1" },
    timeout: 60_000,
  },
});
