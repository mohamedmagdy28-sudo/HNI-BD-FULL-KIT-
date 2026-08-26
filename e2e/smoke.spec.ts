import { test, expect } from "./fixtures";
import { gotoWithLanguage, langFromProject } from "./helpers/locale";

/**
 * Smoke test for the app shell. Runs on every viewport x language project.
 * Extend per feature screen; keep the console guard fixture (fixtures.ts) in use.
 */
test("app shell renders and the language toggle switches direction", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  // The visible navigation exists: sidebar on wide viewports, disclosure panel trigger on mobile.
  const isMobile = (testInfo.project.use.viewport?.width ?? 1440) < 768;
  if (isMobile) {
    const menu = page.getByRole("button", { name: lang === "ar" ? "القائمة" : "Menu", exact: true });
    await expect(menu).toBeVisible();
    await menu.click();
  }
  await expect(page.locator("nav:visible")).toBeVisible();

  // The placeholder screen renders its heading.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The language toggle flips the document direction and persists.
  await page.getByRole("button", { name: lang === "ar" ? "تغيير اللغة" : "Switch language" }).click();
  const other = lang === "ar" ? "en" : "ar";
  await expect(page.locator("html")).toHaveAttribute("dir", other === "ar" ? "rtl" : "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", other);
});
