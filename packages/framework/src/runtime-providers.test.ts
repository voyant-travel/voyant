import { describe, expect, it, type Mock, vi } from "vitest"

import { type CreateVoyantGraphRuntimeInput, createVoyantGraphRuntime } from "./runtime-lowering.js"
import {
  resolveVoyantGraphRuntimeProviders,
  VoyantGraphRuntimeProviderError,
} from "./runtime-providers.js"

function createRuntime(options: {
  selection?: string
  duplicate?: boolean
  importProvider?: Mock<() => Promise<unknown>>
}) {
  const importProvider =
    options.importProvider ??
    vi.fn(async () => ({
      createProvider: vi.fn((context) => ({
        endpoint: context.getConfig("config.endpoint"),
        token: context.getSecret("secret.token"),
        resource: context.resources[0]?.declaration.kind,
      })),
    }))
  const unitId = "@acme/ledger"
  const provider = (id: string, value: string, referenceId: string) => ({
    unitId,
    declaration: {
      id,
      port: "ledger.client",
      selection: { role: "ledger", value },
      runtime: { entry: "./provider", export: "createProvider" },
      config: { transport: "https" },
    },
    referenceId,
  })
  const references = [
    {
      id: "provider-a",
      unitId,
      facet: "providers.runtime" as const,
      entityId: "provider.a",
      runtime: { entry: "./provider", export: "createProvider" },
      importEntry: "@acme/ledger/provider",
    },
  ]
  const providers = [provider("provider.a", "remote", "provider-a")]
  if (options.duplicate) {
    references.push({ ...references[0]!, id: "provider-b", entityId: "provider.b" })
    providers.push(provider("provider.b", "remote", "provider-b"))
  }
  const input: CreateVoyantGraphRuntimeInput = {
    graphHash: "sha256:test",
    providerSelections: options.selection ? { ledger: options.selection } : {},
    entries: { "@acme/ledger/provider": importProvider },
    modules: [
      {
        id: unitId,
        kind: "module",
        packageName: unitId,
        order: 0,
        references,
        config: [
          {
            unitId,
            declaration: { id: "config.endpoint", key: "endpoint", required: true },
          },
        ],
        secrets: [{ unitId, declaration: { id: "secret.token", key: "TOKEN", required: true } }],
        resources: [
          {
            unitId,
            declaration: { id: "resource.api", kind: "http-service", required: true },
          },
        ],
        providers,
        requiredPorts: ["ledger.client"],
        selectedIds: { routes: [], tools: [], workflows: [], events: [], webhooks: [] },
        routes: [],
      },
    ],
    plugins: [],
  }
  return { importProvider, runtime: createVoyantGraphRuntime(input) }
}

describe("graph runtime providers", () => {
  it("does not treat runtime-factory ports as provider requirements", async () => {
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:runtime-only-port",
      entries: {},
      modules: [
        {
          id: "@acme/media",
          kind: "module",
          packageName: "@acme/media",
          order: 0,
          runtimePorts: ["media.runtime"],
          selectedIds: { routes: [], tools: [], workflows: [], events: [], webhooks: [] },
          routes: [],
        },
      ],
      plugins: [],
    })

    await expect(resolveVoyantGraphRuntimeProviders(runtime, {})).resolves.toMatchObject({
      selectedProviders: [],
    })
    expect(runtime.modules[0]?.runtimePorts).toEqual(["media.runtime"])
    expect(runtime.requiredPorts).toEqual([])
  })

  it("selects explicitly, stays lazy, memoizes, and redacts runtime values", async () => {
    const secret = "private-token"
    const { importProvider, runtime } = createRuntime({ selection: "remote" })
    const providers = await resolveVoyantGraphRuntimeProviders(runtime, {
      deploymentValues: { endpoint: "https://ledger.test", TOKEN: secret },
    })

    expect(importProvider).not.toHaveBeenCalled()
    expect(providers.selectedProviders).toEqual([
      {
        unitId: "@acme/ledger",
        declarationId: "provider.a",
        port: "ledger.client",
        selection: { role: "ledger", value: "remote" },
      },
    ])
    expect(JSON.stringify(providers)).not.toContain(secret)

    const first = await providers.getProvider("ledger.client")
    const second = await providers.getProvider("ledger.client")
    expect(first).toEqual({
      endpoint: "https://ledger.test",
      token: secret,
      resource: "http-service",
    })
    expect(second).toBe(first)
    expect(importProvider).toHaveBeenCalledTimes(1)
  })

  it("rejects missing and ambiguous required ports before provider imports", async () => {
    for (const setup of [
      createRuntime({}),
      createRuntime({ selection: "remote", duplicate: true }),
    ]) {
      const error = await resolveVoyantGraphRuntimeProviders(setup.runtime, {
        deploymentValues: { endpoint: "https://ledger.test", TOKEN: "secret" },
      }).catch((cause: unknown) => cause)
      expect(error).toBeInstanceOf(VoyantGraphRuntimeProviderError)
      expect(setup.importProvider).not.toHaveBeenCalled()
    }
  })
})
