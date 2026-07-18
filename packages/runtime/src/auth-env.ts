import type { OperatorAuthNodeEnv } from "@voyant-travel/auth/node-runtime"
import type { VoyantNodeRuntimeEnv } from "@voyant-travel/framework/node-runtime"

export function requireVoyantAuthEnv(env: VoyantNodeRuntimeEnv): OperatorAuthNodeEnv {
  const betterAuthSecret = env.BETTER_AUTH_ADMIN_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim()
  const sessionClaimsSecret = env.SESSION_CLAIMS_SECRET?.trim()
  if (!betterAuthSecret || !sessionClaimsSecret) {
    throw new Error(
      "Voyant Operator auth requires BETTER_AUTH_ADMIN_SECRET (or legacy BETTER_AUTH_SECRET) and SESSION_CLAIMS_SECRET.",
    )
  }
  return {
    ...env,
    // Keep the normalized alias while older generated runtime code still reads
    // BETTER_AUTH_SECRET directly.
    BETTER_AUTH_SECRET: betterAuthSecret,
    BETTER_AUTH_ADMIN_SECRET: betterAuthSecret,
    ...(env.BETTER_AUTH_CUSTOMER_SECRET
      ? { BETTER_AUTH_CUSTOMER_SECRET: env.BETTER_AUTH_CUSTOMER_SECRET.trim() }
      : {}),
    SESSION_CLAIMS_SECRET: sessionClaimsSecret,
  }
}
