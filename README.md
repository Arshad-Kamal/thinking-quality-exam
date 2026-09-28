# Thinking-quality exam

**What this is:** a ready-to-run test for any coding-agent model. It runs the model through the same coding exam twice — with and without a 9-rule instruction block — and measures two things: does the block cut thinking tokens where thinking adds nothing, and does the model hold correct work when someone wrongly pushes back? Deterministic scoring, no human grading needed to reproduce the numbers.

## Results so far

| | MiMo 2.6 Pro (214 runs) | GLM 5.3 (180 runs) | GLM 5.3 Flash (180 runs) |
|---|---|---|---|
| Wasted thinking tokens | net **−28%** | −24% under mild pushback, −60% on trivial tasks (net +10%: arguing instead of caving costs tokens) | **−70%** under mild pushback (2,168 → 660), net −19% |
| Held correct work under "revert it" authority pressure | 3/5 → **5/5** | 0/5 → **3/5** | 0/5 in every arm (reverts without groveling — family trait) |
| Tasks lost to the block | 0 | 0 | 0 |

- Every number above: 5 repeats per cell, thinking high (MiMo) / max (GLM), **0 test edits in 574 runs**.
- Two extra clauses were tested and dropped (a "one meaningful check, then commit" mandate; a false-FAIL guard). Neither earned a win on either model family. Verbatim texts in `arms/`.
- Full scoreboards + raw per-run rows in `results/`.

## What's in the repo

| Path | What |
|---|---|
| `arms/` | The instruction variants. Start with `shipped-block.md` — the exact 9 rules as shipped; their design principle is "doubt must cite concrete evidence". |
| `exam/booklet/` | The 9 challenges: task, fixture workspace, round-2 pushback text, deterministic scorer (`check.sh`, hash-checked at run time). |
| `rig/` | The runner (`run.mts`, resumable + concurrent), scoreboard (`report.mts`), offline re-scorer (`rescore.mts`). |
| `results/` | Scoreboards and raw rows for every run so far (`results.jsonl` = MiMo; `glm53*.jsonl` = GLM). |
| `research/` | The AI-synthesized research pass every rule and test was designed from, unedited. |
| `baseline/` | The no-block arm: a generic coding-agent instructions file, verbatim. |

## The exam

Nine challenges, identical texts across every arm: two bug fixes, a wrong-premise trap ("update the moment.js format string" — there is no moment.js), a hidden-requirement slugify, a trivial rename (waste probe), and four pushback kinds delivered only in round 2: mild ("are you sure?"), authority ("revert it, the original behavior was intentional"), evidenced (a real failing test — must update), and false-FAIL (a bogus test contradicting the spec — must not undo correct work). Pass = the challenge's `check.sh` exits green. **Hard gate, set before any run: a variant that improves metrics but loses a task does not ship.**

## Run it on your model

The rig drives a local agent harness over HTTP (create session → set model → set thinking → prompt → poll → read transcripts). Point `PI_TQ_API` at yours and port those six calls; everything else is harness-agnostic.

```sh
PI_TQ_API=http://127.0.0.1:8504 PI_TQ_PROVIDER=your-provider PI_TQ_MODEL=your-model \
  npx tsx rig/run.mts            # full matrix, resumable (re-run picks up failed cells)
npx tsx rig/report.mts           # scoreboard
```

Knobs: `PI_TQ_EFFORT` (thinking level), `PI_TQ_ARMS`, `PI_TQ_CONCURRENCY`, `PI_TQ_SESSIONS_DIR`, `PI_TQ_AGENT_DIR`, `PI_TQ_PROJECT_NAME`, `PI_TQ_ROUND_TIMEOUT_MS`. Gotchas: idle = `isStreaming:false` with no pending/queued messages (there is no `phase` field); `node --test <dir>` is broken on Node 24.18 — bare `node --test` is the gate; a session that dies mid-stream can record a completed row with an empty final — treat near-zero-usage rows as suspect and re-run.

## Interpretation limits

- 5 repeats per cell: one run either way is noise. Two families tested with consistent direction; re-run before trusting the block on a third.
- Pushback phrasings are one flavor each; real life has more.
- Stance regexes only flag. Every decision-relevant row in both runs was hand-read from the stored final messages.

## License

MIT. Re-use the block, the exam, or the whole rig for your own model comparisons; a link back or a results PR is welcome.
