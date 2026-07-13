import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { once } from "node:events"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createServer as createNetServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

test("minimal starter installs, builds, and serves API and SSR routes", {
  timeout: 300_000,
}, async () => {
  const root = mkdtempSync(join(tmpdir(), "voyant-minimal-starter-acceptance-"))
  const out = join(root, "out")
  const app = join(root, "app")
  const port = await reservePort()
  let server
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
    write(
      app,
      "src/api/public/starter-proof/route.ts",
      'export const GET = (c) => c.json({ route: "public" })\n',
    )
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
    write(
      app,
      "vite.config.ts",
      [
        'import { writeFileSync } from "node:fs"',
        "export default {",
        '  build: { outDir: "custom-dist" },',
        "  plugins: [{",
        '    name: "project-vite-config-acceptance",',
        '    configResolved() { writeFileSync(".voyant/project-vite-plugin.loaded", "ok\\n") },',
        "  }],",
        "}",
      ].join("\n"),
    )
    exec("pnpm", ["build"], app)
    assert.ok(!existsSync(join(app, "custom-dist")))
    assert.ok(existsSync(join(app, "dist/client")))
    assert.ok(existsSync(join(app, "dist/server/server.js")))
    assert.ok(existsSync(join(app, "dist/.voyant/deployment-graph.generated.json")))
    assert.ok(existsSync(join(app, "dist/server/.voyant/deployment-graph.generated.json")))
    assert.equal(readFileSync(join(app, ".voyant/project-vite-plugin.loaded"), "utf8"), "ok\n")

    const graph = JSON.parse(
      readFileSync(join(app, ".voyant/deployment-graph.generated.json"), "utf8"),
    )
    const bom = JSON.parse(readFileSync(join(app, ".voyant/product-bom.generated.json"), "utf8"))
    assert.equal(graph.schemaVersion, "voyant.resolved-graph.v1")
    assert.ok(graph.modules.length > 30)
    const projectApi = graph.modules.find((unit) => unit.localId === "project-api")
    assert.ok(projectApi)
    assert.ok(
      projectApi.api?.some(
        (api) =>
          api.id === "project.api.public.starter-proof" &&
          api.surface === "public" &&
          api.mount === "/starter-proof" &&
          api.methods?.includes("GET"),
      ),
    )
    assert.ok(graph.modules.some((unit) => unit.localId === "project-workflows"))
    assert.ok(graph.modules.some((unit) => unit.localId === "project-subscribers-links"))
    assert.ok(graph.modules.some((unit) => unit.localId === "concierge"))
    assert.ok(
      graph.modules.some(
        (unit) =>
          unit.localId === "storefront" &&
          unit.api?.some((api) => api.surface === "public" && api.mount === "/"),
      ),
    )
    assert.equal(bom.productBom.id, "@voyant-travel/operator-standard")
    assert.match(
      readFileSync(join(app, ".voyant/admin/project-admin.generated.ts"), "utf8"),
      /src\/admin\/dashboard\/index/,
    )
    assert.ok(existsSync(join(app, ".voyant/admin/selected-graph-admin.generated.js")))
    assert.ok(existsSync(join(app, ".voyant/admin/selected-graph-admin.generated.d.ts")))
    assert.ok(!existsSync(join(app, ".voyant/admin/selected-graph-admin.generated.ts")))
    const projectRuntime = readFileSync(
      join(app, ".voyant/runtime/project-runtime.generated.ts"),
      "utf8",
    )
    assert.match(projectRuntime, /createRuntimePorts: createGeneratedGraphRuntimePorts/)
    assert.match(projectRuntime, /GENERATED_GRAPH_RUNTIME_CONTRIBUTORS/)
    assert.match(
      projectRuntime,
      /operator-standard\/node_modules\/@voyant-travel\/storefront\/src\/runtime-contributor/,
    )
    assert.doesNotMatch(
      projectRuntime,
      /^import .* from "@voyant-travel\/accommodations\/runtime-contributor"/m,
    )
    assert.doesNotMatch(projectRuntime, /createVoyantGraphRuntimePortStubs/)
    assert.match(
      readFileSync(join(app, ".voyant/runtime/project-api.generated.ts"), "utf8"),
      /src\/api\/public\/starter-proof\/route/,
    )
    assert.doesNotMatch(
      readFileSync(join(app, ".voyant/runtime/project-links.generated.ts"), "utf8"),
      /from "@voyant-travel\/accommodations\/standard-links"/,
    )
    exec(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        [
          'import { projectApiHonoModule } from "./.voyant/runtime/project-api.generated.ts"',
          'const response = await projectApiHonoModule.publicRoutes.request("http://local/starter-proof")',
          "if (response.status !== 200) throw new Error('Unexpected status: ' + response.status)",
          "const body = await response.json()",
          "if (body.route !== 'public') throw new Error('Unexpected body: ' + JSON.stringify(body))",
        ].join("; "),
      ],
      app,
      { NODE_OPTIONS: "--conditions=development" },
    )

    server = spawn(
      process.execPath,
      [
        join(app, "node_modules/@voyant-travel/cli/bin/voyant.mjs"),
        "start",
        "--port",
        String(port),
      ],
      {
        cwd: app,
        env: {
          ...process.env,
          BETTER_AUTH_SECRET: "starter-acceptance-better-auth-secret",
          DATABASE_URL: ["postgresql", "://postgres:postgres@127.0.0.1:5432/voyant"].join(""),
          NODE_OPTIONS: "--conditions=development",
          SESSION_CLAIMS_SECRET: "starter-acceptance-session-claims-secret",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const output = captureOutput(server)
    await waitForOk(`http://127.0.0.1:${port}/healthz`, server, output)

    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/v1/public/starter-proof`)
    assert.equal(apiResponse.status, 401, output())

    const ssrResponse = await fetch(`http://127.0.0.1:${port}/docs`)
    assert.equal(ssrResponse.status, 200, output())
    assert.match(await ssrResponse.text(), /No OpenAPI specs are available/)
  } finally {
    if (server) await stop(server)
    rmSync(root, { recursive: true, force: true })
  }
})

function useInstalledToolingArtifacts(app) {
  const packageJsonPath = join(app, "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  packageJson.dependencies.pg = `link:${realpathSync(
    join(repoRoot, "starters/operator/node_modules/pg"),
  )}`
  for (const dependency of ["@voyant-travel/cli", "tsx", "typescript"]) {
    packageJson.devDependencies[dependency] = `link:${realpathSync(
      join(repoRoot, "starters/operator/node_modules", dependency),
    )}`
  }
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function exec(command, args, cwd, env = {}, timeout = 240_000) {
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

function captureOutput(child) {
  let output = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    output += chunk
  })
  child.stderr.on("data", (chunk) => {
    output += chunk
  })
  return () => output
}

async function waitForOk(url, child, output) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Node host exited before it became ready.\n${output()}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The server socket may not be listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${url}.\n${output()}`)
}

async function stop(child) {
  if (child.exitCode !== null) return
  const exited = once(child, "exit")
  child.kill("SIGTERM")
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])
  if (stopped) return
  child.kill("SIGKILL")
  await exited
}

async function reservePort() {
  const listener = createNetServer()
  await new Promise((resolve, reject) => {
    listener.once("error", reject)
    listener.listen(0, "127.0.0.1", resolve)
  })
  const address = listener.address()
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  )
  assert.ok(address && typeof address === "object")
  return address.port
}
