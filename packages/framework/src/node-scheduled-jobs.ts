import type { VoyantNodeDeploymentGraphScheduledJob } from "./node-deployment-artifacts.js"

export interface VoyantNodeScheduledDispatchKey {
  cron?: string
  scheduleId?: string
}

export interface VoyantNodeScheduledJob extends VoyantNodeDeploymentGraphScheduledJob {}

export interface VoyantNodeScheduledJobPlan {
  jobs: readonly VoyantNodeScheduledJob[]
  resolve: (event: VoyantNodeScheduledDispatchKey) => VoyantNodeScheduledJob | undefined
  requireCron: (id: string) => string
}

export interface RenderGoogleCloudSchedulerScriptOptions {
  targetUrl: string
  originTrustSecret: string
  timeZone?: string
  jobPrefix?: string
  location?: string
  oidcServiceAccount?: string
}

/** Create one immutable dispatch plan from the graph artifact used to provision schedules. */
export function createVoyantNodeScheduledJobPlan(
  scheduledJobs: readonly VoyantNodeDeploymentGraphScheduledJob[],
): VoyantNodeScheduledJobPlan {
  const jobs = scheduledJobs.map((job) => ({ ...job }))
  const byId = new Map(jobs.map((job) => [job.id, job]))

  return {
    jobs,
    resolve: (event) =>
      event.scheduleId
        ? byId.get(event.scheduleId)
        : jobs.find((job) => event.cron !== undefined && job.cron === event.cron),
    requireCron: (id) => {
      const job = byId.get(id)
      if (!job) throw new Error(`[node-scheduled-jobs] unknown graph scheduled job "${id}".`)
      return job.cron
    },
  }
}

/** Render reviewable Google Cloud Scheduler provisioning from the admitted graph. */
export function renderGoogleCloudSchedulerScript(
  scheduledJobs: readonly VoyantNodeDeploymentGraphScheduledJob[],
  options: RenderGoogleCloudSchedulerScriptOptions,
): string {
  const targetUrl = requiredOption("targetUrl", options.targetUrl).replace(/\/$/, "")
  const trustSecret = requiredOption("originTrustSecret", options.originTrustSecret)
  const timeZone = options.timeZone ?? "Etc/UTC"
  const jobPrefix = schedulerJobName(options.jobPrefix ?? "voyant")
  const lines = [
    "#!/usr/bin/env bash",
    "# Generated from the admitted Voyant deployment graph. Review before running.",
    "set -euo pipefail",
    "",
  ]

  for (const job of scheduledJobs) {
    const uri =
      `${targetUrl}${job.route}?schedule=${encodeURIComponent(job.id)}` +
      `&cron=${encodeURIComponent(job.cron)}`
    const args = [
      `gcloud scheduler jobs create http ${jobPrefix}-${schedulerJobName(job.id)}`,
      options.location ? `--location=${shellQuote(options.location)}` : undefined,
      `--schedule=${shellQuote(job.cron)}`,
      `--time-zone=${shellQuote(timeZone)}`,
      `--uri=${shellQuote(uri)}`,
      "--http-method=POST",
      `--headers=${shellQuote(`x-voyant-origin-trust=${trustSecret}`)}`,
      options.oidcServiceAccount
        ? `--oidc-service-account-email=${shellQuote(options.oidcServiceAccount)}`
        : undefined,
    ].filter((argument): argument is string => argument !== undefined)

    lines.push(`# ${job.description}`, args.join(" \\\n  "), "")
  }

  return `${lines.join("\n")}\n`
}

function requiredOption(name: string, value: string): string {
  if (value.trim()) return value
  throw new Error(`renderGoogleCloudSchedulerScript: ${name} is required.`)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function schedulerJobName(id: string): string {
  return id
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}
