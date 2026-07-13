import type { StorageProvider } from "./types.js"

/**
 * Thrown when a storage operation cannot find the requested provider.
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StorageError"
  }
}

/**
 * Convenience wrapper exposing a single provider. Most deployments use
 * exactly one storage backend at a time; for those cases the service is
 * just a named wrapper.
 */
export interface StorageService extends StorageProvider {
  /** The wrapped provider. */
  readonly provider: StorageProvider
}

/**
 * Create a storage service that delegates all calls to the given provider.
 */
export function createStorageService(provider: StorageProvider): StorageService {
  return {
    provider,
    name: provider.name,
    upload: provider.upload.bind(provider),
    delete: provider.delete.bind(provider),
    ...(provider.signedUrl ? { signedUrl: provider.signedUrl.bind(provider) } : {}),
    get: provider.get.bind(provider),
  }
}
