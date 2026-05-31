import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  createKmsProvider,
  createKmsProviderFromEnv,
  decryptJsonEnvelope,
  decryptOptionalJsonEnvelope,
  EnvKmsProvider,
  encryptJsonEnvelope,
  encryptOptionalJsonEnvelope,
  generateEnvKmsKey,
  generateLocalKmsKey,
  type KeyRef,
  type KmsProvider,
  kmsConfigFromEnv,
  LocalKmsProvider,
  VoyantCloudKmsProvider,
} from "../src/kms.js"

const TEST_KEY_REF: KeyRef = { keyType: "people" }

function makeLocalProvider() {
  return createKmsProvider({
    provider: "local",
    local: { key: generateLocalKmsKey() },
  })
}

function makeEnvProvider() {
  return createKmsProvider({
    provider: "env",
    env: { key: generateEnvKmsKey() },
  })
}

describe("LocalKmsProvider", () => {
  it("round-trips encrypt/decrypt and returns original plaintext", async () => {
    const provider = makeLocalProvider()
    const plaintext = "hello, world — this is secret 🎉"

    const ciphertext = await provider.encrypt(plaintext, TEST_KEY_REF)
    const decrypted = await provider.decrypt(ciphertext, TEST_KEY_REF)

    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertexts for the same plaintext (IV randomness)", async () => {
    const provider = makeLocalProvider()
    const plaintext = "repeat me"

    const a = await provider.encrypt(plaintext, TEST_KEY_REF)
    const b = await provider.encrypt(plaintext, TEST_KEY_REF)

    expect(a).not.toBe(b)
    expect(await provider.decrypt(a, TEST_KEY_REF)).toBe(plaintext)
    expect(await provider.decrypt(b, TEST_KEY_REF)).toBe(plaintext)
  })

  it("includes the local:v1: prefix in ciphertext", async () => {
    const provider = makeLocalProvider()
    const ciphertext = await provider.encrypt("data", TEST_KEY_REF)
    expect(ciphertext.startsWith("local:v1:")).toBe(true)
  })

  it("rejects ciphertext that is missing the prefix", async () => {
    const provider = makeLocalProvider()
    await expect(provider.decrypt("nope:just-some-base64==", TEST_KEY_REF)).rejects.toThrow(
      /missing "local:v1:" prefix/,
    )
  })

  it("rejects ciphertext with a wrong prefix", async () => {
    const provider = makeLocalProvider()
    await expect(provider.decrypt("gcp:v1:AAAAAA==", TEST_KEY_REF)).rejects.toThrow(
      /missing "local:v1:" prefix/,
    )
  })

  it("throws a clear error if the master key is the wrong size", async () => {
    const provider = new LocalKmsProvider({ key: "c2hvcnQ=" }) // "short" → 5 bytes
    await expect(provider.encrypt("x", TEST_KEY_REF)).rejects.toThrow(/32 bytes/)
  })
})

describe("EnvKmsProvider", () => {
  it("round-trips encrypt/decrypt and returns original plaintext", async () => {
    const provider = makeEnvProvider()
    const plaintext = "hello from env kms"

    const ciphertext = await provider.encrypt(plaintext, TEST_KEY_REF)
    const decrypted = await provider.decrypt(ciphertext, TEST_KEY_REF)

    expect(decrypted).toBe(plaintext)
  })

  it("includes the env:v1: prefix in ciphertext", async () => {
    const provider = makeEnvProvider()
    const ciphertext = await provider.encrypt("data", TEST_KEY_REF)
    expect(ciphertext.startsWith("env:v1:")).toBe(true)
  })

  it("throws a clear error if the master key is the wrong size", async () => {
    const provider = new EnvKmsProvider({ key: "c2hvcnQ=" })
    await expect(provider.encrypt("x", TEST_KEY_REF)).rejects.toThrow(/32 bytes/)
  })
})

describe("generateLocalKmsKey", () => {
  it("returns a base64-encoded 32-byte key usable by LocalKmsProvider", async () => {
    const key = generateLocalKmsKey()
    const decoded = atob(key)
    expect(decoded.length).toBe(32)

    const provider = new LocalKmsProvider({ key })
    const ct = await provider.encrypt("ok", TEST_KEY_REF)
    expect(await provider.decrypt(ct, TEST_KEY_REF)).toBe("ok")
  })

  it("returns a different key each call", () => {
    const a = generateLocalKmsKey()
    const b = generateLocalKmsKey()
    expect(a).not.toBe(b)
  })
})

