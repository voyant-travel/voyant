/**
 * `@voyant-travel/media` — the consolidated media-library domain: catalogued
 * assets (images/videos/documents), folders + membership, tags, and usage
 * tracking, built on the `@voyant-travel/storage` byte seam.
 *
 * Schema (`./schema`) + transport-agnostic service (`./service`) + validation
 * (`./validation`). HTTP routes live in `./routes` (a deployment mounts them and
 * injects the resolved `"media"` StorageProvider). This foundational phase is
 * backend/domain only — no React picker UI, no cloud CDN, no `product_media`
 * migration.
 */

export * from "./schema.js"
export * from "./service.js"
export * from "./validation.js"
