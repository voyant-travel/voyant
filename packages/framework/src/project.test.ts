import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import type { VoyantGraphRuntime } from "./deployment-artifacts.js"
import { canonicalJson } from "./deployment-graph.js"
import { defineProject, resolveProject } from "./project.js"
import { runtimeReferencePackageNames } from "./project-resolver.js"
import { composeVoyantGraphRuntime } from "./runtime-composition.js"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  delete (globalThis as Record<string, unknown>).__voyantManifestLoaded
})

describe("framework project resolver", () => {
  it("matches the CLI contract with one deterministic target-neutral graph hash", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/loyalty"))}\n`,
    })
    const project = defineProject({
      modules: [
        {
          resolve: "@acme/loyalty",
          config: { tiers: ["silver", "gold"] },
        },
      ],
      deployment: {
        target: "node",
        mode: "self-hosted",
        providers: { database: "postgres" },
      },
    })

    const first = await resolve(root, project)
    const second = await resolve(root, project)
    const { contentHash: _contentHash, ...withoutHash } = first.graph
    const expectedHash = `sha256:${createHash("sha256")
      .update(canonicalJson(withoutHash))
      .digest("hex")}`

    expect(first).toEqual(second)
    expect(first.graph.contentHash).toBe(expectedHash)
    expect(first.graph.deployment).toEqual({
      mode: "self-hosted",
      providers: { database: "postgres" },
    })
    expect(first.graph.deployment).not.toHaveProperty("target")
    expect(first.artifacts.runtimeEntry).toBe("runtime/project-runtime.generated.ts")
    expect(first.artifacts.migrationRunner).toBe("runtime/project-migrations.generated.mjs")
    expect(first.artifacts.files.map((file) => file.path)).toEqual([
      "admin/project-admin.generated.ts",
      "runtime/project-api.generated.ts",
      "runtime/project-migrations.generated.mjs",
      "runtime/project-runtime.generated.ts",
    ])
    const runtimeSource = first.artifacts.files.find(
      (file) => file.path === first.artifacts.runtimeEntry,
    )?.contents
    expect(runtimeSource).toContain(expectedHash)
    expect(runtimeSource).toContain('GENERATED_PROJECT_RUNTIME_KIND = "application"')
    expect(runtimeSource).toContain('"database": "postgres"')
    expect(runtimeSource).not.toContain('"target"')
    expect(first.artifacts.migrationPlan).toEqual({
      schemaVersion: "voyant.migration-plan.v1",
      contentHash: expectedHash,
      migrations: [
        {
          id: "@acme/loyalty#migrations",
          idempotencyKey: "schema:@acme/loyalty#migrations",
          migrationKind: "schema",
          order: 0,
          owner: "@acme/loyalty",
          packageName: "@acme/loyalty",
          source: {
            kind: "package",
            packageName: "@acme/loyalty",
            path: "./migrations",
          },
        },
      ],
    })
    const migrationSource = first.artifacts.files.find(
      (file) => file.path === first.artifacts.migrationRunner,
    )?.contents
    expect(migrationSource).toContain(expectedHash)
    expect(migrationSource).toContain("runVoyantMigrations")
  })

  it("orders setup migrations after every schema migration and emits admitted static loaders", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@acme/loyalty"),
        setupMigrations: [
          {
            id: "@acme/loyalty#setup.a-finalize.v1",
            source: "@acme/loyalty/setup",
            runtime: { entry: "@acme/loyalty/setup", export: "finalizeLoyalty" },
            dependsOn: ["@acme/loyalty#setup.z-backfill.v1"],
          },
          {
            id: "@acme/loyalty#setup.z-backfill.v1",
            source: "@acme/loyalty/setup",
            runtime: { entry: "@acme/loyalty/setup", export: "backfillLoyalty" },
            dependsOn: ["@acme/loyalty#migrations"],
          },
        ],
      })}\n`,
      extraExports: { "./setup": "./setup.mjs" },
    })
    writeFileSync(
      path.join(root, "node_modules", "@acme", "loyalty", "setup.mjs"),
      "export async function backfillLoyalty() {}\nexport async function finalizeLoyalty() {}\n",
    )

    const resolution = await resolve(root, defineProject({ modules: ["@acme/loyalty"] }))

    expect(resolution.artifacts.migrationPlan.migrations).toEqual([
      expect.objectContaining({
        id: "@acme/loyalty#migrations",
        migrationKind: "schema",
        order: 0,
      }),
      expect.objectContaining({
        id: "@acme/loyalty#setup.z-backfill.v1",
        migrationKind: "setup",
        order: 1,
        idempotencyKey: "setup:@acme/loyalty#setup.z-backfill.v1",
        runtime: { entry: "@acme/loyalty/setup", export: "backfillLoyalty" },
      }),
      expect.objectContaining({
        id: "@acme/loyalty#setup.a-finalize.v1",
        migrationKind: "setup",
        order: 2,
        idempotencyKey: "setup:@acme/loyalty#setup.a-finalize.v1",
        runtime: { entry: "@acme/loyalty/setup", export: "finalizeLoyalty" },
      }),
    ])
    const runner = resolution.artifacts.files.find(
      (file) => file.path === resolution.artifacts.migrationRunner,
    )
    expect(runner?.contents).toContain('"@acme/loyalty#setup.z-backfill.v1": async () => {')
    expect(runner?.contents).toContain('import("@acme/loyalty/setup")')
  })

  it("includes deployment-owned migration folders after package schema migrations", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/loyalty"))}\n`,
    })

    const resolution = await resolve(
      root,
      defineProject({
        modules: ["@acme/loyalty"],
        deployment: {
          migrations: [{ id: "deployment", source: "./migrations" }],
        },
      }),
    )

    expect(resolution.graph.deployment.migrations).toEqual([
      { id: "deployment", source: "./migrations" },
    ])
    expect(resolution.artifacts.migrationPlan.migrations).toEqual([
      expect.objectContaining({
        id: "@acme/loyalty#migrations",
        migrationKind: "schema",
        order: 0,
        source: {
          kind: "package",
          packageName: "@acme/loyalty",
          path: "./migrations",
        },
      }),
      {
        id: "deployment",
        migrationKind: "schema",
        order: 1,
        idempotencyKey: "schema:deployment",
        owner: "deployment",
        source: { kind: "deployment", path: "./migrations" },
      },
    ])
  })

  it("topologically orders package migrations from voyant.requiresSchemas", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/a-dependent",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/a-dependent"))}\n`,
      voyant: packageMetadata({ requiresSchemas: ["@acme/z-foundation"] }),
    })
    writePackage(root, {
      name: "@acme/z-foundation",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/z-foundation"))}\n`,
      voyant: packageMetadata(),
    })

    const resolution = await resolve(
      root,
      defineProject({ modules: ["@acme/a-dependent", "@acme/z-foundation"] }),
    )

    expect(resolution.artifacts.migrationPlan.migrations.map((migration) => migration.id)).toEqual([
      "@acme/z-foundation#migrations",
      "@acme/a-dependent#migrations",
    ])
    expect(
      resolution.graph.packageRecords.find((record) => record.packageName === "@acme/a-dependent")
        ?.metadata?.requiresSchemas,
    ).toEqual(["@acme/z-foundation"])
  })

  it("rejects non-Node application runtime targets", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/loyalty"))}\n`,
    })
    const project = defineProject({ modules: ["@acme/loyalty"] })

    await expect(
      resolve(root, {
        ...project,
        deployment: { target: "cloudflare-worker" },
      }),
    ).rejects.toThrow("unified application deployment target must be node")
  })

  it("loads string and object selections from package-owned ./voyant exports", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/suite",
      manifest: `
export const loyalty = ${JSON.stringify(moduleManifest("@acme/suite#loyalty"))}
export const audit = ${JSON.stringify(pluginManifest("@acme/suite#audit"))}
`,
    })

    const resolution = await resolve(
      root,
      defineProject({
        modules: [{ resolve: "@acme/suite#loyalty", config: { enabled: true } }],
        plugins: ["@acme/suite#audit"],
      }),
    )

    expect(resolution.graph.modules.map((unit) => unit.id)).toEqual(["@acme/suite#loyalty"])
    expect(resolution.graph.plugins.map((unit) => unit.id)).toEqual(["@acme/suite#audit"])
    expect(resolution.graph.packageRecords).toHaveLength(1)
    expect(resolution.graph.packageRecords[0]).toMatchObject({
      packageName: "@acme/suite",
      metadata: { manifest: "./voyant" },
    })
  })

  it("rejects stale and invalid package selections", async () => {
    const staleRoot = projectRoot()
    writePackage(staleRoot, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify(moduleManifest("@acme/renamed"))}\n`,
    })
    await expect(resolve(staleRoot, defineProject({ modules: ["@acme/loyalty"] }))).rejects.toThrow(
      /does not declare any selected unit|resolved graph contains 1 error diagnostic/,
    )

    const invalidRoot = projectRoot()
    writePackage(invalidRoot, {
      name: "@acme/invalid",
      manifest: "export default {}\n",
      voyant: null,
    })
    await expect(
      resolve(invalidRoot, defineProject({ modules: ["@acme/invalid"] })),
    ).rejects.toThrow(/must declare package\.json#voyant/)
  })

  it("does not import a package manifest before compatibility admission", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/cloud-only",
      manifest: `
globalThis.__voyantManifestLoaded = true
export default ${JSON.stringify(moduleManifest("@acme/cloud-only"))}
`,
      compatibleWith: { modes: ["managed-cloud"] },
    })

    await expect(
      resolve(
        root,
        defineProject({
          modules: ["@acme/cloud-only"],
          deployment: { mode: "self-hosted" },
        }),
      ),
    ).rejects.toThrow(/VOYANT_GRAPH_PACKAGE_INCOMPATIBLE/)
    expect((globalThis as Record<string, unknown>).__voyantManifestLoaded).toBeUndefined()
  })

  it("admits packages referenced by lowered runtime facets before emitting importers", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@acme/loyalty"),
        admin: {
          routes: [
            {
              id: "@acme/loyalty#admin.members",
              path: "/members",
              runtime: { entry: "@acme/loyalty-react/admin", export: "membersRoute" },
            },
          ],
        },
      })}\n`,
    })
    writePackage(root, {
      name: "@acme/loyalty-react",
      manifest: "",
      voyant: null,
      extraExports: { "./admin": "./admin.mjs" },
    })
    writeFileSync(
      path.join(root, "node_modules", "@acme", "loyalty-react", "admin.mjs"),
      "export const membersRoute = {}\n",
    )

    const resolution = await resolve(root, defineProject({ modules: ["@acme/loyalty"] }))

    expect(resolution.graph.packageRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "@acme/loyalty-react",
          version: "1.2.3",
          source: { kind: "registry", reference: "@acme/loyalty-react" },
          metadata: expect.objectContaining({
            kind: "library",
            compatibleWith: {
              framework: "*",
              targets: ["node"],
              modes: ["local", "managed-cloud", "self-hosted"],
            },
          }),
        }),
      ]),
    )
    const runtimeSource = resolution.artifacts.files.find(
      (file) => file.path === resolution.artifacts.runtimeEntry,
    )?.contents
    expect(runtimeSource).toContain(
      '"@acme/loyalty-react/admin": () => import("@acme/loyalty-react/admin")',
    )
  })

  it("rejects incompatible runtime-only packages before emitting importers", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@acme/loyalty"),
        tools: [
          {
            id: "@acme/loyalty#tool.list-members",
            name: "list_members",
            description: "List loyalty members",
            runtime: { entry: "@acme/loyalty-tools/runtime", export: "listMembers" },
          },
        ],
      })}\n`,
    })
    writePackage(root, {
      name: "@acme/loyalty-tools",
      manifest: "",
      voyant: {
        schemaVersion: "voyant.package.v1",
        kind: "library",
        compatibleWith: { modes: ["managed-cloud"] },
      },
      extraExports: { "./runtime": "./runtime.mjs" },
    })

    await expect(
      resolve(
        root,
        defineProject({
          modules: ["@acme/loyalty"],
          deployment: { mode: "self-hosted" },
        }),
      ),
    ).rejects.toThrow(/VOYANT_GRAPH_PACKAGE_INCOMPATIBLE.*@acme\/loyalty-tools/s)
  })

  it("materializes external unit runtime packages in the runtime reference closure", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@acme/loyalty"),
        runtime: {
          entry: "@acme/loyalty-runtime/factory",
          export: "createLoyaltyModule",
        },
      })}\n`,
    })
    writePackage(root, {
      name: "@acme/loyalty-runtime",
      manifest: "",
      voyant: null,
      extraExports: { "./factory": "./factory.mjs" },
    })

    const resolution = await resolve(root, defineProject({ modules: ["@acme/loyalty"] }))

    expect(runtimeReferencePackageNames(resolution.graph.modules)).toEqual([
      "@acme/loyalty-runtime",
    ])
    expect(
      resolution.artifacts.files.find((file) => file.path === resolution.artifacts.runtimeEntry)
        ?.contents,
    ).toContain('"@acme/loyalty-runtime/factory": () => import("@acme/loyalty-runtime/factory")')
  })

  it("rejects runtime subpaths that are absent from the referenced package exports", async () => {
    const root = projectRoot()
    writePackage(root, {
      name: "@acme/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@acme/loyalty"),
        admin: {
          copy: [
            {
              id: "@acme/loyalty#copy.admin",
              namespace: "loyalty",
              runtime: { entry: "@acme/loyalty-react/i18n", export: "copy" },
            },
          ],
        },
      })}\n`,
    })
    writePackage(root, {
      name: "@acme/loyalty-react",
      manifest: "",
      voyant: null,
      extraExports: { ".": "./index.mjs" },
    })

    await expect(resolve(root, defineProject({ modules: ["@acme/loyalty"] }))).rejects.toThrow(
      "VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED: resolveProject: runtime entry @acme/loyalty-react/i18n resolves to @acme/loyalty-react, which does not export ./i18n.",
    )
  })

  it("loads project-relative manifests and lowers their runtime exports beneath .voyant", async () => {
    const root = projectRoot()
    const localDirectory = path.join(root, "src", "modules", "loyalty")
    writePackageAt(localDirectory, {
      name: "@fixture/loyalty",
      manifest: `export default ${JSON.stringify({
        ...moduleManifest("@fixture/loyalty", { runtimeEntry: "./runtime" }),
        runtime: { entry: "./module-runtime", export: "createLoyaltyModule" },
        tools: [
          {
            id: "@fixture/loyalty#tool.members",
            name: "list_members",
            description: "List members",
            runtime: { entry: "./tools", export: "listMembers" },
          },
        ],
      })}\n`,
      extraExports: {
        "./module-runtime": "./module-runtime.mjs",
        "./runtime": "./runtime.mjs",
        "./tools": "./tools.mjs",
      },
    })
    writeFileSync(
      path.join(localDirectory, "module-runtime.mjs"),
      "export const createLoyaltyModule = () => ({})\n",
    )
    writeFileSync(path.join(localDirectory, "runtime.mjs"), "export const routes = {}\n")
    writeFileSync(path.join(localDirectory, "tools.mjs"), "export const listMembers = {}\n")

    const resolution = await resolve(root, defineProject({ modules: ["./src/modules/loyalty"] }))
    const runtimeSource =
      resolution.artifacts.files.find((file) => file.path === resolution.artifacts.runtimeEntry)
        ?.contents ?? ""

    expect(resolution.graph.modules[0]).toMatchObject({
      id: "@fixture/loyalty",
      packageName: "@fixture/loyalty",
    })
    expect(resolution.graph.packageRecords[0]?.source).toEqual({
      kind: "file",
      reference: "./src/modules/loyalty",
    })
    expect(runtimeSource).toContain(
      '"../../src/modules/loyalty/module-runtime.mjs": () => import("../../src/modules/loyalty/module-runtime.mjs")',
    )
    expect(runtimeSource).toContain(
      '"../../src/modules/loyalty/runtime.mjs": () => import("../../src/modules/loyalty/runtime.mjs")',
    )
    expect(runtimeSource).toContain(
      '"../../src/modules/loyalty/tools.mjs": () => import("../../src/modules/loyalty/tools.mjs")',
    )
    expect(runtimeSource).not.toContain(root)
    expect(runtimeSource).not.toContain("starters/")
  })

  it("lowers index-only project modules with deterministic ids, ownership, and imports", async () => {
    const root = projectRoot()
    writeProjectModule(root, "zeta", 'export default { module: { name: "zeta" } }\n')
    writeProjectModule(root, "alpha", 'export default { module: { name: "alpha" } }\n')

    const first = await resolve(root, defineProject({ modules: [] }))
    const second = await resolve(root, defineProject({ modules: [] }))

    expect(first.graph.contentHash).toBe(second.graph.contentHash)
    expect(first.graph.modules.map((unit) => unit.id)).toEqual([
      "npm/fixture#alpha",
      "npm/fixture#zeta",
    ])
    expect(first.graph.modules.map((unit) => unit.runtime)).toEqual([
      { entry: "./src/modules/alpha/index.ts", export: "default" },
      { entry: "./src/modules/zeta/index.ts", export: "default" },
    ])
    expect(first.graph.packageRecords).toContainEqual(
      expect.objectContaining({
        packageName: "fixture",
        source: { kind: "file", reference: "." },
      }),
    )
    expect(first.conventions.contributions.filter(({ kind }) => kind === "module")).toEqual([
      {
        id: "project.module.alpha",
        kind: "module",
        sourcePath: "src/modules/alpha/index.ts",
      },
      {
        id: "project.module.zeta",
        kind: "module",
        sourcePath: "src/modules/zeta/index.ts",
      },
    ])
    const runtimeSource = first.artifacts.files.find(
      (file) => file.path === first.artifacts.runtimeEntry,
    )?.contents
    expect(runtimeSource).toContain(
      '"../../src/modules/alpha/index.ts": () => import("../../src/modules/alpha/index.ts")',
    )
    expect(runtimeSource).not.toContain(`${root}/src/modules`)
  })

  it("composes an actual index-only project module without nested package metadata", async () => {
    const root = projectRoot()
    const scope = path.join(root, "node_modules", "@voyant-travel")
    mkdirSync(scope, { recursive: true })
    symlinkSync(fileURLToPath(new URL("..", import.meta.url)), path.join(scope, "framework"), "dir")
    writeProjectModule(root, "concierge", 'export default { module: { name: "concierge" } }\n')
    const resolution = await resolve(root, defineProject({ modules: [] }))
    const runtimeFile = resolution.artifacts.files.find(
      (file) => file.path === resolution.artifacts.runtimeEntry,
    )
    expect(runtimeFile).toBeDefined()
    const outputPath = path.join(root, ".voyant", resolution.artifacts.runtimeEntry)
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, runtimeFile!.contents)

    const generated = (await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`)) as {
      createGeneratedProjectRuntime: () => { graphRuntime: VoyantGraphRuntime }
    }
    const composed = await composeVoyantGraphRuntime({
      runtime: generated.createGeneratedProjectRuntime().graphRuntime,
      capabilities: {},
    })

    expect(composed.modules.map((module) => module.module.name)).toEqual(["concierge"])
  })

  it("compiles project API and admin conventions into the resolved graph artifacts", async () => {
    const root = projectRoot()
    writeFile(
      root,
      "src/api/admin/health/route.ts",
      "export const GET = (c: { json(value: unknown): unknown }) => c.json({ ok: true })\n",
    )
    writeFile(root, "src/admin/dashboard/index.tsx", 'export default { id: "project.dashboard" }\n')

    const resolution = await resolve(root, defineProject({ modules: [] }))
    const projectApi = resolution.graph.modules.find(({ localId }) => localId === "project-api")

    expect(projectApi).toMatchObject({
      id: "npm/fixture#project-api",
      packageName: "fixture",
      api: [
        {
          id: "project.api.admin.health",
          methods: ["GET"],
          mount: "/health",
          surface: "admin",
          runtime: {
            entry: "./.voyant/runtime/project-api.generated.ts",
            export: "projectApiHonoModule",
          },
        },
      ],
    })
    expect(resolution.graph.packageRecords).toContainEqual(
      expect.objectContaining({
        packageName: "fixture",
        source: { kind: "file", reference: "." },
      }),
    )
    expect(
      resolution.artifacts.files.find(({ path }) => path === "runtime/project-api.generated.ts")
        ?.contents,
    ).toContain('import * as route0 from "../../src/api/admin/health/route.js"')
    expect(
      resolution.artifacts.files.find(({ path }) => path === "admin/project-admin.generated.ts")
        ?.contents,
    ).toContain('import projectAdminExtension0 from "../../src/admin/dashboard/index.js"')
    expect(
      resolution.artifacts.files.find(({ path }) => path === resolution.artifacts.runtimeEntry)
        ?.contents,
    ).toContain('"./project-api.generated.ts": () => import("./project-api.generated.ts")')
  })

  it("rejects convention diagnostics and config paths outside the project root", async () => {
    const collisionRoot = projectRoot()
    writeFile(collisionRoot, "src/api/admin/members/[id]/route.ts", "export default {}\n")
    writeFile(collisionRoot, "src/api/admin/members/[slug]/route.ts", "export default {}\n")
    await expect(resolve(collisionRoot, defineProject({ modules: [] }))).rejects.toThrow(
      /PROJECT_CONVENTION_ROUTE_COLLISION/,
    )

    const containedRoot = projectRoot()
    await expect(
      resolveProject({
        project: defineProject({ modules: [] }),
        projectRoot: containedRoot,
        configPath: path.join(containedRoot, "..", "voyant.config.mjs"),
      }),
    ).rejects.toThrow(/configPath must stay inside/)
  })
})

function projectRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "voyant-framework-project-"))
  roots.push(root)
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, type: "module" }, null, 2)}\n`,
  )
  writeFileSync(path.join(root, "voyant.config.mjs"), "export default {}\n")
  return root
}

function writeProjectModule(root: string, name: string, source: string): void {
  writeFile(root, `src/modules/${name}/index.ts`, source)
}

function writeFile(root: string, relativePath: string, source: string): void {
  const filePath = path.join(root, relativePath)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, source)
}

async function resolve(root: string, project: unknown) {
  return resolveProject({
    project,
    projectRoot: root,
    configPath: path.join(root, "voyant.config.mjs"),
  })
}

interface WritePackageOptions {
  name: string
  manifest: string
  voyant?: Record<string, unknown> | null
  compatibleWith?: Record<string, unknown>
  extraExports?: Record<string, string>
}

function packageMetadata(options: { requiresSchemas?: string[] } = {}): Record<string, unknown> {
  return {
    schemaVersion: "voyant.package.v1",
    kind: "module",
    manifest: "./voyant",
    schema: "./schema",
    requiresSchemas: options.requiresSchemas ?? [],
  }
}

function writePackage(root: string, options: WritePackageOptions): void {
  writePackageAt(path.join(root, "node_modules", ...options.name.split("/")), options)
}

function writePackageAt(directory: string, options: WritePackageOptions): void {
  mkdirSync(directory, { recursive: true })
  const voyant =
    options.voyant === null
      ? undefined
      : (options.voyant ?? {
          schemaVersion: "voyant.package.v1",
          kind: "module",
          manifest: "./voyant",
          ...(options.compatibleWith ? { compatibleWith: options.compatibleWith } : {}),
        })
  writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        name: options.name,
        version: "1.2.3",
        type: "module",
        exports: { "./voyant": "./voyant.mjs", ...options.extraExports },
        ...(voyant ? { voyant } : {}),
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(path.join(directory, "voyant.mjs"), options.manifest)
}

function moduleManifest(
  id: string,
  options: { runtimeEntry?: string } = {},
): Record<string, unknown> {
  return {
    schemaVersion: "voyant.module.v1",
    id,
    packageName: id.split("#")[0],
    migrations: [{ id: `${id.split("#")[0]}#migrations`, source: "./migrations" }],
    ...(options.runtimeEntry
      ? {
          api: [
            {
              id: `${id}#api.admin`,
              surface: "admin",
              runtime: { entry: options.runtimeEntry, export: "routes" },
            },
          ],
        }
      : {}),
  }
}

function pluginManifest(id: string): Record<string, unknown> {
  return {
    schemaVersion: "voyant.plugin.v1",
    id,
    packageName: id.split("#")[0],
  }
}
