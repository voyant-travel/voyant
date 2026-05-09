// Mode 1 driver — Cloudflare edge composition.
//
// `createApp({ workflows: { driver: createCloudflareEdgeDriver({ ... }) } })`
// is the entry point for any deployment that runs the orchestrator on
// Cloudflare Workers + Durable Objects. Composes:
//
//   * `voyant_run_DO` (Durable Object namespace)  — primary state
//   * `WORKFLOW_MANIFESTS` KV namespace            — manifest store
//
// Step delivery is configured separately on the run DO via a
// `StepDispatcher` — see `./dispatchers.ts` for built-in factories
// (inline / service binding / HTTP).
//
// The factory is invoked by `createApp()` after the framework's
// `ModuleContainer` is built — see architecture doc §6.3 for the
// `DriverFactory` contract.
//
// See architecture doc §8.

import type {
  EnvironmentName,
  ListRunsOptions,
  Run,
  RunDetail,
  RunSummary,
  TriggerOptions,
} from "@voyantjs/workflows"
import type {
  DriverFactory,
  DriverFactoryDeps,
  IngestEventArgs,
  IngestEventResponse,
  IngestMatch,
  WorkflowAdmin,
  WorkflowDriver,
} from "@voyantjs/workflows/driver"
import { deriveStableEventId } from "@voyantjs/workflows/events"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { routeEvent } from "@voyantjs/workflows-orchestrator"

import {
  type CfManifestStore,
  createKvManifestStore,
  type KvNamespaceLike,
} from "./manifest-kv-store.js"
import type { DurableObjectNamespaceLike } from "./worker.js"

// ---- Public factory options ----

export interface CloudflareEdgeDriverOptions {
  /** Durable Object namespace holding one DO per run. */
  orchestratorNamespace: DurableObjectNamespaceLike
  /** KV namespace storing serialized manifests. */
  manifestKv: KvNamespaceLike
  /**
   * Adapter-specific tenant identifier stamped onto every triggered
   * run as `tenantMeta.tenantScript`. Opaque to the OSS runtime —
   * surfaces on `StepDispatcherContext` for custom dispatchers that
   * need a routing key. Built-in dispatchers (inline, service-binding,
   * HTTP) ignore it.
   */
  tenantScript?: string
  /** Default environment for `trigger()` calls without an explicit one. */
  defaultEnvironment?: EnvironmentName
  /** Tenant metadata stamped onto every triggered run. Defaults to "default" tripled. */
  tenantMeta?: {
    tenantId: string
    projectId: string
    organizationId: string
  }
  /** Injectable clock; defaults to Date.now. */
  now?: () => number
  /** id generator for runs; defaults to `run_<random>`. */
  idGenerator?: () => string
  /** Optional structured logger; falls back to the framework logger. */
  logger?: (level: "info" | "warn" | "error", msg: string, data?: object) => void
}

const DEFAULT_TENANT_META = {
  tenantId: "default",
  projectId: "default",
  organizationId: "default",
}

// ---- Public factory ----

/**
 * Build the Cloudflare-edge driver factory. The returned `DriverFactory`
 * is invoked once by `createApp()` with `DriverFactoryDeps`.
 *
 * Usage in a Worker template:
 *
 *     createApp({
 *       workflows: {
 *         driver: createCloudflareEdgeDriver({
 *           orchestratorNamespace: env.WORKFLOW_RUN_DO,
 *           manifestKv:            env.WORKFLOW_MANIFESTS,
 *         }),
 *       },
 *     })
 */
