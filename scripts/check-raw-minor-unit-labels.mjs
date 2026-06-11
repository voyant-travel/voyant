#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const globs = [
  "packages/*-ui/src/**/*.{ts,tsx}",
  "packages/i18n/src/**/*.{ts,tsx}",
  "packages/legal/src/contracts/template-authoring.ts",
]

const files = execFileSync("git", ["ls-files", ...globs], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)

const rawMinorUnitLabelPattern =
  /["'`](?:[^"'`]*\((?:cents?|centi|bani)\)[^"'`]*|[^"'`]*(?:Amount Cents|Suma .*centi|Valoare .*centi|Pret .*bani)[^"'`]*)["'`]/gi
const violations = []

for (const file of files) {
  const source = readFileSync(file, "utf8")
  for (const match of source.matchAll(rawMinorUnitLabelPattern)) {
    const line = source.slice(0, match.index).split("\n").length
    violations.push(`${file}:${line}: use CurrencyInput and label the money role, not cents`)
  }
}

if (violations.length > 0) {
  console.error("raw-minor-unit-labels: found operator-facing cents labels")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log("raw-minor-unit-labels: ok")
