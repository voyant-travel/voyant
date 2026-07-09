// Framework-owned provisioning manifests for managed profiles (voyant#3032).
//
// Managed-profile deployments (platform#953/#954) run a fixed, versioned
// `voyant-operator-runtime:<framework-version>` image with NO build step — the
// platform never sees a build artifact. Two Cloud-side provisioning steps
// therefore need data derivable purely from a profile snapshot + the installed
// framework version:
//
//   1. the Cloud Scheduler job set (which crons to create), and
//   2. the workflow definitions to register at deploy (`{ id, config }` grain).
//
// Both were previously reachable only from `starters/operator` (the cron list)
// or a build artifact (the workflow manifest). This module makes them
// framework-owned, versioned with the framework release, and — critically —
// derived from the resolved module subset, so a profile that activates fewer
// modules provisions fewer jobs. `starters/operator` consumes the same set as
// its single source of truth (plus its own deployment-local jobs).

import { getVoyantProjectRequirements } from "./profile.js"
import { moduleIdFromSpecifier, type VoyantProjectManifest } from "./profile-types.js"

/**
 * The Node runtime path a Cloud Scheduler job POSTs to trigger scheduled work.
 * The cron expression is passed as `?cron=<expr>` and the request carries the
 * origin-trust header — see `packages/runtime`'s `SCHEDULED_PATH`.
 */
export const SCHEDULED_JOB_ROUTE = "/__voyant/scheduled"

/** A single scheduled job Cloud must provision as a Cloud Scheduler entry. */
export interface ManagedScheduledJob {
  /** Stable, kebab-case identifier — used as the Cloud Scheduler job name. */
  readonly id: string
  /** Standard 5-field cron expression (UTC). */
  readonly cron: string
  /** Human-readable description of the work this trigger drives. */
  readonly description: string
  /** The runtime route the job POSTs (`?cron=<expr>` selects the handler). */
  readonly route: string
  /**
   * The module this job belongs to — a `moduleId` (e.g. `distribution`) for
   * module-owned jobs, or `"framework"` for always-on infrastructure jobs that
   * are independent of the module subset.
   */
  readonly module: string
}

/**
 * A workflow definition to register at deploy, at the serializable `{ id,
 * config }` grain the Cloud driver consumes (voyant#2925) — never the handler
 * graph. Structurally compatible with `@voyant-travel/core`'s `WorkflowDescriptor`.
 */
export interface ManagedWorkflowManifestEntry {
  readonly id: string
  readonly config?: Readonly<Record<string, unknown>>
}

/**
 * An event-filter binding to register at deploy — the declarative `event.name →
 * workflow` routing a module owns. Structurally compatible with
 * `@voyant-travel/core`'s `EventFilterDescriptor`; the runtime entry carries the
 * full serializable `manifest` (where/input/target) the Cloud event router needs.
 *
 * These MUST be registered alongside {@link ManagedWorkflowManifestEntry}: a
 * workflow registered without its event filter never fires on the events that
 * are meant to trigger it (voyant#3032 review).
 */
export interface ManagedEventFilterEntry {
  readonly id: string
  readonly eventType: string
  /** Opaque serializable routing descriptor (where/input/target) the Cloud event router registers. */
  readonly manifest?: unknown
}

/**
 * Marks a standard job as always-on framework infrastructure (independent of
 * the module subset) rather than owned by a mountable module.
 */
const FRAMEWORK_INFRA = null

interface StandardScheduledJobDefinition {
  readonly id: string
  readonly cron: string
  readonly description: string
  /** Owning module specifier, or {@link FRAMEWORK_INFRA} for always-on infra. */
  readonly moduleSpecifier: string | null
}

/**
 * The standard operator profile's scheduled jobs, each tagged with the module
 * that owns the work it drives. A job is provisioned only when its owning
 * module is in the resolved subset; `FRAMEWORK_INFRA` jobs are always present.
 *
 * Ownership is derived from what each job's handler drives (see
 * `starters/operator/src/api/jobs/*`):
 * - `outbox-drain` → the event-outbox subsystem (framework infra, always on).
 * - `draft-reaper` → catalog booking-engine drafts.
 * - `promotion-boundary-scheduler` → commerce promotions.
 * - `channel-push-*` → distribution channel push.
 *
 * `external-cruise-catalog-refresh` is intentionally NOT here: `@voyant-travel/cruises`
 * is not part of the standard runtime manifest, so that cron is deployment-local
 * (the operator starter appends it). A subset that later adds cruises would
 * declare it the same way.
 */
export const STANDARD_PROFILE_SCHEDULED_JOBS: readonly StandardScheduledJobDefinition[] = [
  {
    id: "outbox-drain",
    cron: "*/2 * * * *",
    description: "Redelivers failed/interrupted event-outbox deliveries (every 2 min).",
    moduleSpecifier: FRAMEWORK_INFRA,
  },
  {
    id: "draft-reaper",
    cron: "5 * * * *",
    description: "Drops expired booking drafts (hourly at :05).",
    moduleSpecifier: "@voyant-travel/catalog",
  },
  {
    id: "promotion-boundary-scheduler",
    cron: "*/5 * * * *",
    description: "Emits promotion.changed at valid_from / valid_until boundaries (every 5 min).",
    moduleSpecifier: "@voyant-travel/commerce",
  },
  {
    id: "channel-push-booking-link",
    cron: "*/15 * * * *",
    description: "Channel-push booking-link reconciler (every 15 min).",
    moduleSpecifier: "@voyant-travel/distribution",
  },
  {
    id: "channel-push-availability",
    cron: "0 * * * *",
    description: "Channel-push availability reconciler (hourly).",
    moduleSpecifier: "@voyant-travel/distribution",
  },
  {
    id: "channel-push-content",
    cron: "0 3 * * *",
    description: "Channel-push content reconciler (nightly at 03:00).",
    moduleSpecifier: "@voyant-travel/distribution",
  },
]

