/**
 * Storefront origin + policy normalization (provider-neutral, pure).
 *
 * Operators declare which browser origins may use a storefront's keys. There is
 * no ownership proof — declaration by the authenticated operator IS the
 * authorization, so a leaked publishable key is still bound to these origins by
 * CORS and Better Auth trusted origins.
 */
import type {
  StorefrontCustomerAccountPolicy,
  StorefrontCustomerAuthMethods,
  StorefrontCustomerAuthSocialProvider,
} from "@voyant-travel/db/schema/iam"

export const STOREFRONT_SOCIAL_PROVIDERS = ["google", "facebook", "apple"] as const

export class StorefrontInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StorefrontInputError"
  }
}

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])
const WILDCARD_PREFIX = "https://*."

/**
 * Normalize a set of operator-declared allowed origins. Each entry is either an
 * exact origin or a single-label `https://*.host` wildcard. HTTP is permitted
 * only for localhost (so a storefront can run against a sandbox from a
 * developer's machine); every other host must use HTTPS. Duplicates are removed
 * and the result is sorted for a stable persisted value.
 */
export function normalizeStorefrontAllowedOrigins(origins: readonly string[]): string[] {
  const normalized = origins.map((candidate) => {
    const trimmed = candidate.trim()
    if (!trimmed) {
      throw new StorefrontInputError("Storefront allowed origins cannot be empty.")
    }

    // Wildcard form: https://*.example.com (exactly one leading label).
    if (trimmed.startsWith(WILDCARD_PREFIX)) {
      const host = trimmed.slice(WILDCARD_PREFIX.length)
      if (!host || host.includes("*") || host.includes("/") || host.includes(":")) {
        throw new StorefrontInputError(`Invalid storefront wildcard origin: ${candidate}`)
      }
      return trimmed.replace(/\/$/, "")
    }

    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      throw new StorefrontInputError(`Invalid storefront allowed origin: ${candidate}`)
    }
    const isLocalhost = LOCALHOST_HOSTNAMES.has(url.hostname)
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
      throw new StorefrontInputError(
        "Storefront allowed origins must use HTTPS (HTTP is permitted only for localhost).",
      )
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new StorefrontInputError(
        "Storefront allowed origins cannot contain credentials, query, or hash.",
      )
    }
    if (url.pathname !== "/" || trimmed.replace(/\/$/, "") !== url.origin) {
      throw new StorefrontInputError(
        "Storefront allowed entries must be origins, not URLs with paths.",
      )
    }
    return url.origin
  })
  return [...new Set(normalized)].sort()
}

/**
 * Whether a request origin is authorized by a storefront's declared origins.
 * Exact origins match verbatim; a `https://*.host` wildcard matches exactly one
 * additional leading DNS label (`https://app.host`, not `https://a.b.host` and
 * not the bare `https://host`).
 */
export function isStorefrontOriginAllowed(
  origin: string,
  allowedOrigins: readonly string[],
): boolean {
  let candidate: URL
  try {
    candidate = new URL(origin)
  } catch {
    return false
  }
  if (candidate.origin !== origin) return false

  for (const entry of allowedOrigins) {
    if (entry.startsWith(WILDCARD_PREFIX)) {
      if (candidate.protocol !== "https:") continue
      const suffix = entry.slice(WILDCARD_PREFIX.length)
      const host = candidate.hostname
      if (!host.endsWith(`.${suffix}`)) continue
      const label = host.slice(0, host.length - suffix.length - 1)
      if (label.length > 0 && !label.includes(".")) return true
      continue
    }
    if (entry === candidate.origin) return true
  }
  return false
}

/** Public storefront methods projection: coerces every flag to a strict boolean. */
export function normalizeStorefrontCustomerAuthMethods(
  methods: StorefrontCustomerAuthMethods,
): StorefrontCustomerAuthMethods {
  const normalized: StorefrontCustomerAuthMethods = {
    emailCode: methods.emailCode === true,
    emailPassword: methods.emailPassword === true,
    google: methods.google === true,
    facebook: methods.facebook === true,
    apple: methods.apple === true,
  }
  if (!Object.values(normalized).some(Boolean)) {
    throw new StorefrontInputError("Enable at least one customer authentication method.")
  }
  return normalized
}

/** Social providers whose method flag is enabled on a storefront. */
export function enabledStorefrontSocialProviders(
  methods: StorefrontCustomerAuthMethods,
): StorefrontCustomerAuthSocialProvider[] {
  return STOREFRONT_SOCIAL_PROVIDERS.filter((provider) => methods[provider] === true)
}

/** Normalize and validate the public B2C/B2B buyer-account capability policy. */
export function normalizeStorefrontCustomerAccountPolicy(
  policy: StorefrontCustomerAccountPolicy,
): StorefrontCustomerAccountPolicy {
  const suppliedKinds = [...policy.allowedKinds]
  if (suppliedKinds.length === 0) {
    throw new StorefrontInputError("Allow at least one storefront buyer account kind.")
  }
  if (new Set(suppliedKinds).size !== suppliedKinds.length) {
    throw new StorefrontInputError("Storefront buyer account kinds must be unique.")
  }
  const allowedKinds = (["personal", "business"] as const).filter((kind) =>
    suppliedKinds.includes(kind),
  )
  if (allowedKinds.length !== suppliedKinds.length) {
    throw new StorefrontInputError("Storefront buyer account kind is unsupported.")
  }
  if (!allowedKinds.includes("personal") && policy.personalSignup !== "disabled") {
    throw new StorefrontInputError(
      "Personal signup must be disabled when personal buyer accounts are not allowed.",
    )
  }
  if (!allowedKinds.includes("business") && policy.businessOnboarding !== "disabled") {
    throw new StorefrontInputError(
      "Business onboarding must be disabled when business buyer accounts are not allowed.",
    )
  }
  if (allowedKinds.includes("business") && policy.businessOnboarding === "disabled") {
    throw new StorefrontInputError(
      "Business onboarding must be enabled when business buyer accounts are allowed.",
    )
  }
  return {
    allowedKinds,
    personalSignup: policy.personalSignup,
    businessOnboarding: policy.businessOnboarding,
  }
}
