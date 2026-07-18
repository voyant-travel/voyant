import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { type AppsManagedAuthRuntime, appsManagedAuthRuntimePort } from "./runtime-port.js"

export interface AppsRuntimeContributorHost {
  primitives: Pick<VoyantRuntimeHostPrimitives, "config">
  hasRuntimePort?(port: { id: string }): boolean
}

function readString(host: AppsRuntimeContributorHost, key: string): string | undefined {
  const value = host.primitives.config.read(undefined, key)
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Package-owned, provider-neutral managed-auth configuration. */
export function createAppsRuntimePortContribution(
  host: AppsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  if (host.hasRuntimePort?.(appsManagedAuthRuntimePort)) return {}

  const runtimeAudience = readString(host, "VOYANT_APP_RUNTIME_AUDIENCE")
  const sessionTokenSigningSecret = readString(host, "VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET")
  if (!runtimeAudience || !sessionTokenSigningSecret) return {}

  const ttlInput = readString(host, "VOYANT_APP_SESSION_TOKEN_TTL_SECONDS")
  const sessionTokenTtlSeconds = ttlInput === undefined ? undefined : Number(ttlInput)
  const runtime: AppsManagedAuthRuntime = {
    runtimeAudience,
    sessionTokenSigningSecret,
    ...(sessionTokenTtlSeconds === undefined ? {} : { sessionTokenTtlSeconds }),
  }
  appsManagedAuthRuntimePort.test(runtime)
  return { [appsManagedAuthRuntimePort.id]: runtime }
}
