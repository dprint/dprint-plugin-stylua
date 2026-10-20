/**
 * Reconciles this plugin with a new StyLua release using OpenAI Codex, in two
 * stages that each run Codex in a session of its own:
 *
 *   1. a Codex agentic session edits the source and runs the checks until they
 *      pass (fixing breakage and/or wiring up new formatter options), then
 *   2. a SEPARATE reviewer session reviews the result with Codex, so it can
 *      investigate (read the upstream StyLua source, grep the repo). It is
 *      instructed to review only and not modify anything. If it finds blocking
 *      issues they are fed back to the stage-1 Codex for another pass, bounded
 *      by `REVIEW_MAX_ROUNDS`. If it still isn't approved, this throws so the
 *      workflow fails and nothing is published.
 *
 * Two situations call this:
 *   - a patch bump that failed the checks (fix the breakage), and
 *   - any minor bump (review for new/renamed/removed options even when it
 *     still compiles).
 *
 * Both stages use the default model of the Codex CLI, which is installed at
 * its latest version when it is missing, so they move to a new model when
 * Codex does. Set `CODEX_MODEL` or `REVIEW_MODEL` to pin the model of a stage.
 *
 * Codex must NOT commit or push -- `update.ts` captures the working tree
 * changes into the existing StyLua bump commit afterwards.
 */
import { $ } from "automation";

export interface AiFixOptions {
  /** true for a patch bump, false for a minor/major bump. */
  isPatchBump: boolean;
  /** StyLua version currently in Cargo.toml (before the bump). */
  fromVersion: string;
  /** StyLua version being upgraded to. */
  toVersion: string;
  /** Whether the checks (test + clippy + wasm build) already passed. */
  checksPassed: boolean;
  /** Combined output of the failing checks (empty when `checksPassed`). */
  checkOutput: string;
}

/** Max number of times the reviewer may send changes back to Codex. */
const REVIEW_MAX_ROUNDS = 2;

export async function aiFixStyLuaUpdate(options: AiFixOptions): Promise<void> {
  const apiKey = requireApiKey();
  await ensureCodexInstalled();
  await codexLogin(apiKey);

  // stage 1: let Codex reconcile the update.
  await runCodex(buildFixPrompt(options));

  // stage 2: independent second-model review, with a bounded refix loop.
  for (let round = 1;; round++) {
    const review = await reviewChanges(options);
    logReview(review);
    if (review.approved) {
      return;
    }
    if (round > REVIEW_MAX_ROUNDS) {
      const blocking = review.issues.filter((i) => i.severity === "blocking");
      throw new Error(
        `AI reviewer did not approve after ${REVIEW_MAX_ROUNDS} refix round(s). Blocking issues:\n`
          + blocking.map((i) => `  - ${i.description}`).join("\n"),
      );
    }
    $.logStep(`Reviewer requested changes — Codex refix round ${round}...`);
    await runCodex(buildRefixPrompt(review));
  }
}

// stage 1: Codex ---------------------------------------------------------------

