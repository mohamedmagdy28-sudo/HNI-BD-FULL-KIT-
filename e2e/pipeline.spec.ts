import { test, expect } from "./fixtures";
import { gotoWithLanguage, langFromProject } from "./helpers/locale";
import type { Page } from "@playwright/test";

/**
 * Pipeline dashboard flows (design: docs/designs/pipeline.md).
 * Stage strings are stored verbatim in English; the UI shows localized labels.
 */

const STAGE_LABELS: Record<string, Record<string, string>> = {
  en: { Proposal: "Proposal", Won: "Won", Lost: "Lost" },
  ar: { Proposal: "عرض مقدم", Won: "فوز", Lost: "خسارة" },
};

async function createProposalWithProgram(page: Page, client = "Saudi National Bank", title?: string) {
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  await page.getByTestId("line-label-0-0").fill("Senior trainer days");
  await page.getByTestId("line-qty-0-0").fill("3");
  await page.getByTestId("line-rate-0-0").fill("9000");
  await page.getByTestId("client-name").fill(client);
  if (title) await page.getByTestId("proposal-title").fill(title);
  await page.waitForTimeout(400);
}

async function setStage(page: Page, lang: string, stage: "Proposal" | "Won" | "Lost") {
  await page.locator("[data-testid^='stage-']").first().click();
  await page.getByRole("option", { name: STAGE_LABELS[lang][stage], exact: true }).click();
}

function digits(text: string | null): number {
  return Number((text ?? "").replace(/[^0-9-]/g, ""));
}

/**
 * Picks a Copy-rows menu item by position, keyboard-driven: Radix re-mounts
 * menu items on open, which makes pointer clicks flaky ("element detached").
 * Opening with Enter focuses the first item; ArrowDown walks to the target.
 */
async function pickCopyOption(page: Page, testid: "copy-new" | "copy-all-app") {
  await page.getByTestId("copy-rows").focus();
  await page.keyboard.press("Enter");
  const item = page.getByTestId(testid);
  await expect(item).toBeVisible();
  await item.press("Enter");
  await expect(item).toBeHidden(); // menu closed = selection fired
}

test("setting a stage moves a proposal through open, weighted, and achieved KPIs live", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);

  // Not in the pipeline until a stage is set: empty state.
  await page.getByTestId("pipeline-toggle").click();
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(0);
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(0);

  // Membership is created on the edit screen: setting the first stage adds the
  // proposal to the pipeline.
  await page.getByTestId("pipeline-toggle").click(); // back to edit
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Proposal, exact: true }).click();

  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);

  // Open stage: net 36,450 counts as open; no probability yet -> weighted 0 with a companion count.
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(36450);
  expect(digits(await page.getByTestId("kpi-weighted").locator(".tabular").first().textContent())).toBe(0);

  // Probability 50 -> weighted = 18,225, live.
  await page.locator("[data-testid^='prob-']").first().fill("50");
  expect(digits(await page.getByTestId("kpi-weighted").locator(".tabular").first().textContent())).toBe(Math.round(36450 * 0.5));

  // Won -> achieved revenue 36,450, GP 9,450; open back to 0.
  await setStage(page, lang, "Won");
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(36450);
  expect(digits(await page.getByTestId("kpi-achieved-gp").locator(".tabular").first().textContent())).toBe(9450);
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(0);

  // Survives reload (persisted through the store).
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByTestId("pipeline-toggle").click();
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(36450);
});

test("deal drawer fields persist and targets drive the achievement percentage", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();

  // Drawer: source and notes persist through the structural pipeline path.
  await page.locator("[data-testid^='pipeline-row-'] td").first().click();
  await expect(page.getByTestId("deal-drawer")).toBeVisible();
  await page.getByTestId("drawer-source").fill("Referral");
  await page.getByTestId("drawer-notes").fill("Follow up in Q4");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByTestId("pipeline-toggle").click();
  await page.locator("[data-testid^='pipeline-row-'] td").first().click();
  await expect(page.getByTestId("drawer-source")).toHaveValue("Referral");
  await expect(page.getByTestId("drawer-notes")).toHaveValue("Follow up in Q4");
  await page.keyboard.press("Escape");

  // Targets: revenue target 364,500 -> achieved 36,450 = 10.0% of target.
  await page.getByTestId("targets-toggle").click();
  await page.getByTestId("target-revenueTarget").fill("364500");
  await expect(page.getByTestId("kpi-achieved-rev")).toContainText("10.0%");
});

