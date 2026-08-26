# HNI App Template

Starter template for HNI (Human Network International) enterprise applications. It ships the full HNI foundation with no feature screens: design tokens, brand assets, bilingual EN/AR i18n with RTL, the app shell, shadcn/ui primitives, shared components, Playwright across 4 viewports x 2 languages, and the Claude Code skills and rules used to build and evaluate HNI screens.

## Start a new app from this template

1. Copy the template to a new folder (do not build inside the template):

   ```bash
   cp -R hni-app-template my-new-app
   cd my-new-app
   rm -rf .git node_modules
   git init
   ```

2. Install and verify:

   ```bash
   npm install
   npm run build
   npm run dev
   ```

   The dev server runs at http://localhost:5173 and shows the shell with a placeholder screen.

3. Make it yours:

   - `CLAUDE.md`: fill in the Product section (marked TODO). Everything downstream depends on it.
   - `package.json`: change `name`.
   - `index.html`: change the `<title>` if the app is not "HNI Platform".
   - `src/lib/i18n.tsx`: adjust `app` and the `nav` items to the app's information architecture; `src/components/app/AppShell.tsx` holds the matching nav list.
   - `docs/CURRENT-ARCHITECTURE.md`: fill in after your first inspection pass.

4. Build the first screen following the feature workflow in `CLAUDE.md`: write the brief, design with `hni-product-design`, implement under `src/features/<screen>/`, swap it into `src/App.tsx`, then run `hni-artifact-judge` and `hni-qa`.

5. Tests:

   ```bash
   npm run test:e2e:install
   npm run test:e2e
   ```

   `e2e/smoke.spec.ts` verifies the shell, language toggle, and direction switching in both languages on all viewports. Extend per screen; keep the console-guard fixture (`e2e/fixtures.ts`) in use.

## What is inside

```text
.claude/                skills (hni-product-design, hni-artifact-judge, hni-qa, frontend-design,
                        design-review, impeccable-polish, web-artifacts-builder) and launch config
CLAUDE.md               HNI operating rules; Product section is a TODO placeholder
docs/                   setup brief, skills log, blank architecture template, design-pilot template
public/brand/           HNI logos, favicons, fonts, icons, patterns
src/index.css           full HNI token set (palette, surfaces, status colors, shadcn mapping)
tailwind.config.js      hni.*, surface.*, line.* colors, logical-property-friendly setup
src/lib/i18n.tsx        EN/AR provider, dir/lang switching, shared shell strings only
src/components/ui/      shadcn primitives (wrap, do not edit)
src/components/app/     AppShell, PageHeader, KpiStrip, StatusBadge, States, DetailSheet, AppToaster
src/App.tsx             shell + placeholder screen
e2e/                    Playwright fixtures, locale helpers, smoke test
```

## Rules that keep the template healthy

- Tokens, never raw hex in components.
- Tailwind logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- Reuse and extend shared components before creating new ones.
- `npm run build` must pass before any commit.
