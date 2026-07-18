import type { OperatorAuthNodeEnv } from "@voyant-travel/auth/node-runtime"
import type { VoyantNodeRuntimeEnv } from "@voyant-travel/framework/node-runtime"

export function requireVoyantAuthEnv(env: VoyantNodeRuntimeEnv): OperatorAuthNodeEnv {
  const adminAuthSecret = env.BETTER_AUTH_ADMIN_SECRET?.trim()
  const sessionClaimsSecret = env.SESSION_CLAIMS_SECRET?.trim()
  if (!adminAuthSecret || !sessionClaimsSecret) {
    throw new Error(
      "Voyant Operator auth requires BETTER_AUTH_ADMIN_SECRET and SESSION_CLAIMS_SECRET.",
    )
  }

  const normalizedEnv = { ...env } as VoyantNodeRuntimeEnv & Record<string, string | undefined>
  delete normalizedEnv.BETTER_AUTH_SECRET

  return {
    ...normalizedEnv,
    BETTER_AUTH_ADMIN_SECRET: adminAuthSecret,
    ...(env.BETTER_AUTH_CUSTOMER_SECRET
      ? { BETTER_AUTH_CUSTOMER_SECRET: env.BETTER_AUTH_CUSTOMER_SECRET.trim() }
      : {}),
    SESSION_CLAIMS_SECRET: sessionClaimsSecret,
  }
}
