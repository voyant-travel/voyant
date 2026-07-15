import { describe, expect, it } from "vitest"

import {
  defineModule,
  defineProject,
  deriveDeploymentRequirements,
  resolveDeploymentGraphWithPackageManifests,
  sha256,
  type VoyantGraphPackageSourceKind,
} from "./deployment-graph.js"
import { DEFAULT_MANAGED_CLOUD_PROVIDERS } from "./deployment-types.js"
import { createProjectMigrationPlan } from "./project.js"
import {
  projectVoyantSelfHostExport,
  VOYANT_MIGRATION_JOURNAL_LINEAGE,
  VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION,
  VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION,
  VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION,
  VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION,
  type VoyantSelfHostExportBundle,
  validateVoyantSelfHostExportBundle,
} from "./self-host-export.js"

const BOM = {
  schemaVersion: "voyant.product-bom-reference.v1",
  id: "@voyant-travel/operator-standard",
  version: "1",
} as const
const ARTIFACT_HASH = `sha256:${"a".repeat(64)}`

describe("Voyant self-host export bundle", () => {
  it("validates the admitted graph, duplicate hash/BOM authority, and restore manifests", async () => {
    const bundle = await exportBundle()

    await expect(validateVoyantSelfHostExportBundle(bundle)).resolves.toEqual({
      ok: true,
      value: bundle,
      issues: [],
    })
  })

  it("rejects stale graph data, a mismatched BOM, and alternate migration lineage", async () => {
    const bundle = await exportBundle()
    const stale = structuredClone(bundle) as VoyantSelfHostExportBundle
    stale.resolvedGraph.modules[0]!.projectConfig = { tier: "stale" }
    stale.productBom = { ...BOM, version: "2" }
    ;(stale.database as { migrationJournal: unknown }).migrationJournal = {
      ...VOYANT_MIGRATION_JOURNAL_LINEAGE,
      ledgerTable: "cloud_only_migrations",
    }

    const result = await validateVoyantSelfHostExportBundle(stale)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "VOYANT_EXPORT_GRAPH_NOT_CANONICAL",
        "VOYANT_EXPORT_BOM_MISMATCH",
        "VOYANT_EXPORT_MIGRATION_LINEAGE_MISMATCH",
      ]),
    )
  })

  it("rejects an envelope hash that does not match the admitted graph", async () => {
    const bundle = await exportBundle()
    bundle.graphHash = `sha256:${"b".repeat(64)}`

    const result = await validateVoyantSelfHostExportBundle(bundle)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "VOYANT_EXPORT_GRAPH_HASH_MISMATCH" }),
    )
  })

  it("rejects a framework version outside the admitted package range", async () => {
    const bundle = await exportBundle()
    bundle.frameworkVersion = "0.1.0"

    const result = await validateVoyantSelfHostExportBundle(bundle)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION" }),
    )
  })

  it("rejects a mutable framework coordinate", async () => {
    const bundle = await exportBundle()
    bundle.frameworkVersion = "latest"

    const result = await validateVoyantSelfHostExportBundle(bundle)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "VOYANT_EXPORT_INVALID_FRAMEWORK_VERSION",
        path: "$.frameworkVersion",
      }),
    )
  })

  it("reports malformed graph array entries without throwing", async () => {
    const bundle = await exportBundle()
    const malformed = structuredClone(bundle) as unknown as Record<string, unknown>
    const graph = malformed.resolvedGraph as Record<string, unknown>
    graph.modules = [null]
    graph.packageRecords = ["not-a-package-record"]

    const result = await validateVoyantSelfHostExportBundle(malformed)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_EXPORT_INVALID_GRAPH",
          path: "$.resolvedGraph.modules[0]",
        }),
        expect.objectContaining({
          code: "VOYANT_EXPORT_INVALID_GRAPH",
          path: "$.resolvedGraph.packageRecords[0]",
        }),
      ]),
    )
    await expect(projectVoyantSelfHostExport(malformed)).rejects.toBeInstanceOf(Error)
  })

  it("rejects registry packages without exact lockfile provenance and integrity", async () => {
    const mutations = [
      (bundle: VoyantSelfHostExportBundle) => {
        bundle.resolvedGraph.packageRecords[0]!.version = "^1.2.3"
      },
      (bundle: VoyantSelfHostExportBundle) => {
        bundle.resolvedGraph.packageRecords[0]!.source.reference = "@acme/voyant-loyalty"
      },
      (bundle: VoyantSelfHostExportBundle) => {
        delete bundle.resolvedGraph.packageRecords[0]!.source.integrity
      },
    ]

    for (const mutate of mutations) {
      const bundle = await exportBundle()
      mutate(bundle)
      await rehashBundle(bundle)
      const result = await validateVoyantSelfHostExportBundle(bundle)

      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "VOYANT_EXPORT_INVALID_PACKAGE_PROVENANCE",
          path: "$.resolvedGraph.packageRecords[0].source",
        }),
      )
    }
  })

  it("rejects secret-like fields and values in projected unit config without echoing secrets", async () => {
    const bundle = await exportBundle()
    const graph = bundle.resolvedGraph as unknown as {
      modules: Array<{ projectConfig?: Record<string, unknown> }>
      extensions: Array<Record<string, unknown>>
      plugins: Array<Record<string, unknown>>
    }
    graph.modules[0]!.projectConfig = {
      mail: { apiKey: "sk_live_exported_123456789" },
    }
    graph.extensions.push({
      id: "@acme/voyant-loyalty#sync",
      packageName: "@acme/voyant-loyalty",
      projectConfig: {
        endpoint: ["postgresql", "://operator:s3cret@db.internal/voyant"].join(""),
      },
    })
    graph.plugins.push({
      id: "@acme/voyant-loyalty#signing",
      packageName: "@acme/voyant-loyalty",
      projectConfig: {
        material: "-----BEGIN PRIVATE KEY-----\nZXhwb3J0ZWQ=\n-----END PRIVATE KEY-----",
      },
    })
    await rehashBundle(bundle)

    const result = await validateVoyantSelfHostExportBundle(bundle)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_EXPORT_SECRET_IN_PROJECT_CONFIG",
          path: "$.resolvedGraph.modules[0].projectConfig.mail.apiKey",
        }),
        expect.objectContaining({
          code: "VOYANT_EXPORT_SECRET_IN_PROJECT_CONFIG",
          path: "$.resolvedGraph.extensions[0].projectConfig.endpoint",
        }),
        expect.objectContaining({
          code: "VOYANT_EXPORT_SECRET_IN_PROJECT_CONFIG",
          path: "$.resolvedGraph.plugins[0].projectConfig.material",
        }),
      ]),
    )
    expect(JSON.stringify(result.issues)).not.toContain("sk_live_exported")
    expect(JSON.stringify(result.issues)).not.toContain("operator:s3cret")
    expect(JSON.stringify(result.issues)).not.toContain("ZXhwb3J0ZWQ")
  })
})

