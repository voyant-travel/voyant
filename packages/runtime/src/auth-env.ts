import type { OperatorAuthNodeEnv } from "@voyant-travel/auth/node-runtime"
import type { VoyantNodeRuntimeEnv } from "@voyant-travel/framework/node-runtime"

const VOYANT_CLOUD_ADMIN_AUTH_REQUIRED_ENV = [
  "VOYANT_CLOUD_DEPLOYMENT_ID",
  "VOYANT_CLOUD_ADMIN_AUTH_START_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL",
  "VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN",
] as const

export function requireVoyantAuthEnv(
  env: VoyantNodeRuntimeEnv,
  authMode: "local" | "voyant-cloud" = env.VOYANT_ADMIN_AUTH_MODE?.trim() === "voyant-cloud"
    ? "voyant-cloud"
    : "local",
  customerAuthMode: "better-auth" | "disabled" = env.VOYANT_CUSTOMER_AUTH_MODE?.trim() ===
  "disabled"
    ? "disabled"
    : "better-auth",
): VoyantNodeRuntimeEnv & OperatorAuthNodeEnv {
  for (const legacyName of ["BETTER_AUTH_SECRET", "SESSION_CLAIMS_SECRET"] as const) {
    if (typeof Reflect.get(env, legacyName) === "string") {
      throw new Error(`${legacyName} is not supported; configure realm-specific auth secrets.`)
    }
  }
  const adminAuthSecret = env.BETTER_AUTH_ADMIN_SECRET?.trim()
  const adminClaimsSecret = env.SESSION_CLAIMS_ADMIN_SECRET?.trim()
  const customerAuthDisabled = customerAuthMode === "disabled"
  const customerAuthSecret = env.BETTER_AUTH_CUSTOMER_SECRET?.trim()
  const customerClaimsSecret = env.SESSION_CLAIMS_CUSTOMER_SECRET?.trim()
  if (!adminAuthSecret || !adminClaimsSecret || adminClaimsSecret.length < 32) {
    throw new Error(
      "Voyant Operator admin auth requires BETTER_AUTH_ADMIN_SECRET and SESSION_CLAIMS_ADMIN_SECRET with at least 32 characters.",
    )
  }
  if (
    !customerAuthDisabled &&
    (!customerAuthSecret || !customerClaimsSecret || customerClaimsSecret.length < 32)
  ) {
    throw new Error(
      "Voyant Operator customer auth requires BETTER_AUTH_CUSTOMER_SECRET and SESSION_CLAIMS_CUSTOMER_SECRET with at least 32 characters unless VOYANT_CUSTOMER_AUTH_MODE=disabled.",
    )
  }
  if (!customerAuthDisabled && adminClaimsSecret === customerClaimsSecret) {
    throw new Error("Admin and customer session-claims secrets must be different.")
  }
  if (!customerAuthDisabled && adminAuthSecret === customerAuthSecret) {
    throw new Error("Admin and customer Better Auth secrets must be different.")
  }

  if (authMode === "voyant-cloud") {
    const missing = VOYANT_CLOUD_ADMIN_AUTH_REQUIRED_ENV.filter((name) => !env[name]?.trim())
    if (missing.length > 0) {
      throw new Error(`Voyant Cloud admin auth requires ${missing.join(", ")}.`)
    }
    for (const name of [
      "VOYANT_CLOUD_ADMIN_AUTH_START_URL",
      "VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL",
      "VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL",
      "VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL",
    ] as const) {
      requireHttpUrl(env[name]!, name)
    }
  }

  return {
    ...env,
    VOYANT_ADMIN_AUTH_MODE: authMode,
    VOYANT_CUSTOMER_AUTH_MODE: customerAuthMode,
    BETTER_AUTH_ADMIN_SECRET: adminAuthSecret,
    ...(customerAuthSecret ? { BETTER_AUTH_CUSTOMER_SECRET: customerAuthSecret } : {}),
    SESSION_CLAIMS_ADMIN_SECRET: adminClaimsSecret,
    ...(customerClaimsSecret ? { SESSION_CLAIMS_CUSTOMER_SECRET: customerClaimsSecret } : {}),
  }
}

function requireHttpUrl(value: string, name: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`)
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`)
  }
}
