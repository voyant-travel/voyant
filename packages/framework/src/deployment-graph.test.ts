import { describe, expect, it } from "vitest"
import {
  createTestDeployment,
  defineDeployment,
  defineModule,
  definePlugin,
  defineProject,
  graphIdFromSpecifier,
  resolveDeploymentGraph,
  resolveManagedProfileDeploymentGraph,
  VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY,
  VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION,
  validateGraphUnitManifest,
} from "./deployment-graph.js"
import { defineVoyantProject } from "./profile.js"

describe("deployment graph v1", () => {
  it("defines closed module and plugin manifests", () => {
    const module = defineModule({
      id: "@acme/voyant-loyalty",
      provides: { capabilities: ["acme.loyalty.points"] },
      api: [{ id: "@acme/voyant-loyalty#api.admin", surface: "admin" }],
    })
    const plugin = definePlugin({
      id: "@acme/voyant-fiscal#smartbill",
      provides: { capabilities: ["acme.fiscal.invoice"] },
    })

    expect(module.schemaVersion).toBe("voyant.module.v1")
    expect(plugin.schemaVersion).toBe("voyant.plugin.v1")

    expect(
      validateGraphUnitManifest({
        ...module,
        admin: { nav: [] },
        unsupportedThing: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_GRAPH_UNSUPPORTED_FACET",
          facet: "admin",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_UNKNOWN_FACET",
          facet: "unsupportedThing",
        }),
      ]),
    )
  })

  it("rejects bare legacy aliases as canonical graph ids", () => {
    expect(
      validateGraphUnitManifest({
        schemaVersion: "voyant.module.v1",
        id: "bookings",
      }).map((entry) => entry.code),
    ).toContain("VOYANT_GRAPH_INVALID_ID")

    expect(
      validateGraphUnitManifest({ schemaVersion: "voyant.module.v1", id: "acme/bookings" }),
    ).toEqual([])
  })

  it("detects duplicate graph ids and missing required capabilities", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          requires: { capabilities: ["acme.crm.people"] },
        }),
        defineModule({
          id: "@acme/voyant-loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({ project, target: "node", mode: "self-hosted" })

    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "VOYANT_GRAPH_DUPLICATE_ID" }),
        expect.objectContaining({ code: "VOYANT_GRAPH_MISSING_CAPABILITY" }),
      ]),
    )
  })

  it("hashes deterministic canonical graph content", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-crm",
          provides: { capabilities: ["acme.crm.people"] },
          api: [{ id: "@acme/voyant-crm#api.admin", surface: "admin" }],
        }),
        defineModule({
          id: "@acme/voyant-loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
          requires: { capabilities: ["acme.crm.people"] },
          api: [{ id: "@acme/voyant-loyalty#api.admin", surface: "admin" }],
        }),
      ],
      plugins: [
        definePlugin({
          id: "@acme/voyant-fiscal#smartbill",
          provides: { capabilities: ["acme.fiscal.invoice"] },
        }),
      ],
    })

    const first = await resolveDeploymentGraph({
      project,
      target: "node",
      mode: "self-hosted",
      packageRecords: [
        {
          packageName: "@acme/voyant-loyalty",
          source: { kind: "registry", reference: "npm:@acme/voyant-loyalty@1.0.0" },
        },
      ],
    })
    const second = await resolveDeploymentGraph({
      project,
      mode: "self-hosted",
      target: "node",
      packageRecords: [
        {
          packageName: "@acme/voyant-loyalty",
          source: { reference: "npm:@acme/voyant-loyalty@1.0.0", kind: "registry" },
        },
      ],
    })

    expect(first.schemaVersion).toBe(VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION)
    expect(first.diagnostics).toEqual([])
    expect(first.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(second.contentHash).toBe(first.contentHash)
  })

  it("normalizes deployment resource requirements before hashing", async () => {
    const project = defineProject({
      modules: [],
    })
    const firstDeployment = defineDeployment({
      project,
      target: "node",
      mode: "self-hosted",
      requirements: {
        resources: [
          {
            resourceKey: "database:postgres",
            roles: ["database", "cache"],
            provider: "postgres",
            required: true,
            env: [
              {
                name: "DATABASE_URL_REPLICAS",
                kind: "secret",
                required: false,
                description: "Read replicas.",
              },
              {
                name: "DATABASE_URL",
                kind: "secret",
                required: true,
                description: "Primary database.",
              },
            ],
          },
        ],
      },
    })
    const secondDeployment = defineDeployment({
      project,
      target: "node",
      mode: "self-hosted",
      requirements: {
        resources: [
          {
            resourceKey: "database:postgres",
            roles: ["cache", "database"],
            provider: "postgres",
            required: true,
            env: [
              {
                name: "DATABASE_URL",
                kind: "secret",
                required: true,
                description: "Primary database.",
              },
              {
                name: "DATABASE_URL_REPLICAS",
                kind: "secret",
                required: false,
                description: "Read replicas.",
              },
            ],
          },
        ],
      },
    })
    const { project: _firstProject, ...firstDeploymentInput } = firstDeployment
    const { project: _secondProject, ...secondDeploymentInput } = secondDeployment

    const first = await resolveDeploymentGraph({
      project,
      deployment: firstDeploymentInput,
    })
    const second = await resolveDeploymentGraph({
      project,
      deployment: secondDeploymentInput,
    })

    expect(first.requirements.resources).toEqual(second.requirements.resources)
    expect(JSON.stringify(first.requirements)).not.toContain('"notes":null')
    expect(second.contentHash).toBe(first.contentHash)
  })

  it("detects package framework incompatibility from metadata", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({
      project,
      frameworkVersion: "0.24.1",
      packageRecords: [
        {
          packageName: "@acme/voyant-loyalty",
          source: { kind: "registry", reference: "npm:@acme/voyant-loyalty@1.0.0" },
          metadata: {
            schemaVersion: "voyant.package.v1",
            kind: "module",
            compatibleWith: { framework: "^0.25.0" },
          },
        },
      ],
    })

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "VOYANT_GRAPH_PACKAGE_INCOMPATIBLE",
        source: "@acme/voyant-loyalty",
        facet: "package.compatibleWith.framework",
      }),
    ])

    const compatibleGraph = await resolveDeploymentGraph({
      project,
      frameworkVersion: "0.24.1",
      packageRecords: [
        {
          packageName: "@acme/voyant-loyalty",
          source: { kind: "registry", reference: "npm:@acme/voyant-loyalty@1.0.0" },
          metadata: {
            schemaVersion: "voyant.package.v1",
            kind: "module",
            compatibleWith: { framework: "^0.24.0" },
          },
        },
      ],
    })

    expect(compatibleGraph.diagnostics).toEqual([])
  })

  it("bridges managed operator snapshots into explicit graph units", async () => {
    const profile = defineVoyantProject({
      profile: "operator",
      frameworkVersion: "0.24.1",
      modules: ["bookings", "finance", "relationships"],
      plugins: ["@voyant-travel/plugin-netopia"],
      customSource: {
        modules: ["@acme/voyant-loyalty"],
        extensions: ["@acme/voyant-loyalty-admin"],
      },
    })

    const graph = await resolveManagedProfileDeploymentGraph(profile)

    expect(graph.schemaVersion).toBe("voyant.resolved-graph.v1")
    expect(graph.project.presetLineage).toBe("operator-standard")
    expect(graph.deployment.target).toBe("voyant-cloud")
    expect(graph.deployment.providers).toEqual(
      expect.objectContaining({
        database: "postgres",
        storage: "s3",
        cache: "redis",
        sharedState: "redis",
        rateLimit: "redis",
        auth: "voyant-cloud",
        workflows: "voyant-cloud",
      }),
    )
    expect(graph.requirements.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceKey: "redis", provider: "redis" }),
        expect.objectContaining({ resourceKey: "object-storage", provider: "s3" }),
        expect.objectContaining({ resourceKey: "auth:voyant-cloud", provider: "voyant-cloud" }),
        expect.objectContaining({
          resourceKey: "workflows:voyant-cloud",
          provider: "voyant-cloud",
        }),
      ]),
    )
    expect(graph.modules.map((unit) => unit.id)).toEqual(
      expect.arrayContaining([
        "@voyant-travel/bookings",
        "@voyant-travel/finance",
        "@voyant-travel/relationships",
        "@acme/voyant-loyalty",
      ]),
    )
    expect(graph.modules.map((unit) => unit.id)).not.toContain("@voyant-travel/flights")
    expect(graph.plugins.map((unit) => unit.id)).toEqual(
      expect.arrayContaining(["@voyant-travel/plugin-netopia", "@acme/voyant-loyalty-admin"]),
    )
    expect(graph.packageRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "@voyant-travel/framework",
          version: "0.24.1",
          source: { kind: "unknown" },
        }),
        expect.objectContaining({
          packageName: "@acme/voyant-loyalty",
          source: { kind: "unknown" },
        }),
        expect.objectContaining({
          packageName: "@acme/voyant-loyalty-admin",
          source: { kind: "unknown" },
        }),
        expect.objectContaining({
          packageName: "@voyant-travel/plugin-netopia",
          source: { kind: "unknown" },
        }),
      ]),
    )
    expect(graph.diagnostics).toEqual([])
  })

  it("validates admission policy against inferred package records", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({
      project,
      admission: { allowedSourceKinds: ["workspace"] },
    })

    expect(graph.packageRecords).toEqual([
      expect.objectContaining({
        packageName: "@acme/voyant-loyalty",
        source: { kind: "unknown" },
      }),
    ])
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "VOYANT_GRAPH_PACKAGE_SOURCE_UNADMITTED",
        source: "@acme/voyant-loyalty",
      }),
    ])
  })

  it("does not infer first-party package provenance from package scope", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@voyant-travel/custom-managed-module",
        }),
      ],
      plugins: [
        definePlugin({
          id: "@voyant-travel/plugin-netopia",
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({ project })
    const workspaceOnlyGraph = await resolveDeploymentGraph({
      project,
      admission: { allowedSourceKinds: ["workspace"] },
    })

    expect(graph.packageRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "@voyant-travel/custom-managed-module",
          source: { kind: "unknown" },
        }),
        expect.objectContaining({
          packageName: "@voyant-travel/plugin-netopia",
          source: { kind: "unknown" },
        }),
      ]),
    )
    expect(graph.packageRecords).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: { kind: "workspace" },
        }),
      ]),
    )
    expect(workspaceOnlyGraph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_GRAPH_PACKAGE_SOURCE_UNADMITTED",
          source: "@voyant-travel/plugin-netopia",
        }),
      ]),
    )
  })

  it("normalizes framework specifiers to package-scoped graph ids", () => {
    expect(graphIdFromSpecifier("@voyant-travel/inventory/extras")).toBe(
      "@voyant-travel/inventory#extras",
    )
    expect(graphIdFromSpecifier("operator/payment-link")).toBe(
      "@voyant-travel/operator#payment-link",
    )
  })

  it("keeps diagnostic codes checked in and sorted", () => {
    expect(Object.keys(VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY)).toEqual([
      "VOYANT_GRAPH_DUPLICATE_ENTITY_ID",
      "VOYANT_GRAPH_DUPLICATE_ID",
      "VOYANT_GRAPH_INVALID_CAPABILITY_TOKEN",
      "VOYANT_GRAPH_INVALID_ENTITY_ID",
      "VOYANT_GRAPH_INVALID_ID",
      "VOYANT_GRAPH_INVALID_SCHEMA_VERSION",
      "VOYANT_GRAPH_MISSING_CAPABILITY",
      "VOYANT_GRAPH_PACKAGE_INCOMPATIBLE",
      "VOYANT_GRAPH_PACKAGE_SOURCE_UNADMITTED",
      "VOYANT_GRAPH_UNKNOWN_FACET",
      "VOYANT_GRAPH_UNSUPPORTED_FACET",
    ])
  })

  it("provides a module/plugin author test harness skeleton", async () => {
    const deployment = await createTestDeployment({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          localId: "loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
          api: [{ id: "@acme/voyant-loyalty#api.admin", surface: "admin" }],
          migrations: [{ id: "@acme/voyant-loyalty#migration.20260709120000_create_loyalty" }],
        }),
      ],
    })

    expect(() => deployment.doctor.expectClean()).not.toThrow()
    expect(() =>
      deployment.migrations.expectDeclared(
        "@acme/voyant-loyalty#migration.20260709120000_create_loyalty",
      ),
    ).not.toThrow()
    expect(() => deployment.migrations.expectReplayParity()).not.toThrow()
    expect(deployment.routes.list()).toEqual(["/v1/admin/loyalty"])
    expect(() => deployment.routes.expectMounted("/v1/admin/loyalty")).not.toThrow()
  })

  it("surfaces graph diagnostics through the author test harness", async () => {
    const deployment = await createTestDeployment({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          requires: { capabilities: ["acme.crm.people"] },
        }),
      ],
    })

    expect(() => deployment.doctor.expectClean()).toThrow(/VOYANT_GRAPH_MISSING_CAPABILITY/)
  })
})