describe("self-host projection", () => {
  it("preserves exact selections/config and remaps provider authority to self-hosted Node", async () => {
    const bundle = await exportBundle()
    const projection = await projectVoyantSelfHostExport(bundle, {
      providerOverrides: { sms: "twilio" },
    })

    expect(projection.schemaVersion).toBe(VOYANT_SELF_HOST_PROJECTION_SCHEMA_VERSION)
    expect(projection.ready).toBe(true)
    expect(projection.sourceGraphHash).toBe(bundle.graphHash)
    expect(projection.starter.runtimeDependencyCoordinates["@voyant-travel/framework"]).toBe(
      bundle.frameworkVersion,
    )
    expect([
      ...Object.values(projection.starter.runtimeDependencyCoordinates),
      ...Object.values(projection.starter.developmentDependencyCoordinates),
    ]).not.toContain("latest")
    expect(projection.project.modules).toEqual([
      {
        id: "@acme/voyant-loyalty#rewards",
        resolve: "@acme/voyant-loyalty/rewards",
        packageName: "@acme/voyant-loyalty",
        version: "1.2.3",
        config: { tier: "gold" },
      },
    ])
    expect(projection.project.deployment).toMatchObject({
      target: "node",
      mode: "self-hosted",
      providers: {
        auth: "better-auth",
        email: "smtp",
        realtime: "local",
        scheduledJobs: "node-cron",
        sms: "twilio",
        workflows: "self-hosted",
      },
    })
    expect(projection.graph.deployment).toEqual(projection.project.deployment)
    expect(projection.providerRemaps).toEqual(
      expect.arrayContaining([
        { role: "auth", from: "voyant-cloud", to: "better-auth", reason: "self-host-default" },
        { role: "email", from: "voyant-cloud", to: "smtp", reason: "self-host-default" },
        {
          role: "scheduledJobs",
          from: "cloud-scheduler",
          to: "node-cron",
          reason: "self-host-default",
        },
        {
          role: "sms",
          from: "voyant-cloud",
          to: "twilio",
          reason: "explicit-override",
        },
      ]),
    )
    expect(projection.packageInstalls).toEqual([
      {
        packageName: "@acme/voyant-loyalty",
        coordinate: "1.2.3",
        source: {
          kind: "registry",
          reference: "pnpm-lock:@acme/voyant-loyalty@1.2.3",
          integrity: expect.stringMatching(/^sha512-/),
        },
      },
    ])
    expect(projection.provisioning.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceKey: "database:postgres", provider: "postgres" }),
        expect.objectContaining({ resourceKey: "object-storage", provider: "s3-compatible" }),
        expect.objectContaining({ resourceKey: "auth:better-auth", provider: "better-auth" }),
        expect.objectContaining({ resourceKey: "email:smtp", provider: "smtp" }),
        expect.objectContaining({ resourceKey: "workflows:self-hosted", provider: "self-hosted" }),
      ]),
    )
    expect(
      projection.provisioning.resources
        .flatMap((resource) => resource.env)
        .map((requirement) => requirement.name),
    ).toEqual(
      expect.arrayContaining([
        "BETTER_AUTH_SECRET",
        "SESSION_CLAIMS_SECRET",
        "SMTP_HOST",
        "SMTP_PASSWORD",
        "DATABASE_URL",
      ]),
    )
    const { contentHash: _contentHash, ...projectedWithoutHash } = projection.graph
    expect(projection.projectedGraphHash).not.toBe(bundle.graphHash)
    expect(projectedWithoutHash.deployment.mode).toBe("self-hosted")
    await expect(sha256(projectedWithoutHash)).resolves.toBe(
      projection.projectedGraphHash.replace("sha256:", ""),
    )
  })

  it("emits actionable diagnostics instead of silently disabling unsupported providers", async () => {
    const projection = await projectVoyantSelfHostExport(await exportBundle())

    expect(projection.ready).toBe(false)
    expect(projection.project.deployment.providers.sms).toBe("voyant-cloud")
    expect(projection.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "VOYANT_SELF_HOST_PROVIDER_UNSUPPORTED",
        path: "$.resolvedGraph.deployment.providers.sms",
        hint: expect.stringContaining("providerOverrides.sms"),
      }),
    )
  })

  it("diagnoses platform-only providers and non-portable package sources", async () => {
    const bundle = await exportBundle({ sourceKind: "workspace" })
    bundle.resolvedGraph.deployment.providers.cache = "platform"
    await rehashBundle(bundle)

    const projection = await projectVoyantSelfHostExport(bundle, {
      providerOverrides: { sms: "none" },
    })

    expect(projection.ready).toBe(false)
    expect(projection.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "VOYANT_SELF_HOST_PROVIDER_UNSUPPORTED",
        "VOYANT_SELF_HOST_PACKAGE_SOURCE_UNAVAILABLE",
      ]),
    )
  })

  it("keeps restored Cloud and standard Node databases on one migration journal lineage", async () => {
    const bundle = await exportBundle()
    const projection = await projectVoyantSelfHostExport(bundle, {
      providerOverrides: { sms: "none" },
    })
    const cloudPlan = await createProjectMigrationPlan(bundle.resolvedGraph)
    const selfHostPlan = await createProjectMigrationPlan(projection.graph)
    const cloudPackageMigration = cloudPlan.migrations.find(
      (migration) => migration.id === "@acme/voyant-loyalty#migrations",
    )
    const selfHostPackageMigration = selfHostPlan.migrations.find(
      (migration) => migration.id === "@acme/voyant-loyalty#migrations",
    )

    expect(bundle.database.migrationJournal).toBe(VOYANT_MIGRATION_JOURNAL_LINEAGE)
    expect(projection.migrationJournal).toBe(VOYANT_MIGRATION_JOURNAL_LINEAGE)
    expect(projection.migrationPolicy).toEqual({
      identity: ["source", "tag"],
      matchingEntry: "skip",
      contentHashMismatch: "reject-drift",
      pendingEntry: "apply",
    })
    expect(selfHostPackageMigration).toEqual(cloudPackageMigration)
    expect(selfHostPlan.migrations.map((migration) => migration.id)).toContain(
      "@voyant-travel/workflows-orchestrator#migrations",
    )
  })
})

