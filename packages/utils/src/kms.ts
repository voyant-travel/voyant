/**
 * KMS provider interface and factory.
 *
 * Callers encrypt/decrypt opaque strings via a `KmsProvider` implementation.
 * The returned ciphertext is paired with the `{ enc: "..." }` envelope from
 * `@voyant-travel/types/schemas/kms/envelope` when persisted.
 */

import type { KmsEncryptedEnvelope } from "@voyant-travel/types/schemas/kms/envelope"
import type { z } from "zod"

import { type AwsKmsConfig, AwsKmsProvider } from "./kms-aws.js"
import { type EnvKmsConfig, EnvKmsProvider, generateEnvKmsKey } from "./kms-env.js"
import { type GcpKmsConfig, GcpKmsProvider } from "./kms-gcp.js"
import { generateLocalKmsKey, type LocalKmsConfig, LocalKmsProvider } from "./kms-local.js"
import { type VoyantCloudKmsConfig, VoyantCloudKmsProvider } from "./kms-voyant-cloud.js"

export type KmsKeyType = "people" | "integrations"

export interface KeyRef {
  keyType: KmsKeyType
}

export interface KmsDataKey {
  dek: string
  wrappedDek: string
}

export interface KmsUnwrappedDataKey {
  dek: string
}

export interface KmsProvider {
  /**
   * Provider identifier. Known values are "gcp", "aws", "env", "local", and
   * "voyant-cloud"; custom providers may use any string (the `(string & {})`
   * pattern keeps autocomplete for the known values without forbidding others).
   */
  readonly name: "gcp" | "aws" | "env" | "local" | "voyant-cloud" | (string & {})
  encrypt(plaintext: string, key: KeyRef): Promise<string>
  decrypt(ciphertext: string, key: KeyRef): Promise<string>
  generateDataKey?(key: KeyRef): Promise<KmsDataKey>
  unwrap?(key: KeyRef, wrappedDek: string): Promise<KmsUnwrappedDataKey>
}

export type KmsConfig =
  | { provider: "gcp"; gcp: GcpKmsConfig }
  | { provider: "aws"; aws: AwsKmsConfig }
  | { provider: "env"; env: EnvKmsConfig }
  | { provider: "local"; local: LocalKmsConfig }
  | { provider: "voyant-cloud"; voyantCloud: VoyantCloudKmsConfig }
  | { provider: "custom"; custom: KmsProvider }

/**
 * Build a provider instance from a validated config object.
 *
 * Supply `{ provider: "custom", custom: <your KmsProvider> }` to plug in an
 * implementation that isn't built in (e.g. AWS KMS, HashiCorp Vault).
 */
export function createKmsProvider(config: KmsConfig): KmsProvider {
  if (config.provider === "gcp") {
    return new GcpKmsProvider(config.gcp)
  }
  if (config.provider === "aws") {
    return new AwsKmsProvider(config.aws)
  }
  if (config.provider === "env") {
    return new EnvKmsProvider(config.env)
  }
  if (config.provider === "local") {
    return new LocalKmsProvider(config.local)
  }
  if (config.provider === "voyant-cloud") {
    return new VoyantCloudKmsProvider(config.voyantCloud)
  }
  return config.custom
}

const VALID_PROVIDERS = ["gcp", "aws", "env", "local", "voyant-cloud"] as const

/**
 * Build a `KmsConfig` from an env-like object. Accepts CF Workers `c.env`,
 * Node `process.env`, or any plain object.
 *
 * Throws with a clear message if `KMS_PROVIDER` is unset/invalid or required
 * provider-specific vars are missing.
 */
