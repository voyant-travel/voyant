import {
  type WorkflowConfig,
  type WorkflowContext,
  type WorkflowDefinition,
  workflow,
} from "@voyant-travel/workflows"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type BeginWorkflowRunInput,
  beginWorkflowRun,
  type WorkflowRunRecorder,
} from "./recorder.js"

type MaybePromise<T> = T | Promise<T>
type JsonRecord = Record<string, unknown>
const WAITPOINT_PENDING = Symbol.for("voyant.workflows.waitpointPending")

export interface RecordedWorkflowRunContext<TInput> {
  input: TInput
  ctx: WorkflowContext<TInput>
  config: WorkflowConfig<TInput, unknown>
}

export interface RecordedWorkflowResultContext<TInput, TOutput>
  extends RecordedWorkflowRunContext<TInput> {
  output: TOutput
}

export interface RecordedWorkflowOptions<TInput, TOutput> {
  /**
   * Database used by the workflow-runs recorder. When omitted, the helper
   * resolves `ctx.services.resolve(dbServiceName)`.
   */
  db?:
    | PostgresJsDatabase
    | ((
        args: RecordedWorkflowRunContext<TInput>,
      ) => MaybePromise<PostgresJsDatabase | null | undefined>)
  /** Service-container key used when `db` is omitted. Defaults to `db`. */
  dbServiceName?: string
  workflowName?: string | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string>)
  trigger?:
    | string
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string | null | undefined>)
  correlationId?:
    | string
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string | null | undefined>)
  tags?:
    | ReadonlyArray<string>
    | ((
        args: RecordedWorkflowRunContext<TInput>,
      ) => MaybePromise<ReadonlyArray<string> | null | undefined>)
  input?:
    | false
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<JsonRecord | null | undefined>)
  result?:
    | false
    | ((
        args: RecordedWorkflowResultContext<TInput, TOutput>,
      ) => MaybePromise<JsonRecord | null | undefined>)
  parentRunId?:
    | string
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string | null | undefined>)
  triggeredByUserId?:
    | string
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string | null | undefined>)
  resumeFromStep?:
    | string
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<string | null | undefined>)
}

/**
 * Declare a `@voyant-travel/workflows` workflow whose run lifecycle is mirrored into
 * the `workflow_runs` observability tables. Recording is best-effort: database,
 * metadata, or serialization failures never change workflow execution behavior.
 */
export function recordedWorkflow<TInput = unknown, TOutput = unknown>(
  config: WorkflowConfig<TInput, TOutput>,
  options: RecordedWorkflowOptions<TInput, TOutput> = {},
): WorkflowDefinition<TInput, TOutput> {
  return workflow<TInput, TOutput>({
    ...config,
    async run(input, ctx) {
      const recorder = await startRecording(config, options, input, ctx)
      try {
        const output = await config.run(input, ctx)
        await completeRecording(recorder, options, config, input, ctx, output)
        return output
      } catch (err) {
        if (isWaitpointPending(err)) throw err
        await failRecording(recorder, err)
        throw err
      }
    },
  })
}

async function startRecording<TInput, TOutput>(
  config: WorkflowConfig<TInput, TOutput>,
  options: RecordedWorkflowOptions<TInput, TOutput>,
  input: TInput,
  ctx: WorkflowContext<TInput>,
): Promise<WorkflowRunRecorder | null> {
  try {
    const args: RecordedWorkflowRunContext<TInput> = {
      input,
      ctx,
      config: config as WorkflowConfig<TInput, unknown>,
    }
    const db = await resolveDb(options, args)
    if (!db) return null
    const beginInput: BeginWorkflowRunInput = {
      workflowName: await resolveValue(options.workflowName, args, config.id),
      trigger: await resolveValue(options.trigger, args, triggerName(ctx)),
      correlationId: await resolveValue(options.correlationId, args, ctx.run.id),
      tags: [
        ...dedupe([...(config.tags ?? []), ...ctx.run.tags, ...(await resolveTags(options, args))]),
      ],
      input: await resolveInput(options, args),
      parentRunId: await resolveValue(options.parentRunId, args, parentRunId(ctx)),
      triggeredByUserId: await resolveValue(
        options.triggeredByUserId,
        args,
        triggeredByUserId(ctx),
      ),
      resumeFromStep: await resolveValue(options.resumeFromStep, args, null),
    }
    return await beginWorkflowRun(db, beginInput, { reuseRunningRun: ctx.invocationCount > 1 })
  } catch {
    return null
  }
}

