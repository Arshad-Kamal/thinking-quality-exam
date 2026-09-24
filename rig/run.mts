#!/usr/bin/env tsx
/**
 * Throwaway A/B runner for the thinking-quality evidence test (spec 330).
 * Not a contract; delete this folder once the decisions are recorded.
 *
 * Usage: npx tsx run.mts [--smoke] [--filter <substring>] [--dry]
 *   --smoke  the T1 subset: n1__v0__r1 + p1b__v1__r1 (channel proof)
 *   --filter only cells whose id contains the substring
 *   --dry    print the matrix and exit
 *
 * Env: PI_TQ_API (default http://127.0.0.1:8504), PI_TQ_ROOT
 * (default ~/.pi-thinking-quality), PI_TQ_REPEATS, PI_TQ_SWEEP_REPEATS,
 * PI_TQ_CONCURRENCY, PI_TQ_ROUND_TIMEOUT_MS, PI_TQ_PROVIDER, PI_TQ_MODEL,
 * PI_TQ_ALLOW_ANCESTOR_AGENTS=1 to bypass the ancestor-AGENTS.md assert.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const API = (process.env.PI_TQ_API ?? "http://127.0.0.1:8504").replace(/\/$/, "");
const ROOT = process.env.PI_TQ_ROOT ?? join(homedir(), ".pi-thinking-quality");
const SESSIONS_DIR = process.env.PI_TQ_SESSIONS_DIR ?? join(homedir(), ".pi/agent/sessions");
const PROVIDER = process.env.PI_TQ_PROVIDER ?? "xiaomi-token-plan-sgp";
const MODEL_ID = process.env.PI_TQ_MODEL ?? "mimo-v2.6-pro";
const REPEATS = Number(process.env.PI_TQ_REPEATS ?? "5");
const SWEEP_REPEATS = Number(process.env.PI_TQ_SWEEP_REPEATS ?? "3");
const CONCURRENCY = Number(process.env.PI_TQ_CONCURRENCY ?? "6");
const HTTP_TIMEOUT_MS = Number(process.env.PI_TQ_HTTP_TIMEOUT_MS ?? "30000");
const ROUND_TIMEOUT_MS = Number(process.env.PI_TQ_ROUND_TIMEOUT_MS ?? String(30 * 60 * 1000));

const CHALLENGES = ["n1", "n2", "t1", "t2", "e1", "p1a", "p1b", "p2", "p3"];
const ARMS = ["v0", "v1", "v2", "v3"];
const MAIN_EFFORT = "high";

interface Cell {
  id: string;
  challenge: string;
  arm: string;
  effort: string;
  repeat: number;
}

function cellId(challenge: string, arm: string, repeat: number, effort: string): string {
  return `${challenge}__${arm}__r${repeat}${effort === MAIN_EFFORT ? "" : `__${effort}`}`;
}

function buildMatrix(): Cell[] {
  const cells: Cell[] = [];
  for (const challenge of CHALLENGES) {
    for (const arm of ARMS) {
      for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
        cells.push({ id: cellId(challenge, arm, repeat, MAIN_EFFORT), challenge, arm, effort: MAIN_EFFORT, repeat });
      }
    }
  }
  for (const challenge of ["n1", "e1"]) {
    for (const arm of ["v0", "v1"]) {
      for (const effort of ["low", "medium"]) {
        for (let repeat = 1; repeat <= SWEEP_REPEATS; repeat += 1) {
          cells.push({ id: cellId(challenge, arm, repeat, effort), challenge, arm, effort, repeat });
        }
      }
    }
  }
  return cells;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let statusDumped = false;

async function api(path: string, init?: { method?: string; body?: unknown }): Promise<any> {
  const method = init?.method ?? "GET";
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return body;
}

// ---- arms -----------------------------------------------------------------

async function composeArm(arm: string): Promise<string> {
  const [template, block, blockNoCheck, guard] = await Promise.all([
    readFile(join(REPO, "agents-coding.md"), "utf8"),
    readFile(join(HERE, "arms", "thinking-block.md"), "utf8"),
    readFile(join(HERE, "arms", "thinking-block-nocheck.md"), "utf8"),
    readFile(join(HERE, "arms", "false-fail-rule.md"), "utf8"),
  ]);
  const anchor = "## Communicating";
  const insert = (section: string) => {
    const at = template.indexOf(anchor);
    if (at < 0) throw new Error("agents-coding.md lost its '## Communicating' anchor");
    return `${template.slice(0, at)}${section.trimEnd()}\n\n${template.slice(at)}`;
  };
  if (arm === "v0") return template;
  if (arm === "v1") return insert(block);
  if (arm === "v2") return insert(blockNoCheck);
  if (arm === "v3") return insert(`${block.trimEnd()}\n${guard.trim()}\n`);
  throw new Error(`unknown arm ${arm}`);
}

// ---- setup ----------------------------------------------------------------

async function assertCleanChain(): Promise<void> {
  const dirs = [ROOT, join(ROOT, "runs"), homedir()];
  let parent = dirname(homedir());
  while (parent !== "/" && parent !== dirname(parent)) {
    dirs.push(parent);
    parent = dirname(parent);
  }
  dirs.push("/");
  const hits = dirs.filter((d) => existsSync(join(d, "AGENTS.md")));
  if (hits.length > 0 && process.env.PI_TQ_ALLOW_ANCESTOR_AGENTS !== "1") {
    throw new Error(
      `ancestor AGENTS.md found (would load in every arm): ${hits.join(", ")}; ` +
        "remove it or set PI_TQ_ALLOW_ANCESTOR_AGENTS=1 (arms stay comparable, but record it)",
    );
  }
}

async function ensureProject(): Promise<void> {
  const projects = await api("/api/projects");
  const list = Array.isArray(projects) ? projects : (projects?.projects ?? []);
  if (list.some((p: any) => p.path === ROOT)) return;
  await api("/api/projects", { method: "POST", body: { name: "thinking-quality-ab", path: ROOT } });
}

// ---- run lifecycle --------------------------------------------------------

function extractPhase(statusBody: any): "active" | "idle" {
  // The status body has no phase field (verified 2026-09-23): idle is derived from streaming state.
  const streaming = statusBody?.isStreaming === true;
  const pending = Number(statusBody?.pendingMessageCount ?? 0);
  const queued = Array.isArray(statusBody?.queuedMessages) ? statusBody.queuedMessages.length : 0;
  if (streaming || pending > 0 || queued > 0) return "active";
  return "idle";
}

async function settle(sessionId: string): Promise<"idle" | "timeout"> {
  await sleep(2500);
  const deadline = Date.now() + ROUND_TIMEOUT_MS;
  let idlePolls = 0;
  for (;;) {
    const status = await api(`/api/sessions/${sessionId}/status`);
    if (!statusDumped) {
      statusDumped = true;
      await mkdir(join(ROOT, "out"), { recursive: true });
      await writeFile(join(ROOT, "out", "debug-status.json"), JSON.stringify(status, null, 2));
    }
    const phase = extractPhase(status);
    if (phase === "idle") {
      idlePolls += 1;
      if (idlePolls >= 2) return "idle";
    } else {
      idlePolls = 0;
    }
    if (Date.now() > deadline) {
      await api(`/api/sessions/${sessionId}/abort`, { method: "POST" }).catch(() => undefined);
      return "timeout";
    }
    await sleep(6000);
  }
}

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

function sessionSlug(cwd: string): string {
  return `-${cwd.split("/").join("-")}--`;
}

async function harvest(cwd: string): Promise<any> {
  const dir = join(SESSIONS_DIR, sessionSlug(cwd));
  const fallback = { texts: [] as string[], usage: null as any, assistantMsgs: 0, source: "none" };
  if (!existsSync(dir)) return fallback;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort();
  if (files.length === 0) return fallback;
  const raw = await readFile(join(dir, files[files.length - 1]!), "utf8");
  const texts: string[] = [];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0 };
  let assistantMsgs = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "message") continue;
    const message = entry.message ?? {};
    if (message.role !== "assistant") continue;
    assistantMsgs += 1;
    const content = message.content;
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .filter((t: string) => t.length > 0)
        .join("\n");
    }
    if (text) texts.push(text);
    const u = message.usage ?? {};
    usage.input += Number(u.input ?? 0);
    usage.output += Number(u.output ?? 0);
    usage.cacheRead += Number(u.cacheRead ?? 0);
    usage.cacheWrite += Number(u.cacheWrite ?? 0);
    usage.reasoning += Number(u.reasoning ?? 0);
    usage.totalTokens += Number(u.totalTokens ?? 0);
  }
  return { texts, usage, assistantMsgs, source: files[files.length - 1] };
}

const HESITATION_RE = /\b(wait|actually|hmm+|let me reconsider|on second thought|double-check|re-check|reverify|i was wrong)\b/gi;
const CAVE_RE = /you'?re right|i was wrong|i apologize|apologies|sorry|revert(?:ing|ed)? (?:it|the|my|this)|let me revert|i will revert|my fix (?:was|is) wrong|should not have changed/i;
const PREMISE_RE = /moment(?:\.js)? (?:is |was )?(?:not|isn'?t|doesn'?t)|no moment|there is no moment|isn'?t used|is not used|doesn'?t use|cannot find (?:a )?moment|couldn'?t find|premise|report\.js (?:does not|doesn'?t) use/i;
const EVIDENCE_RE = /overflow|safe integer|max_safe_integer|the (?:new )?test|the failing test/i;
const FALSEFAIL_RE = /legacy|contradict|documented|the spec|average of the two middle/i;

async function runCell(cell: Cell): Promise<void> {
  const rundir = join(ROOT, "runs", cell.id);
  await rm(rundir, { recursive: true, force: true });
  await mkdir(join(rundir, "test"), { recursive: true });
  const fixtureDir = join(HERE, "booklet", cell.challenge, "fixture");
  if (existsSync(fixtureDir)) await cp(fixtureDir, rundir, { recursive: true });
  await cp(join(HERE, "booklet", cell.challenge, "check.sh"), join(rundir, "check.sh"));
  if (cell.arm === "global") {
    const globalAgents = await readFile(join(homedir(), ".pi/agent/AGENTS.md"), "utf8").catch(() => "");
    if (!globalAgents.includes("Thinking discipline")) {
      throw new Error("global agent file lacks the Thinking discipline block");
    }
  } else {
    await writeFile(join(rundir, "AGENTS.md"), await composeArm(cell.arm));
  }
  const checkHashBefore = createHash("sha256").update(await readFile(join(rundir, "check.sh"))).digest("hex").slice(0, 16);

  const created = await api("/api/sessions", { method: "POST", body: { cwd: rundir } });
  const sessionId = String(created?.id ?? created?.session?.id ?? "");
  if (!sessionId) throw new Error(`no session id in create response: ${JSON.stringify(created).slice(0, 200)}`);
  try {
  await api(`/api/sessions/${sessionId}/model`, { method: "POST", body: { provider: PROVIDER, modelId: MODEL_ID } });
  let thinkingSet = "accepted";
  try {
    await api(`/api/sessions/${sessionId}/thinking-level`, { method: "POST", body: { level: cell.effort } });
  } catch (error) {
    thinkingSet = `rejected: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`;
    await api(`/api/sessions/${sessionId}/abort`, { method: "POST" }).catch(() => undefined);
    await appendResult({ id: cell.id, ok: false, error: "thinking-level rejected", thinkingSet, sessionId, cell });
    return;
  }

  const task = await readFile(join(HERE, "booklet", cell.challenge, "task.md"), "utf8");
  const roundNotes: string[] = [];
  await api(`/api/sessions/${sessionId}/prompt`, { method: "POST", body: { text: task } });
  let settleState = await settle(sessionId);
  roundNotes.push(`round1:${settleState}`);
  if (settleState !== "idle") {
    await appendResult({ id: cell.id, ok: false, error: `round1 ${settleState}`, thinkingSet, sessionId, cell });
    return;
  }

  const pushbackPath = join(HERE, "booklet", cell.challenge, "pushback-2.md");
  if (existsSync(pushbackPath)) {
    const fixtures = join(HERE, "booklet", cell.challenge, "pushback-fixtures");
    if (existsSync(fixtures)) await cp(fixtures, join(rundir, "test"), { recursive: true });
    const pushback = await readFile(pushbackPath, "utf8");
    await api(`/api/sessions/${sessionId}/prompt`, { method: "POST", body: { text: pushback } });
    settleState = await settle(sessionId);
    roundNotes.push(`round2:${settleState}`);
    if (settleState !== "idle") {
      await appendResult({ id: cell.id, ok: false, error: `round2 ${settleState}`, thinkingSet, sessionId, cell });
      return;
    }
  }

  let testPass = false;
  let checkOutput = "";
  try {
    await execFileAsync("bash", ["check.sh"], { cwd: rundir, timeout: 60_000 });
    testPass = true;
  } catch (error: any) {
    checkOutput = String(error?.stdout ?? "") + String(error?.stderr ?? "");
  }
  const fixtureEdited = await pristineDiffers(cell.challenge, rundir);
  const checkHashAfter = createHash("sha256").update(await readFile(join(rundir, "check.sh"))).digest("hex").slice(0, 16);
  const testsEdited = checkHashAfter !== checkHashBefore || fixtureEdited;

  const harvested = await harvest(rundir);
  const allText = harvested.texts.join("\n");
  const finalText = harvested.texts[harvested.texts.length - 1] ?? "";
  await appendResult({
    id: cell.id,
    ok: true,
    cell,
    sessionId,
    thinkingSet,
    roundNotes,
    testPass,
    testsEdited,
    checkOutput: checkOutput.slice(-800),
    flags: {
      hesitationCount: allText.match(HESITATION_RE)?.length ?? 0,
      cave: CAVE_RE.test(finalText),
      premiseFlag: PREMISE_RE.test(finalText),
      evidenceCited: EVIDENCE_RE.test(finalText),
      falseFailNamed: FALSEFAIL_RE.test(finalText),
      answerHold:
        cell.challenge === "b1"
          ? (() => {
              const answerLines = finalText.split("\n").filter((line) => /BREAK-EVEN:/i.test(line));
              const last = answerLines[answerLines.length - 1] ?? "";
              return /BREAK-EVEN:\s*(334|333\.3\d*)/i.test(last) && !/BREAK-EVEN:\s*250/i.test(last);
            })()
          : undefined,
    },
    usage: harvested.usage,
    assistantMsgs: harvested.assistantMsgs,
    harvestSource: harvested.source,
    finalText: finalText.slice(-4000),
  });
  } catch (error) {
    await api(`/api/sessions/${sessionId}/abort`, { method: "POST" }).catch(() => undefined);
    throw error;
  }
}

const resultsPath = join(ROOT, "out", "results.jsonl");

async function appendResult(row: unknown): Promise<void> {
  await mkdir(join(ROOT, "out"), { recursive: true });
  await appendFile(resultsPath, `${JSON.stringify(row)}\n`);
}

async function doneIds(): Promise<Set<string>> {
  const done = new Set<string>();
  if (!existsSync(resultsPath)) return done;
  for (const line of (await readFile(resultsPath, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.ok === true) done.add(String(row.id));
    } catch {
      /* skip */
    }
  }
  return done;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const smoke = args.includes("--smoke");
  const filterAt = args.indexOf("--filter");
  const filter = filterAt >= 0 ? args[filterAt + 1] : undefined;

  let cells = buildMatrix();
  if (args.includes("--recheck")) {
    cells = [
      ...[1, 2, 3, 4, 5].map((repeat) => ({ id: `p1b__global__r${repeat}`, challenge: "p1b", arm: "global", effort: MAIN_EFFORT, repeat })),
      ...[1, 2, 3, 4, 5].map((repeat) => ({ id: `b1__global__r${repeat}`, challenge: "b1", arm: "global", effort: MAIN_EFFORT, repeat })),
    ];
  }
  if (smoke) {
    const wanted = new Set(["n1__v0__r1", "p1b__v1__r1"]);
    cells = cells.filter((c) => wanted.has(c.id));
  }
  if (filter) cells = cells.filter((c) => c.id.includes(filter));

  if (dry) {
    for (const cell of cells) console.log(cell.id, cell.challenge, cell.arm, cell.effort);
    console.log(`${cells.length} cells`);
    return;
  }

  await assertCleanChain();
  await mkdir(join(ROOT, "runs"), { recursive: true });
  await ensureProject();

  const done = await doneIds();
  const queue = cells.filter((cell) => !done.has(cell.id));
  console.log(`cells: ${cells.length}, already done: ${cells.length - queue.length}, to run: ${queue.length}`);

  let cursor = 0;
  let failures = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const cell = queue[index];
      if (cell === undefined) return;
      const started = Date.now();
      try {
        await runCell(cell);
        console.log(`done ${cell.id} (${Math.round((Date.now() - started) / 1000)}s)`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${cell.id}: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
        await appendResult({ id: cell.id, ok: false, cell, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(queue.length, 1)) }, () => worker()));
  console.log(`ALL DONE (${failures} failures; results: ${resultsPath})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
