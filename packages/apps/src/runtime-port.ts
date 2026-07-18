import { definePort } from "@voyant-travel/core/project"

export interface AppsManagedAuthRuntime {
  /** Stable audience shared by authorization, installations, and session tokens. */
  runtimeAudience: string
  /** Host-owned HMAC material for short-lived extension session tokens. */
  sessionTokenSigningSecret: string
  sessionTokenTtlSeconds?: number
}

export const appsManagedAuthRuntimePort = definePort<AppsManagedAuthRuntime>({
  id: "apps.managed-auth",
  test(runtime) {
    if (!runtime || typeof runtime !== "object") {
      throw new TypeError("apps.managed-auth must be an object.")
    }
    if (!runtime.runtimeAudience?.trim()) {
      throw new TypeError("apps.managed-auth runtimeAudience must be a non-empty string.")
    }
    if (
      typeof runtime.sessionTokenSigningSecret !== "string" ||
      runtime.sessionTokenSigningSecret.length < 32
    ) {
      throw new TypeError(
        "apps.managed-auth sessionTokenSigningSecret must contain at least 32 characters.",
      )
    }
    if (
      runtime.sessionTokenTtlSeconds !== undefined &&
      (!Number.isInteger(runtime.sessionTokenTtlSeconds) ||
        runtime.sessionTokenTtlSeconds <= 0 ||
        runtime.sessionTokenTtlSeconds > 300)
    ) {
      throw new TypeError(
        "apps.managed-auth sessionTokenTtlSeconds must be an integer from 1 through 300 when provided.",
      )
    }
  },
})
