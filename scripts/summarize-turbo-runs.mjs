#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const runsDirectory = path.resolve(process.argv[2] ?? ".turbo/runs")
if (!fs.existsSync(runsDirectory)) {
  console.log(`No Turbo run summaries found at ${runsDirectory}`)
  process.exit(0)
}

const runs = fs
  .readdirSync(runsDirectory)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(path.join(runsDirectory, file), "utf8")))
  .sort((left, right) => left.execution.startTime - right.execution.startTime)

if (runs.length === 0) {
  console.log(`No Turbo run summaries found at ${runsDirectory}`)
  process.exit(0)
}

const lines = [
  "## Turbo run summary",
  "",
  "| Command | Tasks | Cached | Hit rate | Duration |",
  "| --- | ---: | ---: | ---: | ---: |",
]

for (const run of runs) {
  const { attempted = 0, cached = 0 } = run.execution
  const hitRate = attempted === 0 ? 100 : Math.round((cached / attempted) * 100)
  lines.push(
    `| \`${escapeTable(run.execution.command)}\` | ${attempted} | ${cached} | ${hitRate}% | ${formatDuration(run.execution.endTime - run.execution.startTime)} |`,
  )
}

const slowMisses = runs
  .flatMap((run) => run.tasks ?? [])
  .filter((task) => task.cache?.status !== "HIT" && task.execution?.endTime)
  .map((task) => ({
    taskId: task.taskId,
    duration: task.execution.endTime - task.execution.startTime,
  }))
  .sort((left, right) => right.duration - left.duration)
  .slice(0, 10)

if (slowMisses.length > 0) {
  lines.push("", "### Slowest cache misses", "")
  for (const task of slowMisses) {
    lines.push(`- \`${task.taskId}\`: ${formatDuration(task.duration)}`)
  }
}

const summary = `${lines.join("\n")}\n`
process.stdout.write(summary)

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
}

function formatDuration(milliseconds) {
  if (milliseconds < 1_000) return `${milliseconds}ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}s`
  const minutes = Math.floor(milliseconds / 60_000)
  const seconds = Math.round((milliseconds % 60_000) / 1_000)
  return `${minutes}m ${seconds}s`
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("`", "\\`")
}
