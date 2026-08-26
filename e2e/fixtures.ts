import { test as base, expect } from "@playwright/test";

/** Fails any test that produces console errors, page errors, or failed requests. */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 400 && !r.url().includes("fonts.g")) errors.push(`${r.status()} ${r.url()}`);
      });
      await use();
      if (errors.length) await testInfo.attach("console-errors", { body: errors.join("\n"), contentType: "text/plain" });
      expect(errors, "no console or network errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
