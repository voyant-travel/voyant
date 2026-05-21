/**
 * GCP Cloud KMS provider.
 *
 * Edge-compatible: uses Web Crypto API for JWT signing and fetch() for GCP API
 * calls. No Node.js dependencies — works in Cloudflare Workers.
 */

import type { KeyRef, KmsDataKey, KmsKeyType, KmsProvider, KmsUnwrappedDataKey } from "./kms.js"

export interface GcpKmsConfig {
  projectId: string
  serviceAccountEmail: string
  privateKeyPem: string
  /** GCP keyring name. Keyrings are location-bound — one provider, one keyring. */
  keyRing: string
  /** GCP location the keyring lives in, e.g. "europe", "us", "global", "europe-west1". */
  location: string
  cryptoKeyByType: Record<KmsKeyType, string>
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = ""
  for (const byte of data) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str))
}

function generateBase64DataKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)

  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/**
 * Import a PEM-encoded RSA private key for signing JWTs.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/[\n\r\s]/g, "")

  const binaryString = atob(pemBody)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

export class GcpKmsProvider implements KmsProvider {
  readonly name = "gcp" as const

  private cachedToken: { token: string; expiresAt: number } | null = null

  constructor(private readonly config: GcpKmsConfig) {}

  private getKeyName(key: KeyRef): string {
    const cryptoKey = this.config.cryptoKeyByType[key.keyType]
    return `projects/${this.config.projectId}/locations/${this.config.location}/keyRings/${this.config.keyRing}/cryptoKeys/${cryptoKey}`
  }

  /**
   * Creates a signed JWT assertion and exchanges it at Google's OAuth2
   * endpoint for a short-lived access token. Caches the token per instance.
   */
  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    if (this.cachedToken && this.cachedToken.expiresAt > now + 60) {
      return this.cachedToken.token
    }

    const header = base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const exp = now + 3600
    const payload = base64UrlEncodeString(
      JSON.stringify({
        iss: this.config.serviceAccountEmail,
        scope: "https://www.googleapis.com/auth/cloudkms",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp,
      }),
    )

    const signingInput = `${header}.${payload}`
    const key = await importPrivateKey(this.config.privateKeyPem)
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    )
    const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GCP token exchange failed (${res.status}): ${body}`)
    }

    const data = (await res.json()) as { access_token: string; expires_in: number }
    this.cachedToken = { token: data.access_token, expiresAt: now + data.expires_in }
    return data.access_token
  }

  async encrypt(plaintext: string, key: KeyRef): Promise<string> {
    const keyName = this.getKeyName(key)
    const accessToken = await this.getAccessToken()
    const encoded = btoa(plaintext)

    const res = await fetch(`https://cloudkms.googleapis.com/v1/${keyName}:encrypt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plaintext: encoded }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`KMS encrypt failed (${res.status}): ${body}`)
    }

    const data = (await res.json()) as { ciphertext: string }
    return data.ciphertext
  }

  async decrypt(ciphertext: string, key: KeyRef): Promise<string> {
    const keyName = this.getKeyName(key)
    const accessToken = await this.getAccessToken()

    const res = await fetch(`https://cloudkms.googleapis.com/v1/${keyName}:decrypt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ciphertext }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`KMS decrypt failed (${res.status}): ${body}`)
    }

    const data = (await res.json()) as { plaintext: string }
    return atob(data.plaintext)
  }

  async generateDataKey(key: KeyRef): Promise<KmsDataKey> {
    const dek = generateBase64DataKey()
    return {
      dek,
      wrappedDek: await this.encrypt(dek, key),
    }
  }

  async unwrap(key: KeyRef, wrappedDek: string): Promise<KmsUnwrappedDataKey> {
    return { dek: await this.decrypt(wrappedDek, key) }
  }
}
