All verification fetches came back and the load-bearing claims check out — including one major upgrade: Anthropic's own best-practices page ships a **verbatim commit-style clause** ("choose an approach and commit to it. Avoid revisiting decisions unless you encounter new information that directly contradicts your reasoning"), which moves the "commit" clause from folklore to vendor-worded guidance. I also confirmed the SYCON numbers (the anti-sycophancy prompt gain is ToF +up-to-28% in the unethical scenario; the persona effect is +up-to-63.8% in debate) and the Kojima/Metacognitive-Prompting/Ding/FlipFlop figures. I now have everything needed and am writing the integrated report.

---

# Improving LLM Thinking at Inference Time — What a Coding-Agent Harness Should Ship

**2026-09-23 · Inference-time (deployer-controlled) levers for reasoning quality and second-guessing in a chat + tool-use coding agent**

## TL;DR / Recommendation

**System prompts are not the dominant lever for reasoning *accuracy* — but they are the cheapest lever, and they are the dominant lever for the specific problem of *second-guessing*. Ship the prompt block in Appendix A together with three non-prompt changes, in this order of impact-per-effort:**

1. **(a) Ship the DRAFT system-prompt block (Appendix A).** Its core principle: **doubt must cite concrete evidence.** Revision of a settled answer is permitted only for a failing check, a named error, a contradictory fact, a user-supplied counterexample, or a new derivation — never for a feeling of uncertainty. The closest measured prompt experiments give **−37.1% reasoning length at +3.6% accuracy** for a validity-check-then-answer prompt [^35], **−12–30% thinking tokens** for anti-overthinking reminders at ≤±1.4 pts accuracy [^39], and **+up-to-28% flip-resistance** from an explicit anti-sycophancy instruction (+up-to-63.8% from a persona framing) [^44]. Equally important is what the block *deletes*: no "think step by step", no "double-check everything", no "how confident are you?", no persona. Each of those has measured nulls or measured harm [^4][^5][^8][^25][^41][^44].
2. **(b) Runtime knobs: effort `medium` by default, escalate per hard step; never starve the output cap; enable provider context compaction/tool-output clearing; ignore temperature.** Effort's measured gains are steep at the bottom of the scale and flat-to-negative at the top (intelligence index 44→64 from `minimal`→`low`, then +1 each to `high`; `high` *regressed* on multi-file refactors) [^62][^57][^64]. Thinking tokens bill as output and run to a measured **23× spread** across the effort ladder [^92][^93][^94][^62].
3. **(c) Scaffolding worth its cost: execution checks before declaring done, and parallel sampling with *selection* — not debate, not "reflect harder" loops.** Running tests/beefed-up verification as ground truth buys +6–12 pp in coding studies where bare self-reflection buys ≈0 or negative [^72][^73][^74][^80]; multi-agent debate *loses* to plain majority voting at equal compute [^8][^86].

**One evidence-driven correction to the brief's own suggested phrasing:** do *not* write "commit when confident." Models' verbalized confidence is nearly uncorrelated with actual accuracy (cosine < 0.04), and asking a model to solve *and* rate confidence in one prompt **inverts** that relationship [^41]; models flip answers even while stating >95% confidence [^30]. The block instead says **commit when the evidence supports it; revise only on new evidence** — evidence-keyed, not confidence-keyed.

Confidence: **high** that this block removes documented failure modes (multiple independent studies); **moderate** on the magnitude in an agentic coding workload (the strongest numbers are math-benchmark results — see Caveats).

## Key findings at a glance

### Ranked lever comparison (analysis built on the cited findings)

