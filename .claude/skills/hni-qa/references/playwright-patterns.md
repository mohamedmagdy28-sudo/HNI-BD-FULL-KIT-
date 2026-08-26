# Playwright Patterns for HNI QA

Adapt selectors and the language-switch mechanism to the repository. Prefer role and text locators over CSS selectors. These snippets assume `@playwright/test` and `@axe-core/playwright`.

## Project config with the HNI viewport matrix

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const viewports = {
  desktop: { width: 1440, height: 900 },
  laptop:  { width: 1280, height: 800 },
  tablet:  { width: 834,  height: 1112 },
  mobile:  { width: 390,  height: 844 },
};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: Object.entries(viewports).flatMap(([name, viewport]) => [
    { name: `${name}-en`, use: { ...devices['Desktop Chrome'], viewport, locale: 'en-US' } },
    { name: `${name}-ar`, use: { ...devices['Desktop Chrome'], viewport, locale: 'ar-SA' } },
  ]),
});
```

Read the direction in a test from the project name:

```ts
const isRTL = test.info().project.name.endsWith('-ar');
```

## Language switch helper

Adapt to the app's real mechanism (query param, localStorage key, settings toggle).

```ts
// e2e/helpers/locale.ts
import { Page, expect } from '@playwright/test';

export async function setLanguage(page: Page, lang: 'en' | 'ar') {
  await page.addInitScript((l) => localStorage.setItem('hni.lang', l), lang);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}
```

## Console and network capture (attach to every test)

```ts
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await use();
    if (errors.length) {
      await testInfo.attach('console-errors', { body: errors.join('\n'), contentType: 'text/plain' });
    }
    expect(errors, 'no console or network errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
```

## Accessibility scan

```ts
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
  .analyze();
const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''));
expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
```

## Critical workflow: dashboard action status

```ts
import { test, expect } from './fixtures';
import { setLanguage } from './helpers/locale';

for (const lang of ['en', 'ar'] as const) {
  test(`dashboard: filter, open action, change status, verify [${lang}]`, async ({ page }) => {
    await page.goto('/');
    await setLanguage(page, lang);

    await page.getByRole('combobox', { name: /project|المشروع/i }).selectOption({ label: 'Leadership Cohort A' });
    const row = page.getByRole('row', { name: /kickoff deck|عرض الانطلاق/i });
    await row.getByRole('button', { name: /open|فتح/i }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('combobox', { name: /status|الحالة/i }).selectOption('done');
    await drawer.getByRole('button', { name: /save|حفظ/i }).click();

    await expect(drawer).toBeHidden();
    await expect(row).toContainText(/done|مكتمل/i);
    await expect(page.getByTestId('kpi-overdue')).not.toContainText('3');
  });
}
```

## Critical workflow: RTL structure

```ts
test('arabic: navigation, drawer, table alignment', async ({ page }) => {
  await page.goto('/projects');
  await setLanguage(page, 'ar');

  const html = page.locator('html');
  await expect(html).toHaveCSS('font-family', /Tajawal|IBM Plex Sans Arabic/);

  await page.getByRole('button', { name: /القائمة|menu/i }).click();
  const nav = page.getByRole('navigation');
  const navBox = await nav.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(navBox!.x + navBox!.width, 'nav sits at the right edge in RTL').toBeGreaterThan(vw - 4);

  await page.getByRole('row').nth(1).click();
  const drawer = page.getByRole('dialog');
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox!.x + drawerBox!.width, 'detail drawer opens from the end (left) edge in RTL').toBeLessThan(vw / 2 + 4);

  const firstHeader = page.getByRole('columnheader').first();
  await expect(firstHeader).toHaveCSS('text-align', /start|right/);
  const numericCell = page.getByRole('cell', { name: /\d[\d,]*\s*(SAR|ر\.س)/ }).first();
  await expect(numericCell).toHaveCSS('text-align', /end|left/);
});
```

## States

```ts
// Empty state
await page.route('**/api/actions*', r => r.fulfill({ json: [] }));

// Error state
await page.route('**/api/actions*', r => r.fulfill({ status: 500, body: 'boom' }));
await expect(page.getByRole('alert')).toContainText(/couldn't load|تعذر التحميل/i);
await expect(page.getByRole('button', { name: /retry|إعادة المحاولة/i })).toBeVisible();

// Slow network
const client = await page.context().newCDPSession(page);
await client.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: 50_000, uploadThroughput: 20_000 });

// Reduced motion
await page.emulateMedia({ reducedMotion: 'reduce' });

// Long text and large numbers
await page.route('**/api/projects*', r => r.fulfill({ json: [{ id: 1, name: 'A'.repeat(120), budget: 987654321, gpPct: 100 }] }));
```

## Keyboard walk

```ts
const focusable = await page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').count();
for (let i = 0; i < focusable; i++) {
  await page.keyboard.press('Tab');
  const active = page.locator(':focus');
  await expect(active, `element ${i} has visible focus`).toBeVisible();
  const outline = await active.evaluate(el => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).boxShadow);
  expect(outline, `element ${i} has a focus indicator`).not.toMatch(/^none none$/);
}
```

## Screenshots per cell of the matrix

```ts
await page.screenshot({ path: `docs/design-pilot/${screen}/shots/${test.info().project.name}-${state}.png`, fullPage: true });
```

Attach these to the QA report; they are the evidence the judge and the pilot document reference.
