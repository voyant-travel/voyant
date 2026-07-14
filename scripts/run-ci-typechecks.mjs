#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import process from "node:process"
import { classifyTypecheck, discoverWorkspaceManifests } from "./lib/ci-typecheck-selection.mjs"

const rootDirectory = process.cwd()
const isAffectedRun = process.argv.includes("--affected")
const isDryRun = process.argv.includes("--dry-run")
const concurrencyArgument = process.argv.find((argument) => argument.startsWith("--concurrency="))
const concurrency = concurrencyArgument?.split("=")[1] ?? "4"

const classifications = discoverWorkspaceManifests(rootDirectory)
  .map((workspace) => ({
    ...workspace,
    classification: classifyTypecheck(workspace),
  }))
  .filter(({ classification }) => classification.required)

let selectedPackages = classifications.map(({ manifest }) => manifest.name)

if (isAffectedRun) {
  const affected = runTurbo(["run", "typecheck", "--affected", "--dry=json"], { capture: true })
  const affectedPackages = new Set(
    JSON.parse(affected.stdout)
      .tasks.filter((task) => task.task === "typecheck")
      .map((task) => task.package),
  )
  selectedPackages = selectedPackages.filter((packageName) => affectedPackages.has(packageName))
}

const selected = new Set(selectedPackages)
const reasonCounts = new Map()
for (const { manifest, classification } of classifications) {
  if (!selected.has(manifest.name)) continue
  reasonCounts.set(classification.reason, (reasonCounts.get(classification.reason) ?? 0) + 1)
}

console.log(
  `CI typecheck selection: ${selectedPackages.length} workspace${selectedPackages.length === 1 ? "" : "s"}`,
)
for (const [reason, count] of [...reasonCounts].sort()) {
  console.log(`  ${reason}: ${count}`)
}

if (isDryRun || selectedPackages.length === 0) {
  for (const packageName of selectedPackages) console.log(`  ${packageName}`)
  process.exit(0)
}

const filters = selectedPackages.flatMap((packageName) => ["--filter", packageName])
runTurbo([
  "run",
  "typecheck",
  ...filters,
  "--continue",
  `--concurrency=${concurrency}`,
  "--output-logs=new-only",
  "--summarize",
])

function runTurbo(arguments_, options = {}) {
  const result = spawnSync("pnpm", ["exec", "turbo", ...arguments_], {
    cwd: rootDirectory,
    encoding: "utf8",
    env: { ...process.env, TURBO_UI: "false" },
    // A 100-workspace `turbo --dry=json` graph is several megabytes. Node's
    // 1 MiB spawnSync default truncates it before we can select the CI subset.
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result
}