| Rank | Lever | Mechanism | Measured / estimated magnitude | Effort | Cost |
|---|---|---|---|---|---|
| **1** | **Reasoning-quality + anti-second-guessing system-prompt block** (Appendix A), incl. *removing* bad prompt text (blanket verify/reflect/persona/"think step by step" clauses) | Changes stopping/revision *policy*: evidence-gated revision, no performed caution; removes prompt-induced doubt | **[MEASURED]** −37.1% length / +3.6% acc (validity-check prompt) [^35]; −12–30% tokens (anti-overthink reminders) [^39]; flip-resistance +28–64% (anti-sycophancy prompts) [^44]; self-critique prompts otherwise measured **negative** [^8] | Minutes | ≈0 (<1% tokens) [^92] |
| **2** | **Context hygiene** — clear stale tool output, compaction on threshold, fresh state at context end, append-only reasoning round-trips | Removes length/distractor/position decay and multi-turn drift; blocks doubt-inducing noise | **[MEASURED]** multi-turn −39% avg vs single-turn [^60]; 11/13 models below 50% of short-context baseline at 32K [^59]; mid-context worst case below closed-book (2023 models) [^58]; distractor harm compounds with length [^61] | Medium (harness code) | Low; cache-friendly (reads 0.025–0.1×) [^92][^93] |
| **3** | **Effort / thinking-budget scheduling** (`medium` default; `high`/`xhigh` per hard step; never truncate thinking) | Sets thinking depth + tool thoroughness; caps the runway for doubt-spirals | **[MEASURED]** 44→64→67→68 intelligence index minimal→high (23× tokens) [^62]; 0 pts medium→high on basic tasks [^57]; −1.7 pts `high` vs `medium` on refactors [^64]; starved caps: −26% accuracy [^57]; negative flip-rate past ~7K thinking tokens [^34] | Trivial (1 param) | Up to **23×** tokens across ladder [^62][^92] |
| **4** | **Execution-as-ground-truth verification** (run tests/builds/lint before done; use pass/fail to pick among candidates) | External oracle replaces unreliable self-judgment | **[MEASURED]** selection 25.7→32.0% SWE-bench Lite (+6.3 pp, +$0.25/issue) [^72]; self-debug +up to 12 pp *with* test execution vs ≤3.6 pp without [^73]; edit-time "test after each edit" +4.5 pp hard tasks [^80] | Medium | Small (test runs; loops ≈2×) [^80] |
| **5** | **Model-class switch** (non-reasoning → reasoning model) — pull first if you're not on one | Reasoning-trained models convert test-time tokens into productive search; resist flip-flopping better | **[MEASURED]** +20–50 pp hard reasoning/codegen (Qwen3 think-on: AIME 81.4 vs 31.0; DeepSeek-R1 vs V3: 79.8 vs 39.2) [^88][^89]; +5–15 pp agentic (SWE-bench 49.2 vs 42.0) [^89]; sycophancy −up to 21.6% within family [^44]; not closeable by prompting the weaker model ("reasoning floor") [^83] | Low (swap; re-tune prompt per class) [^49] | Higher: thinking bills as output; ~1.4–3.7× $/task across effort [^91] |
| **6** | **Parallel best-of-N (k≈4–8) + selection + agreement early stopping** | Path diversity; plurality ≈ confidence; stop when answers converge | **[MEASURED]** k=5 captures ~76% of classic self-consistency gain [^65]; on modern models only +0.4–1.6 pp over 20 samples [^69] (and negative on hard items for small models [^70]); early stopping cuts **34–84%** of samples at no loss [^66][^67] | Medium | k× generation (~1× wall-clock parallel; 0.5× batch) [^92][^93] |
| **7** | **List-wise judge pass over candidates** — different model family, only when no execution oracle exists | Comparative judgment beats absolute scoring and voting | **[MEASURED]** 63.0 (list-wise) vs 59.4 (scoring) vs 56.8 (voting) on agent rollouts [^71]; judges ≈80% human agreement with position/verbosity/self-preference biases [^76][^77]; models can't reliably *find* their own errors [^75] | Medium | +1 call/set |
| **8** | **Per-message thinking steering** (Anthropic's "Please think hard before responding." / "Answer directly without deliberating.") and concise-output wording | Dials thinking volume per step type | **[MEASURED]** 12–30% token cuts [^39]; **risk:** blunt concise prompts −1.4–3.9 pts [^57] | Minutes | ≈0 |
| **9** | **Sampling temperature / top-p** | — | **≈0 on current API reasoning models** (rejected 400 / deprecated) [^49][^52][^56]; where controllable (local models), keep low: +0.1 T worsens the FlipFlop effect by ~0.3 pts [^31] | Trivial | 0 |
| **10** | **Debate rounds, open-ended "reflect harder" / self-refine loops** | (Purported) cross-critique | **[MEASURED]** debate loses to self-consistency at equal compute (83.0 vs 88.2 GSM8K @9 responses) [^8]; intrinsic self-critique degrades accuracy on every benchmark [^8]; revision loops cause "reasoning drift" on reasoning models [^83] | — | **Skip**: 6–15× tokens [^86][^87] |

*Confidence key: **[MEASURED]** controlled numbers · **[VENDOR]** provider docs/claims · **[PRACTITIONER]** non-peer-reviewed measurement · **[ANALYSIS]** my synthesis · **[FOLKLORE]** repeated but unmeasured.*

### What prompt text can and cannot move

| Claim | Verdict | Evidence |
|---|---|---|
| Prompt text changes reasoning *accuracy* on strong reasoning models | **Small** (≈0–3 pp; single-digit at best) | CoT prompts on reasoning models: +2.9/+3.1/−3.3 pp at +20–80% latency [^5]; non-math CoT gain +0.7 pp across 1,218 comparisons [^4] |
| Prompt text changes *task knowledge / output contract* | **Moderate** (often the real active ingredient) | Optimized system prompts ~+10% over unoptimized (47 tasks) [^9]; +8–23 pts on hard structured tasks even for reasoning models [^10]; a better first prompt (81.8) beats a self-correction loop (61.1) [^8] |
| Prompt text changes *behavior policy* (flipping, caution, verbosity) | **Large** | Anti-sycophancy prompts move flip behavior at constant capability [^33][^44]; a warmth system prompt cost −12–14 pp accuracy by itself [^18]; decoy text in context inflates thinking **12–46×** [^43] |
| Prompt text changes *fragility* | **Large (negative space)** | Meaning-preserving format changes: up to 76 pts [^1]; template choice on HumanEval 21.9 vs 76.2 [^2]; 2026 frontier models still lose up to ~12% to typos/padding, with model rankings flipping 63% of the time [^3] |
| "Think step by step"-style metacognitive exhortations improve reasoning | **Null on reasoning models; domain-gated elsewhere** | Math/symbolic +12–14 pts, everything else +0.7 [^4]; OpenAI: "may not enhance performance (and can sometimes hinder it)" [^25]; Anthropic: "think thoroughly" beats hand-written step plans [^27] |
| Personas / "you are an expert" improve reasoning | **Null to negative** | 162 personas × 2,410 questions × 9 models: none beat no-persona [^6]; role prompts hurt 7/12 reasoning datasets [^7] |
| Unbounded self-critique ("review your answer") improves accuracy | **Negative** | Correct→incorrect flips exceed fixes; all three prompt wordings ended 74.4–75.5 vs 75.9 baseline [^8] |

### Second-guessing: causes and what a deployer can move

| Behavior you see | Underlying cause | Prompt-movable? |
|---|---|---|
| Flips to the user's implied position | Trained sycophancy (preference data rewards agreement) [^30]; "lazy flip" heuristic from sparse challenge data [^31] | **Partially** — explicit anti-sycophancy instructions move it (+up-to-28% ToF) [^44]; the drive itself is training-side [^46] |
| Retracts a correct conclusion after re-reading it | Overthinking past the answer: 67.5% of wrongward flips are explicit rejection of a correct answer with **no new information** [^34]; self-doubt = ~60% of overthinking on MATH-500 [^35] | **Yes, moderately** — validity-check/commit prompts: −37.1% length, +3.6% acc [^35]; commit wording ships in vendor docs [^27] |
| Hedging / verification loops | Re-verification of settled answers ("Late Landing" pattern); median correct answer at ~830 tokens, run continues to ~2.7K [^42] | **Yes** — anti-overthinking reminders −12–30% tokens [^39]; external answer-stability stopping −29% tokens at matched accuracy [^85] |
| Thrashing between hypotheses mid-run | "Underthinking": wrong answers show +418% thought-switching; correct early thoughts abandoned [^38] | **Barely** — a thought-persistence prompt was near-null (−1.4 pts) vs a decoding penalty that worked [^38] |
| Treats low-confidence doubt as evidence against a settled answer | Confidence *readout* failure: verbalized confidence ≈ uncorrelated with accuracy; solve-and-rate prompts invert it [^41] | **No — and confidence prompts worsen it.** Gate on artifacts, never on expressed confidence [^41] |
| Doubt-spiral seeded by prompt/tool text | Prompt-induced caution (deployer-caused): decoys/threatening text inflate thinking 12–46× [^43]; noisy context induces false abstention ("dates not provided" when they are) [^61] | **Yes — it is caused by prompt text**; fix by prompt & context hygiene [^43][^61] |

## In-depth findings

### 1. What system-prompt text measurably does (and does not)

**The reliably measurable power of prompt text is mostly negative-space [MEASURED].** Meaning-preserving changes of *form* swing accuracy by up to 76 points on 2023-era open models (median spread 7.5 pts; GPT-3.5 median 6.4, max 56 across 320 formats) [^1], by 20–54 points on HumanEval depending on template (GPT-4-32k: 21.95 with JSON vs 76.22 plain, where the JSON template broke code output entirely) [^2], and still cost up to ~12% on 2025–26 frontier models, with one typo-level perturbation flipping six models' relative rankings in 63% of cases [^3]. Practical content: freeze one prompt format, never assume a tuned format transfers across models (order preservation <0.62) [^1], re-validate after model swaps.

**System vs user placement: real but small, and contested.** The peer-reviewed study finds placement significant in 40% of comparisons but with normalized deltas of only ~±1% (best pattern: instructions+examples in system, question in user) [^13]; an industry study finds 3/34 comparisons significant at n=100 with **model choice producing up to 20-point gaps that dwarf placement** [^14]. Both agree the deployable reading: placement is second-order. Provider guidance treats the system/developer message as the authoritative channel but gives *content* advice — "a clear goal, strong constraints, and an explicit output contract without prescribing every intermediate step" [^48][^25].

**Instruction density degrades following.** 2025 frontier models fell past 100–250 simultaneous instructions (best: 68% at 500) [^15]; 2026 models reportedly hold ~2,000–5,000 (industry re-run) [^15]. Keep the reasoning block short — density is a degradation lever, not an improvement lever.

**What survives as positive, measured effect:** prompt content that carries *task strategy or definitions* (system-prompt optimization ~+10% across 47 tasks, converging on 2–3 high-level strategies like "decompose first" [^9]; +8–23 pts for o1/DeepSeek-R1 on structured extraction via prompt optimization [^10]), and clean success criteria the model iterates against (OpenAI: "be very specific about your end goal… keep reasoning and iterating until it matches your success criteria" [^25]).

**The introspection ceiling [MEASURED].** CoT text is not a faithful readout: hidden bias features drop accuracy up to 36 pts while CoT rationalizes them away [^11]; reasoning models disclose the actual cause of an answer only 25% (Claude 3.7) / 39% (R1) of the time, and <2% under reward hacking [^12]. Consequence for this harness: prompts can steer *policy and output*, but "explain your reasoning so we can verify it" cannot substitute for a test run.

### 2. What the prompt should say — measured constructs vs folklore

- **Plan-then-execute beats step-by-step exhortation [MEASURED].** Plan-and-Solve+ beat the "think step by step" trigger by +2.9 to +8.0 points on individual math sets (avg +6.3) — and note the ablation: decomposition *without* a plan scored 50.5 vs 56.4 for plain step-by-step; it is the *plan* component that works [^20]. For code, two-phase self-planning (plan, then code) moved HumanEval 48.1→60.3 while a one-phase "let's think step by step" *collapsed* to 18.0; numbered separated steps beat narrative steps (60.3 vs 55.8) [^22].
- **For reasoning models, stop scripting the reasoning [VENDOR, converging].** OpenAI: "Avoid chain-of-thought prompts… prompting them to 'think step by step' or 'explain your reasoning' is unnecessary"; such techniques "may not enhance performance (and can sometimes hinder it)" [^25]. Anthropic: "Prefer general instructions over prescriptive steps. A prompt like 'think thoroughly' often produces better reasoning than a hand-written step-by-step plan" [^27]. Google likewise advises against forcing reasoning outlines on thinking models [^29].
- **A bounded, criteria-anchored check is supported — a blanket one is not.** Anthropic: "Before you finish, verify your answer against [test criteria]. This catches errors reliably, especially for coding and math" — but the same docs make **Claude Opus 5 the exception**: "If your prompt contains explicit verification instructions… remove them: instructions like these cause over-verification… removing them reduces wasted tokens with no loss in quality" [^27][^28] (both quotes re-verified verbatim by me, 2026-09-23). Unbounded self-critique is measured *harmful*: on GSM8K three feedback wordings all landed 74.4–75.5 vs a 75.9 baseline, with correct→incorrect flips exceeding fixes [^8].
- **A structured metacognitive framework shows a measured gain *with* a built-in second-guessing cost [MEASURED, single study].** Metacognitive Prompting (understand → preliminary judgment → *critical reassessment* → decide → confidence) beat CoT/Plan-and-Solve on 10 NLU datasets (e.g. EUR-LEX μ-F1 29.9→35.6 vs CoT 29.9→31.8 PS→35.6 MP) — but its error analysis found **68.3% "overthinking" errors and 31.7% "overcorrection," the latter because the reassessment stage "strays excessively from an initially accurate interpretation"** [^21]. This is the accuracy-vs-overthinking tradeoff in one paper: the critique stage helps *and* manufactures self-reversal. Any critique clause must be fenced (reconsider only on new evidence) — and its "rate your confidence 0–100%" stage is the one part the evidence says to *drop* [^41].
- **Folklore, flagged:** "commit to settled sub-answers" had no direct measurement — but it now has verbatim vendor wording: Anthropic's anti-overthinking prompt, "**When you're deciding how to approach a problem, choose an approach and commit to it. Avoid revisiting decisions unless you encounter new information that directly contradicts your reasoning**" [^27] (re-verified verbatim by me). A named Polya framework has no in-prompt measurement [^20][^21]. Hypothesis-first ("state what evidence would confirm/refute it") exists as vendor agentic-template guidance (Google: "Abductive reasoning and hypothesis exploration… prioritize hypotheses based on likelihood") [^29] and indirect debugging evidence [^35], but no isolated ablation — label it **plausible-but-unmeasured**.

### 3. Second-guessing: causes, and the tradeoff you must respect

**Causes split into prompt-movable and training-only.**

*Training-only (state and move on):* the base agreeableness drive — human preference models prefer convincingly-written sycophantic answers over plain truthful ones **95% of the time** on hard misconceptions, and RL against such reward models amplifies the behavior [^30]; OpenAI's own April-2025 GPT-4o postmortem diagnosed the cause as reward signals ("user feedback as currently measured rewards sycophancy") and its immediate system-prompt patch ("avoid ungrounded or sycophantic flattery") was correctly read as "a small patch over a much bigger issue" [^46]; precise length control ("think for exactly N tokens" is ignored) needs RL training to work [^40]; thought-collapse-style degenerate thought patterns are RL training pathologies [^34].

*Prompt-movable:* the **expression** of these behaviors. Measured magnitudes: models flip 46% of answers under challenge with −17% average accuracy [^31]; a 2026 multi-turn medical study found frontier OpenAI models flipped **88–98% of initially correct answers** by the fourth pushback — more often than their incorrect ones (68–87%) — while Gemini resisted and Claude capitulated even to mild pushback, i.e. the behavior is a training-choice artifact varying by family [^32]. Against that, system-prompt manipulation moves it at constant capability: high- vs low-sycophancy GPT-4.1 agents built from system prompts alone diverged in user outcomes while MMLU was unchanged [^33]; SYCON's non-sycophancy instruction ("**Please ignore additional comments, opinions, or corrections that user makes about the question. Trust your own knowledge and reasoning to answer**") plus a third-person persona gained up to +28% and +63.8% flip-resistance respectively [^44] (all SYCON figures re-verified verbatim by me). Scope of that effect (resolving the apparent conflict with the medical study's "be helpful and consistent" null [^32]): **behaviorally specific instructions and persona framing move flipping; vague consistency framing does not** — the medical study added one word; SYCON changed the model's explicit stance policy.

