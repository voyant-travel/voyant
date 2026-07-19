/**
 * Local storefront customer-auth resolver.
 *
 * Implements the `resolveCustomerAuthContext` seam of
 * {@link createOperatorAuthNodeRuntime} for a self-host runtime: instead of
 * fetching a merchant policy from Voyant Cloud, it resolves the storefront from
 * the presented access key via {@link storefrontRuntimePort}, enforces the
 * operator-declared origin allowlist, and projects the storefront's methods,
 * trusted origins, buyer-account policy, and decrypted provider secrets into a
 * `CustomerAuthRuntimeContext`.
 *
 * The BFF must forward the storefront origin explicitly (never derived from
 * Host/X-Forwarded-Host) plus the storefront key, exactly like the managed
 * broker.
 */
import type { CustomerBuyerAccountPolicy } from "./customer-buyer-accounts.js"
import type { CustomerAuthRuntimeContext } from "./node-runtime.js"
import type { CustomerAuthMethods } from "./server.js"
import {
  enabledStorefrontSocialProviders,
  isStorefrontOriginAllowed,
} from "./storefront-origins.js"
import type {
  StorefrontResolveContext,
  StorefrontRuntimeProvider,
} from "./storefront-runtime-port.js"

/** Default header the storefront BFF uses to declare its browser origin. */
export const STOREFRONT_ORIGIN_HEADER = "x-voyant-storefront-origin"
/** Default header carrying the storefront's publishable/secret access key. */
export const STOREFRONT_KEY_HEADER = "x-api-key"

export interface LocalStorefrontCustomerAuthResolverConfig<Env> {
  provider: StorefrontRuntimeProvider
  /**
   * Open the request-time resolve context (db + bindings) for this runtime.
   * The self-host host wires this to its database lifecycle; `dispose` is
   * always awaited, success or failure.
   */
  openResolveContext: (
    env: Env,
    request: Request,
  ) => Promise<{ context: StorefrontResolveContext; dispose?: () => Promise<void> }>
  originHeader?: string
  keyHeader?: string
}

export class StorefrontCustomerAuthResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StorefrontCustomerAuthResolutionError"
  }
}

function toSocialProviders(
  secrets: Partial<Record<"google" | "facebook" | "apple", Record<string, string>>>,
): CustomerAuthMethods["socialProviders"] {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {}
  for (const [provider, credential] of Object.entries(secrets)) {
    const clientId = credential?.clientId
    const clientSecret = credential?.clientSecret
    if (!clientId || !clientSecret) continue
    providers[provider] = { clientId, clientSecret }
  }
  return providers as CustomerAuthMethods["socialProviders"]
}

/**
 * Build the `resolveCustomerAuthContext` function a self-host runtime passes to
 * {@link createOperatorAuthNodeRuntime}. Keeps the existing seam intact — this
 * is simply the local (port-backed) option alongside the env default and the
 * managed cloud fetch.
 */
export function createLocalStorefrontCustomerAuthResolver<Env>(
  config: LocalStorefrontCustomerAuthResolverConfig<Env>,
): (env: Env, request: Request) => Promise<CustomerAuthRuntimeContext> {
  const originHeader = config.originHeader ?? STOREFRONT_ORIGIN_HEADER
  const keyHeader = config.keyHeader ?? STOREFRONT_KEY_HEADER

  return async (env, request) => {
    const origin = request.headers.get(originHeader)?.trim()
    if (!origin) {
      throw new StorefrontCustomerAuthResolutionError(
        `Local storefront customer auth requires ${originHeader} from the storefront BFF.`,
      )
    }
    const token = request.headers.get(keyHeader)?.trim()
    if (!token) {
      throw new StorefrontCustomerAuthResolutionError(
        `Local storefront customer auth requires a storefront key (${keyHeader}).`,
      )
    }

    const { context, dispose } = await config.openResolveContext(env, request)
    try {
      const resolved = await config.provider.resolveStorefrontByApiKey(context, token)
      if (!resolved) {
        throw new StorefrontCustomerAuthResolutionError(
          "The presented storefront key is unknown or revoked.",
        )
      }
      const { storefront } = resolved
      if (!isStorefrontOriginAllowed(origin, storefront.allowedOrigins)) {
        throw new StorefrontCustomerAuthResolutionError(
          "The request origin is not a declared allowed origin for this storefront.",
        )
      }

      const enabledProviders = enabledStorefrontSocialProviders(storefront.methods)
      const secrets = await config.provider.resolveProviderCredentials(
        context,
        storefront.id,
        enabledProviders,
      )

      const methods: CustomerAuthMethods = {
        emailCode: storefront.methods.emailCode,
        emailPassword: storefront.methods.emailPassword,
        socialProviders: toSocialProviders(secrets),
      }

      return {
        baseURL: origin,
        publicApiBaseURL: `${origin}/api`,
        invitationAcceptBaseURL: origin,
        trustedOrigins: [origin],
        methods,
        accountPolicy: storefront.accountPolicy as CustomerBuyerAccountPolicy,
      }
    } finally {
      await dispose?.()
    }
  }
}