describe("kmsConfigFromEnv", () => {
  it("returns env config when KMS_PROVIDER=env and KMS_ENV_KEY is set", () => {
    const key = generateEnvKmsKey()
    const config = kmsConfigFromEnv({ KMS_PROVIDER: "env", KMS_ENV_KEY: key })
    expect(config).toEqual({ provider: "env", env: { key } })
  })

  it("throws when KMS_PROVIDER=env but KMS_ENV_KEY is missing", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "env" })).toThrow(/KMS_ENV_KEY/)
  })

  it("returns local config when KMS_PROVIDER=local and KMS_LOCAL_KEY is set", () => {
    const key = generateLocalKmsKey()
    const config = kmsConfigFromEnv({ KMS_PROVIDER: "local", KMS_LOCAL_KEY: key })
    expect(config).toEqual({ provider: "local", local: { key } })
  })

  it("throws when KMS_PROVIDER=local but KMS_LOCAL_KEY is missing", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "local" })).toThrow(/KMS_LOCAL_KEY/)
  })

  it("returns gcp config with all required vars set", () => {
    const config = kmsConfigFromEnv({
      KMS_PROVIDER: "gcp",
      GCP_PROJECT_ID: "proj",
      GCP_SERVICE_ACCOUNT_EMAIL: "sa@proj.iam.gserviceaccount.com",
      GCP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      GCP_KMS_PEOPLE_KEY_NAME: "people",
      GCP_KMS_INTEGRATIONS_KEY_NAME: "integrations",
      GCP_KMS_KEYRING: "secrets-eu",
      GCP_KMS_LOCATION: "europe",
    })
    expect(config.provider).toBe("gcp")
    if (config.provider !== "gcp") throw new Error("unreachable")
    expect(config.gcp.projectId).toBe("proj")
    expect(config.gcp.keyRing).toBe("secrets-eu")
    expect(config.gcp.location).toBe("europe")
    expect(config.gcp.cryptoKeyByType).toEqual({ people: "people", integrations: "integrations" })
  })

  it("returns aws config with all required vars set", () => {
    const config = kmsConfigFromEnv({
      KMS_PROVIDER: "aws",
      AWS_REGION: "eu-central-1",
      AWS_ACCESS_KEY_ID: "AKIA_TEST",
      AWS_SECRET_ACCESS_KEY: "secret",
      AWS_KMS_PEOPLE_KEY_ID: "people-key",
      AWS_KMS_INTEGRATIONS_KEY_ID: "integrations-key",
      AWS_SESSION_TOKEN: "session-token",
      AWS_KMS_ENDPOINT: "https://kms.eu-central-1.amazonaws.com/",
    })
    expect(config.provider).toBe("aws")
    if (config.provider !== "aws") throw new Error("unreachable")
    expect(config.aws.region).toBe("eu-central-1")
    expect(config.aws.keyIdByType).toEqual({
      people: "people-key",
      integrations: "integrations-key",
    })
    expect(config.aws.sessionToken).toBe("session-token")
  })

  it("returns voyant-cloud config with all required vars set", () => {
    const config = kmsConfigFromEnv({
      KMS_PROVIDER: "voyant-cloud",
      VOYANT_API_KEY: "vc_test",
      VOYANT_CLOUD_VAULT_SLUG: "main-vault",
      VOYANT_CLOUD_API_URL: "https://cloud.test/",
    })

    expect(config).toEqual({
      provider: "voyant-cloud",
      voyantCloud: {
        apiKey: "vc_test",
        vaultSlug: "main-vault",
        apiUrl: "https://cloud.test/",
      },
    })
  })

  it("accepts the legacy Voyant Cloud API key env var", () => {
    const config = kmsConfigFromEnv({
      KMS_PROVIDER: "voyant-cloud",
      VOYANT_CLOUD_API_KEY: "vc_legacy",
      VOYANT_CLOUD_VAULT_SLUG: "main-vault",
    })

    expect(config).toMatchObject({
      provider: "voyant-cloud",
      voyantCloud: {
        apiKey: "vc_legacy",
        vaultSlug: "main-vault",
      },
    })
  })

  it("throws listing missing AWS vars when KMS_PROVIDER=aws but vars are absent", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "aws" })).toThrow(
      /AWS_REGION.*AWS_ACCESS_KEY_ID.*AWS_SECRET_ACCESS_KEY.*AWS_KMS_PEOPLE_KEY_ID.*AWS_KMS_INTEGRATIONS_KEY_ID/,
    )
  })

  it("throws listing missing GCP vars when KMS_PROVIDER=gcp but vars are absent", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "gcp" })).toThrow(
      /GCP_PROJECT_ID.*GCP_SERVICE_ACCOUNT_EMAIL.*GCP_PRIVATE_KEY/,
    )
  })

  it("throws listing missing Voyant Cloud vars when KMS_PROVIDER=voyant-cloud but vars are absent", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "voyant-cloud" })).toThrow(
      /VOYANT_API_KEY.*VOYANT_CLOUD_VAULT_SLUG/,
    )
  })

  it("throws when GCP_KMS_KEYRING is missing", () => {
    expect(() =>
      kmsConfigFromEnv({
        KMS_PROVIDER: "gcp",
        GCP_PROJECT_ID: "proj",
        GCP_SERVICE_ACCOUNT_EMAIL: "sa@proj.iam.gserviceaccount.com",
        GCP_PRIVATE_KEY: "pk",
        GCP_KMS_PEOPLE_KEY_NAME: "people",
        GCP_KMS_INTEGRATIONS_KEY_NAME: "integrations",
        GCP_KMS_LOCATION: "europe",
      }),
    ).toThrow(/GCP_KMS_KEYRING/)
  })

  it("throws when GCP_KMS_LOCATION is missing", () => {
    expect(() =>
      kmsConfigFromEnv({
        KMS_PROVIDER: "gcp",
        GCP_PROJECT_ID: "proj",
        GCP_SERVICE_ACCOUNT_EMAIL: "sa@proj.iam.gserviceaccount.com",
        GCP_PRIVATE_KEY: "pk",
        GCP_KMS_PEOPLE_KEY_NAME: "people",
        GCP_KMS_INTEGRATIONS_KEY_NAME: "integrations",
        GCP_KMS_KEYRING: "secrets-eu",
      }),
    ).toThrow(/GCP_KMS_LOCATION/)
  })

  it("throws with valid provider values when KMS_PROVIDER is unset", () => {
    expect(() => kmsConfigFromEnv({})).toThrow(
      /KMS_PROVIDER must be one of: gcp, aws, env, local, voyant-cloud/,
    )
  })

  it("throws when KMS_PROVIDER has an unknown value", () => {
    expect(() => kmsConfigFromEnv({ KMS_PROVIDER: "vault" })).toThrow(
      /KMS_PROVIDER must be one of: gcp, aws, env, local, voyant-cloud/,
    )
  })
})