/**
 * The standard workflow definitions each module contributes, keyed by module
 * specifier. Mirrors the `module.workflows` metadata the framework composition
 * declares (`composition-lazy.ts`), so the derived manifest never drifts from
 * what the runtime actually registers. Kept in sync by a unit test.
 */
const STANDARD_PROFILE_WORKFLOWS: Readonly<
  Record<string, readonly ManagedWorkflowManifestEntry[]>
> = {
  "@voyant-travel/commerce": [
    {
      id: "promotions.reindex-all-products",
      config: {
        defaultRuntime: "node",
      },
    },
  ],
}

/**
 * The standard event-filter bindings each module contributes, keyed by module
 * specifier. Mirrors the `module.eventFilters` metadata the framework
 * composition declares (`composition-lazy.ts`) alongside `workflows`, so a
 * managed deployment routes the same events into the same workflows the composed
 * runtime does. Kept in sync by a unit test.
 */
const STANDARD_PROFILE_EVENT_FILTERS: Readonly<Record<string, readonly ManagedEventFilterEntry[]>> =
  {
    "@voyant-travel/commerce": [
      {
        id: "ef_6f8e4b4ce409d04c",
        eventType: "promotion.changed",
        manifest: {
          eventType: "promotion.changed",
          id: "ef_6f8e4b4ce409d04c",
          input: {
            object: {
              offerId: { path: "data.offerId" },
              source: { path: "data.source" },
            },
          },
          payloadHash: "6f8e4b4ce409d04c",
          targetWorkflowId: "promotions.reindex-all-products",
          where: {
            eq: [{ path: "data.affected.kind" }, { lit: "all" }],
          },
        },
      },
    ],
  }

function toManagedScheduledJob(job: StandardScheduledJobDefinition): ManagedScheduledJob {
  return {
    id: job.id,
    cron: job.cron,
    description: job.description,
    route: SCHEDULED_JOB_ROUTE,
    module:
      job.moduleSpecifier === FRAMEWORK_INFRA
        ? "framework"
        : moduleIdFromSpecifier(job.moduleSpecifier),
  }
}

/**
 * The full standard operator scheduled-job set (every standard module active).
 * The source-backed operator starter composes the full runtime, so this is its
 * job set — it no longer hand-maintains the list. Cloud uses
 * {@link getManagedProfileScheduledJobs} for a specific (possibly subset) snapshot.
 */
export const STANDARD_OPERATOR_SCHEDULED_JOBS: readonly ManagedScheduledJob[] =
  STANDARD_PROFILE_SCHEDULED_JOBS.map(toManagedScheduledJob)

function resolveActiveModuleSpecifiers(project: VoyantProjectManifest): ReadonlySet<string> {
  return new Set(getVoyantProjectRequirements(project).modules.include)
}

/**
 * The Cloud Scheduler job set for a managed profile snapshot (voyant#3032).
 *
 * Given only a valid `voyant.managed-profile.v1` snapshot and the installed
 * framework version, Cloud can compute exactly which scheduler jobs to create:
 * always-on framework jobs plus one job per active module that owns scheduled
 * work. Every job POSTs {@link SCHEDULED_JOB_ROUTE} with `?cron=<expr>`.
 */
export function getManagedProfileScheduledJobs(
  project: VoyantProjectManifest,
): ManagedScheduledJob[] {
  const active = resolveActiveModuleSpecifiers(project)
  return STANDARD_PROFILE_SCHEDULED_JOBS.filter(
    (job) => job.moduleSpecifier === FRAMEWORK_INFRA || active.has(job.moduleSpecifier),
  ).map(toManagedScheduledJob)
}

/**
 * The workflow definitions manifest for a managed profile snapshot
 * (voyant#3032), at the `{ id, config }` grain the Cloud driver registers at
 * deploy. Only workflows owned by active modules are included, so the
 * registered set matches what the composed runtime actually runs.
 */
export function getManagedProfileWorkflowManifest(
  project: VoyantProjectManifest,
): ManagedWorkflowManifestEntry[] {
  return collectActiveModuleEntries(project, STANDARD_PROFILE_WORKFLOWS)
}

/**
 * The event-filter bindings for a managed profile snapshot (voyant#3032). These
 * register the `event → workflow` routes alongside
 * {@link getManagedProfileWorkflowManifest} — without them a registered workflow
 * never fires on the events meant to trigger it. Only filters owned by active
 * modules are included.
 */
export function getManagedProfileEventFilters(
  project: VoyantProjectManifest,
): ManagedEventFilterEntry[] {
  return collectActiveModuleEntries(project, STANDARD_PROFILE_EVENT_FILTERS)
}

export function getStandardProfileWorkflowManifestForModule(
  moduleSpecifier: string,
): ManagedWorkflowManifestEntry[] {
  return [...(STANDARD_PROFILE_WORKFLOWS[moduleSpecifier] ?? [])]
}

export function getStandardProfileEventFiltersForModule(
  moduleSpecifier: string,
): ManagedEventFilterEntry[] {
  return [...(STANDARD_PROFILE_EVENT_FILTERS[moduleSpecifier] ?? [])]
}

function collectActiveModuleEntries<T>(
  project: VoyantProjectManifest,
  byModuleSpecifier: Readonly<Record<string, readonly T[]>>,
): T[] {
  const active = resolveActiveModuleSpecifiers(project)
  const entries: T[] = []
  for (const [specifier, moduleEntries] of Object.entries(byModuleSpecifier)) {
    if (active.has(specifier)) entries.push(...moduleEntries)
  }
  return entries
}
