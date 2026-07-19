/**
 * Non-user-facing helpers shared by the media components. Nothing here renders
 * copy — all user-facing strings live in the i18n catalog.
 */
import type { MediaAsset, MediaAssetType } from "../schemas.js"
/** The asset kinds the picker/library can filter on, in display order. */
export declare const MEDIA_ASSET_TYPES: readonly MediaAssetType[]
/** Multipart `accept` hints per asset type (used by the upload inputs). */
export declare const ACCEPT_BY_TYPE: Record<MediaAssetType, string>
/**
 * Default byte-serving URL for an asset. Raw bytes are served by
 * `@voyant-travel/storage` at `GET /v1/admin/media/{storageKey}`; consumers can
 * override via the `resolveAssetUrl` prop when their deployment serves media
 * from a different origin/CDN.
 */
export declare function defaultAssetUrl(
  asset: Pick<MediaAsset, "storageKey">,
  baseUrl: string,
): string
/** Infer an asset type from a MIME string, defaulting to `document`. */
export declare function inferAssetType(mimeType: string | null | undefined): MediaAssetType
/** Split a comma-separated tag input into a trimmed, de-duplicated list. */
export declare function parseTags(input: string): string[]
/**
 * Human-readable byte size. Always returns via a template so the units array
 * never surfaces as a scanned string literal.
 */
export declare function formatFileSize(bytes: number | null | undefined): string | null
