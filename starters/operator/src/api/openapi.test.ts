import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { type OpenApiDocument, selectSurface } from "@voyant-travel/hono/openapi"
import { describe, expect, it } from "vitest"
import { buildOperatorOpenApiDocuments, mergeOperatorOpenApiModuleDocuments } from "./openapi.js"

/**
 * OpenAPI drift gate for the operator deployment (voyant#2733, was #2114).
 *
 * Specs are generated per module from each module's own routes. Selected graph
 * manifests and package route registries are authoritative for opted-in
 * bundles; the compact files under
 * `openapi/{admin,storefront}/<module>.json` are committed, browsable render
 * artifacts and compatibility snapshots. Regenerating from the composed app
 * must reproduce them exactly (added/changed/removed routes fail CI). The
 * multi-megabyte aggregates (`openapi/framework-*.json`) are NOT committed —
 * they're generated on demand, so git never carries a 7 MB file no tool can
 * render, and the deployment composes the aggregate only if it wants it.
 *
 * To update after an intentional route change:
 *   pnpm --filter operator generate:openapi
 * (runs this file with `UPDATE_OPENAPI=1`, rewriting the artifacts).
 */
const OUT_DIR = join(process.cwd(), "openapi")
const REPO_ROOT = resolve(process.cwd(), "../..")
const PACKAGE_OPENAPI_ROOTS = new Map([
  ["action-ledger", join(REPO_ROOT, "packages/action-ledger/openapi")],
  ["distribution", join(REPO_ROOT, "packages/distribution/openapi")],
  ["external-refs", join(REPO_ROOT, "packages/distribution/openapi")],
  ["mice", join(REPO_ROOT, "packages/mice/openapi")],
  ["operations", join(REPO_ROOT, "packages/operations/openapi")],
  ["operator-settings", join(REPO_ROOT, "packages/operator-settings/openapi")],
  ["relationships", join(REPO_ROOT, "packages/relationships/openapi")],
  ["storage-media", join(REPO_ROOT, "packages/storage/openapi")],
  ["storage-uploads", join(REPO_ROOT, "packages/storage/openapi")],
  ["storage-video-upload-ticket", join(REPO_ROOT, "packages/storage/openapi")],
  ["storefront", join(REPO_ROOT, "packages/storefront/openapi")],
  ["customer-portal", join(REPO_ROOT, "packages/storefront/openapi")],
  ["payment-link", join(REPO_ROOT, "packages/storefront/openapi")],
  ["storefront-verification", join(REPO_ROOT, "packages/storefront/openapi")],
  ["suppliers", join(REPO_ROOT, "packages/distribution/openapi")],
  ["workflow-runs", join(REPO_ROOT, "packages/workflow-runs/openapi")],
])
const docs = await buildOperatorOpenApiDocuments()
const serialize = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`

/** The aggregate artifacts — generated on demand, gitignored. */
const aggregates = {
  "framework-openapi.json": docs.full,
  "framework-admin.json": docs.admin,
  "framework-storefront.json": docs.storefront,
}

/** The committed per-module surface files, keyed by their path under `openapi/`. */
const perModule: Record<string, unknown> = {}
for (const [moduleName, doc] of docs.modules) {
  const admin = selectSurface(doc, "admin")
  if (Object.keys(admin.paths ?? {}).length > 0) perModule[`admin/${moduleName}.json`] = admin
  const storefront = selectSurface(doc, "storefront")
  if (Object.keys(storefront.paths ?? {}).length > 0)
    perModule[`storefront/${moduleName}.json`] = storefront
}

if (process.env.UPDATE_OPENAPI) {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, doc] of Object.entries(aggregates)) {
    writeFileSync(join(OUT_DIR, name), serialize(doc))
  }
  // Rewrite the committed per-module dirs from scratch so a removed module drops
  // its stale file instead of lingering.
  for (const surface of ["admin", "storefront"]) {
    rmSync(join(OUT_DIR, surface), { recursive: true, force: true })
    mkdirSync(join(OUT_DIR, surface), { recursive: true })
  }
  for (const [name, doc] of Object.entries(perModule)) {
    const file = committedArtifactPath(name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, serialize(doc))
  }
}

/** List committed `openapi/{admin,storefront}/*.json` relative paths. */
function committedPerModuleFiles(): string[] {
  const out: string[] = []
  for (const surface of ["admin", "storefront"]) {
    let entries: string[]
    try {
      entries = readdirSync(join(OUT_DIR, surface))
    } catch {
      continue
    }
    for (const entry of entries) if (entry.endsWith(".json")) out.push(`${surface}/${entry}`)
  }
  for (const [document, root] of PACKAGE_OPENAPI_ROOTS) {
    for (const surface of ["admin", "storefront"]) {
      if (existsSync(join(root, surface, `${document}.json`))) {
        out.push(`${surface}/${document}.json`)
      }
    }
  }
  return out.sort()
}

