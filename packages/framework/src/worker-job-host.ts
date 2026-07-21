import type { VoyantGraphProvisionedJob } from "./deployment-graph.js"
import {
  createVoyantNodeJobHost,
  type CreateVoyantNodeJobHostOptions,
  type VoyantNodeJobExecutionReport,
  type VoyantNodeJobHealth,
  VOYANT_PRODUCT_JOB_ROUTE,
} from "./node-job-host.js"
import type { VoyantGraphRuntime } from "./runtime-lowering.js"

export { VOYANT_PRODUCT_JOB_ROUTE }

export interface VoyantWorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export interface VoyantWorkerScheduledEvent {
  cron: string
}

export interface VoyantCloudflareProductJobSchedule {
  jobId: string
  owner: "cloudflare-cron" | "managed-http"
  cron?: string
  reason?: string
}

export type CreateVoyantWorkerJobHostOptions = Omit<
  CreateVoyantNodeJobHostOptions,
  "schedulerPollMs"
> & {
  /** Explicitly prevents Cloudflare Cron and managed HTTP from both owning cadence. */
  scheduleAuthority: "cloudflare-cron" | "managed-http"
}

export interface VoyantWorkerJobHost {
  inventory: readonly VoyantGraphProvisionedJob[]
  schedules: readonly VoyantCloudflareProductJobSchedule[]
  fetch(request: Request, context: VoyantWorkerExecutionContext): Promise<Response | undefined>
  scheduled(
    event: VoyantWorkerScheduledEvent,
    context: VoyantWorkerExecutionContext,
  ): Promise<void>
  health(): readonly VoyantNodeJobHealth[]
}

export interface VoyantGeneratedProjectJobRuntime {
  graphRuntime: VoyantGraphRuntime
  productJobs: readonly VoyantGraphProvisionedJob[]
}

/** Bind the standard generated project runtime without authoring job IDs locally. */
export function createVoyantWorkerJobHostFromProjectRuntime(
  projectRuntime: VoyantGeneratedProjectJobRuntime,
  options: Omit<CreateVoyantWorkerJobHostOptions, "runtime" | "jobs">,
): VoyantWorkerJobHost {
  return createVoyantWorkerJobHost({
    ...options,
    runtime: projectRuntime.graphRuntime,
    jobs: projectRuntime.productJobs,
  })
}

/** Unique Cron Trigger values suitable for a generated Wrangler configuration. */
export function cloudflareCronTriggersForProductJobs(
  jobs: readonly VoyantGraphProvisionedJob[],
): readonly string[] {
  return [
    ...new Set(
      compileCloudflareProductJobSchedules(jobs).flatMap((schedule) =>
        schedule.owner === "cloudflare-cron" && schedule.cron ? [schedule.cron] : [],
      ),
    ),
  ]
}

/**
 * Host a resolved graph's fixed product-job projection in a Cloudflare Worker.
 *
 * The bridge intentionally reuses the platform-neutral invocation core used by
 * the Node host. It does not start an in-isolate timer, retain payloads, or own
 * domain progress. Worker lifetime is extended only around accepted executions.
 */
export function createVoyantWorkerJobHost(
  options: CreateVoyantWorkerJobHostOptions,
): VoyantWorkerJobHost {
  const host = createVoyantNodeJobHost(options)
  const schedules = compileCloudflareProductJobSchedules(host.inventory)
  if (options.scheduleAuthority === "cloudflare-cron") {
    const externalSchedules = schedules.filter((schedule) => schedule.owner === "managed-http")
    if (externalSchedules.length > 0) {
      throw new Error(
        `Voyant Worker job host: Cloudflare cannot represent selected schedules for ${externalSchedules
          .map((schedule) => schedule.jobId)
          .join(", ")}. Use the managed HTTP schedule authority or change their cadence.`,
      )
    }
  }

  return {
    inventory: host.inventory,
    schedules,
    async fetch(request, context) {
      const response = await host.handleRequest(request)
      if (response?.status !== 202) return response
      const jobId = jobIdFromInvocationUrl(request.url)
      if (jobId) context.waitUntil(host.settled(jobId))
      return response
    },
    async scheduled(event, context) {
      if (options.scheduleAuthority !== "cloudflare-cron") {
        throw new Error(
          "Voyant Worker job host: scheduled events are disabled while managed HTTP owns cadence.",
        )
      }
      const jobIds = schedules
        .filter((schedule) => schedule.owner === "cloudflare-cron" && schedule.cron === event.cron)
        .map((schedule) => schedule.jobId)
      if (jobIds.length === 0) {
        throw new Error(`Voyant Worker job host: unknown Cloudflare cron "${event.cron}".`)
      }
      await Promise.all(jobIds.map((jobId) => host.invoke(jobId, "schedule")))
      context.waitUntil(Promise.all(jobIds.map((jobId) => host.settled(jobId))))
    },
    health: host.health,
  }
}

