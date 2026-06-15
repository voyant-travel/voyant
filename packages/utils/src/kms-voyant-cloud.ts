import type { KeyRef, KmsDataKey, KmsProvider, KmsUnwrappedDataKey } from "./kms.js"

const DEFAULT_API_URL = "https://api.voyant.travel"

export interface VoyantCloudKmsConfig {
  apiKey: string
  vaultSlug: string
  apiUrl?: string
}

type VaultResponse<T> = T | { data: T }

function normalizeApiUrl(apiUrl: string | undefined): string {
  return (apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "")
}

function unwrapResponse<T>(value: VaultResponse<T>): T {
  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    (value as { data?: unknown }).data !== undefined
  ) {
    return (value as { data: T }).data
  }
  return value as T
}

function assertStringField<TField extends string>(
  value: unknown,
  field: TField,
  operation: string,
): Record<TField, string> {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as Record<TField, unknown>)[field] !== "string"
  ) {
    throw new Error(`VoyantCloudKmsProvider: ${operation} response is missing "${field}"`)
  }
  return value as Record<TField, string>
}

export class VoyantCloudKmsProvider implements KmsProvider {
  readonly name = "voyant-cloud" as const

  private readonly apiUrl: string

  constructor(private readonly config: VoyantCloudKmsConfig) {
    this.apiUrl = normalizeApiUrl(config.apiUrl)
  }

  private endpoint(path: "encrypt" | "decrypt" | "generateDataKey" | "unwrap") {
    return `${this.apiUrl}/vault/v1/${encodeURIComponent(this.config.vaultSlug)}/${path}`
  }

  private async post<TResponse>(
    path: "encrypt" | "decrypt" | "generateDataKey" | "unwrap",
    body: Record<string, string> | null,
  ): Promise<TResponse> {
    const response = await fetch(this.endpoint(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Voyant Cloud KMS ${path} failed (${response.status}): ${text}`)
    }

    return unwrapResponse((await response.json()) as VaultResponse<TResponse>)
  }

  async encrypt(plaintext: string, _key: KeyRef): Promise<string> {
    const data = await this.post<{ ciphertext: string }>("encrypt", { plaintext })
    return assertStringField(data, "ciphertext", "encrypt").ciphertext
  }

  async decrypt(ciphertext: string, _key: KeyRef): Promise<string> {
    const data = await this.post<{ plaintext: string }>("decrypt", { ciphertext })
    return assertStringField(data, "plaintext", "decrypt").plaintext
  }

  async generateDataKey(_key: KeyRef): Promise<KmsDataKey> {
    const data = await this.post<KmsDataKey>("generateDataKey", null)
    const dek = assertStringField(data, "dek", "generateDataKey").dek
    const wrappedDek = assertStringField(data, "wrappedDek", "generateDataKey").wrappedDek
    return { dek, wrappedDek }
  }

  async unwrap(_key: KeyRef, wrappedDek: string): Promise<KmsUnwrappedDataKey> {
    const data = await this.post<KmsUnwrappedDataKey>("unwrap", { wrappedDek })
    return { dek: assertStringField(data, "dek", "unwrap").dek }
  }
}
