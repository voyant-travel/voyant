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
  })

  it("uses an explicitly selected host enqueuer", async () => {
    mocks.deploymentProviders = { auth: "better-auth", outboundWebhooks: "host" }
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
    mocks.deploymentProviders = { auth: "better-auth", outboundWebhooks: "none" }
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
    mocks.deploymentProviders = { auth: "better-auth", outboundWebhooks: "external-queue" }
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
    mocks.deploymentProviders = { auth: "better-auth" }
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
