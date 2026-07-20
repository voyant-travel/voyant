import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  StorageObject,
  StorageProvider,
  StorageProviderResolver,
  StorageUploadBody,
  UploadOptions,
  VoyantStorageName,
} from "@voyant-travel/storage/types"

/**
 * Node-only filesystem persistence for the local `memory` storage plan.
 *
 * The in-memory storage provider keeps bytes in a per-process `Map`, so uploaded
 * media/documents vanish on restart while their catalogue rows persist in
 * Postgres — leaving dangling references and broken thumbnails. This decorator
 * mirrors every uploaded object to disk under `dir` (namespaced per store) and
 * falls back to disk on read, so a self-hosted operator running without a
 * configured S3/R2 bucket keeps its uploads across restarts. Disk operations are
 * best-effort: a read-only or ephemeral filesystem degrades to memory-only
 * rather than failing the upload.
 *
 * This lives in `@voyant-travel/runtime` (Node-only) on purpose — the
 * `@voyant-travel/storage` package is isomorphic and must not import `node:fs`.
 */

async function toBytes(body: StorageUploadBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  return new Uint8Array(await body.arrayBuffer())
}

/** Resolve a key to an absolute path under `root`, rejecting traversal. */
function safeDiskPath(root: string, key: string): string | null {
  const resolved = path.resolve(root, key)
  const normalizedRoot = path.resolve(root)
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    return null
  }
  return resolved
}

function withDiskProvider(inner: StorageProvider, dir: string): StorageProvider {
  const provider: StorageProvider = {
    name: `${inner.name}+fs`,
    async upload(body: StorageUploadBody, options?: UploadOptions): Promise<StorageObject> {
      const bytes = await toBytes(body)
      const result = await inner.upload(bytes, options)
      const filePath = safeDiskPath(dir, result.key)
      if (filePath) {
        try {
          await mkdir(path.dirname(filePath), { recursive: true })
          await writeFile(filePath, bytes)
        } catch {
          // Best-effort: keep the in-memory copy when the filesystem is unwritable.
        }
      }
      return result
    },
    async delete(key: string): Promise<void> {
      await inner.delete(key)
      const filePath = safeDiskPath(dir, key)
      if (filePath) {
        try {
          await rm(filePath, { force: true })
        } catch {
          // Best-effort.
        }
      }
    },
    async get(key: string): Promise<ArrayBuffer | null> {
      const fromMemory = await inner.get(key)
      if (fromMemory) return fromMemory
      const filePath = safeDiskPath(dir, key)
      if (!filePath) return null
      try {
        const buffer = await readFile(filePath)
        return new Uint8Array(buffer).buffer
      } catch {
        return null
      }
    },
  }
  if (inner.signedUrl) {
    provider.signedUrl = (key, expiresIn) => inner.signedUrl!(key, expiresIn)
  }
  return provider
}

/**
 * Wrap a storage resolver so each resolved store persists uploaded bytes to disk
 * under `${dir}/${name}` and reads fall back to disk. Resolved providers are
 * cached per store name so the disk decorator is stable across requests.
 */
export function withFilesystemPersistence(
  resolver: StorageProviderResolver,
  dir: string,
): StorageProviderResolver {
  const cache = new Map<string, StorageProvider | null>()
  return {
    resolve(name: VoyantStorageName): StorageProvider | null {
      const cached = cache.get(name)
      if (cached !== undefined) return cached
      const inner = resolver.resolve(name)
      const wrapped = inner ? withDiskProvider(inner, path.join(dir, name)) : null
      cache.set(name, wrapped)
      return wrapped
    },
  }
}

/**
 * Resolve the on-disk root for local storage persistence. Honors
 * `STORAGE_LOCAL_DIR`; otherwise defaults to `<cwd>/.voyant/storage`.
 */
export function resolveLocalStorageDir(env: Record<string, unknown>): string {
  const explicit = typeof env.STORAGE_LOCAL_DIR === "string" ? env.STORAGE_LOCAL_DIR.trim() : ""
  return explicit ? path.resolve(explicit) : path.resolve(process.cwd(), ".voyant", "storage")
}
