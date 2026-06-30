#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const files = execFileSync(
  "git",
  ["ls-files", "packages/*-ui/src/**/*.tsx", "packages/*-react/src/**/*.tsx"],
  {
    encoding: "utf8",
  },
)
  .split("\n")
  .filter(Boolean)
  .filter((file) => existsSync(file))

const nativeDateInputPattern = /\btype\s*=\s*["'](?:date|datetime-local)["']/g
const violations = []

for (const file of files) {
  const source = readFileSync(file, "utf8")
  for (const match of source.matchAll(nativeDateInputPattern)) {
    const line = source.slice(0, match.index).split("\n").length
    violations.push(`${file}:${line}: use DatePicker or DateTimePicker from @voyant-travel/ui`)
  }
}

if (violations.length > 0) {
  console.error("native-date-inputs: found native date controls in UI packages")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log("native-date-inputs: ok")
