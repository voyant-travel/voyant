import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  createGeneratedProject,
  getRuntimeCompositionMocks,
  loadVoyantProject,
} from "./runtime-composition.test-support.js"

const mocks = getRuntimeCompositionMocks()

describe("Voyant outbound webhook composition", () => {
  it("uses the explicitly selected Postgres provider", async () => {
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
      appWebhooks?: unknown
    }
    expect(options).toMatchObject({
      runtimePorts: mocks.runtimePorts,
      resources: {},
      outboundWebhooks: { enqueue: expect.any(Function) },
    })

    const event = { name: "catalog.entity.updated" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    await expect(options.outboundWebhooks.enqueue(event, bindings)).resolves.toEqual(["queued"])
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).toHaveBeenCalledOnce()
    expect(mocks.postgresEnqueue).toHaveBeenCalledWith(event, bindings)
    expect(options.appWebhooks).toBeUndefined()
  })

  it("uses an explicitly selected host enqueuer", async () => {
    mocks.deploymentProviders = {
      adminAuth: "better-auth",
      customerAuth: "better-auth",
      outboundWebhooks: "host",
    }
    const deliverEvent = vi.fn(async () => ["hosted"])
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { deliverEvent },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    const event = { name: "catalog.entity.updated" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    await expect(options.outboundWebhooks.enqueue(event, bindings)).resolves.toEqual(["hosted"])
    expect(deliverEvent).toHaveBeenCalledWith(event, bindings)
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).not.toHaveBeenCalled()
  })

  it("composes installed-app delivery from the selected external catalog", async () => {
    mocks.workflowGraphRuntime = {
      modules: [
        {
          id: "@voyant-travel/apps",
          packageName: "@voyant-travel/apps",
          requiredPorts: ["apps.webhook-delivery"],
        },
      ],
      extensions: [],
      plugins: [],
      accessCatalog: { resources: [] },
      eventCatalog: {
        schemaVersion: "voyant.event-catalog.v1",
        events: [
          {
            id: "@voyant-travel/finance#event.invoice.issued",
            eventType: "invoice.issued",
            version: "1.0.0",
            visibility: "external",
            payloadSchema: {
              type: "object",
              properties: { invoiceId: { type: "string" } },
            },
          },
        ],
      },
    }
    const webhookDelivery = {
      issueSigningKey: vi.fn(),
      verifySigningKeyProof: vi.fn(),
      resolveSigningKey: vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) })),
    }
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { runtimePorts: { "apps.webhook-delivery": webhookDelivery } },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
      appWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    const event = { name: "invoice.issued" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }

    await expect(options.outboundWebhooks.enqueue(event, bindings)).resolves.toEqual(["queued"])
    await expect(options.appWebhooks.enqueue(event, bindings)).resolves.toEqual(["app-queued"])
    expect(mocks.createAppWebhookDeliveryEnqueuer).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: [
          expect.objectContaining({
            eventType: "invoice.issued",
            eventVersion: "1.0.0",
          }),
        ],
        resolveSigningKey: webhookDelivery.resolveSigningKey,
      }),
    )
  })

  it("does not let a host callback override the explicitly selected Postgres provider", async () => {
    const deliverEvent = vi.fn(async () => ["hosted"])
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      host: { deliverEvent },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks: { enqueue(event: unknown, bindings: unknown): Promise<unknown> }
    }
    await expect(options.outboundWebhooks.enqueue({ name: "event" }, {})).resolves.toEqual([
      "queued",
    ])
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).toHaveBeenCalledOnce()
    expect(deliverEvent).not.toHaveBeenCalled()
  })

  it("does not let Postgres credentials select outbound webhooks when the provider is none", async () => {
    mocks.deploymentProviders = {
      adminAuth: "better-auth",
      customerAuth: "better-auth",
      outboundWebhooks: "none",
    }
    const projectRoot = await createGeneratedProject()
    await loadVoyantProject({
      projectRoot,
      adminAssetsDir: path.join(projectRoot, "admin"),
      env: { DATABASE_URL: "postgres://example.invalid/voyant" },
    })

    const options = mocks.loadVoyantNodeRuntime.mock.calls[0]?.[0] as {
      outboundWebhooks?: unknown
    }
    expect(options.outboundWebhooks).toBeUndefined()
    expect(mocks.createPostgresWebhookDeliveryEnqueuer).not.toHaveBeenCalled()
  })

  it("rejects unsupported outbound webhook providers before server start", async () => {
    mocks.deploymentProviders = {
      adminAuth: "better-auth",
      customerAuth: "better-auth",
      outboundWebhooks: "external-queue",
    }
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      }),
    ).rejects.toThrow(/outboundWebhooks=.*is not supported/)
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })

  it("rejects a missing outbound webhook provider before server start", async () => {
    mocks.deploymentProviders = {
      adminAuth: "better-auth",
      customerAuth: "better-auth",
    }
    const projectRoot = await createGeneratedProject()

    await expect(
      loadVoyantProject({
        projectRoot,
        adminAssetsDir: path.join(projectRoot, "admin"),
        env: { DATABASE_URL: "postgres://example.invalid/voyant" },
      }),
    ).rejects.toThrow(/outboundWebhooks must be explicitly selected/)
    expect(mocks.loadVoyantNodeRuntime).not.toHaveBeenCalled()
  })
})
