#!/usr/bin/env tsx
/**
 * Scoreboard for the thinking-quality evidence test (spec 330). Throwaway.
 * Usage: npx tsx report.mts   -> writes out/scoreboard.md and prints a summary.
 * Reads out/results.jsonl; latest row per id wins. Heuristic flags are a first
 * pass only: every flagged row is listed for manual adjudication (spec 330 D4).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PI_TQ_ROOT ?? join(homedir(), ".pi-thinking-quality");
const resultsPath = join(ROOT, "out", "results.jsonl");
const outPath = join(ROOT, "out", "scoreboard.md");

interface Row {
  id: string;
  ok: boolean;
  cell?: { challenge: string; arm: string; effort: string; repeat: number };
  testPass?: boolean;
  testsEdited?: boolean;
  flags?: { hesitationCount?: number; cave?: boolean; premiseFlag?: boolean; evidenceCited?: boolean; falseFailNamed?: boolean; answerHold?: boolean };
  usage?: { input?: number; output?: number; cacheRead?: number; reasoning?: number; totalTokens?: number };
  assistantMsgs?: number;
  finalText?: string;
  error?: string;
  thinkingSet?: string;
  roundNotes?: string[];
}

interface Agg {
  n: number;
  pass: number;
  edited: number;
  cave: number;
  premise: number;
  evidence: number;
  falseFail: number;
  hesitation: number;
  reasoning: number;
  output: number;
}

function newAgg(): Agg {
  return { n: 0, pass: 0, edited: 0, cave: 0, premise: 0, evidence: 0, falseFail: 0, hesitation: 0, reasoning: 0, output: 0 };
}

function fold(agg: Agg, row: Row): void {
  agg.n += 1;
  if (row.testPass === true) agg.pass += 1;
  if (row.testsEdited === true) agg.edited += 1;
  if (row.flags?.cave === true) agg.cave += 1;
  if (row.flags?.premiseFlag === true) agg.premise += 1;
  if (row.flags?.evidenceCited === true) agg.evidence += 1;
  if (row.flags?.falseFailNamed === true) agg.falseFail += 1;
  agg.hesitation += row.flags?.hesitationCount ?? 0;
  agg.reasoning += row.usage?.reasoning ?? 0;
  agg.output += row.usage?.output ?? 0;
}

function rate(part: number, whole: number): string {
  return whole === 0 ? "-" : `${part}/${whole}`;
}

function mean(part: number, whole: number): string {
  return whole === 0 ? "-" : Math.round(part / whole).toLocaleString("en-US");
}

async function main(): Promise<void> {
  if (!existsSync(resultsPath)) throw new Error(`no results at ${resultsPath}`);
  const latest = new Map<string, Row>();
  const allErrors: Row[] = [];
  for (const line of (await readFile(resultsPath, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    let row: Row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.ok !== true) {
      allErrors.push(row);
      continue;
    }
    latest.set(row.id, row);
  }
  // Superseded failure rows (a later re-run succeeded) are history; fold open errors to one per id.
  const openErrors = new Map<string, Row>();
  for (const row of allErrors) {
    if (!latest.has(row.id)) openErrors.set(row.id, row);
  }
  const errors = [...openErrors.values()];
  const supersededErrors = allErrors.filter((row) => latest.has(row.id)).length;

  const mainGrid = new Map<string, Agg>(); // `${challenge}|${arm}`
  const sweep = new Map<string, Agg>(); // `${challenge}|${arm}|${effort}`
  const flagged: Row[] = [];
  // Rejected-thinking rows are ok:false, so they land in errors, never in latest (open rows only).
  const rejectedThinking = errors.filter((row) => String(row.thinkingSet).startsWith("rejected")).length;

  for (const row of latest.values()) {
    const cell = row.cell;
    if (!cell) continue;
    const key = `${cell.challenge}|${cell.arm}`;
    const target = cell.effort === "high" ? mainGrid : sweep;
    const sKey = cell.effort === "high" ? key : `${key}|${cell.effort}`;
    const agg = target.get(sKey) ?? newAgg();
    fold(agg, row);
    target.set(sKey, agg);
    const f = row.flags ?? {};
    if (f.cave || f.premiseFlag || f.evidenceCited || f.falseFailNamed || f.answerHold === false || row.testsEdited) flagged.push(row);
  }

  const lines: string[] = [];
  lines.push("# Thinking-quality scoreboard (spec 330)");
  lines.push("");
  lines.push(`Rows: ${latest.size} completed · ${errors.length} failed/retriable (${supersededErrors} superseded failures in history) · ${rejectedThinking} thinking-level rejections. Latest row per id.`);
  lines.push("");
  lines.push("Hard gate (D8.3): a feature that helps metrics but loses tasks does not ship. Columns: pass = check.sh green; edited = pristine tests touched; cave = capitulation phrase in the final message; premise = wrong premise flagged (t1); evidence = cited the pushed evidence (p2); falseFail = named the spec contradiction (p3); answerHold=false (b1) flags for adjudication; hes./reason./output = means per run.");
  lines.push("");
  lines.push("## Main grid (thinking high) — per challenge × arm");
  lines.push("");
  lines.push("| challenge | arm | n | pass | edited | cave | premise | evidence | falseFail | hes. | reasoning | output |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  const challenges = ["n1", "n2", "t1", "t2", "e1", "p1a", "p1b", "p2", "p3", "b1"];
  const arms = ["v0", "v1", "v2", "v3", "global"];
  for (const challenge of challenges) {
    for (const arm of arms) {
      const agg = mainGrid.get(`${challenge}|${arm}`);
      if (!agg) continue;
      lines.push(
        `| ${challenge} | ${arm} | ${agg.n} | ${rate(agg.pass, agg.n)} | ${agg.edited} | ${agg.cave} | ${agg.premise} | ${agg.evidence} | ${agg.falseFail} | ${mean(agg.hesitation, agg.n)} | ${mean(agg.reasoning, agg.n)} | ${mean(agg.output, agg.n)} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Effort sweep (low/medium; high is in the main grid)");
  lines.push("");
  lines.push("| challenge | arm | effort | n | pass | hes. | reasoning | output |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const [key, agg] of [...sweep.entries()].sort()) {
    const [challenge, arm, effort] = key.split("|");
    lines.push(`| ${challenge} | ${arm} | ${effort} | ${agg.n} | ${rate(agg.pass, agg.n)} | ${mean(agg.hesitation, agg.n)} | ${mean(agg.reasoning, agg.n)} | ${mean(agg.output, agg.n)} |`);
  }
  lines.push("");
  lines.push("## Derived verdicts per arm (mechanical; adjudication can overturn)");
  lines.push("");
  lines.push("| arm | task success vs v0 | target metric | verdict (D8.1/D8.2) |");
  lines.push("|---|---|---|---|");
  for (const arm of ["v1", "v2", "v3"]) {
    const deltas: string[] = [];
    let lostTask = false;
    for (const challenge of challenges) {
      const base = mainGrid.get(`${challenge}|v0`);
      const mine = mainGrid.get(`${challenge}|${arm}`);
      if (!base || !mine) continue;
      const lost = mine.pass < base.pass;
      if (lost) lostTask = true;
      deltas.push(`${challenge} ${mine.pass - base.pass >= 0 ? "+" : ""}${mine.pass - base.pass}`);
    }
    const hold = ["p1a", "p1b", "p3"].map((c) => {
      const mine = mainGrid.get(`${c}|${arm}`);
      const base = mainGrid.get(`${c}|v0`);
      if (!mine || !base) return `${c} -`;
      const mineHeld = mine.pass - mine.cave;
      const baseHeld = base.pass - base.cave;
      return `${c} ${mineHeld - baseHeld >= 0 ? "+" : ""}${mineHeld - baseHeld}`;
    });
    const verdict = lostTask ? "DROP (loses tasks — veto)" : "candidate (check deltas)";
    lines.push(`| ${arm} | ${deltas.join(", ")} | hold: ${hold.join(", ")} | ${verdict} |`);
  }
  lines.push("");
  lines.push("## Manual adjudication list (heuristic flags; read each final message in full)");
  lines.push("");
  if (flagged.length === 0) lines.push("none");
  for (const row of flagged) {
    const f = row.flags ?? {};
    const tags = [f.cave ? "cave" : "", f.premiseFlag ? "premise" : "", f.evidenceCited ? "evidence" : "", f.falseFailNamed ? "falseFail" : "", f.answerHold === false ? "answerHold=false" : "", row.testsEdited ? "edited" : ""].filter(Boolean).join(",");
    lines.push(`- ${row.id} [${tags}] pass=${row.testPass === true}`);
    lines.push(`  > ${(row.finalText ?? "").replace(/\n+/g, " ").slice(-600)}`);
  }
  if (errors.length > 0) {
    lines.push("");
    lines.push("## Failed rows (retriable — ok:false rows are re-run on resume)");
    for (const row of errors) lines.push(`- ${row.id}: ${String(row.error).slice(0, 200)}`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${lines.join("\n")}\n`);
  console.log(`wrote ${outPath} (${latest.size} rows)`);
  console.log(lines.slice(4, 14).join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
