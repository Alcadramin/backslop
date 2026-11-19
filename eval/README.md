# Eval

Realistic diffs of what coding agents do when asked to "optimize", "fix the flaky test", "make CI green" or "simplify", plus clean refactors that look similar and must stay silent.

```bash
node eval/run.mjs            # development set (eval/cases)
node eval/run.mjs heldout    # held-out set (eval/heldout)
```

Each case is `before.*`, `after.*` and a `case.json`:

```json
{ "expect": ["rule ids that must fire"], "optional": ["ids that may fire"], "story": "what the agent was asked and did" }
```

The score covers three things:
- **recall:** the share of expected findings that fire
- **false positives:** any finding on a clean case
- **extras:** findings on regression cases that weren't listed

**Be clear about what these numbers mean.** The cases are hand-written, not mined from real agent sessions. The rules were tuned on `cases/`, so its score shows coverage and can't measure precision. `heldout/` was written by a separate agent that read only the pattern descriptions. It never read the rules or ran the scanner, and nothing was tuned on it. That makes it the more honest number. It's still small and synthetic.

Real-code precision was measured separately, by running every rule on koel, Monica, Saleor and Documenso and reading the hits. The diff rules were also run on about 2,000 commits of their history. Agent sessions you've seen go wrong make the best new cases. PRs welcome.
