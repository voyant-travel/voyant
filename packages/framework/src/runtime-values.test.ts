import type { VoyantGraphJsonObject } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"

import { createVoyantGraphRuntime } from "./runtime-lowering.js"
import { resolveVoyantGraphRuntimeValues, VoyantGraphRuntimeValueError } from "./runtime-values.js"

function runtimeWithDeclarations(options: {
  configValidator?: unknown
  secretValidator?: unknown
  projectConfig?: VoyantGraphJsonObject
}) {
  const importValidators = vi.fn(async () => ({
    configSchema:
      options.configValidator ??
      ({
        safeParse: (value: unknown) => ({
          success: typeof value === "string",
          data: typeof value === "string" ? value.toUpperCase() : undefined,
        }),
      } as const),
    secretSchema:
      options.secretValidator ??
      ({
        safeParse: (value: unknown) => ({
          success: typeof value === "string" && value.startsWith("valid_"),
          data: value,
        }),
      } as const),
  }))
  const importProvider = vi.fn(async () => ({
    createProvider: () => ({ kind: "loyalty" }),
  }))
  const unitId = "@acme/loyalty"
  const runtime = createVoyantGraphRuntime({
    graphHash: "sha256:test",
    entries: {
      "@acme/loyalty/validators": importValidators,
      "@acme/loyalty/provider": importProvider,
    },
    modules: [
      {
        id: unitId,
        kind: "module",
        packageName: unitId,
        order: 0,
        projectConfig: options.projectConfig,
        references: [
          {
            id: "config-validator",
            unitId,
            facet: "config.validator",
            entityId: "config.endpoint",
            runtime: { entry: "./validators", export: "configSchema" },
            importEntry: "@acme/loyalty/validators",
          },
          {
            id: "secret-validator",
            unitId,
            facet: "secrets.validator",
            entityId: "secret.token",
            runtime: { entry: "./validators", export: "secretSchema" },
            importEntry: "@acme/loyalty/validators",
          },
          {
            id: "provider-runtime",
            unitId,
            facet: "providers.runtime",
            entityId: "provider.ledger",
            runtime: { entry: "./provider", export: "createProvider" },
            importEntry: "@acme/loyalty/provider",
          },
        ],
        config: [
          {
            unitId,
            declaration: {
              id: "config.endpoint",
              key: "service.endpoint",
              required: true,
              validator: { entry: "./validators", export: "configSchema" },
            },
            validatorReferenceId: "config-validator",
          },
          {
            unitId,
            declaration: {
              id: "config.timeout",
              key: "timeoutMs",
              default: 5000,
            },
          },
        ],
        secrets: [
          {
            unitId,
            declaration: {
              id: "secret.token",
              key: "LOYALTY_TOKEN",
              required: true,
              validator: { entry: "./validators", export: "secretSchema" },
            },
            validatorReferenceId: "secret-validator",
          },
        ],
        resources: [
          {
            unitId,
            declaration: {
              id: "resource.api",
              kind: "http-service",
              required: true,
              config: { service: "loyalty" },
            },
          },
        ],
        providers: [
          {
            unitId,
            declaration: {
              id: "provider.ledger",
              port: "loyalty.ledger",
              runtime: { entry: "./provider", export: "createProvider" },
              config: { mode: "remote" },
            },
            referenceId: "provider-runtime",
          },
        ],
        selectedIds: { routes: [], tools: [], workflows: [], events: [], webhooks: [] },
        routes: [],
      },
    ],
    plugins: [],
  })
  return { importProvider, importValidators, runtime }
}