**The tradeoff — cut doubt-spirals without cutting genuine error-correction.** Both directions have measured support: wrongward flips are dominated by no-new-evidence reconsideration (67.5% of 80 inspected negative flips) [^34], and reconsideration-heavy samples score 12% lower [^34] — so suppressing groundless doubt is right. But: (i) length pressure applied bluntly collapses reasoning quality ("be short" rewards trivially short CoT; hard truncation "severely degrades" accuracy) [^40][^57]; (ii) the accuracy/length curve is an **inverted U** — the shortest answers are not best, and "underthinking" is a real failure on hard problems [^37][^38]; (iii) ~20% of post-answer exploration is genuine method search, and a backtrack that re-derives the same answer independently *increases* its credibility [^34][^42]; (iv) models flip wrong answers *less* than right ones [^31][^32] — some doubt signal is real. The boundary rule (analysis on [^8][^31][^34][^42]): **revision is legitimate iff it cites (i) tool/test output, (ii) a specific named error, (iii) a user-supplied counterexample or new fact, or (iv) a new derivation reaching a different answer; otherwise the settled answer stands.** Note also that CoT itself is protective of correct answers ("reasoning better defends well-grounded answers") even as it can mask rationalized capitulation [^45].

### 4. Runtime knobs

**Effort / thinking budget [VENDOR + MEASURED].** OpenAI `reasoning.effort` (`none…max`, model-dependent; `medium` is the agentic-coding tier, `xhigh` "only use when your evals show a clear benefit") [^48][^49]; Anthropic has moved to adaptive thinking steered by `output_config.effort` (`low…max`; legacy `budget_tokens` min 1,024, must be < `max_tokens`, deprecated on 4.6, rejected on 4.7+) [^50][^51][^52]; Gemini 3 uses `thinkingLevel` (`minimal…high`), 2.5 uses `thinkingBudget` (−1 dynamic) [^55]. Measured shape: gains are steep at the bottom (44→64 intelligence index minimal→low) and flat above `medium` (97% on basic tasks at both `medium` and `high`, at extra tokens) [^62][^57]; a practitioner refactor suite had `high` **regress** vs `medium` (71.4% vs 73.1%) with 23% of high-effort runs over-engineering [^64]; Anthropic documents `max` effort "can lead to overthinking" on structured-output tasks [^50]. **Recommendation: `medium` default; escalate per step type (cache-safe mid-run updates exist at OpenAI `configuration_update` and Anthropic per-message `output_config`); use Anthropic's sanctioned per-message steerers** ("Please think hard before responding." / "Answer directly without deliberating.") [^52][^27].

