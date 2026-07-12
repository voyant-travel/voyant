// agent-quality: file-size exception -- reason: generated deployment artifact fixtures and deterministic source assertions stay in one focused suite.
import { describe, expect, it } from "vitest"
import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildDeploymentMigrationSources,
  buildGraphAdminBundleModule,
  buildGraphRuntimeModule,
  buildGraphWorkflowRuntimeModule,
  buildNodeRuntimeEntry,
  buildNodeRuntimeEntryArtifact,
  buildProjectRuntimeModule,
  buildSelectedGraphExecutableFacetArtifacts,
  VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
  VOYANT_NODE_RUNTIME_ENTRY_ID,
} from "./deployment-artifacts.js"
import {
  defineExtension,
  defineModule,
  definePlugin,
  defineProject,
  resolveDeploymentGraph,
  type VoyantGraphUnitManifest,
} from "./deployment-graph.js"

async function sampleGraph() {
  return resolveDeploymentGraph({
    project: defineProject({
      modules: [
        defineModule({
          id: "@acme/voyant-loyalty",
          provides: { capabilities: ["acme.loyalty.points"] },
          api: [
            {
              id: "@acme/voyant-loyalty#api.admin",
              surface: "admin",
              runtime: {
                entry: "@acme/voyant-loyalty/runtime-body-that-must-stay-lazy",
                export: "createLoyaltyModule",
              },
            },
          ],
        }),
      ],
    }),
    target: "node",
    mode: "self-hosted",
    packageRecords: [
      {
        packageName: "@acme/voyant-loyalty",
        version: "1.0.0",
        source: {
          kind: "registry",
          reference: "pnpm-lock:@acme/voyant-loyalty@1.0.0",
          integrity: "sha512-test",
        },
      },
    ],
  })
}

async function graphWithSelectedUnits(
  modules: readonly VoyantGraphUnitManifest[],
  plugins: readonly VoyantGraphUnitManifest[] = [],
  extensions: readonly VoyantGraphUnitManifest[] = [],
) {
  const units = [...modules, ...extensions, ...plugins]
  return resolveDeploymentGraph({
    project: defineProject({ modules, extensions, plugins }),
    target: "node",
    mode: "self-hosted",
    packageRecords: [
      ...new Set(units.map((unit) => unit.packageName ?? unit.id.split("#")[0])),
    ].map((packageName) => ({
      packageName: packageName ?? "",
      source: { kind: "workspace" as const },
    })),
  })
}

