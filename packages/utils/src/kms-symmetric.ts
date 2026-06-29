import type { KeyRef, KmsProvider } from "./kms.js"

const IV_BYTES = 12

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function importMasterKey(keyB64: string, label: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyB64)
  if (raw.length !== 32) {
    throw new Error(
      `${label}: key must decode to 32 bytes (got ${raw.length}). Generate one with: openssl rand -base64 32`,
    )
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

export function generateSymmetricKmsKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

export abstract class SymmetricAesGcmKmsProvider implements KmsProvider {
  // fallow-ignore-next-line unused-class-member
  abstract readonly name: KmsProvider["name"]
  protected abstract readonly prefix: string
  protected abstract readonly label: string

  private keyPromise: Promise<CryptoKey> | null = null

  protected constructor(private readonly keyB64: string) {}

  private getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      this.keyPromise = importMasterKey(this.keyB64, this.label)
    }
    return this.keyPromise
  }

  async encrypt(plaintext: string, _key: KeyRef): Promise<string> {
    const masterKey = await this.getKey()
    const iv = new Uint8Array(IV_BYTES)
    crypto.getRandomValues(iv)

    const data = new TextEncoder().encode(plaintext)
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, masterKey, data),
    )

    const combined = new Uint8Array(IV_BYTES + ciphertext.length)
    combined.set(iv, 0)
    combined.set(ciphertext, IV_BYTES)

    return `${this.prefix}${bytesToBase64(combined)}`
  }

  async decrypt(ciphertext: string, _key: KeyRef): Promise<string> {
    if (!ciphertext.startsWith(this.prefix)) {
      throw new Error(
        `${this.label}: ciphertext missing "${this.prefix}" prefix — was it encrypted by a different provider?`,
      )
    }

    const combined = base64ToBytes(ciphertext.slice(this.prefix.length))
    if (combined.length <= IV_BYTES) {
      throw new Error(`${this.label}: ciphertext is too short to contain IV + data`)
    }

    const iv = combined.slice(0, IV_BYTES)
    const encrypted = combined.slice(IV_BYTES)
    const masterKey = await this.getKey()
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, masterKey, encrypted)

    return new TextDecoder().decode(plaintext)
  }
}
