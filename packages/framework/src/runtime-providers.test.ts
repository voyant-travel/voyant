import { z } from "@hono/zod-openapi"
import { createToolRegistry, defineTool } from "@voyant-travel/tools"
import { describe, expect, it, type Mock, vi } from "vitest"

import { assertVoyantGraphMcpRuntime } from "./conditional-action-availability.js"
import { lowerVoyantGraphActionsToActionLedgerRegistry } from "./graph-action-ledger.js"
import { composeVoyantGraphRuntime } from "./runtime-composition.js"
import {
  type CreateVoyantGraphRuntimeInput,
  createVoyantGraphRuntime,
  registerVoyantGraphTools,
} from "./runtime-lowering.js"
import {
  resolveVoyantGraphRuntimeProviders,
  VoyantGraphRuntimeProviderError,
} from "./runtime-providers.js"

function createRuntime(options: {
  selection?: string
  duplicate?: boolean
  unrelatedRequiredConfig?: boolean
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
      uses: {
        config: ["config.endpoint"],
        secrets: ["secret.token"],
        resources: ["resource.api"],
      },
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
          ...(options.unrelatedRequiredConfig
            ? [
                {
                  unitId,
                  declaration: {
                    id: "config.unrelated-required",
                    key: "UNRELATED_REQUIRED",
                    required: true,
                  },
                },
              ]
            : []),
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
        selectedIds: { routes: [], tools: [], events: [], webhooks: [] },
        routes: [],
      },
    ],
    plugins: [],
  }
  return { importProvider, runtime: createVoyantGraphRuntime(input) }
}

function createConditionalRuntimeInput(options: {
  createProvider: () => unknown
  testProvider: (provider: unknown) => void | Promise<void>
}) {
  const unitId = "@acme/notifications"
  const portId = "notifications.durable-send"
  const toolId = "@acme/notifications#tool.send"
  const loadTool = vi.fn(async () => ({
    sendNotificationTool: defineTool({
      name: "send_notification",
      description: "Send a notification",
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.object({ sent: z.boolean() }),
      requiredScopes: [],
      tier: "write",
      riskPolicy: {
        destructive: false,
        reversible: false,
        dryRunSupported: false,
        sideEffects: ["email"],
      },
      actionPolicyEnforcement: "handler",
      async handler() {
        return { sent: true }
      },
    }),
  }))
  const input: CreateVoyantGraphRuntimeInput = {
    graphHash: "sha256:conditional-provider",
    providerSelections: { notifications: "durable" },
    entries: {
      "@acme/notifications/provider": async () => ({
        createProvider: options.createProvider,
      }),
      "@acme/notifications/durable-port": async () => ({
        durableNotificationPort: {
          id: portId,
          test: options.testProvider,
        },
      }),
      "@acme/notifications/tools": loadTool,
    },
    modules: [
      {
        id: unitId,
        kind: "module",
        packageName: unitId,
        order: 0,
        references: [
          {
            id: "notification-provider",
            unitId,
            facet: "providers.runtime",
            entityId: "@acme/notifications#provider.durable",
            runtime: { entry: "./provider", export: "createProvider" },
            importEntry: "@acme/notifications/provider",
          },
          {
            id: "notification-port-conformance",
            unitId,
            facet: "runtimePorts.conformance",
            entityId: portId,
            runtime: {
              entry: "./durable-port",
              export: "durableNotificationPort",
            },
            importEntry: "@acme/notifications/durable-port",
          },
        ],
        providers: [
          {
            unitId,
            declaration: {
              id: "@acme/notifications#provider.durable",
              port: portId,
              selection: { role: "notifications", value: "durable" },
              runtime: { entry: "./provider", export: "createProvider" },
            },
            referenceId: "notification-provider",
          },
        ],
        provisionalReferences: [
          {
            id: "notification-tool",
            unitId,
            facet: "tools.runtime",
            entityId: toolId,
            runtime: { entry: "./tools", export: "sendNotificationTool" },
            importEntry: "@acme/notifications/tools",
          },
        ],
        provisionalTools: [
          {
            id: toolId,
            unitId,
            name: "send_notification",
            referenceId: "notification-tool",
            requiredScopes: [],
            risk: "high",
          },
        ],
        requiredPorts: [portId],
        runtimePorts: [portId],
        runtimePortConformance: [{ portId, referenceId: "notification-port-conformance" }],
        actions: [
          {
            id: "@acme/notifications#action.send",
            unitId,
            version: "v1",
            kind: "execute",
            targetType: "notification",
            availability: {
              status: "unavailable",
              reasonCode: "provider-not-durable",
              enableWhen: {
                selectedProviderPorts: { mode: "all", ports: [portId] },
              },
            },
            risk: "high",
            ledger: "required",
            requiredScopes: [],
            from: { routes: [], tools: [toolId], events: [], webhooks: [] },
          },
        ],
        selectedIds: { routes: [], tools: [], events: [], webhooks: [] },
        routes: [],
      },
    ],
    plugins: [],
  }
  return { input, loadTool, portId, toolId }
}

