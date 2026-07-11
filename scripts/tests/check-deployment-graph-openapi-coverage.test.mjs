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

function graph(units, extensions = [], plugins = []) {
  return `${JSON.stringify({ schemaVersion: "voyant.resolved-graph.v1", modules: units, extensions, plugins }, null, 2)}\n`
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

  it("emits a stable JSON coverage report", async () => {
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
          get: { responses: { 200: { description: "OK" } } },
        },
      }),
      "allowlist.json": JSON.stringify({ "@voyant-travel/flights#api": "fixture gap" }),
    })

    const result = await runChecker(root, ["--allowlist", "allowlist.json", "--json"])
    const report = JSON.parse(result.stdout)

    assert.equal(report.schemaVersion, "voyant.graph-openapi-coverage-report.v1")
    assert.equal(report.ok, true)
    assert.equal(report.bundles.allowlistedGaps[0].id, "@voyant-travel/flights#api")
    assert.equal(report.bundles.allowlistedGaps[0].reason, "fixture gap")
    assert.deepEqual(report.diagnostics, [])
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

  it("requires an exact API id for opted-in bundles instead of filename heuristics", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/identity",
          localId: "identity",
          packageName: "@voyant-travel/identity",
          api: [
            {
              id: "@voyant-travel/identity#api.admin",
              surface: "admin",
              mount: "identity",
              openapi: { document: "identity" },
            },
          ],
        },
      ]),
      "openapi/admin/identity.json": openapi({
        "/v1/admin/identity": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-module": "identity",
            "x-voyant-surface": "admin",
            "x-voyant-api-id": "@voyant-travel/identity#api.wrong",
          },
        },
      }),
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /deployment-graph-openapi-coverage:missing-docs/)
      assert.match(error.stderr, /@voyant-travel\/identity#api.admin/)
      return true
    })
  })

  it("covers opted-in extension bundles by exact API id", async () => {
    const extension = {
      id: "@acme/identity-extension",
      localId: "identity-extension",
      packageName: "@acme/identity-extension",
      api: [
        {
          id: "@acme/identity-extension#api.admin",
          surface: "admin",
          mount: "identity-extension",
          openapi: { document: "identity-extension" },
        },
      ],
    }
    const root = await createFixture({
      "graph.json": graph([], [extension]),
      "openapi/admin/custom-name.json": openapi({
        "/v1/admin/identity-extension": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-api-id": "@acme/identity-extension#api.admin",
          },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /1 covered graph API bundles/)
  })

  it("covers overlapping opted-in routes only by their exact operation API ids", async () => {
    const uploadsApiId = "@voyant-travel/storage#api.admin.uploads"
    const videoApiId = "@voyant-travel/storage#api.admin.video-upload-ticket"
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/storage",
          localId: "storage",
          packageName: "@voyant-travel/storage",
          api: [
            {
              id: uploadsApiId,
              surface: "admin",
              mount: "uploads",
              openapi: { document: "storage-uploads" },
            },
            {
              id: videoApiId,
              surface: "admin",
              mount: "uploads/video",
              openapi: { document: "storage-video-upload-ticket" },
            },
          ],
        },
      ]),
      "openapi/admin/storage.json": openapi({
        "/v1/admin/uploads": {
          post: {
            responses: { 200: { description: "OK" } },
            "x-voyant-api-id": uploadsApiId,
          },
        },
        "/v1/admin/uploads/video": {
          post: {
            responses: { 200: { description: "OK" } },
            "x-voyant-api-id": videoApiId,
          },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /2 covered graph API bundles/)
  })

  it("covers the final first-party package documents by exact operation API id", async () => {
    const apiIds = {
      accommodations: "@voyant-travel/accommodations#content-extension.api.public",
      flights: "@voyant-travel/flights#api",
      quotes: "@voyant-travel/quotes#proposal-extension.api.public",
    }
    const root = await createFixture({
      "graph.json": graph(
        [
          {
            id: "@voyant-travel/flights",
            localId: "flights",
            packageName: "@voyant-travel/flights",
            api: [
              {
                id: apiIds.flights,
                surface: "admin",
                mount: "flights",
                openapi: { document: "flights" },
              },
            ],
          },
        ],
        [
          {
            id: "@voyant-travel/accommodations#content-extension",
            localId: "accommodations.content-extension",
            packageName: "@voyant-travel/accommodations",
            api: [
              {
                id: apiIds.accommodations,
                surface: "public",
                mount: "accommodations",
                openapi: { document: "accommodations-content-public" },
              },
            ],
          },
          {
            id: "@voyant-travel/quotes#proposal-extension",
            localId: "quotes.proposal-extension",
            packageName: "@voyant-travel/quotes",
            api: [
              {
                id: apiIds.quotes,
                surface: "public",
                mount: "proposals",
                openapi: { document: "quotes-proposal-public" },
              },
            ],
          },
        ],
      ),
      "openapi/admin/flights.json": openapi({
        "/v1/admin/flights/search": {
          post: { responses: { 200: { description: "OK" } }, "x-voyant-api-id": apiIds.flights },
        },
      }),
      "openapi/storefront/accommodations-content-public.json": openapi({
        "/v1/public/accommodations/{id}/content": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-api-id": apiIds.accommodations,
          },
        },
      }),
      "openapi/storefront/quotes-proposal-public.json": openapi({
        "/v1/public/proposals/{quoteVersionId}": {
          get: { responses: { 200: { description: "OK" } }, "x-voyant-api-id": apiIds.quotes },
        },
      }),
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /3 covered graph API bundles, 0 allowlisted gaps/)
  })

  it("rejects allowlist exceptions for opted-in bundles", async () => {
    const root = await createFixture({
      "graph.json": graph([
        {
          id: "@voyant-travel/identity",
          localId: "identity",
          packageName: "@voyant-travel/identity",
          api: [
            {
              id: "@voyant-travel/identity#api.admin",
              surface: "admin",
              openapi: { document: "identity" },
            },
          ],
        },
      ]),
      "openapi/admin/identity.json": openapi({
        "/v1/admin/identity": {
          get: {
            responses: { 200: { description: "OK" } },
            "x-voyant-api-id": "@voyant-travel/identity#api.admin",
          },
        },
      }),
      "allowlist.json": JSON.stringify({
        "@voyant-travel/identity#api.admin": "must not mask migrated authority",
      }),
    })

    await assert.rejects(runChecker(root, ["--allowlist", "allowlist.json"]), (error) => {
      assert.match(error.stderr, /deployment-graph-openapi-coverage:stale-allowlist/)
      return true
    })
  })
})