describe("createKmsProviderFromEnv", () => {
  it("builds an env provider from env-like input", async () => {
    const key = generateEnvKmsKey()
    const provider = createKmsProviderFromEnv({
      KMS_PROVIDER: "env",
      KMS_ENV_KEY: key,
    })

    const ciphertext = await provider.encrypt("hello", TEST_KEY_REF)
    expect(await provider.decrypt(ciphertext, TEST_KEY_REF)).toBe("hello")
  })

  it("builds a Voyant Cloud provider from env-like input", () => {
    const provider = createKmsProviderFromEnv({
      KMS_PROVIDER: "voyant-cloud",
      VOYANT_API_KEY: "vc_test",
      VOYANT_CLOUD_VAULT_SLUG: "main-vault",
    })

    expect(provider).toBeInstanceOf(VoyantCloudKmsProvider)
    expect(provider.name).toBe("voyant-cloud")
  })
})

describe("VoyantCloudKmsProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("calls per-call and envelope Vault endpoints", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = []
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} })
      const pathname = new URL(String(url)).pathname

      if (pathname.endsWith("/encrypt")) {
        return Response.json({ ciphertext: "ciphertext-1" })
      }
      if (pathname.endsWith("/decrypt")) {
        return Response.json({ data: { plaintext: "plain-1" } })
      }
      if (pathname.endsWith("/generateDataKey")) {
        return Response.json({ dek: "dek-1", wrappedDek: "wrapped-1" })
      }
      if (pathname.endsWith("/unwrap")) {
        return Response.json({ dek: "dek-1" })
      }
      return new Response("not found", { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const provider = new VoyantCloudKmsProvider({
      apiKey: "vc_test",
      vaultSlug: "main vault",
      apiUrl: "https://cloud.test/",
    })

    await expect(provider.encrypt("plain-1", TEST_KEY_REF)).resolves.toBe("ciphertext-1")
    await expect(provider.decrypt("ciphertext-1", TEST_KEY_REF)).resolves.toBe("plain-1")
    await expect(provider.generateDataKey?.(TEST_KEY_REF)).resolves.toEqual({
      dek: "dek-1",
      wrappedDek: "wrapped-1",
    })
    await expect(provider.unwrap?.(TEST_KEY_REF, "wrapped-1")).resolves.toEqual({ dek: "dek-1" })

    expect(requests.map((request) => request.url)).toEqual([
      "https://cloud.test/vault/v1/main%20vault/encrypt",
      "https://cloud.test/vault/v1/main%20vault/decrypt",
      "https://cloud.test/vault/v1/main%20vault/generateDataKey",
      "https://cloud.test/vault/v1/main%20vault/unwrap",
    ])
    expect(requests.map((request) => request.init.method)).toEqual(["POST", "POST", "POST", "POST"])
    expect(requests[0]?.init.headers).toMatchObject({
      Authorization: "Bearer vc_test",
      "Content-Type": "application/json",
    })
    expect(requests[0]?.init.body).toBe(JSON.stringify({ plaintext: "plain-1" }))
    expect(requests[1]?.init.body).toBe(JSON.stringify({ ciphertext: "ciphertext-1" }))
    expect(requests[2]?.init.body).toBeUndefined()
    expect(requests[3]?.init.body).toBe(JSON.stringify({ wrappedDek: "wrapped-1" }))
  })

  it("throws response details when a Vault endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no access", { status: 403 })),
    )

    const provider = new VoyantCloudKmsProvider({
      apiKey: "vc_test",
      vaultSlug: "main-vault",
    })

    await expect(provider.encrypt("plain", TEST_KEY_REF)).rejects.toThrow(
      /Voyant Cloud KMS encrypt failed \(403\): no access/,
    )
  })
})

