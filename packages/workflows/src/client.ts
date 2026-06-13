// Client-safe workflow API for app/server code that triggers or forwards
// workflow activity to a managed Voyant Cloud runtime.

import type { IngestEventArgs, IngestEventResponse, WorkflowDriver } from "./driver.js"
import type { WorkflowManifest } from "./protocol/index.js"
import type { Duration, EnvironmentName, RunStatus } from "./types.js"
import type { WorkflowHandle } from "./workflow.js"

export interface WorkflowsClient {
  trigger<TIn, TOut>(
    workflow: WorkflowHandle<TIn, TOut> | string,
    input: TIn,
    opts?: TriggerOptions,
  ): Promise<Run<TOut>>

  signal(runId: string, name: string, payload: unknown, opts?: { nonce?: string }): Promise<void>
  completeToken(tokenId: string, payload: unknown): Promise<void>

  cancel(runId: string, opts?: { compensate?: boolean; reason?: string }): Promise<void>
  retry(runId: string, opts: { mode: "re-trigger" | "resume" }): Promise<Run>
  replay(runId: string, opts?: { fromStepId?: string; input?: unknown }): Promise<Run>

  get(runId: string): Promise<RunDetail>
  list(opts?: ListRunsOptions): Promise<{ runs: RunSummary[]; nextCursor?: string }>

  mintAccessToken(opts: MintAccessTokenOptions): Promise<PublicAccessToken>
}

export interface TriggerOptions {
  idempotencyKey?: string
  delay?: Duration | Date
  debounce?: { key: string; delay: Duration; mode?: "leading" | "trailing" }
  ttl?: Duration
  tags?: string[]
  priority?: number
  concurrencyKey?: string
  lockToVersion?: string
  environment?: EnvironmentName
  issuePublicAccessToken?: boolean
}

export interface Run<TOut = unknown> {
  id: string
  workflowId: string
  status: RunStatus
  startedAt: number
  accessToken?: string
  /** Phantom; used only for TypeScript inference. */
  readonly __output?: TOut
}

export interface RunSummary {
  id: string
  workflowId: string
  status: RunStatus
  startedAt: number
  completedAt?: number
  tags: string[]
  environment: EnvironmentName
}

export interface RunDetail<TOut = unknown> extends RunSummary {
  version: string
  input: unknown
  output?: TOut
  error?: unknown
  durationMs?: number
}

export interface ListRunsOptions {
  workflowId?: string
  status?: RunStatus | RunStatus[]
  environment?: EnvironmentName
  tag?: string
  since?: Date | number
  until?: Date | number
  cursor?: string
  limit?: number
}

export interface MintAccessTokenOptions {
  target:
    | { kind: "run"; runId: string }
    | { kind: "workflow"; workflowId: string }
    | { kind: "tag"; tag: string }
  scope: ("read" | "trigger" | "cancel")[]
  ttl?: Duration
}

export interface PublicAccessToken {
  token: string
  exp: number
}

export interface CloudWorkflowsClientEnv {
  VOYANT_CLOUD_WORKFLOWS_URL?: string
  VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN?: string
  VOYANT_CLOUD_APP_SLUG?: string
  VOYANT_CLOUD_ENVIRONMENT?: string
}

export interface CloudWorkflowsClientOptions {
  baseUrl?: string
  triggerToken?: string
  appSlug?: string
  environment?: EnvironmentName
  fetch?: typeof fetch
  env?: CloudWorkflowsClientEnv
}

export interface CloudWorkflowDriverOptions extends CloudWorkflowsClientOptions {
  /**
   * Managed Cloud deployments should leave this disabled. Workflow releases
   * are created by the deployment/control-plane path, not by the app runtime.
   * The enabled mode exists only for explicitly wired adapters that own their
   * release-registration boundary.
   */
  manifestRegistration?: "disabled" | "enabled"
}

const DEFAULT_ENVIRONMENT: EnvironmentName = "production"

let configuredClient: WorkflowsClient | undefined

/**
 * Install the process-local `workflows` client implementation used by the
 * root `@voyantjs/workflows` singleton. Apps may call this during boot, or
 * rely on deployment-injected Voyant Cloud environment variables.
 */
export function configureWorkflowsClient(client: WorkflowsClient): void {
  configuredClient = client
}

export function getConfiguredWorkflowsClient(): WorkflowsClient | undefined {
  return configuredClient
}

export const workflows: WorkflowsClient = new Proxy({} as WorkflowsClient, {
  get(_, method: keyof WorkflowsClient & string) {
    return (...args: unknown[]) => {
      const client = configuredClient ?? tryCreateCloudClientFromEnv()
      if (!client) {
        throw new Error(
          `@voyantjs/workflows: workflows.${method}() requires a configured workflows client. ` +
            `Use configureWorkflowsClient(createCloudWorkflowsClient(...)) or provide the ` +
            `VOYANT_CLOUD_WORKFLOWS_URL, VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN, ` +
            `VOYANT_CLOUD_APP_SLUG, and VOYANT_CLOUD_ENVIRONMENT deployment variables.`,
        )
      }
      const fn = client[method]
      if (typeof fn !== "function") {
        throw new Error(`@voyantjs/workflows: workflows.${method} is not implemented`)
      }
      return (fn as (...inner: unknown[]) => unknown)(...args)
    }
  },
})

