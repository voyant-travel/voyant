#!/usr/bin/env node
/**
 * Runs Wrangler's startup profiler for a Worker project and prints a compact
 * self-time summary from the generated Chrome CPU profile.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

const args = process.argv.slice(2)
const projectArg = args[0] && !args[0].startsWith("--") ? args.shift() : "."
let outfileArg
let topCount = 20

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === "--") {
    continue
  }
  if (arg === "--outfile") {
    outfileArg = args[++i]
    continue
  }
  if (arg === "--top") {
    const value = Number(args[++i])
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("--top must be a positive integer")
    }
    topCount = value
    continue
  }
  throw new Error(`Unknown argument: ${arg}`)
}

const projectDir = resolve(process.cwd(), projectArg)
const outfile = resolve(
  projectDir,
  outfileArg ?? ".wrangler/startup-profiles/worker-startup.cpuprofile",
)

mkdirSync(dirname(outfile), { recursive: true })

const result = spawnSync("pnpm", ["exec", "wrangler", "check", "startup", "--outfile", outfile], {
  cwd: projectDir,
  env: process.env,
  stdio: "inherit",
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (!existsSync(outfile) || !statSync(outfile).isFile()) {
  console.error(`Startup profile was not written: ${outfile}`)
  process.exit(1)
}

const profile = JSON.parse(readFileSync(outfile, "utf-8"))
const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
const samples = Array.isArray(profile.samples) ? profile.samples : []
const timeDeltas = Array.isArray(profile.timeDeltas) ? profile.timeDeltas : []
const selfTimeByNode = new Map()

for (let i = 0; i < samples.length; i++) {
  const id = samples[i]
  selfTimeByNode.set(id, (selfTimeByNode.get(id) ?? 0) + (timeDeltas[i] ?? 0))
}

const totalSampledUs = timeDeltas.reduce((sum, value) => sum + value, 0)
const wallUs =
  typeof profile.startTime === "number" && typeof profile.endTime === "number"
    ? profile.endTime - profile.startTime
    : totalSampledUs

const rows = [...selfTimeByNode.entries()]
  .map(([id, selfUs]) => {
    const node = nodes.get(id)
    const callFrame = node?.callFrame ?? {}
    return {
      selfUs,
      functionName: callFrame.functionName || "(anonymous)",
      url: displayUrl(callFrame.url),
      line: typeof callFrame.lineNumber === "number" ? callFrame.lineNumber + 1 : null,
    }
  })
  .sort((a, b) => b.selfUs - a.selfUs)

const selfTimeByFile = new Map()
for (const row of rows) {
  selfTimeByFile.set(row.url, (selfTimeByFile.get(row.url) ?? 0) + row.selfUs)
}

console.log("\nCloudflare Worker startup profile summary")
console.log(`profile: ${relative(process.cwd(), outfile)}`)
console.log(`wall: ${formatMs(wallUs)} | sampled: ${formatMs(totalSampledUs)}`)
console.log(`samples: ${samples.length} | nodes: ${profile.nodes.length}`)
console.log("\nTop self-time functions:")
for (const row of rows.slice(0, topCount)) {
  const location = row.line === null ? row.url : `${row.url}:${row.line}`
  console.log(`${formatMs(row.selfUs).padStart(9)}  ${row.functionName}  ${location}`)
}

console.log("\nTop self-time files:")
for (const [url, selfUs] of [...selfTimeByFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, Math.max(8, Math.ceil(topCount / 2)))) {
  console.log(`${formatMs(selfUs).padStart(9)}  ${url}`)
}

console.log(
  "\nNote: Wrangler measures this locally. Use the profile to find relative startup cost, not exact Cloudflare production CPU.",
)

function formatMs(us) {
  return `${(us / 1000).toFixed(2)}ms`
}

function displayUrl(url) {
  if (!url) return "(runtime)"
  const absoluteUrl = url.startsWith("/") ? url : `/${url}`
  if (absoluteUrl.startsWith(projectDir)) {
    return relative(projectDir, absoluteUrl) || "."
  }
  return url
}
