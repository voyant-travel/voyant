/**
 * Storefront OAuth provider credential bundles + the encryption seam.
 *
 * Plaintext provider secrets never touch persisted config: the local adapter
 * encrypts a validated bundle through a `StorefrontCredentialCipher` (backed by
 * the deployment's KMS) into the opaque `{ enc }` envelope stored on
 * `storefrontCustomerAuthCredentials`, and decrypts it only when resolving a
 * customer-auth context at request time.
 */
import type {
  KmsEnvelope,
  StorefrontCustomerAuthSocialProvider,
} from "@voyant-travel/db/schema/iam"
import { createKmsProviderFromEnv, type KeyRef } from "@voyant-travel/utils/kms"

import { StorefrontInputError } from "./storefront-origins.js"

export type StorefrontCredentialBundle = {
  provider: StorefrontCustomerAuthSocialProvider
  clientId: string
  clientSecret: string
}

// Every provider is stored as `{ clientId, clientSecret }`, matching the shape
// `defaultCustomerAuthContext` feeds Better Auth's `socialProviders`. For Apple
// the `clientSecret` is the operator's pre-generated Sign-in-with-Apple JWT.
const REQUIRED_FIELDS: Record<StorefrontCustomerAuthSocialProvider, readonly string[]> = {
  google: ["clientId", "clientSecret"],
  facebook: ["clientId", "clientSecret"],
  apple: ["clientId", "clientSecret"],
}

const MAX_CREDENTIAL_FIELD_LENGTH = 16_384

function requireCredentialField(credentials: Record<string, unknown>, key: string): void {
  const value = credentials[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new StorefrontInputError(`Customer auth credential field ${key} is required.`)
  }
  if (value.length > MAX_CREDENTIAL_FIELD_LENGTH) {
    throw new StorefrontInputError(`Customer auth credential field ${key} is too large.`)
  }
}

/** Validate a provider-specific secret bundle before encryption. */
export function validateStorefrontCredentialBundle(
  provider: StorefrontCustomerAuthSocialProvider,
  credentials: Record<string, unknown>,
): StorefrontCredentialBundle {
  const required = REQUIRED_FIELDS[provider]
  for (const key of required) requireCredentialField(credentials, key)
  const allowed = new Set(["provider", ...required])
  const unexpected = Object.keys(credentials).filter((key) => !allowed.has(key))
  if (unexpected.length > 0) {
    throw new StorefrontInputError(
      `Unexpected ${provider} customer auth credential field(s): ${unexpected.join(", ")}.`,
    )
  }
  return { provider, ...credentials } as StorefrontCredentialBundle
}

/**
 * Encryption seam for storefront provider secrets. The self-host runtime binds
 * this to its KMS; tests bind a deterministic in-memory cipher.
 */
export interface StorefrontCredentialCipher {
  encrypt(plaintext: string): Promise<KmsEnvelope>
  decrypt(envelope: KmsEnvelope): Promise<string>
}

// Storefront OAuth secrets are third-party integration credentials.
const STOREFRONT_CREDENTIAL_KEY: KeyRef = { keyType: "integrations" }

/**
 * Default cipher backed by the deployment's configured KMS (GCP/AWS/env/local),
 * selected from environment exactly like every other framework secret. The
 * ciphertext is wrapped in the opaque `{ enc }` envelope stored on the row.
 */
export function createKmsStorefrontCredentialCipher(
  env: Record<string, string | undefined>,
): StorefrontCredentialCipher {
  const provider = createKmsProviderFromEnv(env)
  return {
    async encrypt(plaintext) {
      return { enc: await provider.encrypt(plaintext, STOREFRONT_CREDENTIAL_KEY) }
    },
    async decrypt(envelope) {
      if (!envelope) {
        throw new StorefrontInputError("Stored storefront credential is empty.")
      }
      return provider.decrypt(envelope.enc, STOREFRONT_CREDENTIAL_KEY)
    },
  }
}
