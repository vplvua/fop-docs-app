#!/usr/bin/env node
// scripts/qa-verify.mjs — bundle gate
//
// Runs the full static-verification ritual before archive / PR:
//   1. lint         (oxlint)
//   2. check:design (design-token compliance guard — D-DS-06)
//   3. format:check (prettier)
//   4. typecheck    (tsc --noEmit)
//   5. test:run     (vitest run)
//   6. build        (next build)
//   7. openspec validate --strict
//
// Atomic: fails fast on the first non-zero exit. Used both locally
// (Claude Code Stop hook, `npm run qa`) and in CI (ai-pr-check.yml).

import { spawn } from "node:child_process";
import process from "node:process";

const stages = [
  { name: "lint", cmd: "npm", args: ["run", "lint"] },
  { name: "check:design", cmd: "npm", args: ["run", "check:design"] },
  { name: "format:check", cmd: "npm", args: ["run", "format:check"] },
  { name: "typecheck", cmd: "npm", args: ["run", "typecheck"] },
  { name: "test:run", cmd: "npm", args: ["run", "test:run"] },
  { name: "build", cmd: "npm", args: ["run", "build"] },
  { name: "openspec:validate", cmd: "npx", args: ["openspec", "validate", "--all", "--strict"] },
];

const dim = (s) => `[2m${s}[0m`;
const red = (s) => `[31m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const bold = (s) => `[1m${s}[0m`;

function run(stage) {
  return new Promise((resolve) => {
    const started = Date.now();
    process.stdout.write(
      `\n${bold(`▶ ${stage.name}`)} ${dim(`(${stage.cmd} ${stage.args.join(" ")})`)}\n`,
    );
    const child = spawn(stage.cmd, stage.args, { stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      const ms = Date.now() - started;
      resolve({ code: code ?? 1, ms });
    });
    child.on("error", (err) => {
      console.error(red(`spawn error: ${err.message}`));
      resolve({ code: 1, ms: Date.now() - started });
    });
  });
}

let failed = false;
for (const stage of stages) {
  const { code, ms } = await run(stage);
  if (code !== 0) {
    console.error(red(`\n✖ ${stage.name} failed (exit ${code}, ${ms}ms)`));
    failed = true;
    break;
  }
  console.log(green(`✔ ${stage.name} (${ms}ms)`));
}

if (failed) {
  console.error(red(bold("\nqa-verify: FAILED — fix above before archive / PR.")));
  process.exit(1);
} else {
  console.log(green(bold("\nqa-verify: PASSED — all gates green.")));
}
