#!/usr/bin/env python3
"""Compute the HNI Artifact Judge weighted score.

Usage:
  python score.py scores.json
  echo '{"task_effectiveness": 7, ...}' | python score.py -

Input: JSON object with the ten dimension keys below, each an integer 1..10.
Optional keys: "critical" and "high" (integer counts) to compute the verdict.
Output: weighted total, per-dimension contribution, dimensions below 8, verdict.
No dependencies beyond the standard library.
"""
import json
import sys

WEIGHTS = {
    "task_effectiveness": 0.20,
    "information_architecture": 0.15,
    "decision_usefulness": 0.15,
    "cognitive_load": 0.10,
    "visual_hierarchy": 0.10,
    "interaction_quality": 0.10,
    "accessibility": 0.05,
    "responsiveness": 0.05,
    "rtl_ltr_parity": 0.05,
    "visual_distinction": 0.05,
}


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    raw = sys.stdin.read() if sys.argv[1] == "-" else open(sys.argv[1], encoding="utf-8").read()
    data = json.loads(raw)

    missing = [k for k in WEIGHTS if k not in data]
    if missing:
        print(f"Missing dimensions: {', '.join(missing)}")
        return 1

    total = 0.0
    below = []
    print(f"{'Dimension':<28}{'Weight':>8}{'Score':>7}{'Weighted':>10}")
    for key, w in WEIGHTS.items():
        s = data[key]
        if not isinstance(s, (int, float)) or not 1 <= s <= 10:
            print(f"Invalid score for {key}: {s!r} (must be 1..10)")
            return 1
        contrib = s * w
        total += contrib
        if s < 8:
            below.append((key, s))
        print(f"{key:<28}{int(w*100):>7}%{s:>7}{contrib:>10.2f}")

    critical = int(data.get("critical", 0))
    high = int(data.get("high", 0))
    high_accepted = bool(data.get("high_accepted", False))

    ship = total >= 8.0 and critical == 0 and (high == 0 or high_accepted)
    print("-" * 53)
    print(f"{'WEIGHTED TOTAL':<28}{'':>8}{'':>7}{total:>10.1f}")
    print(f"CRITICAL: {critical}  HIGH: {high}{' (accepted)' if high_accepted and high else ''}")
    if below:
        print("Below 8 (needs investigation note): " + ", ".join(f"{k}={s}" for k, s in below))
    print("VERDICT: " + ("SHIP" if ship else "DO NOT SHIP"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