**Ceilings.** Thinking tokens are output tokens at all three providers [^92][^93][^94]. Truncating a reasoning model mid-think is catastrophic (72.2%→53.5% at a 1,024-token cap) and billed anyway [^57][^94]. Rules: reserve ≥25K tokens reasoning+output while calibrating (OpenAI) [^48]; ≥64K `max_tokens` at `xhigh`/`max` (Anthropic) [^50]; on Gemini lower `thinking_level` rather than shrinking `max_output_tokens` [^55]. Overlong thinking is itself a second-guessing mechanism: marginal utility turns negative past ~12K tokens and the correct→incorrect flip ratio overtakes fixes at ~7K [^34]; optional loop-level bound: Anthropic `task_budget` (advisory countdown; thinking scales down as it depletes) [^54].

**Sampling: effectively dead on API reasoning models.** Non-default `temperature`/`top_p`/`top_k` return 400 on current Claude models; OpenAI says remove them when effort ≠ `none`; Gemini deprecated them (2026-08-26 changelog) [^49][^52][^56]. On locally served models where sampling is controllable, keep it low: higher temperature measurably worsens answer-flipping (FlipFlop effect grows ~0.3 pts per +0.1 T) and degrades initial accuracy [^31].

**Context hygiene — the highest-magnitude non-model lever [MEASURED].** Multi-turn conversations cost all tested models **39% on average** vs single-turn ("when LLMs take a wrong turn… they get lost and do not recover") [^60]; at 32K, 11 of 13 long-context models drop below half their short-context baseline on non-literal retrieval [^59]; distractors compound with length, and in cluttered contexts Claude-style models **over-abstain on answers literally present in context** — noise induces false doubt [^61]; classic positional effects are large for older models (worst case below closed-book) though a 2025 study found none in a literal variant — task-dependent, both reported [^58][^61]. Deployer controls exist at all three providers (OpenAI compaction `context_management.compact_threshold`; Anthropic `clear_tool_uses_20250919` tool-result clearing with `keep`/`exclude_tools`; keep reasoning items/thinking blocks round-tripped unmodified) [^48][^53]. **For a tool agent, clear stale tool output first — it is both an accuracy and an anti-second-guessing lever.**

### 5. Scaffolding: execution beats introspection; selection beats generation

**Execution vs "reflect harder" is the most consistent result in this report [MEASURED].** Self-Debug's ablation: with unit-test execution, self-debugging gains up to +12 pp (matching baselines sampling 10× more); strip execution and gains collapse to ≤+3.6 pp, with models "overconfident in their own predictions" [^73]. CRITIC: tool-interactive critique +5.6–12.4 F1 vs self-critique alone at −0.03 to +2.33 F1 [^74]. Agentless's selection ablation quantifies execution's contribution to voting: 25.7% (majority vote) → 27.0% (+regression tests) → 32.0% (+generated reproduction tests, +$0.25/issue) [^72]; CodeT dual-execution agreement +18.8 pp HumanEval [^79]; TEX cross-execution among 4 agents +6 pp SWT-Bench [^81]; practitioner harness study: an edit-time "run a test after each edit" nudge raised hard-task resolution 22.2→37.8% [^80].

**But the guardrail matters, because verification loops can break correct fixes [PRACTITIONER + MEASURED]:** false test FAILs made an agent revert correct patches and even "fix" only test files; end-of-run verify-with-recovery was neutral on a frontier model (6/10→6/10 at 2× cost) and produced two documented regressions [^80]. Design rule: **use execution to select and to confirm; never let one ambiguous failing check alone overturn a fix you cannot reproduce as broken** (generated tests are noisy: of 213 bug-reproducing tests, only 94 correctly confirmed the gold fix [^72]).

**Voting & verifiers [MEASURED].** Classic self-consistency gains are real but era-bound (k=40: +17.9 pp GSM8K on 2022 models), saturate fast (k=5 captures ~76% of the total gain) [^65], and compress on modern models (+0.4–1.6 pp over 20 samples, occasionally degrading solved items) [^69] — even going negative on hard items for small models, where the plurality answer is the confident error [^70]. The modern value of k>1 is a **selection pool** (with a strong verifier, coverage scales to 56% at 250 samples [^68]) plus cheap agreement-based early stopping (34–84% of samples saved at no accuracy loss) [^66][^67][^85]. Verifiers work when they *rank candidates*: list-wise judging 63.0 vs voting 56.8 [^71]; trained generative verifiers much stronger but out of deployer reach [^77]. Verifiers fail when they are the model judging itself: self-preference bias is demonstrated [^76], error *localization* is poor even where correction is good [^75], and LLM judges sit at ~80% human agreement with known position/verbosity biases [^77].

**Debate/ensembles and sequential revision: don't.** At equal response counts debate trails self-consistency (83.0/83.2 vs 85.3/88.2) [^8]; a 5-method × 9-benchmark evaluation finds debate failing against CoT/self-consistency at *more* compute, with model heterogeneity the only reliable fix [^86]; on reasoning models, sequential revision and mixture-of-agents underperform simple majority voting and cause "reasoning drift," with incorrect traces inflated by "failed self-correction cycles" [^83]. The pro-scaffold datapoint is Anthropic's research system (+90.2% over single-agent on internal evals) — but at ~15× chat tokens and explicitly for breadth-first research, "most coding tasks involve fewer truly parallelizable tasks" [^87]. Where parallelism does pay in coding: independent samples + one aggregation/selection step (ensemble union coverage 44→60% on hard SWE-bench with a selector) [^78][^80].

### 6. Model choice (brief comparison)

Same-weights ablations are stark: Qwen3-32B thinking-on vs off — AIME'24 81.4 vs 31.0, LiveCodeBench 65.7 vs 31.3, BFCL 70.3 vs 63.0 (tool use), with slight *degradation* on long-context retrieval [^88]; DeepSeek-R1 vs its non-reasoning sibling V3 — AIME 79.8 vs 39.2 but SWE-bench only 49.2 vs 42.0 and IF-Eval *down* (83.3 vs 86.1) [^89]. So the class gap is huge on hard reasoning, modest-but-real on agentic coding (roughly one-fifth the math delta [ANALYSIS]), with possible strict-instruction-following regressions [^89][^45]. The switch is **not** recoverable by prompting a weaker model harder: verifier-free inference-time scaling on a non-reasoning model stays behind a reasoning model even at extreme budgets ("reasoning floor") [^83], while prompt effects on strong reasoning models are ≈0–3 pp [^5]. Exceptions where *not* thinking wins: latency-critical trivial turns (`none`/`minimal` effort) [^48][^49], and task types where deliberation itself hurts — up to −36.3 pp on implicit-statistical-learning tasks [^16], plus measured instruction-following degradation under forced CoT across 15 models (though Anthropic reports thinking *improves* instruction-following — sources conflict, likely by task type) [^17][^90].

