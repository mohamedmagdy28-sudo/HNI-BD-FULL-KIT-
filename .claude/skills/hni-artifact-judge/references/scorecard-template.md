# Scorecard Template

Use this structure exactly. Fill every section. Do not add praise sections beyond "What to keep".

```markdown
# HNI Artifact Judge: <screen or module name>

Date: <YYYY-MM-DD>
Artifact: <URL / route / file paths>
Brief: <given | inferred>  
USER: … | JOB: … | INFORMATION: … | DECISION: … | ACTION: … | SUCCESS: …

Evidence collected:
- Directions: EN LTR <yes/no>, AR RTL <yes/no>
- Breakpoints: 1440 <y/n>, 1280 <y/n>, tablet <y/n>, mobile <y/n>
- States: loading <y/n>, empty <y/n>, error <y/n>, validation <y/n>, long text <y/n>, large numbers <y/n>
- Method: <Playwright / browser / screenshots / source only>

## Verdict

**<SHIP | DO NOT SHIP>**  Weighted score: **<X.X>/10**  CRITICAL: <n>  HIGH: <n>  MEDIUM: <n>  LOW: <n>

Shortest path to SHIP: <ordered finding IDs>

## Scorecard

| Dimension | Weight | Score | Weighted | Findings | Note if < 8 |
|---|---:|---:|---:|---|---|
| Task effectiveness | 20% | | | | |
| Information architecture | 15% | | | | |
| Decision usefulness | 15% | | | | |
| Cognitive load | 10% | | | | |
| Visual hierarchy | 10% | | | | |
| Interaction quality | 10% | | | | |
| Accessibility | 5% | | | | |
| Responsiveness | 5% | | | | |
| RTL/LTR parity | 5% | | | | |
| Visual distinction | 5% | | | | |
| **Total** | 100% | | **<X.X>** | | |

## Job walk

<The path taken for the primary job: steps, clicks, transitions, hesitation points.>

## Findings (ranked by severity, then impact)

### F1. <short title>  [CRITICAL | HIGH | MEDIUM | LOW]  (catalog <A1…H4>)
PROBLEM: 
EVIDENCE: 
USER IMPACT: 
RECOMMENDED FIX: 

### F2. …

## Checked, not observed

<Catalog items checked with no finding, one line each with where checked. This proves coverage.>

## What to keep

<Up to three lines. Things that must not regress during fixes.>

## Re-test instructions

<Exactly what hni-qa should re-verify after fixes, by finding ID.>
```

## Summary block for the conversation

After saving the file, print only this in chat:

```text
JUDGE: <screen>  <SHIP | DO NOT SHIP>  <X.X>/10
CRITICAL <n>  HIGH <n>  MEDIUM <n>  LOW <n>
Lowest dimensions: <dim> <score>, <dim> <score>
Fix first: <F-ids>
Report: <path>
```
