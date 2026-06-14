#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const canonicalPath = "packages/ui/src/components/date-picker.tsx"

const candidateFiles = [
  execFileSync("git", ["ls-files"], { encoding: "utf8" }),
  execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }),
]
  .flatMap((output) => output.split("\n"))
  .filter(Boolean)
  .filter((file) => existsSync(file))

const forkPaths = candidateFiles.filter((file) => {
  if (file === canonicalPath) return false
  return (
    file.endsWith("/src/components/ui/date-picker.tsx") ||
    file.endsWith("/src/components/product-detail/date-picker.tsx")
  )
})

const violations = []

for (const file of forkPaths) {
  violations.push(`${file}: import DatePicker from @voyant-travel/ui/components/date-picker`)
}

const canonicalSource = readFileSync(canonicalPath, "utf8")
const triggerMatch = canonicalSource.match(
  /function\s+DatePickerTrigger\s*\([^)]*\.\.\.props[\s\S]*?<Button[\s\S]*?\{\.\.\.props\}/,
)

if (!triggerMatch) {
  violations.push(
    `${canonicalPath}: DatePickerTrigger must forward PopoverTrigger render props to Button`,
  )
}

if (!canonicalSource.includes("export function DateRangePicker")) {
  violations.push(`${canonicalPath}: DateRangePicker must remain part of the shared component`)
}

if (!canonicalSource.includes('dateDisabled?: CalendarProps["disabled"]')) {
  violations.push(`${canonicalPath}: dateDisabled must remain in the shared DatePicker API`)
}

if (violations.length > 0) {
  console.error("date-picker-single-source: found violations")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log("date-picker-single-source: ok")