export function kmsConfigFromEnv(env: Record<string, string | undefined>): KmsConfig {
  const provider = env.KMS_PROVIDER

  if (provider === "gcp") {
    const projectId = env.GCP_PROJECT_ID
    const serviceAccountEmail = env.GCP_SERVICE_ACCOUNT_EMAIL
    const privateKeyPem = env.GCP_PRIVATE_KEY
    const peopleKey = env.GCP_KMS_PEOPLE_KEY_NAME
    const integrationsKey = env.GCP_KMS_INTEGRATIONS_KEY_NAME
    const keyring = env.GCP_KMS_KEYRING
    const location = env.GCP_KMS_LOCATION

    const missing: string[] = []
    if (!projectId) missing.push("GCP_PROJECT_ID")
    if (!serviceAccountEmail) missing.push("GCP_SERVICE_ACCOUNT_EMAIL")
    if (!privateKeyPem) missing.push("GCP_PRIVATE_KEY")
    if (!peopleKey) missing.push("GCP_KMS_PEOPLE_KEY_NAME")
    if (!integrationsKey) missing.push("GCP_KMS_INTEGRATIONS_KEY_NAME")
    if (!keyring) missing.push("GCP_KMS_KEYRING")
    if (!location) missing.push("GCP_KMS_LOCATION")

    if (
      missing.length > 0 ||
      !projectId ||
      !serviceAccountEmail ||
      !privateKeyPem ||
      !peopleKey ||
      !integrationsKey ||
      !keyring ||
      !location
    ) {
      throw new Error(`KMS_PROVIDER=gcp is missing required env vars: ${missing.join(", ")}`)
    }

    // Single-region deployment. Multi-region consumers should implement their
    // own `KmsProvider` and pass it via `{ provider: "custom", custom: ... }`.
    return {
      provider: "gcp",
      gcp: {
        projectId,
        serviceAccountEmail,
        privateKeyPem,
        keyRing: keyring,
        location,
        cryptoKeyByType: {
          people: peopleKey,
          integrations: integrationsKey,
        },
      },
    }
  }

  if (provider === "aws") {
    const region = env.AWS_REGION
    const accessKeyId = env.AWS_ACCESS_KEY_ID
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY
    const peopleKeyId = env.AWS_KMS_PEOPLE_KEY_ID
    const integrationsKeyId = env.AWS_KMS_INTEGRATIONS_KEY_ID

    const missing: string[] = []
    if (!region) missing.push("AWS_REGION")
    if (!accessKeyId) missing.push("AWS_ACCESS_KEY_ID")
    if (!secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY")
    if (!peopleKeyId) missing.push("AWS_KMS_PEOPLE_KEY_ID")
    if (!integrationsKeyId) missing.push("AWS_KMS_INTEGRATIONS_KEY_ID")

    if (!region || !accessKeyId || !secretAccessKey || !peopleKeyId || !integrationsKeyId) {
      throw new Error(`KMS_PROVIDER=aws is missing required env vars: ${missing.join(", ")}`)
    }

    return {
      provider: "aws",
      aws: {
        region,
        accessKeyId,
        secretAccessKey,
        sessionToken: env.AWS_SESSION_TOKEN,
        endpoint: env.AWS_KMS_ENDPOINT,
        keyIdByType: {
          people: peopleKeyId,
          integrations: integrationsKeyId,
        },
      },
    }
  }

  if (provider === "env") {
    const key = env.KMS_ENV_KEY
    if (!key) {
      throw new Error(
        "KMS_PROVIDER=env requires KMS_ENV_KEY (base64-encoded 32 bytes). Generate one with: openssl rand -base64 32",
      )
    }
    return { provider: "env", env: { key } }
  }

  if (provider === "local") {
    const key = env.KMS_LOCAL_KEY
    if (!key) {
      throw new Error(
        "KMS_PROVIDER=local requires KMS_LOCAL_KEY (base64-encoded 32 bytes). Generate one with: openssl rand -base64 32",
      )
    }
    return { provider: "local", local: { key } }
  }

  if (provider === "voyant-cloud") {
    const apiKey = env.VOYANT_CLOUD_API_KEY
    const vaultSlug = env.VOYANT_CLOUD_VAULT_SLUG
    const apiUrl = env.VOYANT_CLOUD_API_URL

    const missing: string[] = []
    if (!apiKey) missing.push("VOYANT_CLOUD_API_KEY")
    if (!vaultSlug) missing.push("VOYANT_CLOUD_VAULT_SLUG")

    if (!apiKey || !vaultSlug) {
      throw new Error(
        `KMS_PROVIDER=voyant-cloud is missing required env vars: ${missing.join(", ")}`,
      )
    }

    return {
      provider: "voyant-cloud",
      voyantCloud: {
        apiKey,
        vaultSlug,
        ...(apiUrl ? { apiUrl } : {}),
      },
    }
  }

  throw new Error(
    `KMS_PROVIDER must be one of: ${VALID_PROVIDERS.join(", ")} (got: ${provider ?? "unset"})`,
  )
}

export function createKmsProviderFromEnv(env: Record<string, string | undefined>) {
  return createKmsProvider(kmsConfigFromEnv(env))
}

export async function encryptJsonEnvelope<T>(
  provider: KmsProvider,
  key: KeyRef,
  value: T,
): Promise<KmsEncryptedEnvelope> {
  return {
    enc: await provider.encrypt(JSON.stringify(value), key),
  }
}

export async function decryptJsonEnvelope<T>(
  provider: KmsProvider,
  key: KeyRef,
  envelope: KmsEncryptedEnvelope,
  schema: z.ZodType<T>,
): Promise<T> {
  const plaintext = await provider.decrypt(envelope.enc, key)
  return schema.parse(JSON.parse(plaintext))
}

export async function encryptOptionalJsonEnvelope<T>(
  provider: KmsProvider,
  key: KeyRef,
  value: T | null | undefined,
): Promise<KmsEncryptedEnvelope | null> {
  if (value == null) {
    return null
  }
  return encryptJsonEnvelope(provider, key, value)
}

export async function decryptOptionalJsonEnvelope<T>(
  provider: KmsProvider,
  key: KeyRef,
  envelope: KmsEncryptedEnvelope | null | undefined,
  schema: z.ZodType<T>,
): Promise<T | null> {
  if (!envelope) {
    return null
  }
  return decryptJsonEnvelope(provider, key, envelope, schema)
}

export type { AwsKmsConfig, EnvKmsConfig, GcpKmsConfig, LocalKmsConfig, VoyantCloudKmsConfig }
export {
  AwsKmsProvider,
  EnvKmsProvider,
  GcpKmsProvider,
  generateEnvKmsKey,
  generateLocalKmsKey,
  LocalKmsProvider,
  VoyantCloudKmsProvider,
}