/**
 * Project graph schedules onto Cloudflare Cron Triggers when their cadence is
 * exact in UTC. The remaining jobs stay callable through the fixed HTTP route
 * so the managed scheduler can own their cadence.
 */
export function compileCloudflareProductJobSchedules(
  jobs: readonly VoyantGraphProvisionedJob[],
): readonly VoyantCloudflareProductJobSchedule[] {
  return jobs.flatMap((job) => {
    if (!job.schedule) return []
    if ("cron" in job.schedule) {
      if (
        job.schedule.timezone &&
        job.schedule.timezone !== "UTC" &&
        job.schedule.timezone !== "Etc/UTC"
      ) {
        return [
          {
            jobId: job.id,
            owner: "managed-http" as const,
            reason: "Cloudflare Cron Triggers are evaluated in UTC",
          },
        ]
      }
      return [{ jobId: job.id, owner: "cloudflare-cron" as const, cron: job.schedule.cron }]
    }
    const cron = exactCloudflareCronForEvery(job.schedule.every)
    return cron
      ? [{ jobId: job.id, owner: "cloudflare-cron" as const, cron }]
      : [
          {
            jobId: job.id,
            owner: "managed-http" as const,
            reason: "the every cadence is not exactly representable by a UTC cron trigger",
          },
        ]
  })
}

export interface VoyantManagedProductJobHealthEnv {
  ORIGIN_TRUST_SECRET?: string
  VOYANT_CLOUD_PRODUCT_JOB_HEALTH_URL?: string
  VOYANT_CLOUD_WORKLOAD_ENVIRONMENT_ID?: string
}

/** Create the same best-effort terminal callback used by managed Node hosts. */
export function createVoyantWorkerJobHealthReporter(
  env: VoyantManagedProductJobHealthEnv,
  fetchImplementation: typeof fetch = fetch,
): ((report: VoyantNodeJobExecutionReport) => Promise<void>) | undefined {
  const endpoint = env.VOYANT_CLOUD_PRODUCT_JOB_HEALTH_URL?.trim()
  const workloadEnvironmentId = env.VOYANT_CLOUD_WORKLOAD_ENVIRONMENT_ID?.trim()
  const originTrustSecret = env.ORIGIN_TRUST_SECRET?.trim()
  if (!endpoint || !workloadEnvironmentId || !originTrustSecret) return undefined
  return async (report) => {
    const response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-voyant-origin-trust": originTrustSecret,
      },
      body: JSON.stringify({ workloadEnvironmentId, ...report }),
    })
    if (!response.ok) {
      throw new Error(`Managed product job health reporting failed with HTTP ${response.status}.`)
    }
  }
}

function jobIdFromInvocationUrl(url: string): string | undefined {
  const pathname = new URL(url).pathname
  if (!pathname.startsWith(`${VOYANT_PRODUCT_JOB_ROUTE}/`)) return undefined
  const encoded = pathname.slice(VOYANT_PRODUCT_JOB_ROUTE.length + 1)
  if (!encoded || encoded.includes("/")) return undefined
  try {
    return decodeURIComponent(encoded)
  } catch {
    return undefined
  }
}

function exactCloudflareCronForEvery(every: string | number): string | undefined {
  const milliseconds = everyMilliseconds(every)
  if (milliseconds === undefined || milliseconds % 60_000 !== 0) return undefined
  const minutes = milliseconds / 60_000
  if (minutes === 1) return "* * * * *"
  if (minutes < 60 && Number.isInteger(minutes) && 60 % minutes === 0) {
    return `*/${minutes} * * * *`
  }
  const hours = minutes / 60
  if (hours === 1) return "0 * * * *"
  if (hours < 24 && Number.isInteger(hours) && 24 % hours === 0) {
    return `0 */${hours} * * *`
  }
  if (hours === 24) return "0 0 * * *"
  return undefined
}

function everyMilliseconds(value: string | number): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined
  const shorthand = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i.exec(value.trim())
  if (shorthand) {
    const factors = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }
    return Number(shorthand[1]) * factors[shorthand[2]!.toLowerCase() as keyof typeof factors]
  }
  const iso = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(
    value.trim(),
  )
  if (!iso) return undefined
  const milliseconds =
    Number(iso[1] ?? 0) * 3_600_000 + Number(iso[2] ?? 0) * 60_000 + Number(iso[3] ?? 0) * 1_000
  return milliseconds > 0 ? milliseconds : undefined
}
