import JSZip from "jszip";
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
  await page.locator("[data-testid^='pipeline-row-'] [data-testid^='stage-']").first().click();
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

  // GP amount = Revenue x GP%: editing GP% on an imported row recomputes the
  // cell and the Achieved GP tile (app proposal GP 9,450 + Aramco).
  const aramcoRow = page.locator("[data-testid^='pipeline-row-']").filter({ hasText: "Aramco" });
  expect(digits(await aramcoRow.locator("[data-testid^='gp-amount-']").textContent())).toBe(42600); // 120,000 x 35.5%
  await aramcoRow.locator("[data-testid^='gp-pct-']").fill("50");
  expect(digits(await aramcoRow.locator("[data-testid^='gp-amount-']").textContent())).toBe(60000);
  expect(digits(await page.getByTestId("kpi-achieved-gp").locator(".tabular").first().textContent())).toBe(9450 + 60000);
  await aramcoRow.locator("[data-testid^='gp-pct-']").fill("35.5");

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

test("XLSX import reads typed cells straight into the dashboard", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page);
  await page.getByTestId("pipeline-toggle").click();

  // A minimal Google-Sheets-shaped workbook: shared strings, a date serial
  // styled as a date, percent fractions styled as percents, plain numbers.
  const headers = [
    "Date", "Source", "Deal Type", "Sector", "Primary Service", "Company", "Project Name", "Stage",
    "Winning Probability", "Start Date of Delivery", "End Date if Delivery", "PO Number", "Currency",
    "Actual Deal Value (AED)", "GP%", "Actual Expected GP amt. (AED)", "Traget Achivement Contribution %",
    "Project Status", "Notes",
  ];
  const shared = [...headers, "Aramco", "AC Wave 2", "Won", "SAR"];
  const si = (s: string) => shared.indexOf(s);
  const colRef = (c: number) => (c < 26 ? String.fromCharCode(65 + c) : `A${String.fromCharCode(65 + c - 26)}`);
  const headerXml = headers.map((h, c) => `<c r="${colRef(c)}1" t="s"><v>${si(h)}</v></c>`).join("");
  const dataXml =
    `<c r="A2" s="1"><v>46249</v></c>` + // 2026-08-15 as a date serial
    `<c r="F2" t="s"><v>${si("Aramco")}</v></c><c r="G2" t="s"><v>${si("AC Wave 2")}</v></c>` +
    `<c r="H2" t="s"><v>${si("Won")}</v></c><c r="I2" s="2"><v>1</v></c>` +
    `<c r="M2" t="s"><v>${si("SAR")}</v></c><c r="N2"><v>120000</v></c>` +
    `<c r="O2" s="2"><v>0.355</v></c><c r="P2"><v>42600</v></c>`;
  const zip = new JSZip();
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((s) => `<si><t>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`);
  zip.file("xl/styles.xml", `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${headerXml}</row><row r="2">${dataXml}</row></sheetData></worksheet>`);
  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

  await page.getByTestId("import-csv-input").setInputFiles({
    name: "pipeline.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });

  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='pipeline-row-']")).toContainText("Aramco");
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(120000);
  expect(digits(await page.getByTestId("kpi-achieved-gp").locator(".tabular").first().textContent())).toBe(42600);
  await expect(page.getByTestId("excluded-note")).toHaveCount(0);
});

test("Download Excel produces a real xlsx with numeric money cells and grouped target input", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page, "Aramco", "AC Wave 2");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();

  // Targets input shows live thousands separators while storing the raw number.
  await page.getByTestId("targets-toggle").click();
  const gpTarget = page.getByTestId("target-gpTarget");
  await gpTarget.click();
  await gpTarget.pressSequentially("8000000", { delay: 30 });
  await expect(gpTarget).toHaveValue("8,000,000");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-xlsx").click()]);
  expect(download.suggestedFilename()).toMatch(/^hni-pipeline-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const JSZipMod = (await import("jszip")).default;
  const zip = await JSZipMod.loadAsync(readFileSync(path!));
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const styles = await zip.file("xl/styles.xml")!.async("string");
  expect(sheet).toContain("Aramco"); // inline string
  expect(sheet).toContain("<v>36450</v>"); // numeric money cell, no text commas
  expect(styles).toContain('formatCode="#,##0"'); // Excel renders 36,450 itself
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

test("mark as sent puts the proposal in the pipeline with its real amount and derived GP", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page, "Maaden Phosphate", "Strategic HR");
  await page.getByTestId("mark-sent").click();

  // Submission defaulted the stage to Proposal; the pipeline shows the true total.
  await page.getByTestId("pipeline-toggle").click();
  const row = page.locator("[data-testid^='pipeline-row-']");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Maaden Phosphate");
  await expect(row).toContainText("36,450"); // netPrice, not 0
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(36450);

  // Weighted GP = prob x value x GP%: empty prob on an open deal = SAR 0.
  expect(digits(await row.locator("[data-testid^='gp-amount-']").textContent())).toBe(0);
  await page.locator("[data-testid^='prob-']").first().fill("100");
  expect(digits(await row.locator("[data-testid^='gp-amount-']").textContent())).toBe(9450);

  // GP% on a proposal row is editable (post-execution adhocs change it):
  // override 40 -> weighted GP recomputes; clearing reverts to derived.
  const gpInput = row.locator("[data-testid^='gp-pct-']");
  await expect(gpInput).toHaveAttribute("placeholder", "25.9");
  await gpInput.fill("40");
  expect(digits(await row.locator("[data-testid^='gp-amount-']").textContent())).toBe(Math.round(36450 * 0.4));
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='gp-pct-']").first()).toHaveValue("40");
  await page.locator("[data-testid^='gp-pct-']").first().fill("");
  expect(digits(await page.locator("[data-testid^='gp-amount-']").first().textContent())).toBe(9450); // derived again

  // A stage chosen BEFORE sending is never overwritten by mark-as-sent.
  await page.getByTestId("pipeline-toggle").click();
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  await page.getByTestId("line-qty-0-0").fill("1");
  await page.getByTestId("line-rate-0-0").fill("1000");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("mark-sent").click();
  await page.getByTestId("pipeline-toggle").click();
  const wonRow = page.locator("[data-testid^='pipeline-row-']").filter({ hasText: "1,350" }); // 1,000 cost x 1.35 default markup
  await expect(wonRow.locator("[data-testid^='stage-']")).toContainText(STAGE_LABELS[lang].Won);
});