describe("graph runtime values", () => {
  it("resolves project config, defaults, and deployment secrets before providers load", async () => {
    const { importProvider, importValidators, runtime } = runtimeWithDeclarations({
      projectConfig: { service: { endpoint: "project.example" } },
    })

    expect(runtime.config.map(({ declaration }) => declaration.id)).toEqual([
      "config.endpoint",
      "config.timeout",
    ])
    expect(runtime.resources[0]?.declaration.config).toEqual({ service: "loyalty" })
    expect(importValidators).not.toHaveBeenCalled()
    expect(importProvider).not.toHaveBeenCalled()

    const values = await resolveVoyantGraphRuntimeValues(runtime, {
      deploymentValues: {
        "service.endpoint": "deployment.example",
        LOYALTY_TOKEN: "valid_private",
      },
    })

    expect(values.getConfig("config.endpoint")).toBe("PROJECT.EXAMPLE")
    expect(values.getConfig("config.timeout")).toBe(5000)
    expect(values.getSecret("secret.token")).toBe("valid_private")
    expect(values.secrets).toEqual([
      {
        unitId: "@acme/loyalty",
        declarationId: "secret.token",
        key: "LOYALTY_TOKEN",
      },
    ])
    expect(JSON.stringify(values)).not.toContain("valid_private")
    expect(importValidators).toHaveBeenCalledTimes(1)
    expect(importProvider).not.toHaveBeenCalled()

    await expect(values.providers[0]?.load()).resolves.toEqual(expect.any(Function))
    expect(importProvider).toHaveBeenCalledTimes(1)
  })

  it("uses deployment config when project config is absent", async () => {
    const { runtime } = runtimeWithDeclarations({})

    const values = await resolveVoyantGraphRuntimeValues(runtime, {
      deploymentValues: {
        "service.endpoint": "deployment.example",
        LOYALTY_TOKEN: "valid_private",
      },
    })

    expect(values.getConfig("config.endpoint")).toBe("DEPLOYMENT.EXAMPLE")
  })

  it("honors deployment aliases without weakening the canonical declaration", async () => {
    const { runtime } = runtimeWithDeclarations({
      projectConfig: { service: { endpoint: "project.example" } },
    })

    const values = await resolveVoyantGraphRuntimeValues(runtime, {
      deploymentValues: { LOYALTY_TOKEN_DIRECT: "valid_private" },
      deploymentValueAliases: { LOYALTY_TOKEN: ["LOYALTY_TOKEN_DIRECT"] },
    })

    expect(values.getSecret("secret.token")).toBe("valid_private")
  })

  it("redacts missing and invalid secret values from structured failures", async () => {
    const secret = "must_never_appear"
    const { runtime } = runtimeWithDeclarations({
      projectConfig: { service: { endpoint: "project.example" } },
      secretValidator: {
        parse: () => {
          throw new Error(secret)
        },
      },
    })

    const error = await resolveVoyantGraphRuntimeValues(runtime, {
      deploymentValues: { LOYALTY_TOKEN: secret },
    }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(VoyantGraphRuntimeValueError)
    expect(error).toMatchObject({
      issues: [
        {
          code: "VOYANT_GRAPH_RUNTIME_VALUE_INVALID",
          unitId: "@acme/loyalty",
          declarationId: "secret.token",
          facet: "secrets",
          key: "LOYALTY_TOKEN",
        },
      ],
    })
    expect(String(error)).not.toContain(secret)
    expect(JSON.stringify(error)).not.toContain(secret)
  })

  it("reports required values and malformed admitted validators without importing providers", async () => {
    const { importProvider, runtime } = runtimeWithDeclarations({
      configValidator: { description: "not a schema" },
    })

    await expect(resolveVoyantGraphRuntimeValues(runtime)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "VOYANT_GRAPH_RUNTIME_VALUE_REQUIRED",
          declarationId: "config.endpoint",
        }),
        expect.objectContaining({
          code: "VOYANT_GRAPH_RUNTIME_VALUE_REQUIRED",
          declarationId: "secret.token",
        }),
      ]),
    })
    expect(importProvider).not.toHaveBeenCalled()

    await expect(
      resolveVoyantGraphRuntimeValues(runtime, {
        deploymentValues: {
          "service.endpoint": "deployment.example",
          LOYALTY_TOKEN: "valid_private",
        },
      }),
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: "VOYANT_GRAPH_RUNTIME_VALIDATOR_INVALID",
          declarationId: "config.endpoint",
        }),
      ],
    })
  })
})
