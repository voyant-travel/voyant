import { describe, expect, it } from "vitest"

import { defineModule, defineProject, resolveDeploymentGraph } from "./deployment-graph.js"
import {
  createVoyantGraphLifecyclePlan,
  executeVoyantGraphLifecyclePlan,
  type VoyantGraphLifecycleExecutionState,
  type VoyantGraphLifecycleExecutor,
  VoyantGraphLifecyclePlanError,
  validateVoyantGraphEventCompatibility,
} from "./graph-lifecycle.js"

describe("graph lifecycle", () => {
  it("lowers upgrades into deterministic migration, detach, cleanup, and activation steps", async () => {
    const previous = await graph({
      eventVersion: "1.0.0",
      includeResource: true,
      cleanupOnUpgrade: true,
    })
    const next = await graph({ eventVersion: "1.1.0" })

    const plan = createVoyantGraphLifecyclePlan({
      operationId: "upgrade-42",
      operation: "upgrade",
      previous,
      next,
    })

    expect(plan.steps.map((step) => [step.kind, step.unitId, step.resourceId])).toEqual([
      ["migrate-graph", undefined, undefined],
      ["detach-unit", "@acme/loyalty", undefined],
      ["release-resource", "@acme/loyalty", "@acme/loyalty#resource.cache"],
      ["activate-unit", "@acme/loyalty", undefined],
    ])
    expect(plan.steps.every((step) => step.idempotencyKey.startsWith("upgrade-42:"))).toBe(true)
  })

  it("treats a selected package version change as an upgrade when facets are unchanged", async () => {
    const graph = await resolveDeploymentGraph({
      project: defineProject({ modules: [defineModule({ id: "@acme/loyalty" })] }),
    })
    const packageRecord = {
      packageName: "@acme/loyalty",
      source: { kind: "registry" as const },
    }
    const previous = {
      ...graph,
      contentHash: "sha256:previous",
      packageRecords: [{ ...packageRecord, version: "1.0.0" }],
    }
    const next = {
      ...graph,
      contentHash: "sha256:next",
      packageRecords: [{ ...packageRecord, version: "1.1.0" }],
    }

    const plan = createVoyantGraphLifecyclePlan({
      operationId: "upgrade-loyalty-version",
      operation: "upgrade",
      previous,
      next,
    })

    expect(plan.steps.map((step) => step.id)).toEqual([
      "migrate-graph:graph",
      "detach-unit:@acme/loyalty",
      "activate-unit:@acme/loyalty",
    ])
  })

  it("persists completed steps, rolls back reversible work, and safely retries", async () => {
    const previous = await graph({ eventVersion: "1.0.0" })
    const next = await graph({ eventVersion: "1.1.0" })
    const plan = createVoyantGraphLifecyclePlan({
      operationId: "upgrade-retry",
      operation: "upgrade",
      previous,
      next,
    })
    let state: VoyantGraphLifecycleExecutionState | undefined
    const calls: string[] = []
    let failActivation = true
    const executor: VoyantGraphLifecycleExecutor = {
      async execute(step) {
        calls.push(`execute:${step.id}`)
        if (step.kind === "activate-unit" && failActivation) {
          failActivation = false
          throw new Error("activation failed")
        }
        return { rollbackToken: step.id }
      },
      async rollback(step, context) {
        calls.push(`rollback:${step.id}:${String(context.rollbackToken)}`)
      },
    }
    const store = {
      async load() {
        return state
      },
      async save(nextState: VoyantGraphLifecycleExecutionState) {
        state = structuredClone(nextState)
      },
    }

    const failed = await executeVoyantGraphLifecyclePlan(plan, store, executor)
    expect(failed.status).toBe("rolled-back")
    expect(failed.error).toBe("activation failed")
    expect(calls).toEqual([
      "execute:migrate-graph:graph",
      "execute:detach-unit:@acme/loyalty",
      "execute:activate-unit:@acme/loyalty",
      "rollback:detach-unit:@acme/loyalty:detach-unit:@acme/loyalty",
    ])

    const completed = await executeVoyantGraphLifecyclePlan(plan, store, executor)
    expect(completed.status).toBe("completed")
    expect(completed.attempt).toBe(2)
  })

  it("uninstalls only removed units when surviving unit order changes", async () => {
    const removed = defineModule({ id: "@acme/alpha" })
    const retained = defineModule({ id: "@acme/loyalty" })
    const previous = await resolveDeploymentGraph({
      project: defineProject({ modules: [removed, retained] }),
    })
    const next = await resolveDeploymentGraph({ project: defineProject({ modules: [retained] }) })

    const plan = createVoyantGraphLifecyclePlan({
      operationId: "uninstall-alpha",
      operation: "uninstall",
      previous,
      next,
    })

    expect(plan.steps.map((step) => step.id)).toEqual(["detach-unit:@acme/alpha"])
  })

  it("accounts for detachable surfaces and retained durable data without package hooks", async () => {
    const base = await graph({ eventVersion: "1.0.0" })
    const unit = base.modules[0]!
    const previous = {
      ...base,
      modules: [
        {
          ...unit,
          runtime: { entry: "@acme/loyalty/runtime", export: "createLoyaltyRuntime" },
          api: [
            {
              id: "@acme/loyalty#api.admin",
              surface: "admin" as const,
              runtime: { entry: "@acme/loyalty/routes", export: "createLoyaltyRoutes" },
            },
          ],
          schema: [{ id: "@acme/loyalty#schema", source: "@acme/loyalty/schema" }],
          migrations: [{ id: "@acme/loyalty#migrations", source: "./migrations" }],
          resources: [
            { id: "@acme/loyalty#resource.database", kind: "database", required: true },
            { id: "@acme/loyalty#resource.cache", kind: "cache", required: false },
          ],
          config: [{ id: "@acme/loyalty#config.ttl", key: "ttl", required: false, default: 60 }],
          secrets: [{ id: "@acme/loyalty#secret.token", key: "token", required: true }],
          tools: [
            {
              id: "@acme/loyalty#tool.list",
              name: "list_loyalty",
              runtime: { entry: "@acme/loyalty/tools", export: "listLoyalty" },
            },
          ],
          lifecycle: {
            uninstall: { default: "retain-data" as const },
            cleanup: [
              {
                id: "@acme/loyalty#cleanup.cache",
                resourceId: "@acme/loyalty#resource.cache",
                on: ["uninstall"] as const,
                action: "release" as const,
              },
            ],
          },
        },
      ],
    }
    const next = await resolveDeploymentGraph({ project: defineProject({ modules: [] }) })

    const plan = createVoyantGraphLifecyclePlan({
      operationId: "uninstall-loyalty",
      operation: "uninstall",
      previous,
      next,
    })

    expect(plan.consequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "detach", facet: "api" }),
        expect.objectContaining({ action: "detach", facet: "config" }),
        expect.objectContaining({ action: "detach", facet: "secret" }),
        expect.objectContaining({ action: "detach", facet: "tool" }),
        expect.objectContaining({
          action: "retain-data",
          entityId: "@acme/loyalty#schema",
        }),
        expect.objectContaining({
          action: "retain-data",
          entityId: "@acme/loyalty#resource.database",
        }),
        expect.objectContaining({
          action: "release",
          entityId: "@acme/loyalty#resource.cache",
        }),
      ]),
    )
    expect(
      plan.consequences.some(
        (entry) =>
          entry.action === "retain-data" && entry.entityId === "@acme/loyalty#resource.cache",
      ),
    ).toBe(false)
  })

  it("resumes rollback before executing more work after an interrupted rollback", async () => {
    const previous = await graph({ eventVersion: "1.0.0" })
    const next = await graph({ eventVersion: "1.1.0" })
    const plan = createVoyantGraphLifecyclePlan({
      operationId: "upgrade-rollback-resume",
      operation: "upgrade",
      previous,
      next,
    })
    let state: VoyantGraphLifecycleExecutionState | undefined
    let rollbackFails = true
    const calls: string[] = []
    const executor: VoyantGraphLifecycleExecutor = {
      async execute(step) {
        calls.push(`execute:${step.id}`)
        if (step.kind === "activate-unit") throw new Error("activate failed")
      },
      async rollback(step) {
        calls.push(`rollback:${step.id}`)
        if (rollbackFails) {
          rollbackFails = false
          throw new Error("rollback interrupted")
        }
      },
    }
    const store = {
      async load() {
        return state
      },
      async save(nextState: VoyantGraphLifecycleExecutionState) {
        state = structuredClone(nextState)
      },
    }

    await expect(executeVoyantGraphLifecyclePlan(plan, store, executor)).rejects.toThrow(
      "rollback interrupted",
    )
    expect(state?.status).toBe("rolling-back")
    const resumed = await executeVoyantGraphLifecyclePlan(plan, store, executor)
    expect(resumed.status).toBe("rolled-back")
    expect(calls.filter((call) => call.startsWith("execute:"))).toHaveLength(3)
  })

  it("rejects same-major event payload narrowing and accepts additive evolution", async () => {
    const previous = await graph({ eventVersion: "1.0.0" })
    const additive = await graph({ eventVersion: "1.1.0", addOptionalField: true })
    const breaking = await graph({ eventVersion: "1.1.0", requireCurrency: true })
    const nextMajor = await graph({ eventVersion: "2.0.0", requireCurrency: true })
    const downgrade = await graph({ eventVersion: "0.9.0" })
    const removedContract = await graph({ eventVersion: "1.1.0", omitContract: true })

    expect(validateVoyantGraphEventCompatibility(previous, additive)).toEqual([])
    expect(validateVoyantGraphEventCompatibility(previous, breaking)).toEqual([
      expect.objectContaining({
        code: "VOYANT_GRAPH_INCOMPATIBLE_EVENT_SCHEMA",
        facet: "@acme/loyalty#event.changed",
        message: expect.stringContaining("$.currency became required"),
      }),
    ])
    expect(() =>
      createVoyantGraphLifecyclePlan({
        operationId: "breaking-upgrade",
        operation: "upgrade",
        previous,
        next: breaking,
      }),
    ).toThrow(VoyantGraphLifecyclePlanError)
    expect(validateVoyantGraphEventCompatibility(previous, nextMajor)).toEqual([])
    expect(validateVoyantGraphEventCompatibility(previous, downgrade)[0]?.message).toContain(
      "version 0.9.0 is older than 1.0.0",
    )
    expect(validateVoyantGraphEventCompatibility(previous, removedContract)[0]?.message).toContain(
      "versioned payload contract was removed",
    )
  })
})

