import { expect, type Page } from "@playwright/test";

export type Lang = "en" | "ar";

export function langFromProject(projectName: string): Lang {
  return projectName.endsWith("-ar") ? "ar" : "en";
}

/** Sets the app language before load and verifies the document direction. */
export async function gotoWithLanguage(page: Page, path: string, lang: Lang) {
  await page.addInitScript((l) => localStorage.setItem("hni.lang", l), lang);
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
}
