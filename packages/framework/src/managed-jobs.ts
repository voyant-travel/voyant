/**
 * @deprecated Compatibility surface for profile-snapshot provisioning callers.
 * Graph-native applications consume scheduled jobs from the resolved graph.
 */
import { getVoyantProjectRequirements } from "./profile.js"
import type { VoyantProjectManifest } from "./profile-types.js"
import {
  SCHEDULED_JOB_ROUTE,
  STANDARD_OPERATOR_SCHEDULED_JOBS,
  type VoyantScheduledJob,
} from "./scheduled-jobs.js"

export { SCHEDULED_JOB_ROUTE, STANDARD_OPERATOR_SCHEDULED_JOBS }

/** @deprecated Use VoyantScheduledJob from ./scheduled-jobs. */
export type ManagedScheduledJob = VoyantScheduledJob

/** @deprecated Package workflows are loaded from selected graph runtime references. */
export interface ManagedWorkflowManifestEntry {
  readonly id: string
  readonly config?: Readonly<Record<string, unknown>>
}

/** @deprecated Package event filters are loaded from selected graph runtime references. */
export interface ManagedEventFilterEntry {
  readonly id: string
  readonly eventType: string
  readonly manifest?: unknown
}

/** @deprecated Resolve provisioning from a selected graph. */
export function getManagedProfileScheduledJobs(
  project: VoyantProjectManifest,
): VoyantScheduledJob[] {
  const active = new Set(getVoyantProjectRequirements(project).modules.include)
  return STANDARD_OPERATOR_SCHEDULED_JOBS.filter(
    (job) => job.module === "framework" || active.has(`@voyant-travel/${job.module}`),
  )
}

/** @deprecated Package workflows are loaded from selected graph runtime references. */
export function getManagedProfileWorkflowManifest(
  _project: VoyantProjectManifest,
): ManagedWorkflowManifestEntry[] {
  return []
}

/** @deprecated Package event filters are loaded from selected graph runtime references. */
export function getManagedProfileEventFilters(
  _project: VoyantProjectManifest,
): ManagedEventFilterEntry[] {
  return []
}
