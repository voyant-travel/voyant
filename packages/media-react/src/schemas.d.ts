/**
 * Wire response schemas for the media-library admin API.
 *
 * Request/DTO validation is REUSED from `@voyant-travel/media/validation`
 * (`createMediaAssetSchema`, `updateMediaAssetSchema`, the list-query schemas,
 * folder + usage inputs, and `mediaAssetTypeSchema`). The domain package does
 * not export a zod schema for the serialized *response* rows, so these mirror
 * the wire shapes returned by `packages/media/src/routes.ts` — Drizzle rows
 * serialized to JSON (timestamps as ISO strings, integers as numbers). Field
 * names/types stay in lock-step with `@voyant-travel/media/schema`
 * (`MediaAsset`, `MediaFolder`, `MediaFolderMember`, `AssetUsage`).
 */
import { mediaAssetTypeSchema } from "@voyant-travel/media/validation"
import { z } from "zod"

export { mediaAssetTypeSchema }
export type MediaAssetType = z.infer<typeof mediaAssetTypeSchema>
export declare const mediaAssetSchema: z.ZodObject<
  {
    id: z.ZodString
    type: z.ZodEnum<{
      image: "image"
      video: "video"
      document: "document"
    }>
    name: z.ZodString
    alt: z.ZodNullable<z.ZodString>
    storageKey: z.ZodString
    mimeType: z.ZodNullable<z.ZodString>
    fileSize: z.ZodNullable<z.ZodNumber>
    checksum: z.ZodString
    width: z.ZodNullable<z.ZodNumber>
    height: z.ZodNullable<z.ZodNumber>
    durationMs: z.ZodNullable<z.ZodNumber>
    tags: z.ZodArray<z.ZodString>
    providerMeta: z.ZodNullable<z.ZodUnknown>
    createdBy: z.ZodNullable<z.ZodString>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  z.core.$strip
>
export type MediaAsset = z.infer<typeof mediaAssetSchema>
export declare const mediaFolderSchema: z.ZodObject<
  {
    id: z.ZodString
    name: z.ZodString
    parentId: z.ZodNullable<z.ZodString>
    createdAt: z.ZodString
    updatedAt: z.ZodString
  },
  z.core.$strip
>
export type MediaFolder = z.infer<typeof mediaFolderSchema>
export declare const mediaFolderMemberSchema: z.ZodObject<
  {
    id: z.ZodString
    assetId: z.ZodString
    folderId: z.ZodString
    createdAt: z.ZodString
  },
  z.core.$strip
>
export type MediaFolderMember = z.infer<typeof mediaFolderMemberSchema>
export declare const assetUsageSchema: z.ZodObject<
  {
    id: z.ZodString
    assetId: z.ZodString
    entityType: z.ZodString
    entityId: z.ZodString
    createdAt: z.ZodString
  },
  z.core.$strip
>
export type AssetUsage = z.infer<typeof assetUsageSchema>
/** `{ data }` envelope around a single resource. */
export declare const mediaAssetEnvelopeSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        id: z.ZodString
        type: z.ZodEnum<{
          image: "image"
          video: "video"
          document: "document"
        }>
        name: z.ZodString
        alt: z.ZodNullable<z.ZodString>
        storageKey: z.ZodString
        mimeType: z.ZodNullable<z.ZodString>
        fileSize: z.ZodNullable<z.ZodNumber>
        checksum: z.ZodString
        width: z.ZodNullable<z.ZodNumber>
        height: z.ZodNullable<z.ZodNumber>
        durationMs: z.ZodNullable<z.ZodNumber>
        tags: z.ZodArray<z.ZodString>
        providerMeta: z.ZodNullable<z.ZodUnknown>
        createdBy: z.ZodNullable<z.ZodString>
        createdAt: z.ZodString
        updatedAt: z.ZodString
      },
      z.core.$strip
    >
  },
  z.core.$strip
