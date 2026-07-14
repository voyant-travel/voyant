import type { StorageProviderResolver } from "@voyant-travel/storage/types"

export function resolveCustomStorageResolver(value: unknown): StorageProviderResolver {
  if (!isStorageProviderResolver(value)) {
    throw new TypeError(
      'The selected "storage.object" provider must return a StorageProviderResolver.',
    )
  }
  return value
}

function isStorageProviderResolver(value: unknown): value is StorageProviderResolver {
  return Boolean(
    value && typeof value === "object" && typeof Reflect.get(value, "resolve") === "function",
  )
}