async function graph(options: {
  eventVersion: string
  addOptionalField?: boolean
  requireCurrency?: boolean
  includeResource?: boolean
  cleanupOnUpgrade?: boolean
  omitContract?: boolean
}) {
  const module = defineModule({
    id: "@acme/loyalty",
    events: [
      {
        id: "@acme/loyalty#event.changed",
        eventType: "loyalty.changed",
        visibility: "internal",
        audit: { sourceModule: "loyalty", category: "domain" },
        ...(options.omitContract
          ? {}
          : {
              version: options.eventVersion,
              payloadSchema: {
                type: "object",
                properties: {
                  accountId: { type: "string" },
                  ...(options.addOptionalField || options.requireCurrency
                    ? { currency: { type: "string" } }
                    : {}),
                },
                required: ["accountId", ...(options.requireCurrency ? ["currency"] : [])],
              },
            }),
      },
    ],
    ...(options.includeResource
      ? {
          resources: [{ id: "@acme/loyalty#resource.cache", kind: "cache", required: false }],
          lifecycle: {
            uninstall: { default: "retain-data" as const },
            cleanup: [
              {
                id: "@acme/loyalty#cleanup.cache",
                resourceId: "@acme/loyalty#resource.cache",
                on: options.cleanupOnUpgrade
                  ? (["upgrade", "uninstall"] as const)
                  : (["uninstall"] as const),
                action: "release" as const,
              },
            ],
          },
        }
      : {}),
  })
  return resolveDeploymentGraph({ project: defineProject({ modules: [module] }) })
}