describe("deployment graph artifacts", () => {
  it("emits only selected tool, action, and outbound webhook eligibility metadata", async () => {
    const selected = defineModule({
      id: "@acme/selected",
      access: {
        resources: [{ id: "selected.access", resource: "selected", actions: ["write"] }],
      },
      tools: [
        {
          id: "selected.tool",
          name: "selected_tool",
          runtime: { entry: "./tools", export: "selectedTool" },
          requiredScopes: ["selected:write"],
          context: ["selected"],
          risk: "high",
        },
      ],
      events: [{ id: "selected.event", eventType: "selected.changed" }],
      webhooks: [{ id: "selected.webhook", direction: "outbound", eventId: "selected.event" }],
      actions: [
        {
          id: "selected.action",
          capabilityId: "selected.write",
          version: "v1",
          kind: "execute",
          targetType: "selected-record",
          requiredScopes: ["selected:write"],
          risk: "high",
          ledger: "required",
          approval: "conditional",
          policy: "selected-policy",
          reversible: true,
          allowedActorTypes: ["staff"],
          from: { tools: ["selected.tool"], webhooks: ["selected.webhook"] },
        },
      ],
    })
    const deselected = defineModule({
      id: "@acme/deselected",
      tools: [
        {
          id: "deselected.tool",
          name: "deselected_tool",
          runtime: { entry: "./tools", export: "deselectedTool" },
        },
      ],
    })
    const graph = await graphWithSelectedUnits([selected])

    const artifacts = buildSelectedGraphExecutableFacetArtifacts(graph)
    const tools = JSON.parse(artifacts.tools)
    const actions = JSON.parse(artifacts.actions)
    const webhooks = JSON.parse(artifacts.outboundWebhooks)

    expect(tools.entries).toEqual([
      expect.objectContaining({
        id: "selected.tool",
        owner: { unitId: "@acme/selected", packageName: "@acme/selected" },
        requiredScopes: ["selected:write"],
        context: ["selected"],
        risk: "high",
      }),
    ])
    expect(actions.entries).toEqual([
      expect.objectContaining({
        id: "selected.action",
        owner: { unitId: "@acme/selected", packageName: "@acme/selected" },
        kind: "execute",
        ledger: "required",
        approval: "conditional",
        policy: "selected-policy",
        reversible: true,
        allowedActorTypes: ["staff"],
      }),
    ])
    expect(webhooks.entries).toEqual([
      expect.objectContaining({
        id: "selected.webhook",
        unitId: "@acme/selected",
        packageName: "@acme/selected",
        eventType: "selected.changed",
      }),
    ])
    expect(JSON.stringify(artifacts)).not.toContain(deselected.id)
  })

  it("builds deterministic resolved graph JSON containing the graph hash", async () => {
    const graph = await sampleGraph()
    const first = buildDeploymentGraphJson(graph)
    const second = buildDeploymentGraphJson(graph)

    expect(first).toBe(second)
    expect(first.endsWith("\n")).toBe(true)
    expect(JSON.parse(first)).toMatchObject({
      schemaVersion: "voyant.resolved-graph.v1",
      contentHash: graph.contentHash,
      webhookPlan: { inbound: [], outbound: [] },
    })
  })

  it("lowers the selected webhook plan into generated runtime source", async () => {
    const graph = await graphWithSelectedUnits([
      defineModule({
        id: "@acme/hooks",
        events: [{ id: "@acme/hooks#event.changed", eventType: "hooks.changed" }],
        webhooks: [
          {
            id: "@acme/hooks#webhook.changed",
            direction: "outbound",
            eventId: "@acme/hooks#event.changed",
          },
        ],
      }),
    ])

    const source = buildGraphRuntimeModule({ graph })

    expect(source).toContain("GENERATED_GRAPH_RUNTIME_WEBHOOK_PLAN")
    expect(source).toContain('"eventType": "hooks.changed"')
    expect(source).toContain("webhookPlan: GENERATED_GRAPH_RUNTIME_WEBHOOK_PLAN")
  })

  it("statically lowers selected package runtime contributors", async () => {
    const resolved = await graphWithSelectedUnits([defineModule({ id: "@acme/voyant-loyalty" })])
    const graph = {
      ...resolved,
      packageRecords: resolved.packageRecords.map((record) => ({
        ...record,
        metadata: {
          schemaVersion: "voyant.package.v1" as const,
          kind: "module" as const,
          runtime: {
            entry: "./runtime-contributor",
            export: "createLoyaltyRuntimePortContribution",
          },
        },
      })),
    }

    const source = buildGraphRuntimeModule({ graph })

    expect(source).toContain(
      'import { createLoyaltyRuntimePortContribution as GENERATED_RUNTIME_CONTRIBUTOR_0 } from "@acme/voyant-loyalty/runtime-contributor"',
    )
    expect(source).toContain("export function createGeneratedGraphRuntimePorts(")
    expect(source).toContain("& Parameters<typeof GENERATED_RUNTIME_CONTRIBUTOR_0>[0]")
    expect(source).toContain('"@acme/voyant-loyalty/runtime-contributor"')
  })

  it("lowers only opted-in package admin factories into one selected bundle", async () => {
    const graph = await graphWithSelectedUnits([
      defineModule({
        id: "@acme/voyant-loyalty",
        admin: {
          runtime: { entry: "./admin", export: "createLoyaltyAdminExtension" },
          routes: [
            {
              id: "@acme/voyant-loyalty#admin.route.index",
              path: "/loyalty",
              runtime: { entry: "./admin", export: "createLoyaltyAdminExtension" },
            },
          ],
        },
      }),
      defineModule({
        id: "@acme/reports",
        admin: {
          routes: [
            {
              id: "@acme/reports#admin.route.index",
              path: "/reports",
              runtime: { entry: "./admin", export: "createReportsAdminExtension" },
            },
          ],
        },
      }),
    ])

    const source = buildGraphAdminBundleModule({ graph })

    expect(source).toContain(
      'import { createLoyaltyAdminExtension as selectedAdminFactory0 } from "@acme/voyant-loyalty/admin"',
    )
    expect(source).toContain('"@acme/voyant-loyalty": selectedAdminFactory0')
    expect(source).not.toContain("createReportsAdminExtension")
    expect(source).toContain("Page bodies stay lazy in package UI exports")
    expect(source).toContain("satisfies Readonly<Record<string, SelectedAdminExtensionFactory>>")
    expect(source).toContain("export function createSelectedGraphAdminExtensions(")
    expect(source).toContain("Object.values(selectedGraphAdminExtensionFactories)")
  })

  it("builds a deployment artifact manifest with relative runtime entries", async () => {
    const graph = await sampleGraph()
    const entry = buildNodeRuntimeEntryArtifact({
      graph,
      file: "src/runtime-entry.generated.ts",
    })

    expect(
      buildDeploymentArtifactManifest({
        graph,
        graphArtifactPath: "deployment-graph.generated.json",
        runtimeEntries: [entry],
        migrationSources: [
          {
            packageName: "@acme/voyant-loyalty",
            schema: "../../node_modules/@acme/voyant-loyalty/dist/schema.js",
          },
        ],
      }),
    ).toEqual({
      schemaVersion: VOYANT_DEPLOYMENT_ARTIFACTS_SCHEMA_VERSION,
      graphHash: graph.contentHash,
      graph: "deployment-graph.generated.json",
      accessCatalog: graph.accessCatalog,
      webhookPlan: { inbound: [], outbound: [] },
      runtimeEntries: [
        {
          id: VOYANT_NODE_RUNTIME_ENTRY_ID,
          target: "node",
          file: "src/runtime-entry.generated.ts",
          graphHash: graph.contentHash,
          kind: "node",
        },
      ],
      migrationSources: [
        {
          packageName: "@acme/voyant-loyalty",
          schema: "../../node_modules/@acme/voyant-loyalty/dist/schema.js",
        },
      ],
    })
  })

  it("lowers migration schema inputs only from selected migration owners", async () => {
    const foundation = defineModule({
      id: "@acme/foundation",
      schema: [{ id: "@acme/foundation#schema", source: "@acme/foundation/schema" }],
      migrations: [{ id: "@acme/foundation#migrations", source: "./migrations" }],
    })
    const feature = defineModule({
      id: "@acme/feature",
      schema: [{ id: "@acme/feature#schema", source: "@acme/feature/schema" }],
      migrations: [{ id: "@acme/feature#migrations", source: "./migrations" }],
    })
    const featureExtension = defineExtension({
      id: "@acme/feature#extension",
      packageName: "@acme/feature",
      schema: [{ id: "@acme/feature#schema.extension", source: "@acme/feature/schema" }],
    })
    const schemaOnly = defineModule({
      id: "@acme/schema-only",
      schema: [{ id: "@acme/schema-only#schema", source: "@acme/schema-only/schema" }],
    })

    const complete = await graphWithSelectedUnits(
      [foundation, feature, schemaOnly],
      [],
      [featureExtension],
    )
    const subset = await graphWithSelectedUnits([foundation])

    expect(buildDeploymentMigrationSources(complete)).toEqual([
      { packageName: "@acme/feature", schema: "@acme/feature/schema" },
      { packageName: "@acme/foundation", schema: "@acme/foundation/schema" },
    ])
    expect(buildDeploymentMigrationSources(subset)).toEqual([
      { packageName: "@acme/foundation", schema: "@acme/foundation/schema" },
    ])
  })

  it("builds a tiny managed Node runtime entry tied to the graph hash", async () => {
    const graph = await sampleGraph()
    const source = buildNodeRuntimeEntry({
      graph,
      graphArtifactPath: "../deployment-graph.generated.json",
      command: "pnpm --filter operator graph:emit",
    })

    expect(source).toContain(`GENERATED_DEPLOYMENT_GRAPH_HASH = "${graph.contentHash}"`)
    expect(source).toContain('import { readFileSync } from "node:fs"')
    expect(source).toContain('from "node:url"')
    expect(source).toContain("assertGeneratedDeploymentGraphArtifact()")
    expect(source).toContain("resolveGeneratedDeploymentRequirements")
    expect(source).toContain("resolveGeneratedRuntimeDeployment")
    expect(source).toContain('await import("@voyant-travel/framework/node-runtime")')
    expect(
      source.indexOf("if (isMainModule) {\n  assertGeneratedDeploymentGraphArtifact()"),
    ).toBeLessThan(source.indexOf('await import("@voyant-travel/framework/node-runtime")'))
    expect(source).toContain("startVoyantNodeRuntime")
    expect(source).not.toContain("profileSnapshotPath:")
    expect(source).toContain("deployment: resolveGeneratedRuntimeDeployment()")
    expect(source).toContain("deploymentRequirements: resolveGeneratedDeploymentRequirements()")
    expect(source).toContain('from "./graph-runtime.generated.js"')
    expect(source).toContain("graphRuntime: createGeneratedGraphRuntime()")
    expect(source).not.toContain("starters/")
  })

  it("lowers selected graph runtime references into deterministic lazy source", async () => {
    const graph = await sampleGraph()
    const first = buildGraphRuntimeModule({ graph, command: "voyant graph runtime emit" })
    const second = buildGraphRuntimeModule({ graph, command: "voyant graph runtime emit" })

    expect(first).toBe(second)
    expect(first).toContain(`GENERATED_GRAPH_RUNTIME_HASH = "${graph.contentHash}"`)
    expect(first).toContain(
      '"@acme/voyant-loyalty/runtime-body-that-must-stay-lazy": () => import("@acme/voyant-loyalty/runtime-body-that-must-stay-lazy")',
    )
    expect(first).toContain('"@acme/voyant-loyalty#api.admin"')
    expect(first).toContain('"createLoyaltyModule"')
    expect(first).toContain("createGeneratedGraphRuntime")
    expect(first).not.toContain("FRAMEWORK_RUNTIME_MANIFEST")
  })

  it("emits a workflow-only runtime without API or module loaders", async () => {
    const graph = await graphWithSelectedUnits([
      defineModule({
        id: "@acme/voyant-loyalty",
        runtime: { entry: "./runtime", export: "createLoyaltyModule" },
        api: [
          {
            id: "loyalty.api",
            surface: "admin",
            runtime: { entry: "./api", export: "loyaltyRoutes" },
          },
        ],
        workflows: [
          {
            id: "loyalty.reconcile",
            runtime: { entry: "./workflows", export: "reconcileWorkflow" },
          },
        ],
      }),
    ])
    const source = buildGraphWorkflowRuntimeModule({ graph })

    expect(source).toContain("createGeneratedWorkflowRuntime")
    expect(source).toContain('"workflows.runtime"')
    expect(source).toContain('"reconcileWorkflow"')
    expect(source).not.toContain('"createLoyaltyModule"')
    expect(source).not.toContain('"loyaltyRoutes"')
    expect(source).not.toContain('import("@acme/voyant-loyalty/api")')
  })

  it("preserves and lowers unit runtimes for modules, extensions, and plugins", async () => {
    const module = defineModule({
      id: "@acme/catalog",
      runtime: { entry: "./runtime", export: "createCatalogModule" },
    })
    const extension = defineExtension({
      id: "@acme/catalog#admin",
      runtime: { entry: "./admin-runtime", export: "createCatalogAdmin" },
    })
    const plugin = definePlugin({
      id: "@acme/catalog#audit",
      runtime: { entry: "./audit-runtime", export: "createCatalogAudit" },
    })
    const graph = await graphWithSelectedUnits([module], [plugin], [extension])
    const withoutRuntime = await graphWithSelectedUnits([defineModule({ id: "@acme/catalog" })])

    expect(graph.contentHash).not.toBe(withoutRuntime.contentHash)
    expect(graph.modules[0]?.runtime).toEqual(module.runtime)
    expect(graph.extensions[0]?.runtime).toEqual(extension.runtime)
    expect(graph.plugins[0]?.runtime).toEqual(plugin.runtime)
    expect(JSON.parse(buildDeploymentGraphJson(graph))).toMatchObject({
      modules: [{ runtime: module.runtime }],
      extensions: [{ runtime: extension.runtime }],
      plugins: [{ runtime: plugin.runtime }],
    })

    const source = buildGraphRuntimeModule({ graph })
    expect(source.match(/"facet": "runtime"/g)).toHaveLength(3)
    expect(source).toContain('import("@acme/catalog/runtime")')
    expect(source).toContain('import("@acme/catalog/admin-runtime")')
    expect(source).toContain('import("@acme/catalog/audit-runtime")')
    expect(source).toContain('"runtimeReferenceId": "%40acme%2Fcatalog/runtime/%40acme%2Fcatalog"')
    expect(source).toContain('"kind": "extension"')
    expect(source).toContain('"kind": "plugin"')
  })

  it("lowers every package-owned executable facet through deduplicated lazy imports", async () => {
    const graph = await graphWithSelectedUnits([
      defineModule({
        id: "@acme/voyant-loyalty",
        api: [
          {
            id: "loyalty.api",
            surface: "webhook",
            runtime: { entry: "./runtime", export: "createRoutes" },
          },
        ],
        config: [
          {
            id: "loyalty.config",
            key: "loyalty",
            validator: { entry: "./runtime", export: "configSchema" },
          },
        ],
        secrets: [
          {
            id: "loyalty.secret",
            key: "LOYALTY_TOKEN",
            validator: { entry: "./runtime", export: "secretSchema" },
          },
        ],
        resources: [
          {
            id: "loyalty.resource",
            kind: "http-service",
            required: true,
            config: { service: "loyalty" },
          },
        ],
        providers: [
          {
            id: "loyalty.provider",
            port: "loyalty.ledger",
            runtime: { entry: "./runtime", export: "createLedgerProvider" },
          },
        ],
        access: {
          resources: [
            {
              id: "loyalty.access",
              resource: "loyalty",
              actions: ["read", "write"],
            },
          ],
        },
        admin: {
          copy: [
            {
              id: "loyalty.copy",
              namespace: "loyalty",
              fallbackLocale: "en",
              runtime: { entry: "./admin", export: "copy" },
            },
          ],
          routes: [
            {
              id: "loyalty.admin.route",
              path: "/loyalty",
              runtime: { entry: "./admin", export: "LoyaltyPage" },
            },
          ],
          slots: [{ id: "loyalty.slot", routeId: "loyalty.admin.route" }],
          contributions: [
            {
              id: "loyalty.balance",
              slotId: "loyalty.slot",
              runtime: { entry: "./admin", export: "BalanceWidget" },
            },
          ],
        },
        tools: [
          {
            id: "loyalty.adjust",
            name: "adjust_loyalty",
            runtime: { entry: "./runtime", export: "adjustLoyalty" },
            requiredScopes: ["loyalty:write"],
          },
        ],
        workflows: [
          {
            id: "loyalty.reconcile",
            runtime: { entry: "./runtime", export: "reconcileWorkflow" },
          },
        ],
        events: [{ id: "loyalty.event", eventType: "loyalty.changed" }],
        webhooks: [
          {
            id: "loyalty.webhook",
            direction: "inbound",
            apiId: "loyalty.api",
          },
        ],
        actions: [
          {
            id: "loyalty.points.adjust",
            version: "v1",
            kind: "execute",
            targetType: "loyalty_account",
            requiredScopes: ["loyalty:write"],
            risk: "medium",
            ledger: "required",
            from: {
              routes: ["loyalty.api"],
              tools: ["loyalty.adjust"],
              workflows: ["loyalty.reconcile"],
              events: ["loyalty.event"],
              webhooks: ["loyalty.webhook"],
            },
          },
        ],
        subscribers: [
          {
            id: "loyalty.changed",
            eventType: "loyalty.changed",
            runtime: { entry: "./runtime", export: "loyaltyChangedFilter" },
          },
        ],
      }),
    ])

    const source = buildGraphRuntimeModule({ graph })

    for (const facet of [
      "api",
      "config.validator",
      "secrets.validator",
      "providers.runtime",
      "admin.copy.runtime",
      "admin.routes.runtime",
      "admin.contributions.runtime",
      "tools.runtime",
      "workflows.runtime",
      "subscribers.runtime",
    ]) {
      expect(source).toContain(`"facet": "${facet}"`)
    }
    expect(source.match(/import\("@acme\/voyant-loyalty\/runtime"\)/g)).toHaveLength(1)
    expect(source.match(/import\("@acme\/voyant-loyalty\/admin"\)/g)).toHaveLength(1)
    expect(source).toContain('"accessScopes": [')
    expect(source).toContain('"loyalty:write"')
    expect(source).toContain('"tools": [')
    expect(source).toContain('"name": "adjust_loyalty"')
    expect(source).toContain('"workflows": [')
    expect(source).toContain(
      '"referenceId": "%40acme%2Fvoyant-loyalty/workflows.runtime/loyalty.reconcile"',
    )
    expect(source).toContain('"config": [')
    expect(source).toContain('"declaration": {')
    expect(source).toContain('"key": "loyalty"')
    expect(source).toContain('"resources": [')
    expect(source).toContain('"kind": "http-service"')
    expect(source).toContain('"providers": [')
    expect(source).toContain('"actions": [')
    expect(source).toContain('"id": "loyalty.points.adjust"')
    expect(source).toContain('"selectedIds": {')
    expect(source).toContain('"loyalty.event"')
    expect(source).toContain('"loyalty.webhook"')
  })

  it("builds one target-neutral whole-application runtime", async () => {
    const graph = await sampleGraph()
    const targetNeutralGraph = {
      ...graph,
      deployment: { mode: graph.deployment.mode, providers: graph.deployment.providers },
    }
    const source = buildProjectRuntimeModule({ graph: targetNeutralGraph })

    expect(source).toContain('GENERATED_PROJECT_RUNTIME_KIND = "application"')
    expect(source).toContain(`graphHash: GENERATED_GRAPH_RUNTIME_HASH`)
    expect(source).toContain(`GENERATED_GRAPH_RUNTIME_HASH = "${graph.contentHash}"`)
    expect(source).not.toContain("starters/")
    expect(() => buildProjectRuntimeModule({ graph })).toThrow(/must be target-neutral/)
  })

  it("removes package importers and loaders when the package is not selected", async () => {
    const loyalty = defineModule({
      id: "@acme/voyant-loyalty",
      api: [
        {
          id: "@acme/voyant-loyalty#api.admin",
          surface: "admin",
          runtime: { entry: "@acme/voyant-loyalty", export: "loyaltyModule" },
        },
      ],
    })
    const crm = defineModule({
      id: "@acme/voyant-crm",
      api: [
        {
          id: "@acme/voyant-crm#api.admin",
          surface: "admin",
          runtime: { entry: "@acme/voyant-crm", export: "crmModule" },
        },
      ],
    })
    const auditPlugin = definePlugin({
      id: "@acme/voyant-loyalty#audit-plugin",
      api: [
        {
          id: "@acme/voyant-loyalty#audit-plugin.api",
          surface: "internal",
          runtime: { entry: "./audit-runtime", export: "auditExtension" },
        },
      ],
    })

    const complete = buildGraphRuntimeModule({
      graph: await graphWithSelectedUnits([loyalty, crm], [auditPlugin]),
    })
    const withoutCrm = buildGraphRuntimeModule({
      graph: await graphWithSelectedUnits([loyalty], [auditPlugin]),
    })

    expect(complete).toContain('import("@acme/voyant-crm")')
    expect(complete).toContain('"@acme/voyant-crm#api.admin"')
    expect(withoutCrm).not.toContain("@acme/voyant-crm")
    expect(withoutCrm).toContain('import("@acme/voyant-loyalty")')
    expect(withoutCrm).toContain('import("@acme/voyant-loyalty/audit-runtime")')
    expect(withoutCrm).toContain('kind": "plugin"')
  })

  it("keeps selected local units graph-gated without generating package importers", async () => {
    const local = defineModule({ id: "@acme/operator#invitations" })
    const source = buildGraphRuntimeModule({
      graph: await graphWithSelectedUnits([local], []),
    })

    expect(source).toContain('"@acme/operator#invitations"')
    expect(source).toContain('"routes": []')
    expect(source).toContain("{} satisfies Readonly<Record<string, () => Promise<unknown>>>")
    expect(source).not.toContain('import("@acme/operator")')
  })

  it("does not import package runtime bodies during graph resolution or generation", async () => {
    const graph = await sampleGraph()

    await expect(sampleGraph()).resolves.toEqual(graph)
    expect(() => buildGraphRuntimeModule({ graph })).not.toThrow()
  })

  it("refuses to emit runtime imports for a graph with unadmitted references", async () => {
    const graph = await resolveDeploymentGraph({
      project: defineProject({
        modules: [
          defineModule({
            id: "@acme/voyant-loyalty",
            api: [
              {
                id: "@acme/voyant-loyalty#api.admin",
                surface: "admin",
                runtime: { entry: "@unknown/runtime", export: "routes" },
              },
            ],
          }),
        ],
      }),
      packageRecords: [{ packageName: "@acme/voyant-loyalty", source: { kind: "workspace" } }],
    })

    expect(() => buildGraphRuntimeModule({ graph })).toThrow(
      /VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED/,
    )
  })

  it("refuses unadmitted package references from non-route facets", async () => {
    const graph = await graphWithSelectedUnits([
      defineModule({
        id: "@acme/voyant-loyalty",
        providers: [
          {
            id: "loyalty.provider",
            port: "loyalty.ledger",
            runtime: { entry: "@unknown/ledger", export: "provider" },
          },
        ],
      }),
    ])

    expect(() => buildGraphRuntimeModule({ graph })).toThrow(
      /VOYANT_GRAPH_RUNTIME_PACKAGE_UNADMITTED.*providers\.runtime/,
    )
  })

  it("rejects absolute artifact paths", async () => {
    const graph = await sampleGraph()

    expect(() =>
      buildNodeRuntimeEntryArtifact({
        graph,
        file: "/tmp/runtime-entry.generated.ts",
      }),
    ).toThrow(/relative path/)
  })

  it("rejects runtime entry artifacts with a mismatched graph hash", async () => {
    const graph = await sampleGraph()
    const entry = buildNodeRuntimeEntryArtifact({
      graph,
      file: "src/runtime-entry.generated.ts",
    })

    expect(() =>
      buildDeploymentArtifactManifest({
        graph,
        graphArtifactPath: "deployment-graph.generated.json",
        runtimeEntries: [{ ...entry, graphHash: "sha256:stale" }],
      }),
    ).toThrow(/graphHash must match/)
  })
})
