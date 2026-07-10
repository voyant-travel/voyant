// agent-quality: file-size exception -- owner: framework; deployment graph v1 tests stay co-located while the resolver, diagnostics, hashing, and managed-profile bridge share one contract harness.
import {
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
} from "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest"
import { describe, expect, it } from "vitest"
import {
  createTestDeployment,
  defineDeployment,
  defineModule,
  definePlugin,
  defineProject,
  graphIdFromSpecifier,
  packageNameFromSpecifier,
  resolveDeploymentGraph,
  resolveManagedProfileDeploymentGraph,
  VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY,
  VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION,
  validateGraphUnitManifest,
} from "./deployment-graph.js"
import { assertPortConforms, definePort, providePort, requirePort } from "./ports.js"
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
    expect(validateGraphUnitManifest(module)).toEqual([])
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

  it("validates API route bundle metadata without requiring the deferred permissions facet", () => {
    expect(
      validateGraphUnitManifest({
        schemaVersion: "voyant.module.v1",
        id: "@acme/voyant-loyalty",
        api: [
          {
            id: "@acme/voyant-loyalty#api.admin",
            surface: "admin",
            mount: "/v1/admin/loyalty",
            resource: "loyalty.points",
            requiredScopes: ["loyalty:read", "loyalty-points:write"],
            anonymous: ["/v1/public/loyalty/status"],
          },
        ],
      }),
    ).toEqual([])

    expect(
      validateGraphUnitManifest({
        schemaVersion: "voyant.module.v1",
        id: "@acme/voyant-loyalty",
        api: [
          {
            id: "@acme/voyant-loyalty#api.invalid",
            surface: "worker",
            mount: "",
            resource: "Loyalty Points",
            requiredScopes: ["loyalty.points.read", "loyalty:Read"],
            anonymous: "yes",
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          facet: "api[0].surface",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          facet: "api[0].mount",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          facet: "api[0].resource",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_SCOPE",
          facet: "api[0].requiredScopes[0]",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_SCOPE",
          facet: "api[0].requiredScopes[1]",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          facet: "api[0].anonymous",
        }),
      ]),
    )
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

  it("lowers workflow schedule descriptors into nested stable graph entities", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-automation",
          workflows: [
            {
              id: "daily-rollup",
              config: {
                defaultRuntime: "node",
                schedule: [
                  {
                    cron: "0 * * * *",
                    timezone: "UTC",
                    environments: ["production"],
                    input: { kind: "hourly" },
                    overlap: "skip",
                    name: "hourly",
                  },
                  {
                    at: "2026-01-01T12:00:00.000Z",
                    enabled: false,
                  },
                ],
              },
            },
          ],
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({ project, target: "node", mode: "self-hosted" })
    const [unit] = graph.modules

    expect(unit?.workflows[0]?.schedules).toEqual([
      {
        id: "@acme/voyant-automation#schedule.daily-rollup.hourly",
        workflowId: "daily-rollup",
        cron: "0 * * * *",
        timezone: "UTC",
        environments: ["production"],
        input: { kind: "hourly" },
        overlap: "skip",
        name: "hourly",
      },
      {
        id: "@acme/voyant-automation#schedule.daily-rollup.schedule-2",
        workflowId: "daily-rollup",
        at: "2026-01-01T12:00:00.000Z",
        enabled: false,
      },
    ])
    expect(graph.provisioning.scheduledJobs).toEqual([
      {
        id: "@acme/voyant-automation#schedule.daily-rollup.hourly",
        cron: "0 * * * *",
        description:
          "Triggers workflow daily-rollup from graph schedule @acme/voyant-automation#schedule.daily-rollup.hourly.",
        route: "/__voyant/scheduled",
        module: "@acme/voyant-automation",
        workflowId: "daily-rollup",
        input: { kind: "hourly" },
      },
    ])
    expect(graph.diagnostics).toEqual([])
  })

  it("detects duplicate workflow schedule entity ids after descriptor lowering", async () => {
    const project = defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-automation",
          workflows: [
            {
              id: "daily-rollup",
              schedules: [{ id: "@acme/voyant-automation#schedule.daily-rollup.hourly" }],
              config: {
                schedule: { cron: "0 * * * *", name: "hourly" },
              },
            },
          ],
        }),
      ],
    })

    const graph = await resolveDeploymentGraph({ project, target: "node", mode: "self-hosted" })

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "VOYANT_GRAPH_DUPLICATE_ENTITY_ID",
        source: "@acme/voyant-automation",
      }),
    ])
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

  it("keeps resolved module and plugin ordering independent of declaration order", async () => {
    const crm = defineModule({
      id: "@acme/voyant-crm",
      provides: { capabilities: ["acme.crm.people"] },
    })
    const loyalty = defineModule({
      id: "@acme/voyant-loyalty",
      provides: { capabilities: ["acme.loyalty.points"] },
      requires: { capabilities: ["acme.crm.people"] },
    })
    const fiscal = definePlugin({
      id: "@acme/voyant-fiscal#smartbill",
      provides: { capabilities: ["acme.fiscal.invoice"] },
    })
    const webhook = definePlugin({
      id: "@acme/voyant-webhooks#hubspot",
      provides: { capabilities: ["acme.webhooks.hubspot"] },
    })

    const first = await resolveDeploymentGraph({
      project: defineProject({
        modules: [loyalty, crm],
        plugins: [webhook, fiscal],
      }),
      target: "node",
      mode: "self-hosted",
    })
    const second = await resolveDeploymentGraph({
      project: defineProject({
        modules: [crm, loyalty],
        plugins: [fiscal, webhook],
      }),
      target: "node",
      mode: "self-hosted",
    })

    expect(first.diagnostics).toEqual([])
    expect(first.modules.map((unit) => [unit.id, unit.order])).toEqual([
      ["@acme/voyant-crm", 0],
      ["@acme/voyant-loyalty", 1],
    ])
    expect(first.plugins.map((unit) => [unit.id, unit.order])).toEqual([
      ["@acme/voyant-fiscal#smartbill", 0],
      ["@acme/voyant-webhooks#hubspot", 1],
    ])
    expect(second).toEqual(first)
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
                aliases: ["DATABASE_URL_DIRECT", "POSTGRES_URL"],
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
                aliases: ["POSTGRES_URL", "DATABASE_URL_DIRECT"],
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
    expect(first.requirements.resources[0]?.env[0]).toMatchObject({
      name: "DATABASE_URL",
      aliases: ["DATABASE_URL_DIRECT", "POSTGRES_URL"],
    })
    expect(JSON.stringify(first.requirements)).not.toContain('"notes":null')
    expect(second.contentHash).toBe(first.contentHash)
  })

  it("derives resource requirements from declared deployment providers", () => {
    const deployment = defineDeployment({
      project: defineProject({ modules: [] }),
      target: "node",
      mode: "self-hosted",
      providers: {
        database: "postgres",
        cache: "redis",
        search: "none",
      },
    })

    expect(deployment.requirements.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceKey: "database:postgres",
          provider: "postgres",
          roles: ["database"],
        }),
        expect.objectContaining({
          resourceKey: "redis",
          provider: "redis",
          roles: ["cache"],
        }),
        expect.objectContaining({
          resourceKey: "search:none",
          provider: "none",
          required: false,
        }),
      ]),
    )
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

    const lowerBoundGraph = await resolveDeploymentGraph({
      project,
      frameworkVersion: "0.32.0",
      packageRecords: [
        {
          packageName: "@acme/voyant-loyalty",
          source: { kind: "registry", reference: "npm:@acme/voyant-loyalty@1.0.0" },
          metadata: {
            schemaVersion: "voyant.package.v1",
            kind: "module",
            compatibleWith: { framework: ">=0.26.0" },
          },
        },
      ],
    })

    expect(lowerBoundGraph.diagnostics).toEqual([])
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
    const commerce = graph.modules.find((unit) => unit.id === "@voyant-travel/commerce")
    expect(commerce?.workflows).toEqual([bulkReindexProductsWorkflowManifest])
    expect(commerce?.events).toEqual([
      {
        id: "@voyant-travel/commerce#event.promotion.changed",
        eventType: "promotion.changed",
      },
    ])
    expect(commerce?.subscribers).toEqual([
      {
        id: `@voyant-travel/commerce#subscriber.${promotionAffectedAllFilter.id}`,
        eventType: "promotion.changed",
        eventFilterId: promotionAffectedAllFilter.id,
        workflowId: bulkReindexProductsWorkflowManifest.id,
        filter: promotionAffectedAllFilter.manifest,
      },
    ])
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

  it("projects managed scheduled jobs into graph provisioning metadata", async () => {
    const graph = await resolveManagedProfileDeploymentGraph(
      defineVoyantProject({
        profile: "operator",
        frameworkVersion: "0.24.1",
        modules: ["bookings", "catalog"],
        plugins: [],
      }),
    )

    expect(graph.provisioning.scheduledJobs).toEqual([
      expect.objectContaining({
        id: "draft-reaper",
        cron: "5 * * * *",
        route: "/__voyant/scheduled",
        module: "catalog",
      }),
      expect.objectContaining({
        id: "outbox-drain",
        cron: "*/2 * * * *",
        route: "/__voyant/scheduled",
        module: "framework",
      }),
      expect.objectContaining({
        id: "promotion-boundary-scheduler",
        cron: "*/5 * * * *",
        route: "/__voyant/scheduled",
        module: "commerce",
      }),
    ])
    expect(graph.provisioning.scheduledJobs.map((job) => job.id)).not.toEqual(
      expect.arrayContaining(["channel-push-availability"]),
    )
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
    expect(graphIdFromSpecifier("@voyant-travel/public-document-delivery")).toBe(
      "@voyant-travel/public-document-delivery",
    )
    expect(packageNameFromSpecifier("@voyant-travel/public-document-delivery")).toBe(
      "@voyant-travel/hono",
    )
  })

  it("keeps diagnostic codes checked in and sorted", () => {
    expect(Object.keys(VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY)).toEqual([
      "VOYANT_GRAPH_ARTIFACT_MISSING",
      "VOYANT_GRAPH_ARTIFACT_STALE",
      "VOYANT_GRAPH_DUPLICATE_ENTITY_ID",
      "VOYANT_GRAPH_DUPLICATE_ID",
      "VOYANT_GRAPH_INVALID_CAPABILITY_TOKEN",
      "VOYANT_GRAPH_INVALID_ENTITY_ID",
      "VOYANT_GRAPH_INVALID_ID",
      "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
      "VOYANT_GRAPH_INVALID_SCHEMA_VERSION",
      "VOYANT_GRAPH_INVALID_SCOPE",
      "VOYANT_GRAPH_MISSING_CAPABILITY",
      "VOYANT_GRAPH_MISSING_PORT",
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

  it("closes required typed ports from selected providers", async () => {
    expect(() => definePort({ id: "booking", test: () => {} })).toThrow(/dot-case/)
    expect(() => definePort({ id: "booking.read-model", test: undefined as never })).toThrow(
      /conformance test kit/,
    )

    const bookingReadModel = definePort<{ getBooking: (id: string) => string }>({
      id: "booking.read-model",
      test: (provider) => {
        if (provider.getBooking("booking_1") !== "booking_1") {
          throw new Error("getBooking must return the requested booking.")
        }
      },
    })

    await expect(
      assertPortConforms(bookingReadModel, { getBooking: (id) => id }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(bookingReadModel, { getBooking: () => "wrong" }),
    ).rejects.toThrow(/requested booking/)

    const graph = await resolveDeploymentGraph({
      project: defineProject({
        modules: [
          defineModule({
            id: "@acme/voyant-bookings",
            provides: { ports: [providePort(bookingReadModel)] },
          }),
          defineModule({
            id: "@acme/voyant-loyalty",
            requires: { ports: [requirePort(bookingReadModel)] },
          }),
        ],
      }),
    })

    expect(graph.diagnostics).toEqual([])
    expect(graph.modules[1]?.requires.ports).toEqual([{ id: "booking.read-model" }])
  })

  it("reports missing required ports while allowing optional ports", async () => {
    const peopleDirectory = definePort({ id: "identity.people-directory", test: () => {} })

    const graph = await resolveDeploymentGraph({
      project: defineProject({
        modules: [
          defineModule({
            id: "@acme/voyant-loyalty",
            requires: {
              ports: [
                requirePort(peopleDirectory),
                requirePort(peopleDirectory, { optional: true }),
              ],
            },
          }),
        ],
      }),
    })

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "VOYANT_GRAPH_MISSING_PORT",
        source: "@acme/voyant-loyalty",
        facet: "requires.ports",
      }),
    ])
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