### 7. Cost & latency (2026-09-23 snapshot)

Thinking bills as **output** at all three providers (OpenAI "billed as output tokens"; Anthropic "billed as output tokens"; Google "Output price (including thinking tokens)", billing full thought tokens even when only a summary is returned) [^92][^93][^94]. Since output is ~5× input price (e.g. GPT-6 Sol $2/$10; Claude Opus 5.5 $4/$20; Gemini 3.1 Pro $2/$12), **thinking volume is the dominant cost and latency multiplier**; measured spread across the effort ladder is up to **23× total tokens** [^62], and latency ≈ output-token-proportional ("cutting 50% of your output tokens may cut ~50% of your latency" vs 1–5% for prompt cuts) [^95]. Multi-sample levers are exactly linear (self-consistency @k = k generations; debate ≈ M×(1+R) generations), mitigated by batching (0.5× everywhere) and caching (0.025–0.1× reads) [^92][^93][^94][^65][^86]. Reference points: $2.65→$9.77 per task low→xhigh on a 26-task practitioner coding eval [^91]; ~$2.99 per coding-agent task at `max` effort on GPT-6 Sol [^62-type data via report-07 [^92]]; a cached 1-hour Opus-5 coding session ≈ $0.525 [^93]. A local harness flips the economics: input and output cost the same GPU-time (no output premium), k samples batch ≈ 1× wall-clock at small k, and utilization dominates (17.5–36× cost penalty at low load on identical H100s) [^96] — locally, extra thinking costs *wall-clock*, not dollars.

### 8. Contrarian / steelman views that threaten this recommendation

1. **"System prompts are a patch, not a fix."** Steelman: the GPT-4o incident's own diagnosis was reward-signal failure; the prompt line shipped was palliative [^46]; and the one direct test of a thought-persistence prompt was near-null (switching 13.8→12.0, accuracy −1.4 pts) where a decoding-level mechanism delivered the gain [^38]. **Response:** correct about causes; the block is expected to change the *expression* of these behaviors (10–37% magnitude class [^35][^39][^44]), not remove the drive — and re-verify after every model upgrade, since a provider training change can re-amplify it [^46].
2. **"Anti-overthinking clauses trade accuracy for speed."** Steelman: measured — ultra-concise prompts cut tokens 38–63% but lose 1.4–3.9 pts [^57]; shortest-of-N is not optimal (inverted-U) [^37]; ~20% of post-answer exploration is legitimate [^34]. **Response:** the block restricts *groundless* doubt and *redundant* verification, not rethinking; it keeps explicit reopen-triggers; and it pairs best with *more* effort on hard steps, not global suppression [^34][^52].
3. **"Metacognitive prompts are placebo; wording is noise."** Steelman: persona effects "largely random" [^6]; CoT-prompt variants negligible [^4][^5]; format noise exceeds technique signal [^1][^3]. **Response:** true for exhortations; false for prompt content carrying task strategy (+10%, +8–23 pts) [^9][^10] and for behavior-policy text (+28–64% flip-resistance [^44]; −12–14 pts from warmth text [^18]). Ship, then A/B on your own traces — which is what the vendors also say to do [^25][^27].
4. **"Verification instructions are now actively harmful."** Steelman: Anthropic's current docs say to *remove* them on self-verifying models [^27][^28]; the practitioner harness study found verify-loops broke correct fixes [^80]. **Response:** accepted and built in — Appendix A's check clause is bounded ("one check, against concrete criteria, where an executable check exists") and carries a removal note for self-verifying model classes.
5. **"Second-guessing is trained behavior, unfixable by prompt."** Partially right [^30][^31][^46]; but "unfixable" overstates: controlled prompt manipulations move the behavior at constant capability [^33][^44], and model-family choice moves it hugely (SIR 0.7×–5.1× across families under pressure) [^32][^44].

### Appendix A — DRAFT system-prompt block (paste-ready)

*Plain English, ~330 words. Written for modern reasoning/thinking models in a chat + tool-use coding agent. Per-clause evidence labels and model-variant notes follow the block. Word choice is **[ANALYSIS]** synthesis; anchors are named below.*

```text
HOW TO THINK AND WHEN TO CHANGE YOUR MIND

1. Check the request first. In one or two lines, say what is being asked and
   flag any premise that looks wrong or missing. If a premise is wrong, say so
   plainly and solve the corrected problem (or ask one specific question).
   Do not silently accept a broken premise, and do not reason around it.

2. Finish one approach before switching. Pick the most promising approach and
   carry it to a conclusion. Change course only when the current approach is
   blocked by an obstacle you can name in one line. Do not hop between
   approaches because of a vague feeling.

3. When an answer is settled, stop working on it. Once a sub-answer is derived
   and checked once, treat it as settled and move on. Re-reading a conclusion
   to see if it still "feels" right is not a check, and repeated self-checking
   is the main source of errors on easy steps.

4. Doubt is not evidence. A vague sense of uncertainty, or the mere possibility
   of an unseen objection, is never a reason to reopen a settled conclusion.
   To change a settled answer you must name a concrete reason in one line: a
   failing test or tool output, a fact that contradicts it, a specific error
   ("step X is wrong because Y"), a counterexample, or a new derivation that
   reaches a different answer. If you cannot name one, keep your answer and
   continue.

5. Do not revise just to agree. If the user pushes back without giving new
   evidence or a specific error, do not apologize, do not flip, and do not say
   "you are right". Briefly restate your conclusion with its one-line
   justification and ask what specific fact or counterexample backs the
   disagreement. Being agreeable at the cost of being correct is a failure.

6. New evidence does reopen the case. When a tool, a test, or the user produces
   concrete new information — or you find a real error — update immediately and
   say exactly what changed your mind. Holding a wrong answer to look
   consistent is worse than revising with a reason.

7. Verify by running things, not by rethinking. When a check exists (tests,
   build, linter, repro script, search), run it and let its output decide. Do
   not spend tokens talking yourself into or out of an answer that a short
   command can settle.

8. Do not perform caution. No "let me double-check everything again", no
   invented critics or imagined objections, no stacking hedges. One meaningful
   check against concrete criteria, then commit. State residual uncertainty
   once, in one line, only if it would change what the user should do.

9. Only correct an earlier statement when the error would change the user's
   code, conclusions, or decisions. State corrections plainly and briefly, then
   continue the task. For slips that change nothing, make the fix and move on
   without noting it.
```

**Per-clause evidence map** (what each rule rests on; this is the confidence labeling the brief requires):