function committedArtifactPath(name: string): string {
  const document = name.replace(/^.*\//, "").replace(/\.json$/, "")
  return join(PACKAGE_OPENAPI_ROOTS.get(document) ?? OUT_DIR, name)
}

describe("operator openapi spec", () => {
  it("is generated as a 3.1.0 document", () => {
    expect(docs.full.openapi).toBe("3.1.0")
  })

  it("documents routes under their composed surface prefix", () => {
    for (const p of Object.keys(docs.admin.paths ?? {})) {
      expect(p.startsWith("/v1/admin")).toBe(true)
    }
    for (const p of Object.keys(docs.storefront.paths ?? {})) {
      expect(p.startsWith("/v1/public")).toBe(true)
    }
  })

  it("emits at least one per-module document", () => {
    expect(Object.keys(perModule).length).toBeGreaterThan(0)
  })

  it.each([
    ["action-ledger", "@voyant-travel/action-ledger#api.admin", "@voyant-travel/action-ledger"],
    ["identity", "@voyant-travel/identity#api.admin", "@voyant-travel/identity"],
    ["distribution", "@voyant-travel/distribution#api", "@voyant-travel/distribution"],
    ["mice", "@voyant-travel/mice#api.admin", "@voyant-travel/mice"],
    ["notifications", "@voyant-travel/notifications#api.admin", "@voyant-travel/notifications"],
    [
      "finance",
      ["@voyant-travel/finance#api.admin", "@voyant-travel/finance#api.public"],
      "@voyant-travel/finance",
    ],
    [
      "legal",
      ["@voyant-travel/legal#api.admin", "@voyant-travel/legal#api.public"],
      "@voyant-travel/legal",
    ],
    [
      "trips",
      ["@voyant-travel/trips#api.admin", "@voyant-travel/trips#api.public"],
      "@voyant-travel/trips",
    ],
    ["relationships", "@voyant-travel/relationships#api.admin", "@voyant-travel/relationships"],
  ])("emits %s from its exact selected graph API authority", (document, apiIds, packageName) => {
    const selectedDocument = docs.modules.get(document)
    const operations = Object.values(selectedDocument?.paths ?? {}).flatMap((pathItem) =>
      Object.values(pathItem ?? {}).filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null && "responses" in value,
      ),
    )

    expect(operations.length).toBeGreaterThan(0)
    expect(new Set(operations.map((operation) => operation["x-voyant-api-id"]))).toEqual(
      new Set(Array.isArray(apiIds) ? apiIds : [apiIds]),
    )
    expect(
      operations.every(
        (operation) =>
          operation["x-voyant-unit-id"] === packageName &&
          operation["x-voyant-package-name"] === packageName,
      ),
    ).toBe(true)
  })

  it("keeps every module path in exactly one Scalar-discoverable document", () => {
    const owners = new Map<string, string>()
    for (const [document, moduleDoc] of docs.modules) {
      for (const path of Object.keys(moduleDoc.paths ?? {})) {
        expect(
          owners.get(path),
          `${path} appears in ${owners.get(path)} and ${document}`,
        ).toBeUndefined()
        owners.set(path, document)
      }
    }
  })

  it("rejects graph drift while replacing compatibility path ownership", () => {
    const operation = { operationId: "getAdminIdentity", responses: { 200: { description: "OK" } } }
    const compatibility = new Map([
      [
        "identity",
        {
          openapi: "3.1.0",
          info: { title: "x", version: "1" },
          paths: { "/v1/admin/identity": { get: operation } },
        },
      ],
      [
        "bookings",
        {
          openapi: "3.1.0",
          info: { title: "x", version: "1" },
          paths: { "/v1/admin/bookings": { get: operation } },
        },
      ],
    ]) as never
    const graphIdentity: OpenApiDocument = {
      openapi: "3.1.0",
      info: { title: "x", version: "1" },
      paths: {
        "/v1/admin/identity": {
          get: {
            ...operation,
            "x-voyant-api-id": "@voyant-travel/identity#api.admin",
            "x-voyant-unit-id": "@voyant-travel/identity",
            "x-voyant-package-name": "@voyant-travel/identity",
          },
        },
      },
    } as OpenApiDocument
    const identityPath = graphIdentity.paths?.["/v1/admin/identity"]
    if (!identityPath) throw new Error("expected identity fixture path")

    expect(
      mergeOperatorOpenApiModuleDocuments(compatibility, new Map([["identity", graphIdentity]])),
    ).toHaveProperty("size", 2)
    const migrated = mergeOperatorOpenApiModuleDocuments(
      compatibility,
      new Map([
        [
          "other",
          {
            ...graphIdentity,
            paths: { "/v1/admin/bookings": identityPath },
          } as never,
        ],
      ]),
    )
    expect(migrated.has("bookings")).toBe(false)
    expect(migrated.get("other")?.paths).toHaveProperty("/v1/admin/bookings")
    expect(() =>
      mergeOperatorOpenApiModuleDocuments(
        compatibility,
        new Map([
          ["first", graphIdentity],
          ["second", graphIdentity],
        ]),
      ),
    ).toThrow(/owned by both/)
    expect(() =>
      mergeOperatorOpenApiModuleDocuments(
        compatibility,
        new Map([["identity", { ...graphIdentity, paths: {} } as never]]),
      ),
    ).toThrow(/does not preserve/)
  })

  it("keeps every per-module path within the aggregate (no invented routes)", () => {
    const fullPaths = new Set(Object.keys(docs.full.paths ?? {}))
    for (const [name, doc] of Object.entries(perModule)) {
      for (const p of Object.keys((doc as { paths?: object }).paths ?? {})) {
        expect(
          fullPaths.has(p),
          `${name} contributes a path missing from the aggregate: ${p}`,
        ).toBe(true)
      }
    }
  })

  it("covers every admin/storefront path (nothing dropped, incl. workflow-runs)", () => {
    const covered = new Set<string>()
    for (const doc of Object.values(perModule)) {
      for (const p of Object.keys((doc as { paths?: object }).paths ?? {})) covered.add(p)
    }
    const surfacePaths = Object.keys(docs.full.paths ?? {}).filter(
      (p) => p.startsWith("/v1/admin/") || p.startsWith("/v1/public/"),
    )
    const missing = surfacePaths.filter((p) => !covered.has(p))
    expect(
      missing,
      `surface paths missing from every per-module doc: ${missing.join(", ")}`,
    ).toEqual([])
  })

  it("has no stale or missing committed per-module files", () => {
    expect(committedPerModuleFiles()).toEqual(Object.keys(perModule).sort())
  })

  for (const [name, doc] of Object.entries(perModule)) {
    it(`${name} matches the committed artifact (no drift)`, () => {
      let committed: string
      try {
        committed = readFileSync(committedArtifactPath(name), "utf8")
      } catch {
        throw new Error(
          `${name} is missing — run \`pnpm --filter operator generate:openapi\` and commit it.`,
        )
      }
      expect(
        serialize(doc),
        `${name} is out of date — run \`pnpm --filter operator generate:openapi\` and commit the result.`,
      ).toBe(committed)
    })
  }
})
