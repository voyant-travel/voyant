import { describe, expect, it } from "vitest"
import { createAppsRuntimePortContribution } from "./runtime-contributor.js"
import { appsManagedAuthRuntimePort, appsManagedMarketplaceRuntimePort } from "./runtime-port.js"

function host(values: Readonly<Record<string, unknown>>) {
  return {
    hasRuntimePort: () => false,
    primitives: {
      config: { read: (_bindings: unknown, key: string) => values[key] },
    },
  }
}

describe("createAppsRuntimePortContribution", () => {
  it("stays off because scalar environment values cannot authorize managed installations", () => {
    expect(createAppsRuntimePortContribution(host({}))).toEqual({})
    expect(
      createAppsRuntimePortContribution(
        host({
          VOYANT_APP_RUNTIME_AUDIENCE: "deployment-1",
          VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "s".repeat(32),
        }),
      ),
    ).toEqual({})
  })

  it("does not replace an explicitly host-provided managed-auth port", () => {
    const contribution = createAppsRuntimePortContribution({
      ...host({
        VOYANT_APP_RUNTIME_AUDIENCE: "deployment-from-env",
        VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "s".repeat(32),
      }),
      hasRuntimePort: (port) => port.id === appsManagedAuthRuntimePort.id,
    })

    expect(contribution).toEqual({})
  })

  it("resolves independent per-app generations within one workload environment", async () => {
    const generations = new Map([
      ["app_1", 2],
      ["app_2", 9],
    ])
    const runtime = {
      runtimeAudience: "runtime-audience",
      installationAuthority: {
        workloadEnvironmentId: "workload_environment_1",
        resolveInstallationContract: async ({ appId }: { appId: string; releaseId: string }) => ({
          contractGeneration: generations.get(appId) ?? 0,
        }),
      },
      sessionTokenSigningSecret: "s".repeat(32),
    }

    expect(() => appsManagedAuthRuntimePort.test(runtime)).not.toThrow()
    await expect(
      runtime.installationAuthority.resolveInstallationContract({
        appId: "app_1",
        releaseId: "release_1",
      }),
    ).resolves.toEqual({ contractGeneration: 2 })
    await expect(
      runtime.installationAuthority.resolveInstallationContract({
        appId: "app_2",
        releaseId: "release_2",
      }),
    ).resolves.toEqual({ contractGeneration: 9 })
  })

  it("requires both opaque acquisition resolution and trusted setup handoff", () => {
    expect(() =>
      appsManagedMarketplaceRuntimePort.test({
        deploymentId: "deployment-1",
        acquisitionResolver: {
          resolveAcquisitionIntent: async () => null,
          createSetupHandoff: async () => ({
            redirectUrl: "https://app.example.com/setup?code=opaque",
          }),
          notifyInstallationLifecycle: async () => undefined,
          completeInstallationSetup: async () => undefined,
        },
      }),
    ).not.toThrow()
    expect(() =>
      appsManagedMarketplaceRuntimePort.test({
        deploymentId: "deployment-1",
        acquisitionResolver: { resolveAcquisitionIntent: async () => null },
      } as never),
    ).toThrow(/createSetupHandoff/)
    expect(() =>
      appsManagedMarketplaceRuntimePort.test({
        deploymentId: "deployment-1",
        acquisitionResolver: {
          resolveAcquisitionIntent: async () => null,
          createSetupHandoff: async () => ({
            redirectUrl: "https://app.example.com/setup?code=opaque",
          }),
        },
      } as never),
    ).toThrow(/notifyInstallationLifecycle/)
    expect(() =>
      appsManagedMarketplaceRuntimePort.test({
        deploymentId: "deployment-1",
        acquisitionResolver: {
          resolveAcquisitionIntent: async () => null,
          createSetupHandoff: async () => ({
            redirectUrl: "https://app.example.com/setup?code=opaque",
          }),
          notifyInstallationLifecycle: async () => undefined,
        },
      } as never),
    ).toThrow(/completeInstallationSetup/)
    expect(() =>
      appsManagedMarketplaceRuntimePort.test({
        deploymentId: "",
        acquisitionResolver: {
          resolveAcquisitionIntent: async () => null,
          createSetupHandoff: async () => ({
            redirectUrl: "https://app.example.com/setup?code=opaque",
          }),
          notifyInstallationLifecycle: async () => undefined,
          completeInstallationSetup: async () => undefined,
        },
      }),
    ).toThrow(/deploymentId/)
  })
})