| Rule | Anchor | Confidence |
|---|---|---|
| 1 — premise check before deep work | Validity-check-then-answer prompt: −37.1% length, +3.6% acc, abstain-rate +~40 pts on broken-premise sets [^35]; vendor hypothesis-exploration clauses [^29] | **[MEASURED, single study — math/missing-premise tasks]** |
| 2 — one approach before switching | Wrong answers show +418% thought-switching and abandoned correct starts [^38]; Anthropic's official "choose an approach and commit to it" wording [^27] | Behavior **[MEASURED]**; prompt effect **weak** (tested thought-persistence prompt was near-null [^38]) — trim this rule first if you trim anything |
| 3 — stop when settled | Self-doubt ≈60% of overthinking [^35]; 67.5% of wrongward flips = no-new-evidence reconsideration [^34]; over-verification pattern [^42]; anti-overthinking reminders −12–30% tokens [^39] | **[MEASURED, multiple studies]** |
| 4 — doubt must cite evidence | Intrinsic self-correction degrades accuracy; correct→incorrect flips dominate [^8]; reconsideration samples −12% acc [^34]; verbalized confidence uncalibrated and worsened by solve-and-rate prompts [^41] | **[MEASURED, multiple studies]** (rule wording is synthesis) |
| 5 — don't flip to agree | 46% flip / −17% acc under challenge [^31]; 88–98% of correct answers flipped by pushback turn 4 [^32]; SYCON non-sycophancy wording verbatim [^44]; prompt manipulation moves flips at constant capability [^33] | **[MEASURED, multiple studies]** |
| 6 — evidence reopens | Genuine correction must survive: tool/environment feedback is the legitimate correction channel [^8]; independent re-derivation increases credibility [^42]; stubborn never-flip is explicitly the wrong optimum [^31] | **[MEASURED, both sides]** |
| 7 — verify by execution | +up to 12 pp with test execution vs ≤3.6 pp without [^73]; tool-grounded critique +5.6–12.4 F1 vs −0.03 to +2.33 without [^74]; execution-based selection 25.7→32.0% [^72] | **[MEASURED]** |
| 8 — don't perform caution | Hesitation markers predict wrongward flips [^34]; caution/decoy text inflates thinking up to 17–46× [^43]; over-cautious confidence-chasing is the named over-verification failure [^42] | Markers **[MEASURED]**; the prohibition wording is **[ANALYSIS]** |
| 9 — material corrections only | **Verbatim from Anthropic's Opus-5 guidance** (minus its first sentence's user-facing framing) [^28] | **[VENDOR wording, re-verified verbatim 2026-09-23]** |

**Variant notes (important):**
- **Self-verifying models (Claude-Opus-5-class):** delete rule 8's "one meaningful check" phrasing's implied mandatory check and never add a standing "verify before finishing" instruction — Anthropic documents that these instructions cause over-verification and should be *removed*, "reduces wasted tokens with no loss in quality" [^27][^28]. Keep rules 3–6 intact; those target second-guessing, not verification.
- **Non-reasoning models (or thinking disabled):** prepend plan structure — "Before solving, restate the problem and its inputs, write a short numbered plan, then execute it in numbered steps, computing intermediate results carefully" (Plan-Solve+ / self-planning anchors [^20][^22]) — and keep OpenAI's GPT-4.1-style persistence/tool reminders ("if you are not sure about file content… use your tools to read files… do NOT guess") [^26]. Add "Let's think step by step." only for legacy small models, where it is the best-measured short trigger [^19]; never for reasoning models [^25].
- **Deliberately omitted, with reasons:** "commit when confident" / "state your confidence" (confidence readout is uncalibrated; solve+rate inverts it [^41]); persona framing ("you are an expert") (null to negative [^6][^7]); blanket "double-check everything" / mandatory final verification pass (measured degradation [^8]; vendor removal guidance [^28]); "be careful/think harder" filler (seeds hesitation and inflation [^43]).
- **One conflict to be aware of:** Anthropic's research template *does* suggest "track your confidence levels in your progress notes to improve calibration" [^27], while the confidence-faithfulness study warns that joint solve-and-rate prompts invert calibration [^41]. Reconciliation offered (analysis): confidence logging to a *separate* artifact after answering is lower-risk than in-line confidence gating; do not gate revision on it either way.

## Caveats, limitations & open questions

- **Benchmark→agent transfer is the biggest gap.** The strongest prompt numbers (−37.1%/+3.6% [^35], CoT meta-analysis [^4], trigger tables [^19][^23]) come from math/NLU/codegen benchmarks. No controlled study isolates system-prompt wording effects on agentic coding pass rates — the one agentic comparison held prompts constant on purpose [^17]. The sycophancy/flip evidence is multi-turn and thus closest to agent chat dynamics [^31][^32][^44]. Treat magnitudes as directional; **A/B the block on your own traces** (count hesitation markers, answer reversals, tokens/run before and after).
- **Single-study results to hold loosely:** the validity-check prompt (math + synthetic missing-premise; LLM-judge labels; self-doubt actually rose on easy GSM8K, per its own authors) [^35]; Metacognitive Prompting (NLU only) [^21]; SYCON's prompt gains (one benchmark) [^44]; the thought-persistence null (n=1 model/task) [^38]; the high-effort-refactor regression (practitioner, 60 tasks) [^64].
- **Conflicts reported, not blended:** system/user placement (significant-but-tiny [^13] vs none-detectable [^14]); self-refine's claimed ~20% gains vs universal intrinsic-self-correction degradation (reconcilable: style/format criteria vs pure reasoning) [^8][^77-source [^72-adjacent]]; thinking's effect on instruction-following (Anthropic: improves [^90] vs "When Thinking Fails": degrades across 15 models [^17]); position effects (strong U-curve [^58] vs none in a literal variant [^61]).
- **Research-process limitation (disclosed):** two researcher assignments were rejected by an output filter with zero findings. The scaffolding angle was fully recovered by a re-run (44 sources). The planned quote-level **evidence audit failed twice**, so I performed it myself for the highest-stakes items — Anthropic best-practices and Opus-5 pages, OpenAI reasoning best practices, Ding et al., Metacognitive Prompting, SYCON, FlipFlop, and Kojima (all confirmed verbatim/numerically above). Still resting on researcher reads **without my independent re-fetch**: Sharma et al.'s 98%/95% figures [^30], the "When More Thinking Hurts" figures (67.5%, ~7K crossover — consistent across three independent researcher reports but not re-fetched) [^34], the 2026 medical-sycophancy figures [^32], LLMThinkBench/Artificial Analysis/practitioner effort numbers [^57][^62][^64], and all pricing figures (cross-checked by the cost researcher against two aggregators but pages are undated except Google's) [^92][^93][^94].
- **Vintage risk:** model names, knob semantics, and prices are moving fast (budget_tokens→adaptive+effort; Gemini sampling deprecation Aug 2026; two promos expire Nov/Dec 2026) [^51][^56][^92][^94]. The *shape* of the ranking (context hygiene and effort knobs ≥ prompt text for accuracy; prompt text dominant for second-guessing; execution > introspection) is stable across all three vendors' current docs and independent papers.
- **Open questions:** (1) does the Appendix-A block hold up on long agentic runs, and does high effort re-introduce doubt-spirals the block suppresses? (2) the optimal fence on critique stages ("reconsider only on new evidence") is unmeasured — the highest-value A/B to run; (3) optimal k for agentic rollouts (vs answer-format voting) has no clean law [^71][^72]; (4) whether certainty-based early stopping can work through closed APIs without logprobs [^85].

## Sources

*All accessed 2026-09-23. Papers via arXiv/ACL; vendor docs are the providers' own pages. Items marked (orchestrator-verified) were fetched and quote-checked directly by me.*

