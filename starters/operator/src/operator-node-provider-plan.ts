export type OperatorNodeObjectStorageProvider = "memory" | "r2" | "s3"
export type OperatorNodeKvProvider = "memory" | "postgres" | "redis"

export interface OperatorNodeProviderPlan {
  storage: OperatorNodeObjectStorageProvider
  cache: OperatorNodeKvProvider
  sharedState: OperatorNodeKvProvider
  rateLimit: OperatorNodeKvProvider
}

const KV_PROVIDER_ROLES = ["cache", "sharedState", "rateLimit"] as const

export function resolveOperatorNodeProviderPlan(
  providers: Readonly<Record<string, string>>,
): OperatorNodeProviderPlan {
  return {
    storage: objectStorageProvider(providers, "storage"),
    cache: kvProvider(providers, "cache"),
    sharedState: kvProvider(providers, "sharedState"),
    rateLimit: kvProvider(providers, "rateLimit"),
  }
}

export function validateOperatorNodeProviderPlanEnv(
  plan: OperatorNodeProviderPlan,
  env: Record<string, unknown>,
): string[] {
  const required = new Set<string>()
  if (plan.storage === "r2" || plan.storage === "s3") {
    required.add("R2_S3_ENDPOINT")
    required.add("R2_ACCESS_KEY_ID")
    required.add("R2_SECRET_ACCESS_KEY")
    required.add("R2_BUCKET_MEDIA")
    required.add("R2_BUCKET_DOCUMENTS")
  }

  for (const role of KV_PROVIDER_ROLES) {
    if (plan[role] === "redis") required.add("REDIS_URL")
    if (plan[role] === "postgres") required.add("DATABASE_URL")
  }

  return Array.from(required)
    .filter((name) => !present(env[name]))
    .map((name) => `env ${name} is required by the operator Node provider plan`)
}

function objectStorageProvider(
  providers: Readonly<Record<string, string>>,
  role: "storage",
): OperatorNodeObjectStorageProvider {
  const provider = requireProvider(providers, role)
  if (provider === "none" || provider === "memory") return "memory"
  if (provider === "r2" || provider === "s3") return provider
  throw new Error(
    `deployment graph providers.${role}=${provider} is not supported by the operator Node runtime`,
  )
}

function kvProvider(
  providers: Readonly<Record<string, string>>,
  role: (typeof KV_PROVIDER_ROLES)[number],
): OperatorNodeKvProvider {
  const provider = requireProvider(providers, role)
  if (provider === "none" || provider === "memory") return "memory"
  if (provider === "redis" || provider === "postgres") return provider
  throw new Error(
    `deployment graph providers.${role}=${provider} is not supported by the operator Node runtime`,
  )
}

function requireProvider(providers: Readonly<Record<string, string>>, role: string): string {
  const provider = providers[role]
  if (typeof provider === "string" && provider.length > 0) return provider
  throw new Error(`deployment graph providers.${role} must be a non-empty string`)
}

function present(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}
