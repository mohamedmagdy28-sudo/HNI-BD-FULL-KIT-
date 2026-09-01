import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { test, expect } from "./fixtures";
import { gotoWithLanguage, langFromProject } from "./helpers/locale";
import type { Download, Page } from "@playwright/test";

/** Unzips a downloaded .pptx and returns slide XML by filename. */
async function unzipDownload(download: Download): Promise<Map<string, string>> {
  const path = await download.path();
  const zip = await JSZip.loadAsync(readFileSync(path!));
  const slides = new Map<string, string>();
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith("ppt/slides/slide") && name.endsWith(".xml")) {
      slides.set(name, await zip.files[name].async("string"));
    }
  }
  return slides;
}

/**
 * Pricing & Costing Calculator flows (design: docs/designs/pricing-costing-calculator.md).
 * Runs on every viewport x language project. Money assertions use digits only,
 * since grouping separators differ by locale.
 */

async function createProposalWithProgram(page: Page) {
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  await page.getByTestId("line-label-0-0").fill("Senior trainer days");
  await page.getByTestId("line-qty-0-0").fill("3");
  await page.getByTestId("line-rate-0-0").fill("9000");
}

/** Extracts the integer number from a money string like "SAR 36,450" or "ر.س ٣٦..." (latn digits enforced). */
function digits(text: string | null): number {
  return Number((text ?? "").replace(/[^0-9-]/g, ""));
}

test("price a proposal end to end with manual lines", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  await createProposalWithProgram(page);
  await page.getByTestId("client-name").fill("Saudi National Bank");

  // cost 27,000 -> list 36,450 at 35% -> VAT 5,468 -> total 41,918
  expect(digits(await page.getByTestId("total-cost").textContent())).toBe(27000);
  expect(digits(await page.getByTestId("list-price").textContent())).toBe(36450);
  expect(digits(await page.getByTestId("vat-amount").textContent())).toBe(5468);
  expect(digits(await page.getByTestId("total-inc-vat").textContent())).toBe(41918);

  // 25.9% margin is below the default 30% floor: warning tone.
  await expect(page.getByTestId("margin-block")).toHaveAttribute("data-tone", "warning");
  await expect(page.getByTestId("margin-floor-warning")).toBeVisible();

  // A discount pushing margin negative flips to danger.
  await page.getByTestId("discount-value").fill("40");
  await expect(page.getByTestId("margin-block")).toHaveAttribute("data-tone", "danger");
  await page.getByTestId("discount-value").fill("0");

  // Reload: autosave restored the exact state.
  await page.waitForTimeout(400);
  await page.reload();
  expect(digits(await page.getByTestId("total-cost").textContent())).toBe(27000);
  await expect(page.getByTestId("client-name")).toHaveValue("Saudi National Bank");
});

test("markup, target margin, and price per day stay in sync", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  await expect(page.getByTestId("target-margin-input")).toHaveValue("25.9");
  await page.getByTestId("target-margin-input").fill("30");
  await expect(page.getByTestId("markup-input")).toHaveValue("42.9");
  expect(digits(await page.getByTestId("list-price").textContent())).toBe(Math.round(27000 * 1.429));

  // Manual price per day: 1 program day at 40,000/day back-computes the markup.
  await page.getByTestId("price-per-day-input").fill("40000");
  await expect(page.getByTestId("markup-input")).toHaveValue("48.1");
  expect(digits(await page.getByTestId("list-price").textContent())).toBe(Math.round(27000 * 1.481));

  // With zero program days the input is disabled.
  await page.getByTestId("program-days-0").fill("0");
  await expect(page.getByTestId("price-per-day-input")).toBeDisabled();
});

test("price per day and target margin survive digit-by-digit typing (no controlled-input hijack)", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page); // cost 27,000, 1 day

  // Type like a human: keystroke by keystroke. The field must keep the draft
  // while every other figure updates live from each keystroke.
  const ppd = page.getByTestId("price-per-day-input");
  await ppd.click();
  await ppd.clear();
  await ppd.pressSequentially("40000", { delay: 40 });
  await expect(ppd).toHaveValue("40000"); // not hijacked mid-typing
  await expect(page.getByTestId("markup-input")).toHaveValue("48.1");
  expect(Number((await page.getByTestId("list-price").textContent())?.replace(/[^0-9]/g, ""))).toBe(Math.round(27000 * 1.481));

  // Blur re-syncs to the derived value: markup stored at 48.1% -> 27,000 x 1.481.
  await page.getByTestId("client-name").click();
  await expect(ppd).toHaveValue("39987");

  const margin = page.getByTestId("target-margin-input");
  await margin.click();
  await margin.clear();
  await margin.pressSequentially("30", { delay: 40 });
  await expect(margin).toHaveValue("30");
  await expect(page.getByTestId("markup-input")).toHaveValue("42.9");
});

