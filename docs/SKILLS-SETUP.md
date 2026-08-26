# Skills Setup and Review Log

Date reviewed: 2026-08-26

## Installed in `.claude/skills/`

| Skill | Source | Type | What was installed | Why |
|---|---|---|---|---|
| `frontend-design` | github.com/anthropics/skills (Apache-2.0) | Official | `SKILL.md`, `LICENSE.txt`, unmodified | Priority 1 in the brief. Prevents generic AI interfaces, improves typography, hierarchy, composition. |
| `web-artifacts-builder` | github.com/anthropics/skills (Apache-2.0) | Official | `SKILL.md`, `scripts/init-artifact.sh`, `scripts/bundle-artifact.sh`, `scripts/shadcn-components.tar.gz`, unmodified | Priority 2. For standalone React + Vite + Tailwind + shadcn artifacts and prototypes. Not a reason to migrate the repository's stack. |
| `design-review` | github.com/humbleteam/design-review (MIT) | Third-party, reviewed | `SKILL.md`, `references/review-rubric.md`, `LICENSE` | Priority 3. Fast 0 to 4 heuristic critique with a Nielsen or WCAG citation per issue. Complements the judge; it does not replace it. |
| `impeccable-polish` | Adapted from github.com/tyfarrago-hub/taste, skill `impeccable` (MIT) | Third-party, reviewed and trimmed | HNI-written `SKILL.md` plus vendored reference docs: polish, typography, typeset, layout, spatial-design, motion-design, interaction-design, responsive-design, color-and-contrast, cognitive-load, ux-writing. `LICENSE-taste` | Priority 4. Final polish only. |
| `hni-product-design` | HNI | Custom | `SKILL.md` + `references/brand.md`, `ux-principles.md`, `dashboard-rules.md`, `rtl-rules.md`, `data-viz-rules.md` | The design authority. |
| `hni-artifact-judge` | HNI | Custom | `SKILL.md` + `references/failure-catalog.md`, `scorecard-template.md`, `scripts/score.py` | Objective evaluation and ship gate. |
| `hni-qa` | HNI | Custom | `SKILL.md` + `references/test-matrix.md`, `playwright-patterns.md` | Functional, responsive, RTL, accessibility QA. |

## Rejected or excluded

| Item | Reason |
|---|---|
| `impeccable` upstream `SKILL.md` | Templated (`{{scripts_path}}`, `{{command_prefix}}`) and depends on the `npx impeccable` installer, a PRODUCT.md/DESIGN.md gate system, and a live-browser mode. It would not run as a plain project skill. Replaced with `impeccable-polish/SKILL.md` that points at the same reference docs. |
| `impeccable/scripts/*` | Contains `child_process` execution (`execSync`, `spawn`), a local HTTP server with browser script injection (`live-server.mjs`, `live-inject.mjs`), `fetch` calls, and recursive deletes (`rmSync(..., { recursive: true, force: true })` in `pin.mjs` and `cleanup-deprecated.mjs`). Nothing looked malicious, but none of it is needed for polishing and it fails the "install only relevant skill files" rule. Excluded. |
| Other `taste` skills (`bolder`, `cosmic-glass-dashboard`, `delight`, `overdrive`, `gpt-taste`, etc.) | Aesthetic directions that conflict with HNI's operational restraint. Not installed. |
| `design-review` `.github/workflows/validate.yml` | CI for the upstream repo, not relevant here. |
| Storybook, Figma MCP, Context7, extra MCP servers | Phase 2 or optional per the brief. Do not add until the component library or documentation needs justify the maintenance cost. |

## Security review notes

Checked per the brief's rule 34: source, SKILL.md, scripts, commands, network behavior, filesystem behavior, package installation.

- `frontend-design`: documentation only. No scripts.
- `web-artifacts-builder`: two shell scripts. `init-artifact.sh` scaffolds a Vite project and writes config files (references `https://ui.shadcn.com/schema.json` only as a JSON schema string). `bundle-artifact.sh` runs `rm -rf dist bundle.html` inside the artifact directory before rebuilding. Both act on the artifact folder they create, not on the repository. Run them only from a scratch directory.
- `design-review`: documentation only. No scripts, no network calls.
- `impeccable` references: markdown only. Scripts excluded as noted above.

Re-run this review whenever a vendored skill is updated. Never let a skill read `.env` or commit credentials.

## Updating vendored skills

```bash
# official skills
git clone --depth 1 --filter=blob:none --sparse https://github.com/anthropics/skills.git /tmp/anthropic-skills
cd /tmp/anthropic-skills && git sparse-checkout set skills/frontend-design skills/web-artifacts-builder
cp -r skills/frontend-design skills/web-artifacts-builder <repo>/.claude/skills/

# design-review
git clone --depth 1 https://github.com/humbleteam/design-review.git /tmp/design-review
cp /tmp/design-review/SKILL.md /tmp/design-review/LICENSE <repo>/.claude/skills/design-review/
cp -r /tmp/design-review/references <repo>/.claude/skills/design-review/

# impeccable references only
git clone --depth 1 https://github.com/tyfarrago-hub/taste.git /tmp/taste
cp /tmp/taste/skills/impeccable/reference/{polish,typography,typeset,layout,spatial-design,motion-design,interaction-design,responsive-design,color-and-contrast,cognitive-load,ux-writing}.md \
   <repo>/.claude/skills/impeccable-polish/references/
```

Review diffs before committing.

## Invoking skills in Claude Code

Skills with `user-invocable: true` can be called by name: `/hni-product-design`, `/hni-artifact-judge`, `/hni-qa`, `/impeccable-polish`, `/design-review`. They also trigger automatically from their descriptions when the task matches.
