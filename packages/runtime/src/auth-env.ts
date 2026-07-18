import type { OperatorAuthNodeEnv } from "@voyant-travel/auth/node-runtime"
import type { VoyantNodeRuntimeEnv } from "@voyant-travel/framework/node-runtime"

export function requireVoyantAuthEnv(env: VoyantNodeRuntimeEnv): OperatorAuthNodeEnv {
  const adminAuthSecret = env.BETTER_AUTH_ADMIN_SECRET?.trim()
  const adminClaimsSecret = env.SESSION_CLAIMS_ADMIN_SECRET?.trim()
  const customerAuthDisabled = env.VOYANT_CUSTOMER_AUTH_MODE?.trim() === "disabled"
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

  const normalizedEnv = { ...env } as VoyantNodeRuntimeEnv & Record<string, string | undefined>
  delete normalizedEnv.BETTER_AUTH_SECRET
  delete normalizedEnv.SESSION_CLAIMS_SECRET

  return {
    ...normalizedEnv,
    BETTER_AUTH_ADMIN_SECRET: adminAuthSecret,
    ...(customerAuthSecret ? { BETTER_AUTH_CUSTOMER_SECRET: customerAuthSecret } : {}),
    SESSION_CLAIMS_ADMIN_SECRET: adminClaimsSecret,
    ...(customerClaimsSecret ? { SESSION_CLAIMS_CUSTOMER_SECRET: customerClaimsSecret } : {}),
  }
}