export function createCloudWorkflowsClient(
  options: CloudWorkflowsClientOptions = {},
): WorkflowsClient {
  const config = resolveCloudConfig(options)
  const httpFetch = options.fetch ?? globalThis.fetch
  if (typeof httpFetch !== "function") {
    throw new Error("@voyantjs/workflows/client: global fetch is unavailable")
  }

  return {
    async trigger<TIn, TOut>(
      workflow: WorkflowHandle<TIn, TOut> | string,
      input: TIn,
      opts?: TriggerOptions,
    ): Promise<Run<TOut>> {
      const workflowId = workflowIdOf(workflow)
      const environment = opts?.environment ?? config.environment
      const res = await cloudFetch(httpFetch, config, {
        method: "POST",
        path: `/apps/${encodeURIComponent(config.appSlug)}/${environment}/workflows/${encodeURIComponent(
          workflowId,
        )}/runs`,
        body: {
          input,
          options: serializeTriggerOptions(opts),
        },
        idempotencyKey: opts?.idempotencyKey,
      })
      return normalizeRun<TOut>(await readJson(res), workflowId)
    },

    signal() {
      return unsupported("signal")
    },
    completeToken() {
      return unsupported("completeToken")
    },
    cancel() {
      return unsupported("cancel")
    },
    retry() {
      return unsupported("retry")
    },
    replay() {
      return unsupported("replay")
    },
    get() {
      return unsupported("get")
    },
    list() {
      return unsupported("list")
    },
    mintAccessToken() {
      return unsupported("mintAccessToken")
    },
  }
}

/**
 * Cloud-mode driver for framework event forwarding. It does not execute runs
 * locally; it forwards triggers/events/manifests to the hosted runtime using
 * the same deployment-scoped credentials as the client.
 */
export function createCloudWorkflowDriver(
  options: CloudWorkflowDriverOptions = {},
): WorkflowDriver {
  const client = createCloudWorkflowsClient(options)
  const config = resolveCloudConfig(options)
  const httpFetch = options.fetch ?? globalThis.fetch
  const manifestRegistration = options.manifestRegistration ?? "disabled"

  return {
    async registerManifest(args): Promise<{ versionId: string }> {
      if (manifestRegistration === "disabled") {
        return { versionId: args.manifest.versionId }
      }
      const res = await cloudFetch(httpFetch, config, {
        method: "POST",
        path: `/apps/${encodeURIComponent(config.appSlug)}/${args.environment}/workflow-releases`,
        body: { manifest: args.manifest },
      })
      const body = await readJson(res)
      return {
        versionId:
          readString(body, ["versionId"]) ??
          readString(body, ["data", "versionId"]) ??
          args.manifest.versionId,
      }
    },
    trigger(workflow, input, opts) {
      return client.trigger(workflow, input, opts)
    },
    async ingestEvent(args: IngestEventArgs): Promise<IngestEventResponse> {
      const eventId =
        typeof args.envelope.metadata?.eventId === "string"
          ? args.envelope.metadata.eventId
          : args.idempotencyKey
      const res = await cloudFetch(httpFetch, config, {
        method: "POST",
        path: `/apps/${encodeURIComponent(config.appSlug)}/${args.environment}/events`,
        body: {
          envelope: args.envelope,
          idempotencyKey: args.idempotencyKey,
        },
        idempotencyKey: eventId,
      })
      return (await readJson(res)) as IngestEventResponse
    },
    async getManifest(args): Promise<WorkflowManifest | null> {
      const res = await cloudFetch(httpFetch, config, {
        method: "GET",
        path: `/apps/${encodeURIComponent(config.appSlug)}/${args.environment}/workflow-releases/current`,
        allowStatuses: [404],
      })
      if (res.status === 404) return null
      const body = await readJson(res)
      return (readRecord(body, ["manifest"]) ??
        readRecord(body, ["data", "manifest"]) ??
        body) as WorkflowManifest
    },
  }
}

interface ResolvedCloudConfig {
  baseUrl: string
  triggerToken: string
  appSlug: string
  environment: EnvironmentName
}

interface CloudFetchArgs {
  method: "GET" | "POST"
  path: string
  body?: unknown
  idempotencyKey?: string
  allowStatuses?: number[]
}

function tryCreateCloudClientFromEnv(): WorkflowsClient | undefined {
  const env = defaultEnv()
  if (
    !env.VOYANT_CLOUD_WORKFLOWS_URL ||
    !env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN ||
    !env.VOYANT_CLOUD_APP_SLUG
  ) {
    return undefined
  }
  const client = createCloudWorkflowsClient({ env })
  configuredClient = client
  return client
}