test("goal band: empty state without target, live GP progress with one, booked share reacts to stages", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page); // net 36,450, GP 9,450
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();

  // No GP target: goal card shows the set-target empty state, never a fake 0%.
  await expect(page.getByTestId("goal-empty")).toBeVisible();
  await expect(page.getByTestId("goal-fill")).toHaveCount(0);

  // Booked: single Won deal = 100% booked.
  await expect(page.getByTestId("booked-pct")).toContainText("100");

  // Set a GP target of 94,500: achieved 9,450 = 10.0%.
  await page.getByTestId("targets-toggle").click();
  await page.getByTestId("target-gpTarget").fill("94500");
  await expect(page.getByTestId("goal-pct")).toHaveText("10.0%");
  expect(digits(await page.getByTestId("goal-achieved").textContent())).toBe(9450);
  const width = await page.getByTestId("goal-fill").evaluate((el) => (el as HTMLElement).style.width);
  expect(width).toBe("10%");

  // Add an open deal: booked share drops below 100 live (no period set, per design note).
  await page.getByTestId("pipeline-toggle").click(); // back to edit
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  await page.getByTestId("line-qty-0-0").fill("3");
  await page.getByTestId("line-rate-0-0").fill("9000");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Proposal, exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.getByTestId("booked-pct")).toContainText("50"); // 36,450 of 72,900
});

test("stage filter narrows the table but never the KPI totals", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);

  // Two proposals in different stages.
  await createProposalWithProgram(page, "Won Co", "Won Deal");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.getByTestId("new-proposal").click();
  await page.getByTestId("add-program").click();
  await page.getByTestId("line-rate-0-0").fill("9000");
  await page.getByTestId("line-qty-0-0").fill("3");
  await page.getByTestId("client-name").fill("Open Co");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Proposal, exact: true }).click();
  await page.waitForTimeout(400);

  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(2);
  const achievedBefore = digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent());

  // Filter to Won: one row, same KPIs, visible count note.
  await page.getByTestId("stage-filter").click();
  await page.getByRole("option", { name: new RegExp(STAGE_LABELS[lang].Won) }).click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);
  await expect(page.locator("[data-testid^='pipeline-row-']")).toContainText("Won Co");
  await expect(page.getByTestId("stage-filter-count")).toBeVisible();
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(achievedBefore);

  // A stage with no deals shows the in-table empty message.
  await page.getByTestId("stage-filter").click();
  await page.getByRole("option", { name: new RegExp(STAGE_LABELS[lang].Lost) }).click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(0);
  await expect(page.getByTestId("filter-empty")).toBeVisible();

  // Back to all stages restores both rows.
  await page.getByTestId("stage-filter").click();
  await page.getByRole("option").first().click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(2);
});

test("remove-from-pipeline clears the stage but keeps the proposal; re-staging restores it", async ({ page }, testInfo) => {
  const lang = langFromProject(testInfo.project.name);
  await gotoWithLanguage(page, "/", lang);
  await createProposalWithProgram(page, "STC", "AI Workshops");
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Won, exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(36450);

  // Remove from pipeline: row gone, KPIs to zero, proposal untouched.
  await page.locator("[data-testid^='remove-pipeline-']").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(0);
  expect(digits(await page.getByTestId("kpi-achieved-rev").locator(".tabular").first().textContent())).toBe(0);
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.getByTestId("proposal-title")).toHaveValue("AI Workshops"); // proposal alive

  // Reversible: set a stage again and the row returns (decidedAt was cleared).
  await page.getByTestId("pipeline-stage-edit").click();
  await page.getByRole("option", { name: STAGE_LABELS[lang].Proposal, exact: true }).click();
  await page.getByTestId("pipeline-toggle").click();
  await expect(page.locator("[data-testid^='pipeline-row-']")).toHaveCount(1);
  expect(digits(await page.getByTestId("kpi-open").locator(".tabular").first().textContent())).toBe(36450);
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
