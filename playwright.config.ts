import { defineConfig } from "@playwright/test";

const baseURL = process.env.OBSCURA_E2E_WEB_URL ?? "http://127.0.0.1:8008";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
