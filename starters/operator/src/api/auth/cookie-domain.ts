import type { CreateBetterAuthOptions } from "@voyant-travel/auth/server"

type BetterAuthAdvancedOptions = NonNullable<CreateBetterAuthOptions["advanced"]>

export function buildBetterAuthCookieAdvancedOptions(
  env: Pick<CloudflareBindings, "AUTH_COOKIE_DOMAIN">,
):
  | Pick<BetterAuthAdvancedOptions, "crossSubDomainCookies" | "defaultCookieAttributes">
  | undefined {
  const domain = env.AUTH_COOKIE_DOMAIN?.trim()
  if (!domain) return undefined

  return {
    crossSubDomainCookies: {
      enabled: true,
      domain,
    },
    defaultCookieAttributes: {
      domain,
    },
  }
}
