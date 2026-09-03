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
    // Hermetic: own port + Supabase env EMPTIED so e2e always exercises
    // localStorage mode, regardless of what any dev server (possibly
    // cloud-configured via .env) is doing on 5173.
    command: "VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev -- --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5199",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(viewports).flatMap(([name, viewport]) => [
    { name: `${name}-en`, use: { ...devices["Desktop Chrome"], viewport, locale: "en-US" } },
    { name: `${name}-ar`, use: { ...devices["Desktop Chrome"], viewport, locale: "ar-SA" } },
  ]),
});
