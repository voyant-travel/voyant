import type { OperatorAuthNodeEnv } from "@voyant-travel/auth/node-runtime"
import type { VoyantNodeRuntimeEnv } from "@voyant-travel/framework/node-runtime"

export function requireVoyantAuthEnv(env: VoyantNodeRuntimeEnv): OperatorAuthNodeEnv {
  const betterAuthSecret = env.BETTER_AUTH_SECRET?.trim()
  const sessionClaimsSecret = env.SESSION_CLAIMS_SECRET?.trim()
  if (!betterAuthSecret || !sessionClaimsSecret) {
    throw new Error("Voyant Operator auth requires BETTER_AUTH_SECRET and SESSION_CLAIMS_SECRET.")
  }
  return {
    ...env,
    BETTER_AUTH_SECRET: betterAuthSecret,
    SESSION_CLAIMS_SECRET: sessionClaimsSecret,
  }
}
