#!/usr/bin/env node
// scripts/check-design-tokens.mjs — design-token compliance guard (D-DS-06)
//
// Fails when component markup under app/ uses raw color literals instead of the
// semantic design tokens defined in app/globals.css. This is the regression
// backstop for the `design-system` capability: the color palette lives in the
// CSS-variable token layer (globals.css) and nowhere else.
//
// Flags, in app/**/*.tsx{,x}:
//   - raw hex colors            (#abc, #aabbcc) including arbitrary values bg-[#…]
//   - ad-hoc Tailwind shades    (bg-red-500, text-green-700, border-amber-300/50, …)
//
// Allowed: semantic utilities mapped to tokens — bg-primary, text-foreground,
// border-border, bg-success/12, text-warning, text-destructive, etc.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCAN_DIR = path.join(ROOT, "app");

// Tailwind palette names that are never design tokens — using any of these as a
// color utility (e.g. text-green-700) bypasses the token layer.
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
// Utility prefixes that take a color value.
const PREFIX =
  "bg|text|border|ring|ring-offset|from|via|to|fill|stroke|outline|divide|placeholder|caret|accent|decoration|shadow";

const SHADE_RE = new RegExp(`\\b(?:${PREFIX})-(?:${PALETTE})-[0-9]{2,3}\\b`, "g");
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(SCAN_DIR)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const re of [SHADE_RE, HEX_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        violations.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          token: m[0],
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`\n✖ design-token guard: ${violations.length} raw color literal(s) found in app/`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.token}`);
  }
  console.error(
    "\nUse semantic tokens (bg-primary, text-foreground, text-success, …). The palette\n" +
      "lives only in the app/globals.css CSS-variable token layer. See DESIGN.md.",
  );
  process.exit(1);
}

console.log("✔ design-token guard: no raw color literals in app/");
