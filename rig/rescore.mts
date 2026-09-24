#!/usr/bin/env tsx
/**
 * Offline re-scorer (spec 330 rig): re-runs each latest ok-row's challenge check.sh in its
 * intact run dir and recomputes testsEdited as pristine-source comparison (fixture tests +
 * pushback fixtures must be byte-identical in rundir/test; check.sh is NOT compared — the
 * scorer evolved legitimately mid-project and run.mts's run-time hash pair is its tamper gate).
 * APPEND-ONLY: one updated `rescored: true` row per id; report.mts's latest-row-per-id-wins
 * picks it up (never rewrites results.jsonl, so it is safe beside a running runner).
 * Usage: npx tsx rescore.mts
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PI_TQ_ROOT ?? join(homedir(), ".pi-thinking-quality");
const resultsPath = join(ROOT, "out", "results.jsonl");

async function pristineDiffers(challenge: string, rundir: string): Promise<boolean> {
  const sources = [join(HERE, "booklet", challenge, "fixture", "test"), join(HERE, "booklet", challenge, "pushback-fixtures")];
  for (const source of sources) {
    if (!existsSync(source)) continue;
    const names = (await readdir(source, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    for (const name of names) {
      const pristine = await readFile(join(source, name), "utf8").catch(() => undefined);
      const current = await readFile(join(rundir, "test", name), "utf8").catch(() => undefined);
      if (pristine === undefined || current === undefined || current !== pristine) return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  if (!existsSync(resultsPath)) throw new Error(`no results at ${resultsPath}`);
  const latest = new Map<string, any>();
  const runBits = new Map<string, boolean>();
  for (const line of (await readFile(resultsPath, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.ok === true) latest.set(String(row.id), row);
      if (row.ok === true && row.rescored !== true) runBits.set(String(row.id), row.testsEdited === true);
    } catch {
      /* tolerate torn lines */
    }
  }

  let rescored = 0;
  let failed = 0;
  for (const [id, row] of latest) {
    const challenge = String(row?.cell?.challenge ?? "");
    const rundir = join(ROOT, "runs", id);
    if (!challenge || !existsSync(rundir)) {
      console.log(`skip ${id} (no rundir)`);
      continue;
    }
    let testPass = false;
    let checkOutput = "";
    try {
      await execFileAsync("bash", [join(HERE, "booklet", challenge, "check.sh")], { cwd: rundir, timeout: 60_000 });
      testPass = true;
    } catch (error: any) {
      failed += 1;
      checkOutput = String(error?.stdout ?? "") + String(error?.stderr ?? "");
    }
    // Inherit the run-time tamper bit from the ORIGINAL run row only (rescore rows carry
    // derived bits that must not compound across re-scorings).
    const fixtureEdited = await pristineDiffers(challenge, rundir);
    const testsEdited = fixtureEdited || runBits.get(id) === true;
    await appendFile(
      resultsPath,
      `${JSON.stringify({ ...row, testPass, testsEdited, checkOutput: checkOutput.slice(-800), rescored: true })}\n`,
    );
    rescored += 1;
    console.log(`${id}: pass=${testPass} edited=${testsEdited}`);
  }
  console.log(`rescored ${rescored} rows (${failed} failing checks) -> ${resultsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
