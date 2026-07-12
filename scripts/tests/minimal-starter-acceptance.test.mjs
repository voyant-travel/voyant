import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

test("minimal starter installs, emits its selected graph, and boots the Node host", {
  timeout: 180_000,
}, () => {
  const root = mkdtempSync(join(tmpdir(), "voyant-minimal-starter-acceptance-"))
  const out = join(root, "out")
  const app = join(root, "app")
  const port = 44_000 + (process.pid % 1_000)
  try {
    exec(
      process.execPath,
      [
        "scripts/package-starters.mjs",
        "--version",
        "0.0.0-test",
        "--local-links",
        "--out-dir",
        out,
      ],
      repoRoot,
    )
    mkdirSync(app, { recursive: true })
    exec(
      "tar",
      ["-xzf", join(out, "voyant-starter-operator-0.0.0-test.tar.gz"), "-C", app],
      repoRoot,
    )
    useInstalledToolingArtifacts(app)
    exec(
      "pnpm",
      [
        "install",
        "--offline",
        "--ignore-scripts",
        "--ignore-workspace",
        "--config.frozen-lockfile=false",
      ],
      app,
    )
    write(app, "src/api/admin/health/route.ts", "export const GET = (c) => c.json({ ok: true })\n")
    write(app, "src/admin/dashboard/index.tsx", 'export default { id: "project.dashboard" }\n')
    write(
      app,
      "src/modules/concierge/index.ts",
      'export default { module: { name: "concierge" } }\n',
    )
    write(
      app,
      "src/workflows/sync-health.ts",
      [
        'import { defineWorkflow } from "@voyant-travel/framework/project-runtime"',
        'export default defineWorkflow({ id: "health.sync", run: async () => undefined })',
      ].join("\n"),
    )
    write(
      app,
      "src/jobs/cleanup.ts",
      'export const schedule = { cron: "0 3 * * *" }; export default async function cleanup() {}\n',
    )
    write(
      app,
      "src/subscribers/booking-created.ts",
      'export default { id: "booking.created.health-sync", eventType: "booking.created", manifest: { id: "booking.created.health-sync", eventType: "booking.created", payloadHash: "hash", targetWorkflowId: "health.sync" } }\n',
    )
    exec("pnpm", ["build"], app)

    const graph = JSON.parse(
      readFileSync(join(app, ".voyant/deployment-graph.generated.json"), "utf8"),
    )
    const bom = JSON.parse(readFileSync(join(app, ".voyant/product-bom.generated.json"), "utf8"))
    assert.equal(graph.schemaVersion, "voyant.resolved-graph.v1")
    assert.ok(graph.modules.length > 30)
    assert.ok(graph.modules.some((unit) => unit.localId === "project-api"))
    assert.ok(graph.modules.some((unit) => unit.localId === "project-workflows"))
    assert.ok(graph.modules.some((unit) => unit.localId === "project-subscribers-links"))
    assert.ok(graph.modules.some((unit) => unit.localId === "concierge"))
    assert.equal(bom.productBom.id, "@voyant-travel/operator-standard")
    assert.match(
      readFileSync(join(app, ".voyant/admin/project-admin.generated.ts"), "utf8"),
      /src\/admin\/dashboard\/index/,
    )

    exec(
      "pnpm",
      ["start", "--", "--probe", "--port", String(port)],
      app,
      {
        DATABASE_URL: ["postgresql", "://postgres:postgres@127.0.0.1:5432/voyant"].join(""),
        NODE_OPTIONS: "--conditions=development",
      },
      30_000,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function useInstalledToolingArtifacts(app) {
  const packageJsonPath = join(app, "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  const installedCli = realpathSync(
    join(repoRoot, "starters/operator/node_modules/@voyant-travel/cli"),
  )
  packageJson.devDependencies["@voyant-travel/cli"] = `link:${installedCli}`
  for (const dependency of ["tsx", "typescript"]) {
    packageJson.devDependencies[dependency] = `link:${realpathSync(
      join(repoRoot, "node_modules", dependency),
    )}`
  }
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function exec(command, args, cwd, env = {}, timeout = 120_000) {
  return execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "pipe",
    timeout,
  })
}

function write(root, relativePath, contents) {
  const destination = join(root, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
}