test("mark as sent locks the proposal; duplicate creates an editable revision", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  await page.getByTestId("mark-sent").click();
  await expect(page.getByTestId("locked-hint")).toBeVisible();
  await expect(page.getByTestId("line-rate-0-0")).toBeDisabled();
  await expect(page.getByTestId("markup-input")).toBeDisabled();
  await expect(page.getByTestId("mark-sent")).toHaveCount(0);

  // Duplicate: fresh editable draft, "(copy)" in the title, original untouched.
  await page.getByTestId("duplicate").click();
  await expect(page.getByTestId("locked-hint")).toHaveCount(0);
  await expect(page.getByTestId("line-rate-0-0")).toBeEnabled();
  const title = await page.getByTestId("proposal-title").inputValue();
  expect(title).toContain(lang === "ar" ? "(نسخة)" : "(copy)");

  // Edit the copy; the sent original keeps its numbers.
  await page.getByTestId("line-rate-0-0").fill("10000");
  expect(digits(await page.getByTestId("total-cost").textContent())).toBe(30000);
  await page.waitForTimeout(400);
  await page.getByTestId("proposal-switcher").click();
  await page.getByRole("option").nth(1).click();
  expect(digits(await page.getByTestId("total-cost").textContent())).toBe(27000);
  await expect(page.getByTestId("locked-hint")).toBeVisible();
});

test("client view shows only client-facing figures in the active language", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("client-name").fill("Acme Corp");

  await page.getByTestId("open-client-view").click();
  const doc = page.getByTestId("client-document");
  await expect(doc).toBeVisible();
  await expect(page.getByTestId("doc-client")).toHaveText("Acme Corp");
  // Unit price / day: 1 program day, so the row's unit price equals its net share.
  expect(digits(await page.getByTestId("doc-unit-0").textContent())).toBe(36450);
  expect(digits(await page.getByTestId("doc-net").textContent())).toBe(36450);
  expect(digits(await page.getByTestId("doc-vat").textContent())).toBe(5468);
  expect(digits(await page.getByTestId("doc-total").textContent())).toBe(41918);

  // Internal figures never render in the client document.
  const docText = (await doc.textContent()) ?? "";
  expect(docText).not.toContain("27,000");
  expect(docText.toLowerCase()).not.toContain(lang === "ar" ? "هامش الربح" : "margin");

  // The document direction follows the language; the print control is outside the document.
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.getByTestId("client-view-print")).toBeVisible();

  await page.getByTestId("client-view-back").click();
  await expect(page.getByTestId("total-cost")).toBeVisible();
});

test("invalid payment schedule blocks client view with an inline error", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  await page.getByTestId("schedule-percent-0").fill("60");
  await expect(page.getByTestId("schedule-error")).toBeVisible();
  await expect(page.getByTestId("open-client-view")).toBeDisabled();

  await page.getByTestId("add-installment").click();
  await page.getByTestId("schedule-percent-1").fill("40");
  await expect(page.getByTestId("schedule-error")).toHaveCount(0);
  await expect(page.getByTestId("open-client-view")).toBeEnabled();
});

test("switcher opens proposals, delete removes them, empty state returns", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  await createProposalWithProgram(page);
  await page.getByTestId("proposal-title").fill("First deal");
  await page.waitForTimeout(400);
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("proposal-title").fill("Second deal");
  await page.waitForTimeout(400);

  // Switch to the first proposal via the switcher.
  await page.getByTestId("proposal-switcher").click();
  await page.getByRole("option", { name: /First deal/ }).click();
  await expect(page.getByTestId("proposal-title")).toHaveValue("First deal");

  // Delete both: back to the empty state.
  await page.getByTestId("delete-proposal").click();
  await expect(page.getByTestId("proposal-title")).toHaveValue("Second deal");
  await page.getByTestId("delete-proposal").click();
  await expect(page.getByTestId("proposal-title")).toHaveCount(0);
  await expect(page.getByTestId("new-proposal")).toBeVisible();
});