export function createCloudflareEdgeDriver(opts: CloudflareEdgeDriverOptions): DriverFactory {
  return (deps: DriverFactoryDeps): WorkflowDriver => {
    const manifestStore: CfManifestStore = createKvManifestStore({ kv: opts.manifestKv })
    const now = opts.now ?? deps.now ?? (() => Date.now())
    const tenantMeta = {
      ...DEFAULT_TENANT_META,
      ...(opts.tenantMeta ?? {}),
      ...(opts.tenantScript ? { tenantScript: opts.tenantScript } : {}),
    }
    const defaultEnv = opts.defaultEnvironment ?? "development"
    const logger = opts.logger ?? deps.logger

    let shuttingDown = false

    // ---- Helpers ----

    function assertNotShutdown(): void {
      if (shuttingDown) {
        throw new Error(
          "CloudflareEdgeDriver: shutdown() has been called; new operations are refused.",
        )
      }
    }

    async function forwardToRunDO(runId: string, request: Request): Promise<Response> {
      const id = opts.orchestratorNamespace.idFromName(runId)
      const stub = opts.orchestratorNamespace.get(id)
      return stub.fetch(request)
    }

    function genRunId(seed?: string): string {
      if (seed !== undefined) return seed
      if (opts.idGenerator) return opts.idGenerator()
      const ts = now().toString(36)
      const rand = Math.floor(Math.random() * 1_000_000)
        .toString(36)
        .padStart(4, "0")
      return `run_${ts}_${rand}`
    }

    // ---- WorkflowDriver implementation ----

    async function registerManifest(args: {
      environment: EnvironmentName
      manifest: WorkflowManifest
    }): Promise<{ versionId: string }> {
      assertNotShutdown()
      return manifestStore.registerManifest({
        environment: args.environment,
        versionId: args.manifest.versionId,
        manifest: args.manifest as unknown as Record<string, unknown>,
      })
    }

    async function getManifest(args: {
      environment: EnvironmentName
    }): Promise<WorkflowManifest | null> {
      const envelope = await manifestStore.getCurrent(args.environment)
      if (!envelope) return null
      return envelope.manifest as unknown as WorkflowManifest
    }

    async function trigger<TIn, TOut>(
      workflow: { id: string } | string,
      input: TIn,
      triggerOpts?: TriggerOptions,
    ): Promise<Run<TOut>> {
      assertNotShutdown()
      const workflowId = typeof workflow === "string" ? workflow : workflow.id
      const env = triggerOpts?.environment ?? defaultEnv
      const runId =
        triggerOpts?.idempotencyKey !== undefined
          ? `idem-${workflowId}-${triggerOpts.idempotencyKey}`
          : genRunId()

      const payload = {
        runId,
        workflowId,
        workflowVersion: triggerOpts?.lockToVersion ?? "v1",
        input: input as unknown,
        tenantMeta,
        environment: env,
        tags: triggerOpts?.tags,
        idempotencyKey: triggerOpts?.idempotencyKey,
        triggeredBy: { kind: "api" as const },
      }
      const resp = await forwardToRunDO(
        runId,
        new Request("https://do-internal/trigger", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      )
      if (!resp.ok) {
        const body = await safeText(resp)
        throw new Error(
          `CloudflareEdgeDriver: trigger DO returned ${resp.status}: ${body.slice(0, 256)}`,
        )
      }
      const record = (await resp.json()) as {
        id: string
        workflowId: string
        status: Run["status"]
        startedAt: number
      }
      return {
        id: record.id,
        workflowId: record.workflowId,
        status: record.status,
        startedAt: record.startedAt,
      }
    }

    async function ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse> {
      assertNotShutdown()
      const stored = await manifestStore.getCurrent(args.environment)
      if (!stored) {
        return {
          ok: false,
          reason: "manifest_not_registered",
          message: `No manifest is registered for environment "${args.environment}".`,
        }
      }
      const manifest = stored.manifest as unknown as WorkflowManifest
      const eventId = args.envelope.metadata?.eventId ?? (await deriveStableEventId(args.envelope))
      const routed = routeEvent({
        manifest,
        envelope: {
          name: args.envelope.name,
          data: args.envelope.data,
          metadata: args.envelope.metadata,
          emittedAt: args.envelope.emittedAt,
        },
        eventId,
        idempotencyOverride: args.idempotencyKey,
      })

      const matches: IngestMatch[] = []
      let anyTriggered = false
      let anyFailed = false

      for (const entry of routed) {
        if (entry.status === "skipped") {
          matches.push({
            filterId: entry.filterId,
            status: "skipped",
            reason: entry.reason,
            details: entry.details,
          })
          continue
        }
        const runId = `idem-${entry.targetWorkflowId}-${entry.idempotencyKey}`
        const payload = {
          runId,
          workflowId: entry.targetWorkflowId,
          workflowVersion: "v1",
          input: entry.input,
          tenantMeta,
          environment: args.environment,
          idempotencyKey: entry.idempotencyKey,
          triggeredBy: {
            kind: "event" as const,
            eventId,
            eventType: args.envelope.name,
            filterId: entry.filterId,
          },
        }
        try {
          const resp = await forwardToRunDO(
            runId,
            new Request("https://do-internal/trigger", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            }),
          )
          if (resp.ok) {
            matches.push({
              filterId: entry.filterId,
              targetWorkflowId: entry.targetWorkflowId,
              runId,
              idempotencyKey: entry.idempotencyKey,
              status: "queued",
            })
            anyTriggered = true
          } else {
            const body = await safeText(resp)
            logger?.("error", "CloudflareEdgeDriver: trigger DO failed", {
              status: resp.status,
              body: body.slice(0, 256),
            })
            matches.push({
              filterId: entry.filterId,
              targetWorkflowId: entry.targetWorkflowId,
              status: "error",
              reason: `do_returned_${resp.status}`,
            })
            anyFailed = true
          }
        } catch (err) {
          matches.push({
            filterId: entry.filterId,
            targetWorkflowId: entry.targetWorkflowId,
            status: "error",
            reason: err instanceof Error ? err.message : String(err),
          })
          anyFailed = true
        }
      }

      if (matches.length > 0 && !anyTriggered && anyFailed) {
        return {
          ok: false,
          reason: "trigger_failed_for_all_matches",
          message: "every matched filter failed to trigger",
        }
      }
      return { ok: true, eventId, matches }
    }

    async function shutdown(): Promise<void> {
      shuttingDown = true
    }

    // ---- WorkflowAdmin (partial — Mode 1 has no native cross-run query
    //      layer; getRun + cancelRun are direct DO RPC; listRuns +
    //      streamRun are explicitly unsupported per architecture
    //      doc §8.3) ----

    const admin: Partial<WorkflowAdmin> = {
      async getRun(runId: string): Promise<RunDetail | null> {
        try {
          const resp = await forwardToRunDO(
            runId,
            new Request("https://do-internal/get", { method: "GET" }),
          )
          if (resp.status === 404) return null
          if (!resp.ok) return null
          const rec = (await resp.json()) as {
            id: string
            workflowId: string
            workflowVersion: string
            status: RunSummary["status"]
            startedAt: number
            completedAt?: number
            tags: string[]
            environment: EnvironmentName
            input: unknown
            output?: unknown
            error?: unknown
          }
          return {
            id: rec.id,
            workflowId: rec.workflowId,
            status: rec.status,
            startedAt: rec.startedAt,
            completedAt: rec.completedAt,
            tags: [...rec.tags],
            environment: rec.environment,
            version: rec.workflowVersion,
            input: rec.input,
            output: rec.output,
            error: rec.error,
            durationMs:
              rec.completedAt !== undefined
                ? Math.max(0, rec.completedAt - rec.startedAt)
                : undefined,
          }
        } catch {
          return null
        }
      },

      async cancelRun(runId: string, cancelOpts?: { reason?: string; compensate?: boolean }) {
        // Per architecture doc §21.21, cancel does NOT run compensations
        // by default; the `compensate` flag is accepted but no-op in v1.
        void cancelOpts?.compensate
        await forwardToRunDO(
          runId,
          new Request("https://do-internal/cancel", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reason: cancelOpts?.reason }),
          }),
        )
      },

      async listRuns(_listOpts?: ListRunsOptions) {
        // Self-host Mode 1 has no native cross-run query layer; voyant-cloud
        // provides one in its index repo. Surface the limit to consumers
        // (the dashboard) so they can fall back gracefully.
        return { runs: [], nextCursor: undefined }
      },

      streamRun(_runId: string) {
        // Live journal-event streaming is a follow-up; return an
        // immediately-exhausted iterable so probes see a clean empty
        // stream rather than undefined.
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => ({ value: undefined as never, done: true as const }),
            }
          },
        }
      },
    }

    return {
      registerManifest,
      trigger,
      ingestEvent,
      getManifest,
      shutdown,
      admin,
    }
  }
}

// ---- Internal helpers ----

// Fallback id derivation lives in `@voyantjs/workflows/events`'s
// `deriveStableEventId` and is used inline at the call site above —
// content-derived so external callers without a forwarder still get
// dedup across retries (architecture doc §15.2).

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text()
  } catch {
    return ""
  }
}
