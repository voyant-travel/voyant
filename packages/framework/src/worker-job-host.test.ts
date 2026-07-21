import { describe, expect, it, vi } from "vitest"

import {
  compileCloudflareProductJobSchedules,
  createVoyantWorkerJobHostFromProjectRuntime,
  createVoyantWorkerJobHealthReporter,
  createVoyantWorkerJobHost,
} from "./worker-job-host.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

const unitId = "@acme/jobs"

function runtime(handler: (jobId: string) => void) {
  const jobs = ["acme.first", "acme.second"].map((id) => ({
    unitId,
    declaration: {
      id,
      schedule: { cron: "*/5 * * * *" },
      runtime: { entry: `./${id}`, export: "run" },
    },
    referenceId: `${id}.runtime`,
  }))
  return createVoyantGraphRuntime({
    graphHash: "sha256:worker-jobs",
    entries: Object.fromEntries(
      jobs.map((job) => [
        `${unitId}/${job.declaration.id}`,
        async () => ({ run: () => handler(job.declaration.id) }),
      ]),
    ),
    modules: [
      {
        id: unitId,
        kind: "module",
        packageName: unitId,
        order: 0,
        references: jobs.map((job) => ({
          id: job.referenceId,
          unitId,
          facet: "jobs.runtime" as const,
          entityId: job.declaration.id,
          runtime: job.declaration.runtime,
          importEntry: `${unitId}/${job.declaration.id}`,
        })),
        jobs,
        selectedIds: { routes: [], tools: [], workflows: [], events: [], webhooks: [] },
        routes: [],
      },
    ],
    plugins: [],
  })
}

const inventory = ["acme.first", "acme.second"].map((id) => ({
  id,
  unitId,
  packageName: unitId,
  schedule: { cron: "*/5 * * * *" },
  wakeup: false,
}))

describe("Voyant Worker product job host", () => {
  it("serves the trusted closed inventory and keeps bodyless invocations alive", async () => {
    const run = vi.fn()
    const pending: Promise<unknown>[] = []
    const host = createVoyantWorkerJobHost({
      runtime: runtime(run),
      jobs: inventory,
      originTrustSecret: "secret",
      scheduleAuthority: "cloudflare-cron",
    })
    const context = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) }

    const inventoryResponse = await host.fetch(
      new Request("https://worker.test/__voyant/jobs", {
        headers: { "x-voyant-origin-trust": "secret" },
      }),
      context,
    )
    await expect(inventoryResponse?.json()).resolves.toEqual({ provisioning: { jobs: inventory } })

    const response = await host.fetch(
      new Request("https://worker.test/__voyant/jobs/acme.first", {
        method: "POST",
        headers: { "x-voyant-origin-trust": "secret" },
      }),
      context,
    )
    expect(response?.status).toBe(202)
    expect(pending).toHaveLength(1)
    await Promise.all(pending)
    expect(run).toHaveBeenCalledWith("acme.first")
  })

  it("binds the immutable jobs exported by the generated project runtime", () => {
    const host = createVoyantWorkerJobHostFromProjectRuntime(
      { graphRuntime: runtime(() => {}), productJobs: inventory },
      { scheduleAuthority: "managed-http" },
    )
    expect(host.inventory).toEqual(inventory)
  })

  it("fans one Cron Trigger out to every graph job with that exact cron", async () => {
    const run = vi.fn()
    const pending: Promise<unknown>[] = []
    const host = createVoyantWorkerJobHost({
      runtime: runtime(run),
      jobs: inventory,
      scheduleAuthority: "cloudflare-cron",
    })
    await host.scheduled(
      { cron: "*/5 * * * *" },
      { waitUntil: (promise) => pending.push(promise) },
    )
    await Promise.all(pending)
    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenCalledWith("acme.first")
    expect(run).toHaveBeenCalledWith("acme.second")
  })

  it("projects only exact UTC cadences to Cron Triggers", () => {
    expect(
      compileCloudflareProductJobSchedules([
        { ...inventory[0]!, schedule: { every: "1m" } },
        { ...inventory[1]!, schedule: { every: "30s" } },
        {
          ...inventory[0]!,
          id: "acme.bucharest",
          schedule: { cron: "0 8 * * *", timezone: "Europe/Bucharest" },
        },
      ]),
    ).toEqual([
      { jobId: "acme.first", owner: "cloudflare-cron", cron: "* * * * *" },
      {
        jobId: "acme.second",
        owner: "managed-http",
        reason: "the every cadence is not exactly representable by a UTC cron trigger",
      },
      {
        jobId: "acme.bucharest",
        owner: "managed-http",
        reason: "Cloudflare Cron Triggers are evaluated in UTC",
      },
    ])
  })

  it("fails closed when a self-hosted Cron authority cannot represent a cadence", () => {
    expect(() =>
      createVoyantWorkerJobHost({
        runtime: runtime(() => {}),
        jobs: [{ ...inventory[0]!, schedule: { every: "30s" } }, inventory[1]!],
        scheduleAuthority: "cloudflare-cron",
      }),
    ).toThrow("Cloudflare cannot represent selected schedules for acme.first")
  })

  it("builds the managed terminal callback from Worker bindings", async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 204 }))
    const reporter = createVoyantWorkerJobHealthReporter(
      {
        ORIGIN_TRUST_SECRET: "secret",
        VOYANT_CLOUD_PRODUCT_JOB_HEALTH_URL: "https://cloud.test/health",
        VOYANT_CLOUD_WORKLOAD_ENVIRONMENT_ID: "environment-1",
      },
      fetchImplementation,
    )
    await reporter?.({
      jobId: "acme.first",
      status: "succeeded",
      attempts: 1,
      retryExhausted: false,
      finishedAt: "2026-07-21T00:00:00.000Z",
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://cloud.test/health",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
