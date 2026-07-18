import { definePort } from "@voyant-travel/core/project"

/** Persisted host contract for one managed app installation. */
export interface ManagedAppInstallationBinding {
  workloadEnvironmentId: string
  contractGeneration: number
}

export interface ManagedAppInstallationContractInput {
  appId: string
  releaseId: string
}

export interface ManagedAppInstallationContract {
  /** Per-app monotonic generation. Advancing it invalidates prior app credentials. */
  contractGeneration: number
}

export interface ManagedAppInstallationAuthority {
  /** Stable opaque workload-environment identity across runtime rollouts. */
  workloadEnvironmentId: string
  /** Resolve the current admitted contract for this specific app release. */
  resolveInstallationContract(
    input: ManagedAppInstallationContractInput,
  ): Promise<ManagedAppInstallationContract | null>
}

export interface AppsManagedAuthRuntime {
  /** Stable audience shared by authorization, installations, and session tokens. */
  runtimeAudience: string
  /** Provider-neutral managed installation authority supplied by the host. */
  installationAuthority: ManagedAppInstallationAuthority
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
    if (!runtime.installationAuthority?.workloadEnvironmentId?.trim()) {
      throw new TypeError(
        "apps.managed-auth installationAuthority.workloadEnvironmentId must be a non-empty string.",
      )
    }
    if (typeof runtime.installationAuthority.resolveInstallationContract !== "function") {
      throw new TypeError(
        "apps.managed-auth installationAuthority.resolveInstallationContract must be a function.",
      )
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