async function completeRecording<TInput, TOutput>(
  recorder: WorkflowRunRecorder | null,
  options: RecordedWorkflowOptions<TInput, TOutput>,
  config: WorkflowConfig<TInput, TOutput>,
  input: TInput,
  ctx: WorkflowContext<TInput>,
  output: TOutput,
): Promise<void> {
  if (!recorder) return
  try {
    await recorder.complete(await resolveResult(options, { input, ctx, config, output }))
  } catch {
    // best-effort observability only
  }
}

async function failRecording(recorder: WorkflowRunRecorder | null, err: unknown): Promise<void> {
  if (!recorder) return
  try {
    await recorder.fail(err)
  } catch {
    // best-effort observability only
  }
}

async function resolveDb<TInput, TOutput>(
  options: RecordedWorkflowOptions<TInput, TOutput>,
  args: RecordedWorkflowRunContext<TInput>,
): Promise<PostgresJsDatabase | null | undefined> {
  if (typeof options.db === "function") return options.db(args)
  if (options.db) return options.db
  const serviceName = options.dbServiceName ?? "db"
  return args.ctx.services.resolve<PostgresJsDatabase>(serviceName)
}

async function resolveTags<TInput, TOutput>(
  options: RecordedWorkflowOptions<TInput, TOutput>,
  args: RecordedWorkflowRunContext<TInput>,
): Promise<ReadonlyArray<string>> {
  if (Array.isArray(options.tags)) return options.tags
  if (typeof options.tags === "function") return (await options.tags(args)) ?? []
  return []
}

async function resolveInput<TInput, TOutput>(
  options: RecordedWorkflowOptions<TInput, TOutput>,
  args: RecordedWorkflowRunContext<TInput>,
): Promise<JsonRecord | null> {
  if (options.input === false) return null
  if (typeof options.input === "function") return (await options.input(args)) ?? null
  return toJsonRecord(args.input)
}

async function resolveResult<TInput, TOutput>(
  options: RecordedWorkflowOptions<TInput, TOutput>,
  args: RecordedWorkflowResultContext<TInput, TOutput>,
): Promise<JsonRecord | null> {
  try {
    if (options.result === false) return null
    if (typeof options.result === "function") return (await options.result(args)) ?? null
    return toJsonRecord(args.output)
  } catch {
    return null
  }
}

async function resolveValue<TInput, TValue>(
  value:
    | TValue
    | ((args: RecordedWorkflowRunContext<TInput>) => MaybePromise<TValue | null | undefined>)
    | null
    | undefined,
  args: RecordedWorkflowRunContext<TInput>,
  fallback: TValue,
): Promise<TValue> {
  if (typeof value === "function") {
    return ((await (
      value as (args: RecordedWorkflowRunContext<TInput>) => MaybePromise<TValue | null | undefined>
    )(args)) ?? fallback) as TValue
  }
  return (value ?? fallback) as TValue
}

function triggerName(ctx: WorkflowContext<unknown>): string {
  const trigger = ctx.run.triggeredBy
  if (trigger.kind === "event") return trigger.eventType
  if (trigger.kind === "schedule") return `schedule:${trigger.scheduleId}`
  if (trigger.kind === "parent") return "parent"
  return "api"
}

function parentRunId(ctx: WorkflowContext<unknown>): string | null {
  const trigger = ctx.run.triggeredBy
  return trigger.kind === "parent" ? trigger.parentRunId : null
}

function triggeredByUserId(ctx: WorkflowContext<unknown>): string | null {
  const trigger = ctx.run.triggeredBy
  return trigger.kind === "api" ? (trigger.actor ?? null) : null
}

function toJsonRecord(value: unknown): JsonRecord | null {
  if (value === undefined || value === null) return null
  if (isPlainRecord(value)) return value
  return { value }
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isWaitpointPending(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { [WAITPOINT_PENDING]?: true })[WAITPOINT_PENDING] === true
  )
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)]
}
