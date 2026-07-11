// @voyant-travel/workflows/config
//
// Runtime configuration for standalone workflow deployments.
// Contract defined in docs/sdk-surface.md §10 and docs/design.md §5.4.3.

export type Duration = number | `${number}${"ms" | "s" | "m" | "h" | "d" | "w"}`

/** Hosted/self-hosted Node runner profile. */
export type MachineType =
  | "lite"
  | "basic"
  | "standard-1"
  | "standard-2"
  | "standard-3"
  | "standard-4"
  | (string & {})

export type EnvironmentName = "production" | "preview" | "development"

export type MeterKey =
  | "runnerSeconds"
  | "warmSlotHours"
  | "runCount"
  | "activeScheduleHours"
  | "payloadStorageGbHour"
  | "retentionRunMonths"

export type BindingDeclaration =
  | { type: "d1"; name: string }
  | { type: "r2"; name: string }
  | { type: "kv"; name: string }
  | { type: "queue"; name: string }

export interface EnvironmentConfig {
  customDomain?: string
}

export interface RetryPolicy {
  max?: number
  backoff?: "exponential" | "linear" | "fixed"
  initial?: Duration
  maxDelay?: Duration
}

export interface BuildExtension {
  name: string
  /** Open-ended hook surface; each extension defines its own contract. */
  [key: string]: unknown
}

export interface Instrumentation {
  name: string
  [key: string]: unknown
}

export interface WorkflowsConfig {
  dirs?: string[]
  defaults?: {
    retries?: RetryPolicy
    timeout?: Duration
    timezone?: string
    machine?: MachineType
    concurrency?: { strategy?: "queue" | "cancel-in-progress" | "cancel-newest" | "round-robin" }
  }
  containerPool?: {
    defaultMachine?: MachineType
    maxConcurrency?: number
    warmPoolSize?: Partial<Record<EnvironmentName, number>>
    evictionTtl?: Duration
    perPodConcurrency?: number
    scaleOutPolicy?: "none" | "onDemand"
    preWarmStrategy?: "onFirstRequest" | "onDeploy"
  }
  build?: {
    extensions?: BuildExtension[]
    defineEnv?: Record<string, string>
  }
  instrumentations?: Instrumentation[]
  dev?: {
    port?: number
    preservation?: "smart" | "always" | "never"
    simulateEnvironment?: EnvironmentName
  }
  billing?: {
    caps?: {
      monthly?: Partial<Record<MeterKey, number>>
      action?: "hard-stop" | "soft-notify"
      perEnvironment?: Partial<
        Record<EnvironmentName, { monthly?: Partial<Record<MeterKey, number>> }>
      >
    }
  }
  versioning?: {
    retireAfter?: Duration
    onSunset?: "cancel" | "migrate" | "extend"
    sunsetNoticePeriod?: Duration
  }
}

export interface VoyantWorkflowConfig {
  projectId: string
  entry: {
    worker: string
    container?: string
  }
  environments: Record<EnvironmentName, EnvironmentConfig>
  bindings: Record<string, BindingDeclaration>
  workflows?: WorkflowsConfig
}

/** Define runtime settings for a standalone workflow deployment. */
export function defineWorkflowConfig(config: VoyantWorkflowConfig): VoyantWorkflowConfig {
  return config
}
