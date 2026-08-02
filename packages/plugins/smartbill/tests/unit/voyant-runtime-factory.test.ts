import type { BootstrapContext } from "@voyant-travel/core"
import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"

import {
  createSmartbillVoyantRuntime,
  SMARTBILL_RUNTIME_HOST_KEY,
  type SmartbillRuntimeHost,
  smartbillRuntimeHostPort,
} from "../../src/graph-runtime.js"
import { SMARTBILL_ADMIN_RUNTIME_CONTAINER_KEY } from "../../src/hono.js"

describe("SmartBill selected graph runtime factory", () => {
  it("resolves the typed host and registers it before admin bootstrap", async () => {
    const bindings = { deployment: "node" }
    const host: SmartbillRuntimeHost = {
      resolveConfig: vi.fn(() => ({
        username: "office@example.com",
        apiToken: "token",
        companyVatCode: "RO123",
        seriesName: "INV",
      })),
      resolveDatabase: vi.fn(() => ({}) as never),
      resolveDocumentStorage: vi.fn(() => null),
    }
    const getPort = vi.fn(async () => host)
    const configured = await createSmartbillVoyantRuntime({
      unitId: "@voyant-travel/plugin-smartbill",
      projectConfig: {},
      api: [{ id: "@voyant-travel/plugin-smartbill#api.admin", surface: "admin" }],
      hasPort: () => true,
      getPort,
    })
    const services = new Map<string, unknown>()
    const context = {
      bindings,
      container: {
        register: (key: string, value: unknown) => services.set(key, value),
      },
      eventBus: {},
    } as unknown as BootstrapContext

    await configured.module.bootstrap?.(context)

    expect(isGraphRuntimeFactory(createSmartbillVoyantRuntime)).toBe(true)
    expect(getPort).toHaveBeenCalledWith(smartbillRuntimeHostPort)
    expect(services.get(SMARTBILL_RUNTIME_HOST_KEY)).toBe(host)
    expect(services.get(SMARTBILL_ADMIN_RUNTIME_CONTAINER_KEY)).toMatchObject({
      pluginOptions: {
        username: "office@example.com",
        companyVatCode: "RO123",
        seriesName: "INV",
      },
    })
    expect(host.resolveConfig).toHaveBeenCalledWith(bindings)
    expect(configured.adminRoutes).toBeDefined()
  })

  it("fails clearly when a selected deployment has no SmartBill config", async () => {
    const host: SmartbillRuntimeHost = {
      resolveConfig: () => null,
      resolveDatabase: () => ({}) as never,
    }
    const configured = await createSmartbillVoyantRuntime({
      unitId: "@voyant-travel/plugin-smartbill",
      projectConfig: {},
      api: [{ id: "@voyant-travel/plugin-smartbill#api.admin", surface: "admin" }],
      hasPort: () => true,
      getPort: async () => host,
    })

    await expect(
      configured.module.bootstrap?.({
        bindings: {},
        container: { register: () => {} },
        eventBus: {},
      } as unknown as BootstrapContext),
    ).rejects.toThrow("deployment configuration is unavailable")
  })
})
