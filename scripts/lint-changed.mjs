import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"

const PROCESSABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
])
const SKIP_PREFIXES = ["node_modules/", "dist/", ".turbo/", ".next/"]

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf-8" })
  if (result.error) throw result.error
  if (result.status !== 0) return []
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function extensionOf(file) {
  const index = file.lastIndexOf(".")
  return index === -1 ? "" : file.slice(index)
}

const files = new Set([
  ...runGit(["diff", "--name-only", "--diff-filter=ACMR", "main...HEAD"]),
  ...runGit(["diff", "--name-only", "--diff-filter=ACMR"]),
  ...runGit(["diff", "--name-only", "--cached", "--diff-filter=ACMR"]),
  ...runGit(["ls-files", "--others", "--exclude-standard"]),
])

const processableFiles = [...files]
  .filter((file) => existsSync(file))
  .filter((file) => PROCESSABLE_EXTENSIONS.has(extensionOf(file)))
  .filter((file) => !SKIP_PREFIXES.some((prefix) => file.startsWith(prefix)))
  .sort()

if (processableFiles.length === 0) {
  console.log("lint-changed: OK (no processable changed files)")
  process.exit(0)
}

const result = spawnSync("pnpm", ["exec", "biome", "check", ...processableFiles], {
  stdio: "inherit",
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