async function runCodex(prompt: string): Promise<void> {
  const args = ["exec", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"];
  const model = Deno.env.get("CODEX_MODEL");
  if (model) {
    args.push("--model", model);
  }
  args.push(prompt);

  $.logStep("Running Codex...");
  await $`codex ${args}`;
}

function buildFixPrompt(options: AiFixOptions): string {
  const { isPatchBump, fromVersion, toVersion, checksPassed, checkOutput } = options;

  const situation = checksPassed
    ? `StyLua (the \`stylua\` crate) was upgraded from ${fromVersion} to ${toVersion} (a ${
      isPatchBump ? "patch" : "minor"
    } bump). The project already compiles and the checks pass, but a new StyLua version may have ADDED, RENAMED, or REMOVED formatter options or Lua syntax versions that should be surfaced by this plugin.`
    : `StyLua (the \`stylua\` crate) was upgraded from ${fromVersion} to ${toVersion} and the checks fail (the project no longer builds, or \`cargo test\` or \`cargo clippy\` fails, or a spec test's output changed). This is usually because StyLua's API (its \`Config\` struct, one of its option enums, \`LuaVersion\`, or \`format_code\`) changed, or because it now formats some code differently.`;

  const failureOutput = checkOutput.trim().length > 0
    ? [
      ``,
      `The checks currently fail with the output below. Use it as your starting point instead of re-running the checks just to rediscover the errors:`,
      "```",
      truncateHead(checkOutput.trim()),
      "```",
    ]
    : [];

  return [
    `You are updating the "dprint-plugin-stylua" Rust crate, a dprint plugin that wraps the \`stylua\` crate (StyLua, imported as \`stylua_lib\`) to format Lua and Luau files (\`.lua\`, \`.luau\`).`,
    ``,
    situation,
    ...failureOutput,
    ``,
    `Your goal: make the checks pass AND keep this plugin's configuration surface in sync with StyLua's \`Config\`. Do NOT commit or push; only edit files in the working tree.`,
    ``,
    describeWiring(),
    ``,
    `To see exactly what changed in StyLua, inspect the actual dependency source that cargo already downloaded, e.g.:`,
    `  find ~/.cargo/registry/src -maxdepth 2 -type d -name 'stylua-*'`,
    `then read its \`src/lib.rs\` (the \`Config\` struct, \`Config::default()\`, the option enums and \`LuaVersion\`) and its \`Cargo.toml\` \`[features]\` (each Lua syntax is behind a feature), and diff them against the directory of the previous version if it is there too. Compare that against \`build_config\` in \`src/format_text.rs\` and the \`stylua\` features in this plugin's Cargo.toml.`,
    ``,
    `Rules:`,
    `1. If a field or enum variant was RENAMED or REMOVED in StyLua, update the mapping in \`src/format_text.rs\` (and remove/rename the corresponding plugin config in the other files if it no longer exists upstream).`,
    `2. If a field was ADDED to StyLua's \`Config\`, or a variant to one of its option enums, expose it across ALL of: \`configuration.rs\`, \`resolve_config.rs\`, \`format_text.rs\`, and \`deployment/schema.json\`, AND add or extend a spec test under \`tests/specs/\` that exercises it. Use the default of StyLua's \`Config::default()\` and match the existing naming conventions (Rust snake_case fields, camelCase dprint keys and values).`,
    `3. If StyLua added a Lua syntax version (a new \`LuaVersion\` variant behind a new Cargo feature), enable that feature on the \`stylua\` dependency in Cargo.toml and add it to the \`syntax\` option in all of the files above.`,
    `4. These options are this plugin's mapping of dprint's standard options and have no StyLua counterpart with the same name, so do NOT remove or rename them because they are missing upstream: \`lineWidth\` (StyLua's \`column_width\`), \`useTabs\` (\`indent_type\`), \`newLineKind\` (\`line_endings\`), and \`sortRequires\` (\`sort_requires.enabled\`).`,
    `5. If a spec test fails only because StyLua intentionally formats some code differently now, update that spec's expected output and explain what changed in your final message. Never change an expected output to hide a bug in this plugin.`,
    `6. Do NOT edit \`README.md\`. Its config documentation is maintained separately, so leave it untouched.`,
    `7. Preserve the existing code style. Keep non-test code above test modules. New comments start lowercase unless multiple sentences.`,
    `8. When done, ALL of these must pass (CI denies clippy warnings, and the wasm build is what actually ships) — iterate until they are all clean:`,
    `     cargo test`,
    `     cargo clippy --all-targets --all-features -- -D warnings`,
    `     cargo build --target wasm32-unknown-unknown --features wasm --release`,
    `9. Do not change the plugin's own version in Cargo.toml, do not run git commit, and do not push.`,
    ``,
    `Spec test format: each file in \`tests/specs/\` has an optional \`~~ optionKey: value ~~\` config header line, then \`== short description ==\`, the input code, a line containing \`[expect]\`, and the expected formatted output. Add or update specs for options you add or rename (follow the existing files as examples and the \`Config<Name>.txt\` naming), delete the spec for any removed option, and run \`cargo test\` to confirm they pass.`,
  ].join("\n");
}

function buildRefixPrompt(review: ReviewResult): string {
  return [
    `An independent reviewer examined your changes to dprint-plugin-stylua and found issues that must be fixed. Address every blocking issue below, keeping \`cargo test\` green. Do not commit or push.`,
    ``,
    `Reviewer summary: ${review.summary}`,
    ``,
    `Issues:`,
    ...review.issues.map((i) => `  - [${i.severity}] ${i.description}`),
    ``,
    describeWiring(),
  ].join("\n");
}

function describeWiring(): string {
  return [
    `How the plugin is wired (keep all of these consistent with each other):`,
    `- \`src/format_text.rs\` -> \`format_text\` and \`format_text_range\` call StyLua's \`format_code\`, and \`build_config\` maps this plugin's \`Configuration\` onto StyLua's \`Config\`, one \`match\` per option enum.`,
    `- \`Cargo.toml\` -> the \`stylua\` dependency uses \`default-features = false\` (its default features pull in the LSP, editorconfig and wasm-bindgen, which must not end up in the Wasm plugin) and enables one feature per Lua syntax.`,
    `- \`src/configuration/configuration.rs\` -> the plugin's own \`Configuration\` struct and its option enums.`,
    `- \`src/configuration/resolve_config.rs\` -> reads each dprint config key (camelCase) into \`Configuration\`.`,
    `- \`deployment/schema.json\` -> the JSON schema of config options shown to users. \`tests/test.rs\` checks that its defaults match the resolved default configuration.`,
    `- \`tests/specs/*.txt\` -> spec tests (run by \`dprint_development::run_specs\` via \`tests/test.rs\`) that exercise each config option.`,
  ].join("\n");
}

// keep the tail of long check output -- the errors and the "could not compile"
// summary are at the end, which is the most useful part for the AI.
function truncateHead(text: string, max = 20_000): string {
  return text.length > max ? `... (truncated)\n${text.slice(text.length - max)}` : text;
}

// stage 2: independent reviewer ------------------------------------------------

interface ReviewResult {
  approved: boolean;
  summary: string;
  issues: ReviewIssue[];
}

interface ReviewIssue {
  severity: "blocking" | "nit";
  description: string;
}

// The reviewer runs Codex too so it can actually investigate (read the StyLua
// source cargo downloaded, grep the repo, verify option names against the real
// upstream API). Its verdict is captured as JSON via --output-last-message.
//
// NOTE: we deliberately do NOT use `--sandbox read-only` here. That makes Codex
// wrap commands in bubblewrap, which cannot set up its network namespace on the
// GitHub Actions runner ("bwrap: loopback: Failed RTM_NEWADDR: Operation not
// permitted"), so every command the reviewer runs fails before executing. We
// use the same no-sandbox mode as the fixer and enforce read-only via the
// prompt instead. (CI is itself a throwaway VM, and the final check gate in
// update.ts re-verifies whatever ends up in the working tree.)
async function reviewChanges(options: AiFixOptions): Promise<ReviewResult> {
  // the reviewer starts without the context of the fixer, which is what makes
  // it a second opinion. It uses the default model of Codex unless one is set.
  const model = Deno.env.get("REVIEW_MODEL");

  // record intent-to-add so any files Codex created also show in `git diff`.
  await $`git add -N .`.quiet();

  const outputFile = await Deno.makeTempFile({ prefix: "codex-review-", suffix: ".json" });
  try {
    $.logStep(`Reviewing changes with Codex (${model ?? "default model"})...`);
    const args = ["exec", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox"];
    if (model) {
      args.push("--model", model);
    }
    args.push("--output-last-message", outputFile, buildReviewPrompt(options));
    await $`codex ${args}`;
    return parseReview(await Deno.readTextFile(outputFile));
  } finally {
    await Deno.remove(outputFile).catch(() => {});
  }
}

function buildReviewPrompt(options: AiFixOptions): string {
  return [
    `You are an independent reviewer for dprint-plugin-stylua, a dprint plugin that wraps the stylua crate (StyLua) to format Lua and Luau files. StyLua was just upgraded from ${options.fromVersion} to ${options.toVersion} and another AI edited this plugin to reconcile it. Review the UNCOMMITTED working-tree changes.`,
    `IMPORTANT: this is REVIEW ONLY. Read any files and run read-only commands (git diff, cat, grep, find, etc.) to investigate, but you MUST NOT edit, create, or delete any files, and MUST NOT run git commit or git push. Leave the working tree exactly as you found it.`,
    ``,
    `Investigate as needed:`,
    `- Run \`git --no-pager diff\` (and \`git status\`) to see exactly what changed, including any new files.`,
    `- Verify against the REAL StyLua ${options.toVersion} API by reading the source cargo downloaded:`,
    `    find ~/.cargo/registry/src -maxdepth 2 -type d -name 'stylua-*'`,
    `  then read its \`src/lib.rs\` (the \`Config\` struct, \`Config::default()\`, the option enums and \`LuaVersion\`) and its \`Cargo.toml\` \`[features]\`.`,
    `- Read the plugin files to confirm they are consistent with each other and with upstream.`,
    ``,
    describeWiring(),
    ``,
    `Verify specifically:`,
    `- Every field and enum variant used in \`build_config\` still exists in StyLua with that exact name (catch removed/renamed ones).`,
    `- Any \`Config\` field or option enum variant newly added upstream is exposed through ALL layers: configuration.rs, resolve_config.rs, format_text.rs, and deployment/schema.json. A partial addition is a blocking issue.`,
    `- Any new Lua syntax version has its Cargo feature enabled on the \`stylua\` dependency and is part of the \`syntax\` option, and \`default-features = false\` is still set.`,
    `- Every config option added or renamed in this change has a spec test under \`tests/specs/\` exercising it (and any removed option's spec is deleted). A missing spec test is a blocking issue.`,
    `- Naming conventions are consistent (Rust snake_case fields, camelCase dprint keys and values, matching the schema), and defaults match StyLua's \`Config::default()\`.`,
    `- The \`lineWidth\`, \`useTabs\`, \`newLineKind\` and \`sortRequires\` options were not removed or renamed (they are this plugin's mapping of StyLua options with other names).`,
    `- Any changed expected output in \`tests/specs/\` is explained by an intentional formatting change in StyLua ${options.toVersion}, not by a bug in this plugin. An unexplained change is a blocking issue.`,
    `- README.md was NOT modified (its documentation is maintained separately); flag any README.md change as a blocking issue.`,
    `- No obvious correctness bugs, and code style matches the surrounding code.`,
    ``,
    `When done, your FINAL message must be ONLY a JSON object (no markdown code fences, no extra prose) of exactly this shape:`,
    `{"approved": true|false, "summary": "one sentence", "issues": [{"severity": "blocking"|"nit", "description": "..."}]}`,
    `Set approved=false if there is any blocking issue; nits alone do not block.`,
  ].join("\n");
}

function parseReview(message: string): ReviewResult {
  const review = JSON.parse(extractJsonObject(message)) as ReviewResult;
  if (typeof review.approved !== "boolean" || !Array.isArray(review.issues)) {
    throw new Error(`Codex review returned malformed JSON:\n${message}`);
  }
  return review;
}

// Codex is instructed to emit only JSON, but tolerate an accidental code fence
// or surrounding prose by extracting the outermost { ... } object.
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find a JSON object in Codex review output:\n${text}`);
  }
  return text.slice(start, end + 1);
}

function logReview(review: ReviewResult): void {
  $.log(`Review: ${review.approved ? "approved" : "changes requested"} — ${review.summary}`);
  for (const issue of review.issues) {
    $.logLight(`  [${issue.severity}] ${issue.description}`);
  }
}

// setup ------------------------------------------------------------------------

function requireApiKey(): string {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. It is required to run the AI fixer and reviewer.");
  }
  return apiKey;
}

async function ensureCodexInstalled(): Promise<void> {
  const found = await $`codex --version`.noThrow().quiet();
  if (found.code === 0) {
    return;
  }
  $.logStep("Installing OpenAI Codex CLI...");
  await $`npm install -g @openai/codex`;
}

// `codex exec` does not read OPENAI_API_KEY on its own -- it needs credentials
// stored via `codex login` first, otherwise its requests go out with no auth
// header and the API returns 401. The key is piped over stdin so it never
// appears in the process arguments.
async function codexLogin(apiKey: string): Promise<void> {
  $.logStep("Authenticating Codex with the OpenAI API key...");
  await $`codex login --with-api-key`.stdinText(apiKey);
}
