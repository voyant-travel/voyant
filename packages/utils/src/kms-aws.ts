/**
 * AWS KMS provider using SigV4-signed HTTPS requests.
 *
 * Works in Workers and modern Node without AWS SDK dependencies.
 */

import type { KeyRef, KmsDataKey, KmsKeyType, KmsProvider, KmsUnwrappedDataKey } from "./kms.js"

const PREFIX = "aws:v1:"
const SERVICE = "kms"
const JSON_CONTENT_TYPE = "application/x-amz-json-1.1"

export interface AwsKmsConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  endpoint?: string
  keyIdByType: Record<KmsKeyType, string>
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

async function hmacSha256Raw(key: Uint8Array, message: string): Promise<Uint8Array> {
  const raw = new Uint8Array(key.byteLength)
  raw.set(key)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    raw.buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message))
  return new Uint8Array(signature)
}

async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256Raw(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp)
  const kRegion = await hmacSha256Raw(kDate, region)
  const kService = await hmacSha256Raw(kRegion, SERVICE)
  return hmacSha256Raw(kService, "aws4_request")
}

function formatAmzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  }
}

function joinHeaders(headers: Array<[string, string]>) {
  return headers.map(([name, value]) => `${name}:${value.trim()}\n`).join("")
}

export class AwsKmsProvider implements KmsProvider {
  readonly name = "aws" as const

  constructor(private readonly config: AwsKmsConfig) {}

  private resolveKeyId(key: KeyRef) {
    return this.config.keyIdByType[key.keyType]
  }

  private resolveEndpoint() {
    return this.config.endpoint ?? `https://kms.${this.config.region}.amazonaws.com/`
  }

  private async signedHeaders(target: string, body: string) {
    const endpoint = new URL(this.resolveEndpoint())
    const now = new Date()
    const { amzDate, dateStamp } = formatAmzDate(now)
    const payloadHash = await sha256Hex(body)

    const headers: Array<[string, string]> = [
      ["content-type", JSON_CONTENT_TYPE],
      ["host", endpoint.host],
      ["x-amz-date", amzDate],
      ["x-amz-target", target],
    ]
    if (this.config.sessionToken) {
      headers.push(["x-amz-security-token", this.config.sessionToken])
    }

    headers.sort(([a], [b]) => a.localeCompare(b))
    const canonicalHeaders = joinHeaders(headers)
    const signedHeaders = headers.map(([name]) => name).join(";")
    const canonicalRequest = [
      "POST",
      endpoint.pathname || "/",
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n")

    const credentialScope = `${dateStamp}/${this.config.region}/${SERVICE}/aws4_request`
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join("\n")

    const signingKey = await deriveSigningKey(
      this.config.secretAccessKey,
      dateStamp,
      this.config.region,
    )
    const signature = toHex(await hmacSha256Raw(signingKey, stringToSign))
    const authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ")

    return {
      endpoint: endpoint.toString(),
      headers: Object.fromEntries([...headers, ["authorization", authorization]]),
    }
  }

  private async callAws<TResponse>(
    target: "TrentService.Encrypt" | "TrentService.Decrypt" | "TrentService.GenerateDataKey",
    body: string,
  ) {
    const signed = await this.signedHeaders(target, body)
    const res = await fetch(signed.endpoint, {
      method: "POST",
      headers: signed.headers,
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AWS KMS ${target} failed (${res.status}): ${text}`)
    }

    return (await res.json()) as TResponse
  }

  async encrypt(plaintext: string, key: KeyRef): Promise<string> {
    const body = JSON.stringify({
      KeyId: this.resolveKeyId(key),
      Plaintext: btoa(plaintext),
    })
    const data = await this.callAws<{ CiphertextBlob: string }>("TrentService.Encrypt", body)
    return `${PREFIX}${data.CiphertextBlob}`
  }

  async decrypt(ciphertext: string, key: KeyRef): Promise<string> {
    if (!ciphertext.startsWith(PREFIX)) {
      throw new Error(
        `AwsKmsProvider: ciphertext missing "${PREFIX}" prefix — was it encrypted by a different provider?`,
      )
    }

    const body = JSON.stringify({
      KeyId: this.resolveKeyId(key),
      CiphertextBlob: ciphertext.slice(PREFIX.length),
    })
    const data = await this.callAws<{ Plaintext: string }>("TrentService.Decrypt", body)
    return atob(data.Plaintext)
  }

  async generateDataKey(key: KeyRef): Promise<KmsDataKey> {
    const body = JSON.stringify({
      KeyId: this.resolveKeyId(key),
      KeySpec: "AES_256",
    })
    const data = await this.callAws<{ Plaintext: string; CiphertextBlob: string }>(
      "TrentService.GenerateDataKey",
      body,
    )
    return {
      dek: data.Plaintext,
      wrappedDek: `${PREFIX}${data.CiphertextBlob}`,
    }
  }

  async unwrap(key: KeyRef, wrappedDek: string): Promise<KmsUnwrappedDataKey> {
    if (!wrappedDek.startsWith(PREFIX)) {
      throw new Error(
        `AwsKmsProvider: wrapped DEK missing "${PREFIX}" prefix — was it generated by a different provider?`,
      )
    }

    const body = JSON.stringify({
      KeyId: this.resolveKeyId(key),
      CiphertextBlob: wrappedDek.slice(PREFIX.length),
    })
    const data = await this.callAws<{ Plaintext: string }>("TrentService.Decrypt", body)
    return { dek: data.Plaintext }
  }
}
