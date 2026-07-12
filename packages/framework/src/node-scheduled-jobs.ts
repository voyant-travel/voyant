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
