import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checkerPath = path.join(repoRoot, "scripts/check-deployment-graph-openapi-coverage.mjs")

async function createFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-graph-openapi-coverage-"))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
  return root
}

function graph(units) {
  return `${JSON.stringify({ schemaVersion: "voyant.resolved-graph.v1", modules: units }, null, 2)}\n`
}

function openapi(paths) {
  return `${JSON.stringify({ openapi: "3.1.0", info: { title: "fixture", version: "0" }, paths }, null, 2)}\n`
}

async function runChecker(cwd, extraArgs = []) {
  return execFileAsync(
    process.execPath,
    [
      checkerPath,
      "--graph",
      "graph.json",
      "--openapi-dir",
      "openapi",
      "--no-default-allowlist",
      ...extraArgs,
    ],
    { cwd },
  )
}

describe("check-deployment-graph-openapi-coverage", () => {
  it("passes when a graph API bundle has a matching documented surface/module path", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/bookings",
          localId: "bookings",
          packageName: "@voyant-travel/bookings",
          api: [
            {
              id: "@voyant-travel/bookings#api",
              surface: "admin",
              mount: "@voyant-travel/bookings",
            },
          ],
        },
      ]),
      "openapi/admin/bookings.json": openapi({
        "/v1/admin/bookings": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "bookings",
            "x-voyant-surface": "admin",
          },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /check-deployment-graph-openapi-coverage: OK/)
    assert.match(result.stdout, /1 covered graph API bundles/)
  })

  it("normalizes graph public surface to the storefront OpenAPI surface", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/operator#charters",
          localId: "operator.charters",
          packageName: "@voyant-travel/operator",
          api: [
            {
              id: "@voyant-travel/operator#charters.api.public",
              surface: "public",
              mount: "operator/charters",
            },
          ],
        },
      ]),
      "openapi/storefront/charters.json": openapi({
        "/v1/public/charters": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "charters",
            "x-voyant-surface": "storefront",
          },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /1 covered graph API bundles/)
  })

  it("falls back to the OpenAPI file surface and module when operation metadata is absent", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/finance",
          localId: "finance",
          packageName: "@voyant-travel/finance",
          api: [
            {
              id: "@voyant-travel/finance#api",
              surface: "admin",
              mount: "@voyant-travel/finance",
            },
          ],
        },
      ]),
      "openapi/admin/finance.json": openapi({
        "/v1/admin/finance": {
          post: {
            responses: { 200: { description: "OK" } },
          },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /1 covered graph API bundles/)
  })

  it("fails for a new graph API bundle without matching documented paths", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/quotes",
          localId: "quotes",
          packageName: "@voyant-travel/quotes",
          api: [
            {
              id: "@voyant-travel/quotes#api",
              surface: "admin",
              mount: "@voyant-travel/quotes",
            },
          ],
        },
      ]),
      "openapi/admin/bookings.json": openapi({
        "/v1/admin/bookings": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "bookings",
            "x-voyant-surface": "admin",
          },
        },
      }),
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /Deployment graph OpenAPI coverage failed/)
      assert.match(error.stderr, /deployment-graph-openapi-coverage:missing-docs/)
      assert.match(error.stderr, /@voyant-travel\/quotes#api/)
      return true
    })
  })

  it("reports an allowlisted missing bundle as a warning without failing", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/flights",
          localId: "flights",
          packageName: "@voyant-travel/flights",
          api: [
            {
              id: "@voyant-travel/flights#api",
              surface: "admin",
              mount: "@voyant-travel/flights",
            },
          ],
        },
      ]),
      "openapi/admin/bookings.json": openapi({
        "/v1/admin/bookings": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "bookings",
            "x-voyant-surface": "admin",
          },
        },
      }),
      "allowlist.json": JSON.stringify(
        {
          "@voyant-travel/flights#api": "fixture gap",
        },
        null,
        2,
      ),
    })

    const result = await runChecker(root, ["--allowlist", "allowlist.json"])

    assert.match(result.stderr, /Deployment graph OpenAPI coverage warnings/)
    assert.match(result.stderr, /deployment-graph-openapi-coverage:allowlisted-gap/)
    assert.match(result.stdout, /0 covered graph API bundles, 1 allowlisted gaps/)
  })

  it("fails stale allowlist entries once coverage exists", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/flights",
          localId: "flights",
          packageName: "@voyant-travel/flights",
          api: [
            {
              id: "@voyant-travel/flights#api",
              surface: "admin",
              mount: "@voyant-travel/flights",
            },
          ],
        },
      ]),
      "openapi/admin/flights.json": openapi({
        "/v1/admin/flights": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "flights",
            "x-voyant-surface": "admin",
          },
        },
      }),
      "allowlist.json": JSON.stringify(
        {
          "@voyant-travel/flights#api": "fixture gap",
        },
        null,
        2,
      ),
    })

    await assert.rejects(runChecker(root, ["--allowlist", "allowlist.json"]), (error) => {
      assert.match(error.stderr, /deployment-graph-openapi-coverage:stale-allowlist/)
      return true
    })
  })
})
