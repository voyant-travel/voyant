import {
  createVoyantCloudClient,
  type VoyantCloudClient,
  type VoyantCloudClientOptions,
} from "@voyantjs/cloud-sdk"

/**
 * Bindings/env shape recognized by {@link getVoyantCloudClient}.
 *
 * `VOYANT_CLOUD_API_KEY` is required. `VOYANT_CLOUD_API_URL` defaults to the
 * SDK's built-in `https://api.voyantjs.com` when unset.
 */
export interface VoyantCloudEnv {
  VOYANT_CLOUD_API_KEY?: unknown
  VOYANT_CLOUD_API_URL?: unknown
  VOYANT_CLOUD_USER_AGENT?: unknown
}

export class VoyantCloudConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VoyantCloudConfigError"
  }
}

/**
 * Construct a {@link VoyantCloudClient} from a runtime bindings object
 * (Cloudflare Worker `env`, Node `process.env`, etc.). Throws
 * {@link VoyantCloudConfigError} when `VOYANT_CLOUD_API_KEY` is missing.
 */
export function getVoyantCloudClient(
  env: VoyantCloudEnv,
  overrides: Partial<VoyantCloudClientOptions> = {},
): VoyantCloudClient {
  const apiKey =
    typeof env.VOYANT_CLOUD_API_KEY === "string" && env.VOYANT_CLOUD_API_KEY.length > 0
      ? env.VOYANT_CLOUD_API_KEY
      : null

  if (!apiKey && !overrides.apiKey) {
    throw new VoyantCloudConfigError(
      "VOYANT_CLOUD_API_KEY is not set. Voyant Cloud is required for email, SMS, verification, and vault. Set the variable or override `apiKey` explicitly.",
    )
  }

  const baseUrl =
    typeof env.VOYANT_CLOUD_API_URL === "string" && env.VOYANT_CLOUD_API_URL.length > 0
      ? env.VOYANT_CLOUD_API_URL
      : undefined

  const userAgent =
    typeof env.VOYANT_CLOUD_USER_AGENT === "string" && env.VOYANT_CLOUD_USER_AGENT.length > 0
      ? env.VOYANT_CLOUD_USER_AGENT
      : undefined

  return createVoyantCloudClient({
    apiKey: apiKey ?? "",
    ...(baseUrl ? { baseUrl } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...overrides,
  })
}

export function tryGetVoyantCloudClient(
  env: VoyantCloudEnv,
  overrides: Partial<VoyantCloudClientOptions> = {},
): VoyantCloudClient | null {
  try {
    return getVoyantCloudClient(env, overrides)
  } catch (error) {
    if (error instanceof VoyantCloudConfigError) {
      return null
    }
    throw error
  }
}