>
export declare const mediaFolderEnvelopeSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        id: z.ZodString
        name: z.ZodString
        parentId: z.ZodNullable<z.ZodString>
        createdAt: z.ZodString
        updatedAt: z.ZodString
      },
      z.core.$strip
    >
  },
  z.core.$strip
>
export declare const mediaFolderMemberEnvelopeSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        id: z.ZodString
        assetId: z.ZodString
        folderId: z.ZodString
        createdAt: z.ZodString
      },
      z.core.$strip
    >
  },
  z.core.$strip
>
export declare const assetUsageEnvelopeSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        id: z.ZodString
        assetId: z.ZodString
        entityType: z.ZodString
        entityId: z.ZodString
        createdAt: z.ZodString
      },
      z.core.$strip
    >
  },
  z.core.$strip
>
/** The upload leg returns `{ data, deduped }` (200 when an identical asset already existed). */
export declare const uploadMediaAssetResponseSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        id: z.ZodString
        type: z.ZodEnum<{
          image: "image"
          video: "video"
          document: "document"
        }>
        name: z.ZodString
        alt: z.ZodNullable<z.ZodString>
        storageKey: z.ZodString
        mimeType: z.ZodNullable<z.ZodString>
        fileSize: z.ZodNullable<z.ZodNumber>
        checksum: z.ZodString
        width: z.ZodNullable<z.ZodNumber>
        height: z.ZodNullable<z.ZodNumber>
        durationMs: z.ZodNullable<z.ZodNumber>
        tags: z.ZodArray<z.ZodString>
        providerMeta: z.ZodNullable<z.ZodUnknown>
        createdBy: z.ZodNullable<z.ZodString>
        createdAt: z.ZodString
        updatedAt: z.ZodString
      },
      z.core.$strip
    >
    deduped: z.ZodOptional<z.ZodBoolean>
  },
  z.core.$strip
>
export declare const removeFolderMemberResponseSchema: z.ZodObject<
  {
    data: z.ZodObject<
      {
        removed: z.ZodBoolean
      },
      z.core.$strip
    >
  },
  z.core.$strip
>
/** `{ data, total, limit, offset }` list envelopes. */
export declare const mediaAssetListResponseSchema: z.ZodObject<
  {
    data: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString
          type: z.ZodEnum<{
            image: "image"
            video: "video"
            document: "document"
          }>
          name: z.ZodString
          alt: z.ZodNullable<z.ZodString>
          storageKey: z.ZodString
          mimeType: z.ZodNullable<z.ZodString>
          fileSize: z.ZodNullable<z.ZodNumber>
          checksum: z.ZodString
          width: z.ZodNullable<z.ZodNumber>
          height: z.ZodNullable<z.ZodNumber>
          durationMs: z.ZodNullable<z.ZodNumber>
          tags: z.ZodArray<z.ZodString>
          providerMeta: z.ZodNullable<z.ZodUnknown>
          createdBy: z.ZodNullable<z.ZodString>
          createdAt: z.ZodString
          updatedAt: z.ZodString
        },
        z.core.$strip
      >
    >
    total: z.ZodNumber
    limit: z.ZodNumber
    offset: z.ZodNumber
  },
  z.core.$strip
>
export declare const mediaFolderListResponseSchema: z.ZodObject<
  {
    data: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString
          name: z.ZodString
          parentId: z.ZodNullable<z.ZodString>
          createdAt: z.ZodString
          updatedAt: z.ZodString
        },
        z.core.$strip
      >
    >
    total: z.ZodNumber
    limit: z.ZodNumber
    offset: z.ZodNumber
  },
  z.core.$strip
>
export declare const assetUsageListResponseSchema: z.ZodObject<
  {
    data: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString
          assetId: z.ZodString
          entityType: z.ZodString
          entityId: z.ZodString
          createdAt: z.ZodString
        },
        z.core.$strip
      >
    >
    total: z.ZodNumber
    limit: z.ZodNumber
    offset: z.ZodNumber
  },
  z.core.$strip
>
