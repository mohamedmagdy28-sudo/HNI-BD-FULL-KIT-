import { defineConfig, devices } from "@playwright/test";

// HNI viewport x direction matrix. See .claude/skills/hni-qa/references/playwright-patterns.md
const viewports = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(viewports).flatMap(([name, viewport]) => [
    { name: `${name}-en`, use: { ...devices["Desktop Chrome"], viewport, locale: "en-US" } },
    { name: `${name}-ar`, use: { ...devices["Desktop Chrome"], viewport, locale: "ar-SA" } },
  ]),
});