function resolveCloudConfig(options: CloudWorkflowsClientOptions): ResolvedCloudConfig {
  const env = { ...defaultEnv(), ...options.env }
  const baseUrl = options.baseUrl ?? env.VOYANT_CLOUD_WORKFLOWS_URL
  const triggerToken = options.triggerToken ?? env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN
  const appSlug = options.appSlug ?? env.VOYANT_CLOUD_APP_SLUG
  const environment = parseEnvironment(
    options.environment ?? env.VOYANT_CLOUD_ENVIRONMENT ?? DEFAULT_ENVIRONMENT,
  )

  const missing = [
    ["baseUrl", baseUrl],
    ["triggerToken", triggerToken],
    ["appSlug", appSlug],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(
      `@voyantjs/workflows/client: missing Cloud workflow configuration: ${missing.join(", ")}`,
    )
  }

  return {
    baseUrl: stripTrailingSlash(requireConfigValue(baseUrl, "baseUrl")),
    triggerToken: requireConfigValue(triggerToken, "triggerToken"),
    appSlug: requireConfigValue(appSlug, "appSlug"),
    environment,
  }
}

function requireConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`@voyantjs/workflows/client: missing Cloud workflow configuration: ${name}`)
  }
  return value
}

async function cloudFetch(
  httpFetch: typeof fetch,
  config: ResolvedCloudConfig,
  args: CloudFetchArgs,
): Promise<Response> {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${config.triggerToken}`,
  })
  if (args.body !== undefined) headers.set("content-type", "application/json")
  if (args.idempotencyKey) headers.set("idempotency-key", args.idempotencyKey)

  const res = await httpFetch(`${config.baseUrl}/cloud/v1${args.path}`, {
    method: args.method,
    headers,
    body: args.body === undefined ? undefined : JSON.stringify(args.body),
  })
  if (!res.ok && !args.allowStatuses?.includes(res.status)) {
    throw new Error(
      `Voyant Cloud workflows request failed: ${res.status} ${res.statusText} ${await res.text()}`,
    )
  }
  return res
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.length === 0) return {}
  return JSON.parse(text) as unknown
}

function normalizeRun<TOut>(body: unknown, fallbackWorkflowId: string): Run<TOut> {
  const source =
    readRecord(body, ["data", "run"]) ??
    readRecord(body, ["run"]) ??
    readRecord(body, ["data"]) ??
    asRecord(body)
  const id = readString(source, ["id"]) ?? readString(source, ["runId"])
  if (!id) {
    throw new Error("Voyant Cloud workflows response did not include a run id")
  }
  return {
    id,
    workflowId:
      readString(source, ["workflowId"]) ??
      readString(source, ["workflow", "id"]) ??
      fallbackWorkflowId,
    status: parseRunStatus(readString(source, ["status"]) ?? "pending"),
    startedAt: readNumber(source, ["startedAt"]) ?? Date.now(),
    accessToken: readString(source, ["accessToken"]),
  }
}

function serializeTriggerOptions(opts: TriggerOptions | undefined): Record<string, unknown> {
  if (!opts) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined || key === "environment") continue
    out[key] = value instanceof Date ? value.toISOString() : value
  }
  return out
}

function workflowIdOf(workflow: WorkflowHandle<unknown, unknown> | string): string {
  return typeof workflow === "string" ? workflow : workflow.id
}

function unsupported(method: string): never {
  throw new Error(
    `@voyantjs/workflows/client: workflows.${method}() is not supported by the ` +
      `managed Cloud trigger client yet.`,
  )
}

function defaultEnv(): CloudWorkflowsClientEnv {
  const processEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: CloudWorkflowsClientEnv }
    }
  ).process?.env
  return processEnv ?? {}
}

function parseEnvironment(value: string): EnvironmentName {
  if (value === "production" || value === "preview" || value === "development") return value
  throw new Error(
    `@voyantjs/workflows/client: invalid environment "${value}"; expected production, preview, or development`,
  )
}

function parseRunStatus(value: string): RunStatus {
  const normalized = value.toLowerCase()
  if (
    normalized === "pending" ||
    normalized === "queued" ||
    normalized === "running" ||
    normalized === "waiting" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "cancelled_by_dev_reload" ||
    normalized === "cancelled_by_version_sunset" ||
    normalized === "compensated" ||
    normalized === "compensation_failed" ||
    normalized === "timed_out"
  ) {
    return normalized
  }
  return "pending"
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function readRecord(value: unknown, path: string[]): Record<string, unknown> | undefined {
  const current = readAtPath(value, path)
  return typeof current === "object" && current !== null
    ? (current as Record<string, unknown>)
    : undefined
}

function readString(value: unknown, path: string[]): string | undefined {
  const current = readAtPath(value, path)
  return typeof current === "string" && current.length > 0 ? current : undefined
}

function readNumber(value: unknown, path: string[]): number | undefined {
  const current = readAtPath(value, path)
  if (typeof current === "number") return current
  if (typeof current === "string" && current.length > 0) {
    const parsed = Number(current)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readAtPath(value: unknown, path: string[]): unknown {
  let current: unknown = value
  for (const part of path) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
