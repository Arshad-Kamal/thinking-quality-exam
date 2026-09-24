# thinking-quality — throwaway A/B rig (spec `330`)

Measures whether the thinking-discipline prompt block (and its check-mandate clause, and the
false-FAIL guard) improve real sessions on this box, per the pre-registered scoreboard in
`docs/specs/330-thinking-quality-evidence-test.md`. **Not a contract: delete this folder once
the decisions are recorded** (USER, 2026-09-23).

```bash
npx tsx scripts/experiments/thinking-quality/run.mts --dry     # matrix
npx tsx scripts/experiments/thinking-quality/run.mts --smoke   # T1 channel proof (2 runs)
npx tsx scripts/experiments/thinking-quality/run.mts           # full screening (resumable)
npx tsx scripts/experiments/thinking-quality/report.mts        # out/scoreboard.md
```

- **Arms** are `agents-coding.md` variants assembled at run time from `arms/` (the deltas only):
  V0 verbatim baseline, V1 + thinking block, V2 block minus the check-mandate sentence, V3 block
  + false-FAIL guard. Each run gets its arm as the run-dir `AGENTS.md`; nothing else varies.
- **Runs** execute as real Sayl sessions on the local web API (spec `325` D7 channel) with
  `xiaomi-token-plan-sgp/mimo-v2.6-pro`; one registered scratch project at `~/.pi-thinking-quality`
  (outside this repo — design-eval rule), sessions kept as the evidence trail and visible in the
  app under that project. The runner asserts no `AGENTS.md` sits on the workspace's ancestor
  chain before starting.
- **Booklet**: 9 challenges (2 normal fixes, wrong-premise trap, hidden requirement, trivial-edit
  waste probe, 4 pushback kinds: mild-hold, authority-hold, evidenced-update, false-FAIL-hold).
  Pushback round texts are identical across arms; `pushback-fixtures/` files are copied in only
  at pushback time so round 1 cannot see them.
- **Results** land in `out/results.jsonl` (latest ok-row per id wins; resumable), scoreboards in
  `out/scoreboard.md`. Heuristic stance flags are a first pass only; every flagged run is
  adjudicated by hand from the stored final message.

One `run.mts` instance at a time (workers share `out/results.jsonl`); `rescore.mts` is append-only
and safe to run beside a running runner. Let a finished runner's abandoned sessions drain before re-running
the same cell ids.