describe("envelope helpers", () => {
  it("encrypts and decrypts structured JSON envelopes", async () => {
    const provider = makeEnvProvider()
    const value = { passportNumber: "ABC123", dateOfBirth: "1990-01-01" }

    const envelope = await encryptJsonEnvelope(provider, TEST_KEY_REF, value)
    const decrypted = await decryptJsonEnvelope(
      provider,
      TEST_KEY_REF,
      envelope,
      z.object({
        passportNumber: z.string(),
        dateOfBirth: z.string(),
      }),
    )

    expect(decrypted).toEqual(value)
  })

  it("returns null for optional envelope helpers when value is absent", async () => {
    const provider = makeEnvProvider()
    const encrypted = await encryptOptionalJsonEnvelope(provider, TEST_KEY_REF, null)
    expect(encrypted).toBeNull()

    const decrypted = await decryptOptionalJsonEnvelope(provider, TEST_KEY_REF, null, z.string())
    expect(decrypted).toBeNull()
  })
})

describe("createKmsProvider with custom provider", () => {
  it("returns the custom provider as-is", async () => {
    const calls: Array<"encrypt" | "decrypt"> = []
    const custom: KmsProvider = {
      name: "my-vault",
      async encrypt(plaintext) {
        calls.push("encrypt")
        return `vault:${plaintext}`
      },
      async decrypt(ciphertext) {
        calls.push("decrypt")
        return ciphertext.replace(/^vault:/, "")
      },
    }

    const provider = createKmsProvider({ provider: "custom", custom })
    expect(provider).toBe(custom)
    expect(provider.name).toBe("my-vault")

    const ct = await provider.encrypt("hello", { keyType: "people" })
    expect(ct).toBe("vault:hello")
    const pt = await provider.decrypt(ct, { keyType: "people" })
    expect(pt).toBe("hello")
    expect(calls).toEqual(["encrypt", "decrypt"])
  })
})
