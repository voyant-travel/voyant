import { definePort } from "@voyant-travel/core/project"
import type { HostVerifiedMarketplaceAcquisition } from "./marketplace-acquisition.js"

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

export interface ManagedMarketplaceAcquisitionResolver {
  /**
   * Resolve an opaque, single-purpose install intent through host authority.
   * The public runtime never accepts catalog coordinates, artifact URLs, or
   * publisher assertions from the browser.
   */
  resolveAcquisitionIntent(input: {
    intent: string
  }): Promise<HostVerifiedMarketplaceAcquisition | null>

  /**
   * Mint and deliver a short-lived, host-signed setup assertion. The browser
   * receives only the resulting one-time redirect and never chooses OAuth
   * coordinates or assertion claims.
   */
  createSetupHandoff(input: {
    installationId: string
    appId: string
    releaseId: string
  }): Promise<{ redirectUrl: string }>

  /** Deliver an idempotent host-signed lifecycle assertion to the publisher. */
  notifyInstallationLifecycle(input: {
    event: "uninstalled"
    installationId: string
    appId: string
    releaseId: string
  }): Promise<void>
}

export interface AppsManagedMarketplaceRuntime {
  acquisitionResolver: ManagedMarketplaceAcquisitionResolver
}

export const appsManagedMarketplaceRuntimePort = definePort<AppsManagedMarketplaceRuntime>({
  id: "apps.managed-marketplace",
  test(runtime) {
    if (!runtime || typeof runtime !== "object") {
      throw new TypeError("apps.managed-marketplace must be an object.")
    }
    if (typeof runtime.acquisitionResolver?.resolveAcquisitionIntent !== "function") {
      throw new TypeError(
        "apps.managed-marketplace acquisitionResolver.resolveAcquisitionIntent must be a function.",
      )
    }
    if (typeof runtime.acquisitionResolver.createSetupHandoff !== "function") {
      throw new TypeError(
        "apps.managed-marketplace acquisitionResolver.createSetupHandoff must be a function.",
      )
    }
    if (typeof runtime.acquisitionResolver.notifyInstallationLifecycle !== "function") {
      throw new TypeError(
        "apps.managed-marketplace acquisitionResolver.notifyInstallationLifecycle must be a function.",
      )
    }
  },
})