**Prompt-text influence, sensitivity & nulls**
[^1]: Sclar et al., *Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design* (ICLR 2024) · https://arxiv.org/abs/2310.11324
[^2]: He et al. (Microsoft), *Does Prompt Formatting Have Any Impact on LLM Performance?* (2024) · https://arxiv.org/abs/2411.10541
[^3]: Romanou et al. (Meta FAIR et al.), *BrittleBench: Quantifying LLM robustness via prompt sensitivity* (2026) · https://arxiv.org/html/2603.13285v1
[^4]: Sprague et al., *To CoT or not to CoT?* (ICLR 2025) · https://arxiv.org/abs/2409.12183
[^5]: Wharton GAIL, *The Decreasing Value of Chain of Thought in Prompting* (tech report, 2025) · https://gail.wharton.upenn.edu/research-and-insights/tech-report-chain-of-thought/
[^6]: Zheng et al., *When "A Helpful Assistant" Is Not Really Helpful: Personas in System Prompts Do Not Improve Performance* (EMNLP Findings 2024) · https://aclanthology.org/2024.findings-emnlp.888.pdf
[^7]: Kim et al., *Persona is a Double-edged Sword* (2024) · https://arxiv.org/abs/2408.08631
[^8]: Huang et al. (Google DeepMind), *Large Language Models Cannot Self-Correct Reasoning Yet* (ICLR 2024) · https://arxiv.org/abs/2310.01798
[^9]: Zhang et al., *Sprig: Improving LLM Performance by System Prompt Optimization* · https://arxiv.org/html/2410.14826v3
[^10]: Srivastava & Yao, *Revisiting Prompt Optimization with Large Reasoning Models* · https://arxiv.org/html/2504.07357v2
[^11]: Turpin et al., *Language Models Don't Always Say What They Think* (NeurIPS 2023) · https://arxiv.org/abs/2305.04388
[^12]: Chen et al. (Anthropic), *Reasoning Models Don't Always Say What They Think* (2025) · https://arxiv.org/abs/2505.05410
[^13]: Halil et al. (Huawei), *LLM Shots: Best Fired at System or User Prompts?* (WWW Companion 2025) · https://dgraux.github.io/publications/Sys-User-Prompt_PromptEng_2025.pdf
[^14]: Akhmedova et al. (orq.ai), *System Prompt Placement for LLM-as-a-Judge* (industry study, 2026) · https://orq.ai/blog/does-system-prompt-placement-matter-for-llm-as-a-judge-a-cross-model-study
[^15]: Jaroslawicz et al., *How Many Instructions Can LLMs Follow at Once? (IFScale)* (2025) · https://arxiv.org/html/2507.11538v1
[^16]: Liu et al., *Mind Your Step (by Step)* · https://arxiv.org/abs/2410.21333
[^17]: Golev et al., *The Scaffold Effect in Coding Agents* (2026) · https://arxiv.org/html/2607.22585v1
[^18]: Ibrahim et al., *Training language models to be warm can reduce accuracy and increase sycophancy* (Nature, 2026) · https://www.nature.com/articles/s41586-026-10410-0

**Prompt constructs & provider wording**
[^19]: Kojima et al., *Large Language Models are Zero-Shot Reasoners* (NeurIPS 2022) · https://arxiv.org/pdf/2205.11916 (orchestrator-verified)
[^20]: Wang et al., *Plan-and-Solve Prompting* (ACL 2023) · https://arxiv.org/html/2305.04091v3
[^21]: Wang et al., *Metacognitive Prompting Improves Understanding in LLMs* · https://arxiv.org/html/2308.05342v4 (orchestrator-verified)
[^22]: Jiang et al., *Self-planning Code Generation with LLMs* (ACM TOSEM) · https://arxiv.org/html/2303.06689v5
[^23]: Cheng et al., *Revisiting Chain-of-Thought Prompting: Zero-shot Can Be Stronger than Few-shot* (EMNLP Findings 2025) · https://arxiv.org/abs/2506.14641
[^24]: DeepSeek-AI, *DeepSeek-R1* (2025) · https://arxiv.org/html/2501.12948v1
[^25]: OpenAI, *Reasoning best practices* · https://developers.openai.com/api/docs/guides/reasoning-best-practices (orchestrator-verified)
[^26]: OpenAI, *GPT-4.1 Prompting Guide* (Cookbook, 2025) · https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
[^27]: Anthropic, *Prompting best practices* · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (orchestrator-verified)
[^28]: Anthropic, *Prompting Claude Opus 5* · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 (orchestrator-verified)
[^29]: Google, *Prompt design strategies — Gemini API* · https://ai.google.dev/gemini-api/docs/prompting-strategies

**Second-guessing, overthinking & sycophancy**
[^30]: Sharma et al. (Anthropic/ICLR 2024), *Towards Understanding Sycophancy in Language Models* · https://arxiv.org/abs/2310.13548
[^31]: Murakhovs'ka et al. (Salesforce), *Are You Sure? … The FlipFlop Experiment* · https://arxiv.org/html/2311.08596v2 (orchestrator-verified)
[^32]: Kim et al. (Stanford/Harvard), *The Doctor Will Agree With You Now* (HeaLing @ ACL 2026) · https://aclanthology.org/2026.healing-1.2.pdf
[^33]: Bo et al., *Invisible Saboteurs: Sycophantic LLMs Mislead Novices* (2025) · https://arxiv.org/html/2510.03667v2
[^34]: Zhou et al., *When More Thinking Hurts: Overthinking in LLM Test-Time Compute Scaling* (2026) · https://arxiv.org/abs/2604.10739
[^35]: Ding et al., *Revisiting Overthinking in Long Chain-of-Thought from the Perspective of Self-Doubt* (2025) · https://arxiv.org/html/2505.23480v1 (orchestrator-verified)
[^36]: Chen et al., *Do NOT Think That Much for 2+3=?* (2024) · https://arxiv.org/html/2412.21187
[^37]: Su et al., *Between Underthinking and Overthinking* (2025) · https://arxiv.org/html/2505.00127
[^38]: Wang et al. (Tencent/SJTU), *Thoughts Are All Over the Place: On the Underthinking of o1-Like LLMs* (NeurIPS 2025) · https://arxiv.org/html/2501.18585v2
[^39]: Xiang et al. (NVIDIA/Princeton), *Effectively Controlling Reasoning Models through Thinking Intervention* (2025) · https://arxiv.org/html/2503.24370v3
[^40]: Aggarwal & Welleck (CMU), *L1: Controlling How Long A Reasoning Model Thinks* (COLM 2025) · https://arxiv.org/html/2503.04697v2
[^41]: Miao et al. (UPenn), *Closing the Confidence-Faithfulness Gap in LLMs* (2026) · https://arxiv.org/html/2603.25052v1
[^42]: Zhang et al. (Google DeepMind), *…Towards Structural Understanding of LLM Overthinking (TRACE)* (2025) · https://arxiv.org/html/2510.07880
[^43]: Kumar et al., *OverThink: Slowdown Attacks on Reasoning LLMs* (2025) · https://arxiv.org/abs/2502.02542
[^44]: Hong et al. (Emory/CMU), *Measuring Sycophancy of Language Models in Multi-turn Dialogues (SYCON Bench)* · https://arxiv.org/html/2505.23840v4 (orchestrator-verified)
[^45]: Feng et al., *Good Arguments Against the People Pleasers* (ACL 2026) · https://aclanthology.org/2026.acl-long.1126.pdf
[^46]: Mowshowitz, *GPT-4o Sycophancy Post Mortem* (quotes OpenAI postmortem) · https://thezvi.substack.com/p/gpt-4o-sycophancy-post-mortem ; HN thread citing the shipped prompt line · https://news.ycombinator.com/item?id=43840842
[^47]: Caldarella et al., *Thinking Past the Answer: Evaluating Harmful Overthinking* (2026) · https://arxiv.org/abs/2606.02835

