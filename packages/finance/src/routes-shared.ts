import type { ModuleContainer } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

export type Env = {
  Bindings: Partial<{
    VOYANT_CHECKOUT_CAPABILITY_SECRET: string
    CHECKOUT_CAPABILITY_SECRET: string
    VOYANT_CHECKOUT_CAPABILITY_TTL_SECONDS: string
    CHECKOUT_CAPABILITY_TTL_SECONDS: string
    SESSION_CLAIMS_SECRET: string
    BETTER_AUTH_SECRET: string
  }>
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    container?: ModuleContainer
  }
}

export function getRuntimeEnv(c: Context) {
  const processEnv =
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process?.env ?? {}

  return {
    ...processEnv,
    ...(c.env ?? {}),
  }
}

export function notFound<T extends Env>(c: Context<T>, error: string) {
  return c.json({ error }, 404)
}
