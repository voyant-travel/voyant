import type { StorageProvider } from "./types.js"

export interface StorageProviderConformanceOptions {
  createProvider: () => StorageProvider | Promise<StorageProvider>
  key?: string
}

/** Exercise the portable object-storage contract against a provider instance. */
export async function assertStorageProviderConformance(
  options: StorageProviderConformanceOptions,
): Promise<void> {
  const provider = await options.createProvider()
  const key = options.key ?? `voyant-conformance/${globalThis.crypto.randomUUID()}`
  const expected = new Uint8Array([0, 1, 2, 127, 255])

  const uploaded = await provider.upload(expected, {
    key,
    contentType: "application/octet-stream",
    metadata: { conformance: "true" },
  })
  assert(uploaded.key === key, `upload returned key ${uploaded.key}; expected ${key}`)

  const stored = await provider.get(key)
  assert(stored !== null, "get returned null after upload")
  assert(equalBytes(new Uint8Array(stored), expected), "get returned different bytes than upload")

  if (provider.signedUrl) {
    const signedUrl = await provider.signedUrl(key, 60)
    assert(signedUrl.trim().length > 0, "signedUrl returned an empty URL")
  }

  await provider.delete(key)
  assert((await provider.get(key)) === null, "get returned an object after delete")
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Storage provider conformance failed: ${message}`)
}
