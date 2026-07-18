import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import { createAppsApiModule } from "./api-runtime.js"
import { appsManagedAuthRuntimePort } from "./runtime-port.js"

const graph = {
  providerSelections: {},
  customFieldTargets: [],
  accessCatalog: { resources: [], presets: [] },
  eventCatalog: { schemaVersion: "voyant.event-catalog.v1", events: [] },
  tools: [],
  references: [],
  setupSteps: [],
} as const

function context(managedAuth?: {
  runtimeAudience: string
  installationAuthority: {
    workloadEnvironmentId: string
    resolveInstallationContract: () => Promise<{ contractGeneration: number }>
  }
  sessionTokenSigningSecret: string
  sessionTokenTtlSeconds?: number
}): VoyantGraphRuntimeFactoryContext {
  return {
    unitId: "@voyant-travel/apps",
    projectConfig: {},
    getUnitProjectConfig: () => undefined,
    api: [],
    graph,
    runtimePorts: managedAuth ? { [appsManagedAuthRuntimePort.id]: managedAuth } : {},
    hasPort: (port) => port.id === appsManagedAuthRuntimePort.id && managedAuth !== undefined,
    getPort: async (port) => {
      if (port.id === appsManagedAuthRuntimePort.id && managedAuth) return managedAuth as never
      throw new Error(`missing ${port.id}`)
    },
    getPorts: async () => [],
  }
}

describe("createAppsApiModule", () => {
  it("keeps managed auth and client-authenticated routes off without host inputs", async () => {
    const module = await createAppsApiModule(context())

    expect(module.clientAuthenticated).toBeUndefined()
    expect(module.authAugmentation).toBeUndefined()
  })

  it("composes OAuth, session exchange, and token resolution from the host port", async () => {
    const module = await createAppsApiModule(
      context({
        runtimeAudience: "deployment-1",
        installationAuthority: {
          workloadEnvironmentId: "workload-environment-1",
          resolveInstallationContract: async () => ({ contractGeneration: 1 }),
        },
        sessionTokenSigningSecret: "s".repeat(32),
        sessionTokenTtlSeconds: 180,
      }),
    )

    expect(module.clientAuthenticated).toEqual([
      { method: "POST", path: "/oauth/token" },
      { method: "POST", path: "/oauth/session-token/exchange" },
    ])
    expect(module.authAugmentation?.resolveAppToken).toBeTypeOf("function")
    await expect(
      module.authAugmentation?.resolveAppToken({
        request: new Request("http://test/v1/app"),
        env: { DATABASE_URL: "postgres://test" },
        db: {} as never,
        token: "test-token",
      }),
    ).resolves.toBeNull()
  })
})