async function exportBundle(
  options: { sourceKind?: VoyantGraphPackageSourceKind } = {},
): Promise<VoyantSelfHostExportBundle> {
  const manifest = defineModule({
    id: "@acme/voyant-loyalty#rewards",
    packageName: "@acme/voyant-loyalty",
    migrations: [{ id: "@acme/voyant-loyalty#migrations", source: "./migrations" }],
  })
  const project = defineProject({
    productBom: BOM,
    modules: [{ resolve: "@acme/voyant-loyalty/rewards", config: { tier: "gold" } }],
    deployment: {
      target: "node",
      mode: "managed-cloud",
      providers: DEFAULT_MANAGED_CLOUD_PROVIDERS,
    },
  })
  const graph = await resolveDeploymentGraphWithPackageManifests({
    project,
    target: "node",
    mode: "managed-cloud",
    deployment: {
      mode: "managed-cloud",
      providers: DEFAULT_MANAGED_CLOUD_PROVIDERS,
      requirements: deriveDeploymentRequirements(DEFAULT_MANAGED_CLOUD_PROVIDERS),
    },
    frameworkVersion: "0.44.4",
    packageRecords: [
      {
        packageName: "@acme/voyant-loyalty",
        version: "1.2.3",
        source:
          options.sourceKind === "workspace"
            ? { kind: "workspace", reference: "link:../voyant-loyalty" }
            : {
                kind: "registry",
                reference: "pnpm-lock:@acme/voyant-loyalty@1.2.3",
                integrity:
                  "sha512-YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eg==",
              },
        metadata: {
          schemaVersion: "voyant.package.v1",
          kind: "module",
          manifest: "./voyant",
          compatibleWith: {
            framework: ">=0.40.0",
            targets: ["node"],
            modes: ["managed-cloud", "self-hosted"],
          },
        },
      },
    ],
    async loadPackageManifests() {
      return [manifest]
    },
  })
  return {
    schemaVersion: VOYANT_SELF_HOST_EXPORT_BUNDLE_SCHEMA_VERSION,
    frameworkVersion: "0.44.4",
    graphHash: graph.contentHash,
    productBom: BOM,
    resolvedGraph: graph,
    database: {
      schemaVersion: VOYANT_POSTGRES_EXPORT_SCHEMA_VERSION,
      engine: "postgresql",
      format: "pg-custom",
      dump: { path: "database/operator.dump", byteLength: 4096, contentHash: ARTIFACT_HASH },
      migrationJournal: VOYANT_MIGRATION_JOURNAL_LINEAGE,
    },
    objectStorage: {
      schemaVersion: VOYANT_OBJECT_STORAGE_EXPORT_SCHEMA_VERSION,
      objects: [
        {
          logicalStore: "media",
          key: "logos/operator.png",
          path: "objects/media/logos/operator.png",
          byteLength: 1024,
          contentHash: ARTIFACT_HASH,
          contentType: "image/png",
        },
      ],
    },
  }
}

async function rehashBundle(bundle: VoyantSelfHostExportBundle): Promise<void> {
  const { contentHash: _contentHash, ...withoutHash } = bundle.resolvedGraph
  bundle.resolvedGraph.contentHash = `sha256:${await sha256(withoutHash)}`
  bundle.graphHash = bundle.resolvedGraph.contentHash
}
