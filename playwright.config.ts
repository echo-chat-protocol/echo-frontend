import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = Number(process.env.ECHO_CHAT_PORT || 5173);
const baseURL = process.env.ECHO_E2E_BASE_URL || `http://127.0.0.1:${port}`;
const configDir = fileURLToPath(new URL(".", import.meta.url));
const backendDir = path.resolve(configDir, "..", "Echo-backend");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Runs serially by default to avoid cross-test interference in Socket.IO + crypto state.
  // You can still override via CLI: `playwright test --fully-parallel` or `--workers`.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: [
    {
      command: `node server.js`,
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
      cwd: backendDir,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      cwd: configDir,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