test("workshop projects seed fixed cost items; custom starts blank", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  const workshopLines =
    lang === "ar"
      ? ["أجر المدرب اليومي", "طباعة المواد", "تذكرة الطيران", "الإقامة"]
      : ["Trainer daily rate", "Materials printing", "Air ticket", "Accommodation"];

  // New proposals default to Stand Alone Workshop: programs arrive pre-seeded.
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  for (let i = 0; i < workshopLines.length; i++) {
    await expect(page.getByTestId(`line-label-0-${i}`)).toHaveValue(workshopLines[i]);
  }

  // The seeded items stay fully editable and extendable.
  await page.getByTestId("add-line-0").click();
  await expect(page.getByTestId("line-label-0-4")).toHaveValue("");
  await page.getByTestId("line-rate-0-0").fill("9000");
  await page.getByTestId("line-qty-0-0").fill("3");
  expect(Number((await page.getByTestId("total-cost").textContent())?.replace(/[^0-9]/g, ""))).toBe(27000);

  // Switching the project type to Custom affects only newly added programs.
  await page.getByTestId("project-type").click();
  await page.getByRole("option", { name: lang === "ar" ? "مخصص" : "Custom" }).click();
  await page.getByTestId("add-program").click();
  await expect(page.getByTestId("line-label-1-0")).toHaveValue("");
  await expect(page.getByTestId("line-label-1-1")).toHaveCount(0);
  await expect(page.getByTestId("line-label-0-0")).toHaveValue(workshopLines[0]);
});

test("section label renames groups everywhere; description column appears only when used", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  // Switch sections to Phase via the dropdown: new groups follow the localized label.
  const phaseLabel = lang === "ar" ? "المرحلة" : "Phase";
  await page.getByTestId("section-label").click();
  await page.getByRole("option", { name: phaseLabel }).click();
  await page.getByTestId("add-program").click();
  await expect(page.getByTestId("program-name-1")).toHaveValue(`${phaseLabel} 2`);
  await page.getByTestId("line-label-1-0").fill("Consulting");
  await page.getByTestId("line-qty-1-0").fill("1");
  await page.getByTestId("line-rate-1-0").fill("5000");

  // No descriptions yet: the client document has no Description column.
  await page.getByTestId("open-client-view").click();
  const doc = page.getByTestId("client-document");
  await expect(doc).toContainText(`${phaseLabel} 2`);
  const descriptionHeader = lang === "ar" ? "الوصف" : "Description";
  await expect(doc.getByRole("columnheader", { name: descriptionHeader })).toHaveCount(0);
  await page.getByTestId("client-view-back").click();

  // Adding one description makes the column appear, with a dash for the other group.
  await page.getByTestId("program-description-0").fill("Three-day leadership intensive");
  await page.getByTestId("open-client-view").click();
  await expect(doc.getByRole("columnheader", { name: descriptionHeader })).toHaveCount(1);
  await expect(doc).toContainText("Three-day leadership intensive");
});

test("client logo uploads, appears on the cover, and can be removed", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  // A padded logo: 100x100 transparent frame with artwork only in the middle
  // 60x60. The intake must trim the padding so the cover's proportion box is honest.
  const paddedLogo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 100;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#91195A";
    ctx.fillRect(20, 20, 60, 60);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByTestId("client-logo-upload")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(paddedLogo, "base64") });
  await expect(page.getByTestId("client-logo-preview")).toBeVisible();
  const stored = await page
    .getByTestId("client-logo-preview")
    .evaluate((el) => ({ w: (el as HTMLImageElement).naturalWidth, h: (el as HTMLImageElement).naturalHeight }));
  expect(stored).toEqual({ w: 60, h: 60 });

  // The cover shows the co-brand lockup; autosave keeps it across reloads.
  await page.getByTestId("open-client-view").click();
  await expect(page.getByTestId("doc-client-logo")).toBeVisible();
  await page.getByTestId("client-view-back").click();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByTestId("client-logo-preview")).toBeVisible();

  // Removing it clears the cover again.
  await page.getByTestId("client-logo-remove").click();
  await expect(page.getByTestId("client-logo-preview")).toHaveCount(0);
  await page.getByTestId("open-client-view").click();
  await expect(page.getByTestId("doc-client-logo")).toHaveCount(0);
});

