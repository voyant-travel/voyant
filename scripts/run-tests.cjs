const { spawnSync } = require("node:child_process")
const os = require("node:os")

const passthrough = process.argv.slice(2)
const turboArgs = ["exec", "turbo", "run", "test", "--continue", ...passthrough]

const hasConcurrency = passthrough.some(
  (arg) => arg === "--concurrency" || arg.startsWith("--concurrency="),
)

if (!hasConcurrency) {
  if (process.env.TEST_DATABASE_URL) {
    // Integration tests share a single Postgres database; run them serially.
    turboArgs.push("--concurrency=1")
  } else {
    // Each package's `vitest run` already spreads work across every CPU core, so
    // letting turbo run many package test tasks at once oversubscribes the CPU.
    // Under that contention, import-heavy tests (which dynamically load large
    // module graphs) flake on their timeouts. Cap how many package test tasks
    // run concurrently so the aggregate stays sane. Override with TEST_CONCURRENCY.
    const cores = os.availableParallelism?.() ?? os.cpus().length
    const cap = process.env.TEST_CONCURRENCY || String(Math.max(2, Math.floor(cores / 3)))
    turboArgs.push(`--concurrency=${cap}`)
  }
}

const result = spawnSync("pnpm", turboArgs, {
  stdio: "inherit",
  env: process.env,
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