test("copy rows puts sheet-ordered TSV on the clipboard and stamps copied rows", async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "clipboard permissions are chromium-only");
  const lang = langFromProject(testInfo.project.name);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page, "Acme Corp", "Big Deal");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Proposal, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();

  await pickCopyOption(page, "copy-new");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).not.toBe("");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const cells = clip.split("\t");
  expect(cells).toHaveLength(19);
  expect(cells[5]).toBe("Acme Corp"); // Company
  expect(cells[6]).toBe("Big Deal"); // Project Name
  expect(cells[7]).toBe("Proposal"); // Stage: verbatim English for the sheet dropdown
  expect(cells[12]).toBe("SAR"); // Currency
  expect(cells[13]).toBe("36450"); // plain integer money

  // New-since-last-copy: a second copy-new finds nothing.
  await pickCopyOption(page, "copy-new");
  const nothingMsg = lang === "ar" ? "لا صفوف جديدة" : "No new rows";
  await expect(page.getByText(nothingMsg).first()).toBeVisible();

  // Copy-all still exports it.
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await pickCopyOption(page, "copy-all-app");
  await expect
    .poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).split("\t")[5])
    .toBe("Acme Corp");
});

test("CSV import backfills external deals into the table and totals", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();

  const csv = [
    "Date,Source,Deal Type,Sector,Primary Service,Company,Project Name,Stage,Winning Probability,Start Date of Delivery,End Date if Delivery,PO Number,Currency,Actual Deal Value (AED),GP%,Actual Expected GP amt. (AED),Traget Achivement Contribution %,Project Status,Notes",
    '15/01/2026,Referral,New,Government,Training,Aramco,AC Wave 2,Won,100%,,,PO-9,SAR,"120,000",35.5%,"42,600",,On track,',
    "20/02/2026,,,,,STC,Leadership,Proposal,40%,,,,SAR,50000,30%,15000,,,",
    "05/03/2026,,,,,DGA,Dubai Program,Won,,,,,AED,80000,30%,24000,,,",
  ].join("\r\n");

  await page.getByTestId("import-csv-input").setInputFiles({ name: "pipeline.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });

  // 1 app proposal + 3 externals; the AED row is visible but excluded from sums.
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(4);
  await expect(page.getByTestId("excluded-note")).toBeVisible();
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(36450 + 120000);
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(50000);
  expect(digits(await page.getByTestId("kpi-weighted").locator(".tabular").first().textContent())).toBe(20000);

  // Externals survive reload and can be deleted individually.
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(4);
  page.once("dialog", (d) => void d.accept());
  const stcRow = page.locator("[data-testid^='pipeline-row-']").filter({ hasText: "STC" });
  await stcRow.getByRole("button").last().click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(3);
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(0);
});

test("sent-lock: quote fields stay locked while pipeline fields stay editable", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("mark-sent").click();
  await expect(page.getByTestId("locked-hint")).toBeVisible();
  await expect(page.getByTestId("line-rate-0-0")).toBeDisabled();

  // The sent proposal's pipeline stage is still editable (structural path bypasses the quote lock).
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);
  await page.locator("[data-testid^='prob-']").first().fill("100");
  await page.waitForTimeout(400);

  // And the quote stays locked after pipeline edits: back to edit, still read-only.
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.getByTestId("locked-hint")).toBeVisible();
  await expect(page.getByTestId("line-rate-0-0")).toBeDisabled();
  await expect(page.getByTestId("markup-input")).toBeDisabled();
});

test("deleting a Won proposal requires an explicit confirmation", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.waitForTimeout(400);

  // Dismissing the confirm keeps the proposal.
  let confirmMessage = "";
  page.once("dialog", (d) => {
    confirmMessage = d.message();
    void d.dismiss();
  });
  await page.getByTestId("delete-proposal").click();
  expect(confirmMessage.length).toBeGreaterThan(10);
  await expect(page.getByTestId("proposal-title")).toBeVisible();

  // Accepting deletes it.
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("delete-proposal").click();
  await expect(page.getByTestId("proposal-title")).toHaveCount(0);
});