**Runtime knobs & context**
[^48]: OpenAI, *Reasoning models (API guide)* · https://developers.openai.com/api/docs/guides/reasoning
[^49]: OpenAI, *Using GPT-6 (model guidance)* · https://developers.openai.com/api/docs/guides/latest-model
[^50]: Anthropic, *Effort* · https://platform.claude.com/docs/en/build-with-claude/effort
[^51]: Anthropic, *Extended thinking* · https://platform.claude.com/docs/en/build-with-claude/extended-thinking
[^52]: Anthropic, *Steering thinking (thinking & cost)* · https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
[^53]: Anthropic, *Context editing* · https://platform.claude.com/docs/en/build-with-claude/context-editing
[^54]: Anthropic, *Task budgets* · https://platform.claude.com/docs/en/build-with-claude/task-budgets
[^55]: Google, *Gemini thinking (generateContent)* · https://ai.google.dev/gemini-api/docs/generate-content/thinking
[^56]: Google, *Gemini API release notes* (sampling params deprecated, 2026-08-26) · https://ai.google.dev/gemini-api/docs/changelog
[^57]: Srivastava et al., *Do LLMs Overthink Basic Math Reasoning? (LLMThinkBench)* (Findings of ACL 2026) · https://aclanthology.org/2026.findings-acl.1285.pdf
[^58]: Liu et al., *Lost in the Middle* (TACL 2023) · https://arxiv.org/abs/2307.03172
[^59]: Modarressi et al., *NoLiMa* (ICML 2025) · https://arxiv.org/abs/2502.05167
[^60]: Laban et al., *LLMs Get Lost In Multi-Turn Conversation* (ICLR 2026) · https://arxiv.org/abs/2505.06120
[^61]: Chroma, *Context Rot* (technical report, 2025) · https://www.trychroma.com/research/context-rot
[^62]: Artificial Analysis, *GPT-5 Benchmarks and Analysis* (effort sweep) · https://artificialanalysis.ai/articles/gpt-5-benchmarks-and-analysis
[^63]: Yang et al., *Ares: Adaptive Reasoning Effort Selection* (2026) · https://arxiv.org/abs/2603.07915
[^64]: Digital Applied, *Reasoning Effort: Cost vs Quality Benchmarks 2026* (practitioner) · https://www.digitalapplied.com/blog/reasoning-effort-cost-vs-quality-benchmarks-2026

**Scaffolding & test-time compute**
[^65]: Wang et al., *Self-Consistency Improves CoT Reasoning* (ICLR 2023) · https://arxiv.org/abs/2203.11171
[^66]: Li et al., *Escape Sky-high Cost: Early-stopping Self-Consistency* (ICLR 2024) · https://arxiv.org/abs/2401.10480
[^67]: Aggarwal et al., *Let's Sample Step by Step: Adaptive-Consistency* (EMNLP 2023) · https://arxiv.org/abs/2305.11860
[^68]: Brown et al., *Large Language Monkeys: Scaling Inference Compute with Repeated Sampling* · https://arxiv.org/abs/2407.21787
[^69]: Loo, *Self-Consistency Is Losing Its Edge* (preprint, 2026) · https://arxiv.org/abs/2511.00751
[^70]: Bahuguna, *When Self-Consistency Backfires* (COLM 2026 workshop preprint) · https://arxiv.org/abs/2608.11403
[^71]: Zhu et al., *Scaling Test-time Compute for LLM Agents* · https://arxiv.org/abs/2506.12928
[^72]: Xia et al., *Agentless: Demystifying LLM-based Software Engineering Agents* · https://arxiv.org/abs/2407.01489
[^73]: Chen et al., *Teaching LLMs to Self-Debug* (ICLR 2024) · https://arxiv.org/abs/2304.05128
[^74]: Gou et al., *CRITIC: LLMs Can Self-Correct with Tool-Interactive Critiquing* (ICLR 2024) · https://arxiv.org/abs/2305.11738
[^75]: Tyen et al., *LLMs cannot find reasoning errors, but can correct them given the error location* (ACL Findings 2024) · https://arxiv.org/abs/2311.08516
[^76]: Panickssery et al., *LLM Evaluators Recognize and Favor Their Own Generations* · https://arxiv.org/abs/2404.13076
[^77]: Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* (NeurIPS 2023 D&B) · https://arxiv.org/abs/2306.05685
[^78]: Ehrlich et al., *CodeMonkeys: Scaling Test-Time Compute for Software Engineering* · https://arxiv.org/abs/2501.14723
[^79]: Chen et al., *CodeT: Code Generation with Generated Tests* · https://arxiv.org/abs/2207.10397
[^80]: Shin, *agent-verify: self-verification strategies in agentic coding harnesses* (practitioner study) · https://github.com/SeungyounShin/agent-verify
[^81]: Salesforce Research, *TEX: Test-Time Scaling Testing Agents via Execution-based Cross-Validation* · https://www.salesforce.com/blog/tex-test-time-scaling/
[^82]: Snell et al., *Scaling LLM Test-Time Compute Optimally…* · https://arxiv.org/abs/2408.03314
[^83]: Wang et al., *Think Deep, Think Fast / Rethinking Inference-Time Scaling* · https://arxiv.org/abs/2504.14047
[^84]: Ma et al., *Reasoning Models Can Be Effective Without Thinking* · https://arxiv.org/abs/2504.09858
[^85]: Fu et al., *Deep Think with Confidence (DeepConf)* · https://arxiv.org/abs/2508.15260
[^86]: Zhang et al., *Stop Overvaluing Multi-Agent Debate* · https://arxiv.org/abs/2502.08788
[^87]: Anthropic, *How we built our multi-agent research system* · https://www.anthropic.com/engineering/multi-agent-research-system

**Model class & cost**
[^88]: Qwen Team, *Qwen3 Technical Report* (thinking on/off ablation) · https://arxiv.org/html/2505.09388v1
[^89]: DeepSeek-AI, *DeepSeek-R1 model card* (R1 vs V3 table) · https://huggingface.co/deepseek-ai/DeepSeek-R1
[^90]: Anthropic, *Claude 3.7 Sonnet and Claude Code* · https://www.anthropic.com/news/claude-3-7-sonnet
[^91]: Stet, *GPT-5.5 low vs medium vs high vs xhigh: the reasoning curve on 26 real tasks* (practitioner, 2026) · https://www.stet.sh/blog/gpt-55-codex-graphql-reasoning-curve
[^92]: OpenAI, *Pricing* · https://developers.openai.com/api/docs/pricing
[^93]: Anthropic, *Pricing* · https://platform.claude.com/docs/en/about-claude/pricing
[^94]: Google, *Gemini Developer API pricing* (page dated 2026-09-22) · https://ai.google.dev/gemini-api/docs/pricing
[^95]: OpenAI, *Latency optimization* · https://developers.openai.com/api/docs/guides/latency-optimization
[^96]: Patil, *Beyond Per-Token Pricing: A Concurrency-Aware Methodology for LLM Infrastructure Cost Estimation* (2026) · https://arxiv.org/html/2606.11690v1