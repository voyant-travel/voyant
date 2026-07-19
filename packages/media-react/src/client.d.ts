/**
 * Zod fetch client for the media-library admin API
 * (`/v1/admin/media-library/*`). The low-level `fetchWithValidation` /
 * `VoyantApiError` infra mirrors the other `*-react` clients; the typed
 * operation functions reuse the request schemas from
 * `@voyant-travel/media/validation` and validate responses against the wire
 * schemas in `./schemas`.
 */
import type {
  CreateMediaFolderInput,
  ListAssetUsageQuery,
  ListMediaAssetsQuery,
  ListMediaFoldersQuery,
  UpdateMediaAssetInput,
  UpdateMediaFolderInput,
} from "@voyant-travel/media/validation"
import type { z } from "zod"
export type VoyantFetcher = (url: string, init?: RequestInit) => Promise<Response>
export declare const defaultFetcher: VoyantFetcher
export declare class VoyantApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body: unknown)
}
/** True when the failure is the service's delete-in-use guard (HTTP 409). */
export declare function isAssetInUseError(error: unknown): error is VoyantApiError
export interface FetchWithValidationOptions {
  baseUrl: string
  fetcher: VoyantFetcher
}
export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>
export declare function fetchWithValidation<TOut>(
  path: string,
  schema: z.ZodType<TOut>,
  options: FetchWithValidationOptions,
  init?: RequestInit,
): Promise<TOut>
export declare function withQueryParams(path: string, query?: object): string
/** List/search assets (filters: type, folderId, tag, mimeType, name; paginated). */
export declare function listMediaAssets(
  query: Partial<ListMediaAssetsQuery> | undefined,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    type: "image" | "video" | "document"
    name: string
    alt: string | null
    storageKey: string
    mimeType: string | null
    fileSize: number | null
    checksum: string
    width: number | null
    height: number | null
    durationMs: number | null
    tags: string[]
    providerMeta: unknown
    createdBy: string | null
    createdAt: string
    updatedAt: string
  }[]
  total: number
  limit: number
  offset: number
}>
export declare function getMediaAsset(
  assetId: string,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    type: "image" | "video" | "document"
    name: string
    alt: string | null
    storageKey: string
    mimeType: string | null
    fileSize: number | null
    checksum: string
    width: number | null
    height: number | null
    durationMs: number | null
    tags: string[]
    providerMeta: unknown
    createdBy: string | null
    createdAt: string
    updatedAt: string
  }
}>
export interface UploadMediaAssetInput {
  file: File
  type: string
  name?: string
  alt?: string
  mimeType?: string
  tags?: string[]
  folderIds?: string[]
}
/** Upload an asset (multipart → dedup → store → catalogue). Returns the asset. */
export declare function uploadMediaAsset(
  input: UploadMediaAssetInput,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    type: "image" | "video" | "document"
    name: string
    alt: string | null
    storageKey: string
    mimeType: string | null
    fileSize: number | null
    checksum: string
    width: number | null
    height: number | null
    durationMs: number | null
    tags: string[]
    providerMeta: unknown
    createdBy: string | null
    createdAt: string
    updatedAt: string
  }
  deduped?: boolean | undefined
}>
export declare function updateMediaAsset(
  assetId: string,
  input: UpdateMediaAssetInput,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    type: "image" | "video" | "document"
    name: string
    alt: string | null
    storageKey: string
    mimeType: string | null
    fileSize: number | null
    checksum: string
    width: number | null
    height: number | null
    durationMs: number | null
    tags: string[]
    providerMeta: unknown
    createdBy: string | null
    createdAt: string
    updatedAt: string
  }
}>
export declare function deleteMediaAsset(
  assetId: string,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    type: "image" | "video" | "document"
    name: string
    alt: string | null
    storageKey: string
    mimeType: string | null
    fileSize: number | null
    checksum: string
    width: number | null
    height: number | null
    durationMs: number | null
    tags: string[]
    providerMeta: unknown
    createdBy: string | null
    createdAt: string
    updatedAt: string
  }
}>
export declare function listMediaFolders(
  query: Partial<ListMediaFoldersQuery> | undefined,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    name: string
    parentId: string | null
    createdAt: string
    updatedAt: string
  }[]
  total: number
  limit: number
  offset: number
}>
export declare function createMediaFolder(
  input: CreateMediaFolderInput,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    name: string
    parentId: string | null
    createdAt: string
    updatedAt: string
  }
}>
export declare function updateMediaFolder(
  folderId: string,
  input: UpdateMediaFolderInput,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    name: string
    parentId: string | null
    createdAt: string
    updatedAt: string
  }
}>
export declare function deleteMediaFolder(
  folderId: string,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    name: string
    parentId: string | null
    createdAt: string
    updatedAt: string
  }
}>
export declare function addAssetToFolder(
  folderId: string,
  assetId: string,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    assetId: string
    folderId: string
    createdAt: string
  }
}>
export declare function removeAssetFromFolder(
  folderId: string,
  assetId: string,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    removed: boolean
  }
}>
export declare function listAssetUsage(
  query: Partial<ListAssetUsageQuery> | undefined,
  options: FetchWithValidationOptions,
): Promise<{
  data: {
    id: string
    assetId: string
    entityType: string
    entityId: string
    createdAt: string
  }[]
  total: number
  limit: number
  offset: number
}>
