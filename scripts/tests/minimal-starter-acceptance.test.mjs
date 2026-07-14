import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { once } from "node:events"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { createConnection, createServer as createNetServer } from "node:net"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const frontendSingletonRoots = [
  "@tanstack/react-query",
  "@tanstack/react-router",
  "react",
  "react-dom",
]

test("legacy minimal starter serves project API and SSR routes without direct frontend dependencies", {
  timeout: 420_000,
}, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "voyant-minimal-starter-acceptance-"))
  const out = join(root, "out")
  const app = join(root, "app")
  try {
    const publishedPackages = packPublishedPackages(join(root, "published-packages"))
    exec(
      process.execPath,
      ["scripts/package-starters.mjs", "--version", "0.0.0-test", "--out-dir", out],
      repoRoot,
    )
    mkdirSync(app, { recursive: true })
    exec(
      "tar",
      ["-xzf", join(out, "voyant-starter-operator-0.0.0-test.tar.gz"), "-C", app],
      repoRoot,
    )
    useInstalledToolingArtifacts(app, publishedPackages)
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
    assertNonHoistedConsumerLayout(app)
    assertPublishedPackageLayout(app)
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
    write(app, "src/acceptance-proof.tsx", acceptanceProofSource("before"))
    write(
      app,
      "vite.config.ts",
      [
        'import { writeFileSync } from "node:fs"',
        "export default {",
        '  build: { outDir: "custom-dist" },',
        // The offline link fixture must expose dependencies of linked workspace sources.
        "  resolve: { alias: {",
        `    "@aws-sdk/client-s3": ${JSON.stringify(resolvePnpmStorePackageEntry("@aws-sdk/client-s3"))},`,
        `    "@aws-sdk/s3-request-presigner": ${JSON.stringify(resolvePnpmStorePackageEntry("@aws-sdk/s3-request-presigner"))},`,
        "  } },",
        "  plugins: [{",
        '    name: "project-vite-config-acceptance",',
        '    enforce: "pre",',
        '    configResolved() { writeFileSync(".voyant/project-vite-plugin.loaded", "ok\\n") },',
        "    transform(code, id) {",
        '      const normalizedId = id.replaceAll("\\\\", "/").split("?", 1)[0]',
        '      if (!normalizedId.endsWith("/.voyant/routes/__root.tsx")) return null',
        '      if (!code.includes("<Outlet />")) throw new Error("Acceptance hook could not find the root outlet")',
        `      return ${JSON.stringify('import AcceptanceProof from "@/acceptance-proof"\n')} + code.replace("<Outlet />", "<AcceptanceProof /><Outlet />")`,
        "    },",
        "  }],",
        "}",
      ].join("\n"),
    )
    const buildOutput = exec("pnpm", ["build"], app)
    assert.ok(!existsSync(join(app, "custom-dist")))
    assert.ok(
      existsSync(join(app, "dist/client")),
      `Build did not emit dist/client.\n${buildOutput}\nProject root: ${readdirSync(app).join(", ")}`,
    )
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
    assert.match(projectRuntime, /@voyant-travel\/storefront\/dist\/runtime-contributor\.js/)
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
    exec("pnpm", ["db:migrate"], app, acceptanceEnvironment())

    await t.test("voyant start serves the authored route and rendered SSR", async (modeTest) => {
      await assertVoyantServerMode(app, "start", modeTest)
    })
    await t.test("voyant develop serves the authored route and rendered SSR", async (modeTest) => {
      await assertVoyantServerMode(app, "develop", modeTest)
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

async function assertVoyantServerMode(app, mode, t) {
  const port = await reservePort()
  const server = spawnVoyant(app, mode, port)
  const output = captureOutput(server)
  try {
    await waitForListening("127.0.0.1", port, server, output)

    const api = await readResponse(`http://127.0.0.1:${port}/api/v1/public/starter-proof`, {
      headers: { authorization: "Bearer starter-acceptance-internal-key" },
    })
    const ssr = await readResponse(`http://127.0.0.1:${port}/docs`)
    const failures = []

    if (api.status !== 200) {
      failures.push(`project API returned ${api.status}: ${api.body}`)
    } else {
      try {
        assert.deepEqual(JSON.parse(api.body), { route: "public" })
      } catch (error) {
        failures.push(`project API returned an unexpected body: ${api.body}\n${String(error)}`)
      }
    }
    if (ssr.status !== 200) {
      failures.push(`SSR route returned ${ssr.status}: ${ssr.body}`)
    } else {
      if (!ssr.contentType.includes("text/html")) {
        failures.push(`SSR route returned unexpected content-type: ${ssr.contentType}`)
      }
      if (!/<html[\s>]/i.test(ssr.body)) {
        failures.push("SSR route did not return an HTML document")
      }
      if (!/No OpenAPI specs are available/.test(ssr.body)) {
        failures.push("SSR route did not render the expected project docs content")
      }
    }

    assert.deepEqual(failures, [], `${mode} failed packaged starter HTTP acceptance.\n${output()}`)
    await t.test(
      mode === "develop"
        ? "hydrates and preserves one React identity across authored-source HMR"
        : "hydrates the production client bundle without browser errors",
      async (browserTest) => {
        await assertBrowserHydration(app, port, browserTest, output, { hmr: mode === "develop" })
      },
    )
  } finally {
    await stop(server)
  }
}

function spawnVoyant(app, mode, port) {
  const args = [join(app, "node_modules/@voyant-travel/cli/bin/voyant.mjs"), mode]
  if (mode === "develop") args.push("--host", "127.0.0.1")
  args.push("--port", String(port))
  const env = acceptanceEnvironment()
  assert.doesNotMatch(env.NODE_OPTIONS, /conditions=development|tsx/)
  return spawn(process.execPath, args, {
    cwd: app,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function acceptanceEnvironment() {
  return {
    ...process.env,
    BETTER_AUTH_SECRET: "starter-acceptance-better-auth-secret",
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      ["postgresql", "://postgres:postgres@127.0.0.1:5432/voyant_starter_acceptance"].join(""),
    INTERNAL_API_KEY: "starter-acceptance-internal-key",
    NODE_OPTIONS: "--max-old-space-size=6144",
    SESSION_CLAIMS_SECRET: "starter-acceptance-session-claims-secret",
  }
}

async function readResponse(url, init) {
  const response = await fetch(url, init)
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text(),
  }
}

function useInstalledToolingArtifacts(app, publishedPackages) {
  const packageJsonPath = join(app, "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  for (const dependency of frontendSingletonRoots) {
    assert.equal(
      typeof packageJson.dependencies[dependency],
      "string",
      `Supported packaged starter must directly own ${dependency}`,
    )
    // Exercise the runtime bridge used by existing projects created before
    // direct frontend singleton ownership became part of the starter contract.
    delete packageJson.dependencies[dependency]
  }
  packageJson.dependencies["@voyant-travel/operator-standard"] =
    `file:${publishedPackages.get("@voyant-travel/operator-standard")}`
  packageJson.dependencies["@voyant-travel/framework"] =
    `file:${publishedPackages.get("@voyant-travel/framework")}`
  packageJson.dependencies["@voyant-travel/runtime"] =
    `file:${publishedPackages.get("@voyant-travel/runtime")}`
  packageJson.pnpm = {
    ...packageJson.pnpm,
    overrides: {
      ...packageJson.pnpm?.overrides,
      ...Object.fromEntries(
        [...publishedPackages].map(([name, archive]) => [name, `file:${archive}`]),
      ),
    },
  }
  for (const dependency of ["pg"]) {
    packageJson.dependencies[dependency] = `link:${realpathSync(
      join(repoRoot, "starters/operator/node_modules", dependency),
    )}`
  }
  for (const dependency of ["@voyant-travel/cli", "tsx", "typescript"]) {
    packageJson.devDependencies[dependency] = `link:${realpathSync(
      join(repoRoot, "starters/operator/node_modules", dependency),
    )}`
  }
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function assertNonHoistedConsumerLayout(app) {
  const packageJson = JSON.parse(readFileSync(join(app, "package.json"), "utf8"))

  assert.ok(packageJson.dependencies["@voyant-travel/operator-standard"])
  for (const dependency of frontendSingletonRoots) {
    assert.equal(
      packageJson.dependencies[dependency],
      undefined,
      `Legacy packaged acceptance unexpectedly declares ${dependency}`,
    )
    assert.equal(
      existsSync(join(app, "node_modules", dependency)),
      false,
      `Legacy packaged acceptance unexpectedly hoisted ${dependency}`,
    )
  }
  assert.equal(packageJson.dependencies["@voyant-travel/admin"], undefined)
  assert.ok(
    !existsSync(join(app, "node_modules/@voyant-travel/admin")),
    "Packaged consumer fixture unexpectedly hoisted transitive @voyant-travel/admin",
  )
}

function assertPublishedPackageLayout(app) {
  for (const name of ["@voyant-travel/operator-standard", "@voyant-travel/runtime"]) {
    const packageRoot = realpathSync(join(app, "node_modules", name))
    assert.ok(
      packageRoot.startsWith(`${realpathSync(app)}/`),
      `${name} resolved outside the isolated consumer fixture: ${packageRoot}`,
    )
    assert.ok(existsSync(join(packageRoot, "dist")), `${name} is missing its published dist layout`)
  }
  const operatorRoot = realpathSync(join(app, "node_modules/@voyant-travel/operator-standard"))
  const operatorManifest = JSON.parse(readFileSync(join(operatorRoot, "package.json"), "utf8"))
  assert.equal(operatorManifest.exports["./runtime/react"].browser, "./dist/runtime/react.js")
  assert.equal(operatorManifest.imports["#frontend/react"], "react")
  const resolveFromOperator = createRequire(join(operatorRoot, "package.json"))
  const dbRuntimeEntry = resolveFromOperator.resolve("@voyant-travel/db/runtime")
  const dbRoot = resolve(dirname(dbRuntimeEntry), "../..")
  const dbManifest = JSON.parse(readFileSync(join(dbRoot, "package.json"), "utf8"))
  assert.equal(dbManifest.exports["./runtime"].import, "./dist/runtime/index.js")
  assert.ok(existsSync(join(dbRoot, "dist/runtime/index.js")))
}

function packPublishedPackages(root) {
  const selected = JSON.parse(
    exec(
      "pnpm",
      [
        "--filter-prod",
        "@voyant-travel/framework...",
        "--filter-prod",
        "@voyant-travel/runtime...",
        "--filter-prod",
        "@voyant-travel/operator-standard...",
        "list",
        "--depth",
        "-1",
        "--json",
      ],
      repoRoot,
    ),
  )
  const workspacePackages = selected.filter(
    (entry) => entry.name?.startsWith("@voyant-travel/") && entry.path,
  )
  assert.ok(workspacePackages.length > 80, "Published Operator closure is unexpectedly small")

  return new Map(
    workspacePackages.map((entry) => [entry.name, packPublishedPackage(root, entry.path)]),
  )
}

function packPublishedPackage(root, source) {
  mkdirSync(root, { recursive: true })
  const stdout = exec(
    "pnpm",
    ["--config.ignore-scripts=true", "pack", "--json", "--pack-destination", root],
    source,
  )
  const packResult = JSON.parse(stdout)
  const packed = Array.isArray(packResult) ? packResult[0] : packResult
  assert.equal(
    typeof packed?.filename,
    "string",
    `pnpm pack did not return a filename for ${source}`,
  )
  const archive = join(root, basename(packed.filename))
  assert.ok(existsSync(archive), `pnpm pack did not create ${archive}`)
  return archive
}

function acceptanceProofSource(marker) {
  return `import * as React from "react"

const marker = ${JSON.stringify(marker)}

export default function AcceptanceProof() {
  React.useEffect(() => {
    const previous = Reflect.get(globalThis, "__voyantAcceptance")
    Reflect.set(globalThis, "__voyantAcceptance", {
      pageId: previous?.pageId ?? crypto.randomUUID(),
      marker,
      hydrated: true,
    })
  }, [marker])
  return <output data-voyant-acceptance-hmr>{marker}</output>
}
`
}

async function assertBrowserHydration(app, port, t, serverOutput, { hmr }) {
  const { chromium } = await import("playwright")
  const executable = chromium.executablePath()
  if (!existsSync(executable)) {
    t.skip(`Playwright Chromium executable is unavailable: ${executable}`)
    return
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const browserErrors = []
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`)
  })
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`))
  page.on("requestfailed", (request) => {
    browserErrors.push(
      `requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown error"})`,
    )
  })
  try {
    await page.goto(`http://127.0.0.1:${port}/docs`, { waitUntil: "domcontentloaded" })
    await page
      .locator("[data-voyant-acceptance-hmr]")
      .getByText("before", { exact: true })
      .waitFor({ timeout: 10_000 })
    await waitForBrowserState(
      page,
      () => Reflect.get(globalThis, "__voyantAcceptance")?.hydrated,
      browserErrors,
      "Browser did not hydrate the SSR-rendered acceptance probe",
      serverOutput,
    )
    const initial = await page.evaluate(() => {
      const evidence = Reflect.get(globalThis, "__voyantAcceptance")
      return {
        pageId: evidence.pageId,
        marker: evidence.marker,
      }
    })
    assert.equal(initial.marker, "before")

    if (!hmr) {
      assert.deepEqual(
        browserErrors,
        [],
        `Production browser hydration errors:\n${browserErrors.join("\n")}`,
      )
      return
    }

    writeFileSync(join(app, "src/acceptance-proof.tsx"), acceptanceProofSource("after"))
    await page
      .locator("[data-voyant-acceptance-hmr]")
      .getByText("after", { exact: true })
      .waitFor({ timeout: 10_000 })
    await waitForBrowserState(
      page,
      () => Reflect.get(globalThis, "__voyantAcceptance")?.marker === "after",
      browserErrors,
      "Authored-source HMR did not run the updated acceptance probe",
      serverOutput,
    )
    const updated = await page.evaluate(() => {
      const evidence = Reflect.get(globalThis, "__voyantAcceptance")
      return {
        pageId: evidence.pageId,
        marker: evidence.marker,
      }
    })
    assert.equal(updated.marker, "after")
    assert.equal(updated.pageId, initial.pageId, "HMR performed a full browser reload")
    assert.deepEqual(
      browserErrors,
      [],
      `Browser hydration/HMR errors:\n${browserErrors.join("\n")}`,
    )
  } finally {
    await browser.close()
  }
}

async function waitForBrowserState(page, predicate, browserErrors, message, serverOutput) {
  try {
    await page.waitForFunction(predicate, undefined, { timeout: 10_000 })
  } catch (error) {
    assert.fail(
      `${message}.\n${browserErrors.join("\n")}\n${String(error)}\nDev server:\n${serverOutput()}`,
    )
  }
}

function resolvePnpmStorePackageEntry(name) {
  const store = join(repoRoot, "node_modules/.pnpm")
  const directoryPrefix = `${name.replace("/", "+")}@`
  const directory = readdirSync(store).find((entry) => entry.startsWith(directoryPrefix))
  assert.ok(directory, `Missing ${name} from the pnpm virtual store`)
  const packageRoot = realpathSync(join(store, directory, "node_modules", name))
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
  const entry = manifest.exports?.["."]?.import ?? manifest.module ?? manifest.main
  assert.equal(typeof entry, "string", `Missing ESM entry for ${name}`)
  return join(packageRoot, entry)
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

async function waitForListening(host, port, child, output) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Node host exited before it became ready.\n${output()}`)
    }
    if (await canConnect(host, port)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${host}:${port}.\n${output()}`)
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
  })
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
