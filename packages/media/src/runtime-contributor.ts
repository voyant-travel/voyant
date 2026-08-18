import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { StorageProvider } from "@voyant-travel/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { and, eq } from "drizzle-orm"

import { mediaAsset } from "./schema.js"
import { mediaInquiryAttachmentRuntimePort } from "./runtime-port.js"

export function createMediaRuntimePortContribution(host: {
  primitives: VoyantRuntimeHostPrimitives
}) {
  async function resolvePrivateDocument(db: unknown, assetId: string) {
    const [asset] = await (db as PostgresJsDatabase)
      .select({ id: mediaAsset.id, name: mediaAsset.name, mimeType: mediaAsset.mimeType })
      .from(mediaAsset)
      .where(
        and(
          eq(mediaAsset.id, assetId),
          eq(mediaAsset.type, "document"),
          eq(mediaAsset.storageClass, "documents"),
        ),
      )
      .limit(1)
    return asset ?? null
  }
  const inquiryAttachmentRuntime = {
    resolvePrivateDocument,
    async downloadPrivateDocument(db: unknown, bindings: unknown, assetId: string) {
      const asset = await resolvePrivateDocument(db, assetId)
      if (!asset) return null
      const [stored] = await (db as PostgresJsDatabase)
        .select({ storageKey: mediaAsset.storageKey })
        .from(mediaAsset)
        .where(eq(mediaAsset.id, assetId))
        .limit(1)
      if (!stored) return null
      const storage = host.primitives.storage.resolve(bindings, "documents") as StorageProvider | null
      const body = await storage?.get(stored.storageKey)
      return body ? { ...asset, body } : null
    },
  }
  return { [mediaInquiryAttachmentRuntimePort.id]: inquiryAttachmentRuntime }
}
