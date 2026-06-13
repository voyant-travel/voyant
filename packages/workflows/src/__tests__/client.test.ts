import { afterEach, describe, expect, test, vi } from "vitest"

import {
  configureWorkflowsClient,
  createCloudWorkflowDriver,
  createCloudWorkflowsClient,
  workflows,
} from "../client.js"

afterEach(() => {
  configureWorkflowsClient(
    createThrowingClient("test reset: configure a client before using workflows"),
  )
})

describe("@voyantjs/workflows/client", () => {
  test("posts trigger calls to the managed Cloud run endpoint", async () => {
    const requests: Request[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return Response.json({
        data: {
          runId: "run_123",
          workflowId: "booking.finalize",
          status: "queued",
          startedAt: 1_700_000_000_000,
        },
      })
    })

    const client = createCloudWorkflowsClient({
      baseUrl: "https://api.voyant.test/",
      triggerToken: "trg_test",
      appSlug: "operator",
      environment: "preview",
      fetch: fetchMock as typeof fetch,
    })

    const run = await client.trigger(
      "booking.finalize",
      { bookingId: "bk_123" },
      { idempotencyKey: "booking.finalize:bk_123", tags: ["source:test"] },
    )

    expect(run).toMatchObject({
      id: "run_123",
      workflowId: "booking.finalize",
      status: "queued",
      startedAt: 1_700_000_000_000,
    })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(
      "https://api.voyant.test/cloud/v1/apps/operator/preview/workflows/booking.finalize/runs",
    )
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer trg_test")
    expect(requests[0]?.headers.get("idempotency-key")).toBe("booking.finalize:bk_123")
    expect(await requests[0]?.json()).toEqual({
      input: { bookingId: "bk_123" },
      options: {
        idempotencyKey: "booking.finalize:bk_123",
        tags: ["source:test"],
      },
    })
  })

  test("root workflows singleton delegates to the configured client", async () => {
    configureWorkflowsClient(
      createCloudWorkflowsClient({
        baseUrl: "https://api.voyant.test",
        triggerToken: "trg_test",
        appSlug: "operator",
        environment: "production",
        fetch: async () => Response.json({ id: "run_configured", status: "pending" }),
      }),
    )

    await expect(workflows.trigger("sync.products", {})).resolves.toMatchObject({
      id: "run_configured",
      workflowId: "sync.products",
    })
  })

  test("cloud driver forwards event ingest to the app-scoped Cloud endpoint", async () => {
    const requests: Request[] = []
    const driver = createCloudWorkflowDriver({
      baseUrl: "https://api.voyant.test",
      triggerToken: "trg_test",
      appSlug: "operator",
      environment: "production",
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ ok: true, eventId: "evt_123", matches: [] })
      },
    })

    await expect(
      driver.ingestEvent({
        environment: "production",
        envelope: {
          name: "booking.created",
          data: { bookingId: "bk_123" },
          metadata: { eventId: "evt_123" },
          emittedAt: "2026-06-13T00:00:00.000Z",
        },
      }),
    ).resolves.toEqual({ ok: true, eventId: "evt_123", matches: [] })

    expect(requests[0]?.url).toBe(
      "https://api.voyant.test/cloud/v1/apps/operator/production/events",
    )
    expect(requests[0]?.headers.get("idempotency-key")).toBe("evt_123")
    expect(await requests[0]?.json()).toEqual({
      envelope: {
        name: "booking.created",
        data: { bookingId: "bk_123" },
        metadata: { eventId: "evt_123" },
        emittedAt: "2026-06-13T00:00:00.000Z",
      },
    })
  })

  test("cloud driver returns null for missing current manifest", async () => {
    const driver = createCloudWorkflowDriver({
      baseUrl: "https://api.voyant.test",
      triggerToken: "trg_test",
      appSlug: "operator",
      environment: "production",
      fetch: async () => new Response("{}", { status: 404 }),
    })

    await expect(driver.getManifest({ environment: "production" })).resolves.toBeNull()
  })

  test("cloud driver does not register workflow releases by default", async () => {
    const fetchMock = vi.fn(async () => Response.json({}))
    const driver = createCloudWorkflowDriver({
      baseUrl: "https://api.voyant.test",
      triggerToken: "trg_test",
      appSlug: "operator",
      environment: "production",
      fetch: fetchMock as typeof fetch,
    })

    await expect(
      driver.registerManifest({
        environment: "production",
        manifest: testManifest("manifest_local"),
      }),
    ).resolves.toEqual({ versionId: "manifest_local" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("cloud driver forwards workflow releases only when explicitly enabled", async () => {
    const requests: Request[] = []
    const driver = createCloudWorkflowDriver({
      baseUrl: "https://api.voyant.test",
      triggerToken: "trg_test",
      appSlug: "operator",
      environment: "production",
      manifestRegistration: "enabled",
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ data: { versionId: "manifest_remote" } })
      },
    })

    await expect(
      driver.registerManifest({
        environment: "production",
        manifest: testManifest("manifest_local"),
      }),
    ).resolves.toEqual({ versionId: "manifest_remote" })
    expect(requests[0]?.url).toBe(
      "https://api.voyant.test/cloud/v1/apps/operator/production/workflow-releases",
    )
    expect(await requests[0]?.json()).toEqual({
      manifest: testManifest("manifest_local"),
    })
  })
})

function testManifest(versionId: string) {
  return {
    schemaVersion: 1 as const,
    projectId: "operator",
    versionId,
    builtAt: 1_700_000_000_000,
    builderVersion: "@voyantjs/workflows@manifest-builder",
    capabilities: {
      trigger: true,
      events: true,
      schedules: true,
      rerun: true,
      resume: true,
      cancel: true,
      humanApproval: true,
      stepRerun: false,
    },
    workflows: [],
    eventFilters: [],
    diagnostics: [],
    bindings: {},
    environments: {
      production: {},
      preview: {},
      development: {},
    },
  }
}

function createThrowingClient(message: string) {
  return new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error(message)
        }
      },
    },
  ) as never
}