function createConditionalRuntime(options: {
  createProvider: () => unknown
  testProvider: (provider: unknown) => void | Promise<void>
}) {
  const setup = createConditionalRuntimeInput(options)
  return { ...setup, runtime: createVoyantGraphRuntime(setup.input) }
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
          selectedIds: { routes: [], tools: [], events: [], webhooks: [] },
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

  it("scopes provider resolution and runtime values to requested ports", async () => {
    const { importProvider, runtime } = createRuntime({
      selection: "remote",
      unrelatedRequiredConfig: true,
    })

    const providers = await resolveVoyantGraphRuntimeProviders(runtime, {
      ports: ["ledger.client"],
      deploymentValues: { endpoint: "https://ledger.test", TOKEN: "secret" },
    })

    await expect(providers.getProvider("ledger.client")).resolves.toMatchObject({
      endpoint: "https://ledger.test",
    })
    expect(importProvider).toHaveBeenCalledTimes(1)
  })

  it("requires every explicitly requested provider port", async () => {
    const { runtime } = createRuntime({ selection: "remote" })

    await expect(
      resolveVoyantGraphRuntimeProviders(runtime, { ports: ["storage.object"] }),
    ).rejects.toMatchObject({
      issues: [
        {
          code: "VOYANT_GRAPH_RUNTIME_PROVIDER_MISSING",
          port: "storage.object",
        },
      ],
    })
  })

  it("fails conditional action startup when the selected provider factory throws", async () => {
    const testProvider = vi.fn()
    const { loadTool, portId, runtime } = createConditionalRuntime({
      createProvider: () => {
        throw new Error("provider factory failed")
      },
      testProvider,
    })
    const providers = await resolveVoyantGraphRuntimeProviders(runtime, { ports: [portId] })

    expect(loadTool).not.toHaveBeenCalled()
    await expect(providers.activateRuntime()).rejects.toThrow("provider factory failed")
    expect(testProvider).not.toHaveBeenCalled()
    expect(runtime.actions[0]?.availability?.status).toBe("unavailable")
    expect(runtime.tools).toEqual([])
    expect(loadTool).not.toHaveBeenCalled()
    expect(() => lowerVoyantGraphActionsToActionLedgerRegistry(runtime)).toThrow(/NOT_ACTIVATED/)
    await expect(
      composeVoyantGraphRuntime({
        runtime,
        capabilities: {},
        ports: { [portId]: {} },
      }),
    ).rejects.toThrow(/NOT_ACTIVATED/)
  })

  it("fails conditional action startup when the selected provider fails typed port conformance", async () => {
    const provider = { send: vi.fn() }
    const testProvider = vi.fn(() => {
      throw new Error("durable reconciliation is missing")
    })
    const { loadTool, portId, runtime } = createConditionalRuntime({
      createProvider: () => provider,
      testProvider,
    })
    const providers = await resolveVoyantGraphRuntimeProviders(runtime, { ports: [portId] })

    expect(loadTool).not.toHaveBeenCalled()
    await expect(providers.activateRuntime()).rejects.toThrow("durable reconciliation is missing")
    expect(testProvider).toHaveBeenCalledWith(provider)
    expect(runtime.actions[0]?.availability?.status).toBe("unavailable")
    expect(loadTool).not.toHaveBeenCalled()
    expect(() => lowerVoyantGraphActionsToActionLedgerRegistry(runtime)).toThrow(/NOT_ACTIVATED/)
  })

  it("attests only the exact selected provider instance for conditional action composition", async () => {
    class DurableProvider {
      readonly send = vi.fn()
      readonly reconcile = vi.fn()
    }
    const provider = new DurableProvider()
    const testProvider = vi.fn()
    const { loadTool, portId, runtime, toolId } = createConditionalRuntime({
      createProvider: () => provider,
      testProvider,
    })
    const providers = await resolveVoyantGraphRuntimeProviders(runtime, { ports: [portId] })
    const selected = await providers.getProvider(portId)
    const activated = await providers.activateRuntime()

    expect(Object.isFrozen(provider)).toBe(false)
    expect(testProvider).toHaveBeenCalledWith(provider)
    expect(runtime.actions[0]?.availability?.status).toBe("unavailable")
    expect(activated.actions[0]?.availability).toEqual({ status: "available" })
    expect(activated.tools.map(({ id }) => id)).toEqual([toolId])
    expect(lowerVoyantGraphActionsToActionLedgerRegistry(activated).definitions).toEqual([
      expect.objectContaining({ id: "@acme/notifications#action.send" }),
    ])
    const registry = createToolRegistry()
    await registerVoyantGraphTools(activated, registry)
    expect(registry.names()).toEqual(["send_notification"])
    expect(loadTool).toHaveBeenCalledOnce()
    await expect(
      composeVoyantGraphRuntime({
        runtime: activated,
        capabilities: {},
        ports: { [portId]: selected },
      }),
    ).resolves.toBeDefined()
    await expect(
      composeVoyantGraphRuntime({
        runtime: activated,
        capabilities: {},
        ports: { [portId]: { ...provider } },
      }),
    ).rejects.toThrow(/PROVIDER_DRIFT/)
  })

  it("rejects a custom-prototype top-level input before inherited metadata is read", () => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    const { modules, ...ownInput } = input
    const prototype = { modules }
    const inheritedInput = Object.assign(Object.create(prototype), ownInput)

    expect(() => createVoyantGraphRuntime(inheritedInput)).toThrow(
      /plain records and genuine arrays with no custom prototype/,
    )
    expect(Reflect.set(prototype, "modules", [])).toBe(true)
  })

  it("rejects a custom-prototype modules container before normalization can iterate it", () => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    Object.setPrototypeOf(input.modules, Object.create(Array.prototype))

    expect(() => createVoyantGraphRuntime(input)).toThrow(
      /plain records and genuine arrays with no custom prototype/,
    )
  })

  it("rejects an accessor-backed modules container without invoking its getter", () => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    const getter = vi.fn(() => input.modules)
    const accessorInput = { ...input }
    Object.defineProperty(accessorInput, "modules", {
      configurable: true,
      enumerable: true,
      get: getter,
    })

    expect(() => createVoyantGraphRuntime(accessorInput)).toThrow(
      /must not contain accessor properties/,
    )
    expect(getter).not.toHaveBeenCalled()
  })

  it.each([
    "actions",
    "providers",
    "runtimePortConformance",
    "references",
  ] as const)("rejects a custom-prototype unit %s container before normalization reads it", (field) => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    const container = input.modules[0]![field]!
    Object.setPrototypeOf(container, Object.create(Array.prototype))

    expect(() => createVoyantGraphRuntime(input)).toThrow(
      /plain records and genuine arrays with no custom prototype/,
    )
  })

  it.each([
    "actions",
    "providers",
    "runtimePortConformance",
    "references",
  ] as const)("rejects an accessor-backed unit %s container without invoking its getter", (field) => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    const unit = input.modules[0]!
    const getter = vi.fn(() => unit[field])
    Object.defineProperty(unit, field, {
      configurable: true,
      enumerable: true,
      get: getter,
    })

    expect(() => createVoyantGraphRuntime(input)).toThrow(/must not contain accessor properties/)
    expect(getter).not.toHaveBeenCalled()
  })

  it.each([
    {
      surface: "action availability",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const unit = input.modules[0]!
        const action = unit.actions![0]!
        const { availability, ...ownAction } = action
        const prototype = { availability }
        ;(unit.actions as unknown[])[0] = Object.assign(Object.create(prototype), ownAction)
        return () => Object.assign(prototype, { availability: { status: "available" } })
      },
    },
    {
      surface: "action enableWhen",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const availability = input.modules[0]!.actions![0]!.availability!
        if (availability.status !== "unavailable") throw new Error("expected unavailable action")
        const { enableWhen, ...ownAvailability } = availability
        const prototype = { enableWhen }
        input.modules[0]!.actions![0]!.availability = Object.assign(
          Object.create(prototype),
          ownAvailability,
        )
        return () => Reflect.deleteProperty(prototype, "enableWhen")
      },
    },
    {
      surface: "action Tool bindings",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const action = input.modules[0]!.actions![0]!
        const { tools, ...ownBindings } = action.from
        const prototype = { tools }
        action.from = Object.assign(Object.create(prototype), ownBindings)
        return () => Object.assign(prototype, { tools: ["@acme/notifications#tool.forged"] })
      },
    },
    {
      surface: "provisional Tool reference",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const unit = input.modules[0]!
        const tool = unit.provisionalTools![0]!
        const { referenceId, ...ownTool } = tool
        const prototype = { referenceId }
        ;(unit.provisionalTools as unknown[])[0] = Object.assign(Object.create(prototype), ownTool)
        return () => Object.assign(prototype, { referenceId: "forged-reference" })
      },
    },
    {
      surface: "provider reference requirement",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const unit = input.modules[0]!
        const provider = unit.providers![0]!
        const { referenceId, ...ownProvider } = provider
        const prototype = { referenceId }
        ;(unit.providers as unknown[])[0] = Object.assign(Object.create(prototype), ownProvider)
        return () => Object.assign(prototype, { referenceId: "forged-provider-reference" })
      },
    },
    {
      surface: "provider selection",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const declaration = input.modules[0]!.providers![0]!.declaration
        const selection = declaration.selection!
        const { value, ...ownSelection } = selection
        const prototype = { value }
        declaration.selection = Object.assign(Object.create(prototype), ownSelection)
        return () => Object.assign(prototype, { value: "forged" })
      },
    },
    {
      surface: "typed-port conformance binding",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const unit = input.modules[0]!
        const conformance = unit.runtimePortConformance![0]!
        const { referenceId, ...ownConformance } = conformance
        const prototype = { referenceId }
        ;(unit.runtimePortConformance as unknown[])[0] = Object.assign(
          Object.create(prototype),
          ownConformance,
        )
        return () => Object.assign(prototype, { referenceId: "forged-conformance" })
      },
    },
    {
      surface: "reference runtime export",
      poison(input: CreateVoyantGraphRuntimeInput) {
        const runtime = input.modules[0]!.references![0]!.runtime
        const { export: exportName, ...ownRuntime } = runtime
        const prototype = { export: exportName }
        input.modules[0]!.references![0]!.runtime = Object.assign(
          Object.create(prototype),
          ownRuntime,
        )
        return () => Object.assign(prototype, { export: "forgedExport" })
      },
    },
  ])("rejects inherited $surface metadata before it can become runtime authority", ({ poison }) => {
    const { input } = createConditionalRuntimeInput({
      createProvider: () => ({ send: vi.fn() }),
      testProvider: vi.fn(),
    })
    const mutatePrototype = poison(input)

    expect(() => createVoyantGraphRuntime(input)).toThrow(/plain records.*no custom prototype/)
    expect(() => mutatePrototype()).not.toThrow()
  })

  it("detaches and deeply freezes raw and activated conditional runtime authority", async () => {
    const provider = { send: vi.fn(), mutableAfterCreation: false }
    const testProvider = vi.fn()
    const { input, loadTool, portId, runtime, toolId } = createConditionalRuntime({
      createProvider: () => provider,
      testProvider,
    })
    const inputUnit = input.modules[0]!
    const inputAction = inputUnit.actions![0]!
    const inputTool = inputUnit.provisionalTools![0]!
    const inputToolReference = inputUnit.provisionalReferences![0]!
    const inputProvider = inputUnit.providers![0]!

    Object.assign(input.providerSelections as Record<string, string>, {
      notifications: "forged",
    })
    Object.assign(inputAction.availability!, { status: "available" })
    Reflect.deleteProperty(inputAction.availability!, "enableWhen")
    Object.assign(inputAction.from.tools, ["@acme/notifications#tool.forged"])
    Object.assign(inputTool, { name: "forged_tool", referenceId: "forged-reference" })
    Object.assign(inputToolReference.runtime, { export: "forgedExport" })
    Object.assign(inputProvider.declaration.selection!, { value: "forged" })
    Object.assign(inputProvider, { referenceId: "forged-provider-reference" })
    Reflect.deleteProperty(inputUnit, "runtimePortConformance")

    expect(runtime.providerSelections).toEqual({ notifications: "durable" })
    expect(runtime.actions[0]?.availability).toEqual({
      status: "unavailable",
      reasonCode: "provider-not-durable",
      enableWhen: {
        selectedProviderPorts: { mode: "all", ports: [portId] },
      },
    })
    expect(runtime.providers[0]?.declaration.selection).toEqual({
      role: "notifications",
      value: "durable",
    })
    expect(Reflect.set(runtime.providerSelections, "notifications", "forged")).toBe(false)
    expect(Reflect.set(runtime.actions[0]!.availability!, "status", "available")).toBe(false)
    const runtimeAvailability = runtime.actions[0]!.availability as {
      status: "unavailable"
      enableWhen: {
        selectedProviderPorts: {
          ports: readonly string[]
        }
      }
    }
    expect(
      Reflect.deleteProperty(runtimeAvailability.enableWhen.selectedProviderPorts, "ports"),
    ).toBe(false)
    expect(
      Reflect.set(runtime.actions[0]!.from.tools, "0", "@acme/notifications#tool.forged"),
    ).toBe(false)
    expect(Reflect.set(runtime.references[0]!, "load", vi.fn())).toBe(false)
    expect(Reflect.set(runtime.providers[0]!.declaration.selection!, "value", "forged")).toBe(false)
    expect(Reflect.deleteProperty(runtime.providers[0]!, "referenceId")).toBe(false)
    expect(Reflect.deleteProperty(runtime.modules[0]!, "runtimePortConformance")).toBe(false)
    expect(runtime.providers[0]?.referenceId).toBe("notification-provider")
    expect(runtime.modules[0]?.runtimePortConformance).toEqual([
      { portId, referenceId: "notification-port-conformance", load: expect.any(Function) },
    ])
    expect(Object.isFrozen(runtime)).toBe(true)
    expect(Object.isFrozen(runtime.modules[0]!.actions[0]!.availability)).toBe(true)
    expect(Object.isFrozen(runtime.modules[0]!.runtimePortConformance)).toBe(true)
    expect(() => assertVoyantGraphMcpRuntime(runtime)).toThrow(/NOT_ACTIVATED/)
    expect(() => lowerVoyantGraphActionsToActionLedgerRegistry(runtime)).toThrow(/NOT_ACTIVATED/)
    expect(loadTool).not.toHaveBeenCalled()

    const providers = await resolveVoyantGraphRuntimeProviders(runtime, { ports: [portId] })
    const selected = await providers.getProvider(portId)
    const activated = await providers.activateRuntime()
    expect(selected).toBe(provider)
    expect(Reflect.set(provider, "mutableAfterCreation", true)).toBe(true)
    expect(provider.mutableAfterCreation).toBe(true)
    expect(testProvider).toHaveBeenCalledWith(provider)
    expect(activated.tools.map(({ id }) => id)).toEqual([toolId])
    expect(activated.tools[0]?.name).toBe("send_notification")
    expect(
      activated.references.find(({ facet }) => facet === "tools.runtime")?.runtime.export,
    ).toBe("sendNotificationTool")
    expect(Reflect.set(activated.actions[0]!.availability!, "status", "unavailable")).toBe(false)
    expect(Reflect.set(activated.actions[0]!.from.tools, "0", "forged")).toBe(false)
    expect(Reflect.set(activated.tools[0]!, "load", vi.fn())).toBe(false)
    expect(
      Reflect.set(
        activated.references.find(({ facet }) => facet === "tools.runtime")!,
        "loadModule",
        vi.fn(),
      ),
    ).toBe(false)
    expect(Object.isFrozen(activated)).toBe(true)
    expect(Object.isFrozen(activated.modules[0]!.tools[0])).toBe(true)

    const registry = createToolRegistry()
    await registerVoyantGraphTools(activated, registry)
    expect(registry.names()).toEqual(["send_notification"])
    expect(loadTool).toHaveBeenCalledOnce()
  })
})