test("signature and stamp upload once and appear on every signature block", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("open-client-view").click();

  const makePng = async (color: string) =>
    Buffer.from(
      await page.evaluate((fill) => {
        const c = document.createElement("canvas");
        c.width = 40;
        c.height = 20;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, 40, 20);
        return c.toDataURL("image/png").split(",")[1];
      }, color),
      "base64",
    );

  await page.getByTestId("signature-upload").setInputFiles({ name: "sig.png", mimeType: "image/png", buffer: await makePng("#222") });
  await page.getByTestId("stamp-upload").setInputFiles({ name: "stamp.png", mimeType: "image/png", buffer: await makePng("#33f") });

  // Three signature blocks (Terms 1/2, Terms 2/2, Bank details), each with both images.
  await expect(page.getByTestId("doc-signature")).toHaveCount(3);
  await expect(page.getByTestId("doc-stamp")).toHaveCount(3);

  // App-level settings: they persist across proposals and reloads.
  await page.reload();
  await page.getByTestId("open-client-view").click();
  await expect(page.getByTestId("doc-signature")).toHaveCount(3);

  // Removing clears every block.
  await page.getByTestId("signature-remove").click();
  await expect(page.getByTestId("doc-signature")).toHaveCount(0);
  await expect(page.getByTestId("doc-stamp")).toHaveCount(3);
});

test("export PPT downloads a valid six-slide deck with the proposal's numbers", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("client-name").fill("Acme Corp");
  await page.getByTestId("open-client-view").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-ppt").click(),
  ]);
  expect(download.suggestedFilename()).toBe(`hni-proposal-acme-corp-${new Date().toISOString().slice(0, 10)}.pptx`);

  const slides = await unzipDownload(download);
  expect(slides.size).toBe(6);
  expect(slides.get("ppt/slides/slide1.xml")).toContain("Acme Corp");
  // cost 27,000 at 35% markup, 15% VAT: net 36,450 + 5,468 = 41,918
  expect(slides.get("ppt/slides/slide2.xml")).toContain("SAR 41,918");
  expect(slides.get("ppt/slides/slide5.xml")).toContain("SA1080000151608010789276");

  // Button recovers for the next export.
  await expect(page.getByTestId("export-ppt")).toBeEnabled();
});

test("export always produces the English deck, even from the Arabic UI", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("open-client-view").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-ppt").click(),
  ]);
  const slides = await unzipDownload(download);
  // English-only export (user decision 2026-08-31): English headings regardless of UI language.
  expect(slides.get("ppt/slides/slide2.xml")).toContain("Financial Breakdown");
  expect(slides.get("ppt/slides/slide2.xml")).toContain("SAR 36,450");
  expect(slides.get("ppt/slides/slide3.xml")).toContain("Training material and delivery will be conducted in English.");
});

test("export works from a document opened via the archive", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("mark-sent").click();
  await page.getByTestId("documents-toggle").click();
  await page.locator("[data-testid^='open-document-']").click();
  await expect(page.getByTestId("client-document")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-ppt").click(),
  ]);
  const slides = await unzipDownload(download);
  expect(slides.size).toBe(6);
});

test("documents archive files sent proposals and reopens their document", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  await createProposalWithProgram(page);
  await page.getByTestId("client-name").fill("Archive Client");
  await page.getByTestId("proposal-title").fill("Archived Deal");
  await page.waitForTimeout(400);

  // Drafts are not documents: the archive starts empty.
  await page.getByTestId("documents-toggle").click();
  await expect(page.locator("[data-testid^='document-row-']")).toHaveCount(0);
  await page.getByTestId("documents-toggle").click();

  // Mark as sent files the proposal as a document.
  await page.getByTestId("mark-sent").click();
  await page.getByTestId("documents-toggle").click();
  const row = page.locator("[data-testid^='document-row-']");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Archived Deal");
  await expect(row).toContainText("Archive Client");

  // Open document renders the client view; Back returns to the archive.
  await page.locator("[data-testid^='open-document-']").click();
  await expect(page.getByTestId("client-document")).toBeVisible();
  await expect(page.getByTestId("doc-client")).toHaveText("Archive Client");
  await page.getByTestId("client-view-back").click();
  await expect(row).toHaveCount(1);
});

test("corrupted stored proposal degrades to a warning, not a crash", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await page.addInitScript(() => {
    localStorage.setItem("hni.pricing.v1.index", JSON.stringify(["good", "bad"]));
    localStorage.setItem(
      "hni.pricing.v1.proposal.good",
      JSON.stringify({
        id: "good",
        clientName: "",
        title: "Survivor",
        date: "2026-08-29",
        currency: "SAR",
        markupPct: 35,
        discount: { type: "percent", value: 0 },
        vatPct: 15,
        schedule: [{ id: "s1", label: "On signature", percent: 100 }],
        programs: [],
        sentAt: null,
      }),
    );
    localStorage.setItem("hni.pricing.v1.proposal.bad", "{corrupted");
  });
  await gotoWithLanguage(page, "/", lang);

  await expect(page.getByTestId("proposal-title")).toHaveValue("Survivor");
  await expect(page.getByRole("alert")).toBeVisible();
});
