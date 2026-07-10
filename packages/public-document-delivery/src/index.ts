import type {
  InsertInfraPublicDocumentDeliveryGrant,
  SelectInfraPublicDocumentDeliveryGrant,
} from "@voyant-travel/db/schema/infra"
import { infraPublicDocumentDeliveryGrantsTable } from "@voyant-travel/db/schema/infra"
import type { StorageProvider } from "@voyant-travel/storage"
import { and, eq, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"

const DEFAULT_PUBLIC_DOCUMENT_TTL_SECONDS = 24 * 60 * 60
const MAX_PUBLIC_DOCUMENT_TTL_SECONDS = 30 * 24 * 60 * 60
const PUBLIC_DOCUMENT_TOKEN_BYTES = 32
const DEFAULT_CONTENT_TYPE = "application/octet-stream"
const DEFAULT_PUBLIC_DOCUMENT_PATH = "/v1/public/documents"

export interface PublicDocumentDeliveryEnvelope {
  grantId: string
  url: string
  expiresAt: string | null
  filename: string | null
}

export interface PublicDocumentDeliverySource {
  module?: string | null
  entity?: string | null
  id?: string | null
}

export interface CreatePublicDocumentDeliveryInput {
  storageKey: string
  publicBaseUrl: string
  publicPath?: string
  ttlSeconds?: number
  expiresAt?: Date
  filename?: string | null
  contentType?: string | null
  storageProvider?: string | null
  source?: PublicDocumentDeliverySource | null
  createdBy?: string | null
  createdByType?: string | null
  metadata?: unknown
  now?: Date
}

export interface PublicDocumentDeliveryAccessContext {
  accessedAt?: Date
  ip?: string | null
  userAgent?: string | null
}

export interface RevokePublicDocumentDeliveryGrantInput {
  id: string
  revokedAt?: Date
  revokedBy?: string | null
}

export type PublicDocumentDeliveryGrant = SelectInfraPublicDocumentDeliveryGrant

export type PublicDocumentDeliveryResolution =
  | { status: "ready"; grant: PublicDocumentDeliveryGrant }
  | { status: "not_found" }
  | { status: "expired"; grant: PublicDocumentDeliveryGrant }
  | { status: "revoked"; grant: PublicDocumentDeliveryGrant }

export interface PublicDocumentDeliveryGrantStore {
  create(input: InsertInfraPublicDocumentDeliveryGrant): Promise<PublicDocumentDeliveryGrant>
  findByTokenHash(tokenHash: string): Promise<PublicDocumentDeliveryGrant | null>
  recordAccess(id: string, context: Required<PublicDocumentDeliveryAccessContext>): Promise<void>
  revoke(input: RevokePublicDocumentDeliveryGrantInput): Promise<PublicDocumentDeliveryGrant | null>
}

type Env<TBindings extends object = Record<string, unknown>> = {
  Bindings: TBindings
  Variables: {
    db: PostgresJsDatabase
  }
}

export interface PublicDocumentDeliveryRouteOptions<
  TBindings extends object = Record<string, unknown>,
> {
  storage?: StorageProvider | null
  resolveStorage?: (bindings: TBindings) => StorageProvider | null | undefined
  store?: PublicDocumentDeliveryGrantStore
  resolveStore?: (
    bindings: TBindings,
    db: PostgresJsDatabase,
  ) => PublicDocumentDeliveryGrantStore | undefined
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(hashBuffer))
}

function createOpaqueToken() {
  const bytes = new Uint8Array(PUBLIC_DOCUMENT_TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function normalizePublicBaseUrl(publicBaseUrl: string) {
  const trimmed = publicBaseUrl.trim().replace(/\/+$/, "")
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("publicBaseUrl must be an absolute HTTP(S) URL")
  }
  return trimmed
}

function normalizePublicPath(path: string | undefined) {
  const value = path?.trim() || DEFAULT_PUBLIC_DOCUMENT_PATH
  return `/${value.replace(/^\/+|\/+$/g, "")}`
}

function resolveExpiresAt(input: CreatePublicDocumentDeliveryInput) {
  const now = input.now ?? new Date()
  if (input.expiresAt) {
    if (input.expiresAt <= now) {
      throw new Error("expiresAt must be in the future")
    }
    const maxExpiresAt = new Date(now.getTime() + MAX_PUBLIC_DOCUMENT_TTL_SECONDS * 1000)
    if (input.expiresAt > maxExpiresAt) {
      throw new Error("expiresAt exceeds the public document delivery maximum TTL")
    }
    return input.expiresAt
  }

  const ttlSeconds = input.ttlSeconds ?? DEFAULT_PUBLIC_DOCUMENT_TTL_SECONDS
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be greater than zero")
  }
  return new Date(now.getTime() + Math.min(ttlSeconds, MAX_PUBLIC_DOCUMENT_TTL_SECONDS) * 1000)
}

function maybeString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function safeAsciiFilename(filename: string | null | undefined) {
  const normalized = maybeString(filename)
  if (!normalized) return "document"

  const safe = normalized
    .normalize("NFKD")
    .replace(/[^\w .-]+/g, "-")
    .replace(/[\r\n"\\]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)

  return safe || "document"
}

function filenameFromStorageKey(storageKey: string) {
  return storageKey.split("/").filter(Boolean).at(-1) ?? "document"
}

function contentDisposition(filename: string | null) {
  return `attachment; filename="${safeAsciiFilename(filename)}"`
}

function safeContentType(contentType: string | null | undefined) {
  const normalized = maybeString(contentType)
  if (!normalized) return DEFAULT_CONTENT_TYPE
  return /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;\s*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/.test(
    normalized,
  )
    ? normalized
    : DEFAULT_CONTENT_TYPE
}

function isPlausiblePublicDocumentToken(token: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token)
}

function getClientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  )
}

function getStore<TBindings extends object>(
  options: PublicDocumentDeliveryRouteOptions<TBindings>,
  bindings: TBindings,
  db: PostgresJsDatabase,
) {
  return (
    options.resolveStore?.(bindings, db) ??
    options.store ??
    createDrizzlePublicDocumentDeliveryGrantStore(db)
  )
}

function getStorage<TBindings extends object>(
  options: PublicDocumentDeliveryRouteOptions<TBindings>,
  bindings: TBindings,
) {
  return options.resolveStorage?.(bindings) ?? options.storage ?? null
}

export function createDrizzlePublicDocumentDeliveryGrantStore(
  db: PostgresJsDatabase,
): PublicDocumentDeliveryGrantStore {
  return {
    async create(input) {
      const [row] = await db
        .insert(infraPublicDocumentDeliveryGrantsTable)
        .values(input)
        .returning()
      if (!row) throw new Error("Failed to create public document delivery grant")
      return row
    },
    async findByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(infraPublicDocumentDeliveryGrantsTable)
        .where(eq(infraPublicDocumentDeliveryGrantsTable.tokenHash, tokenHash))
        .limit(1)
      return row ?? null
    },
    async recordAccess(id, context) {
      await db
        .update(infraPublicDocumentDeliveryGrantsTable)
        .set({
          // agent-quality: raw-sql reviewed -- owner: public-document-delivery; Drizzle binds dynamic values.
          accessCount: sql`${infraPublicDocumentDeliveryGrantsTable.accessCount} + 1`,
          lastAccessedAt: context.accessedAt,
          lastAccessedIp: context.ip,
          lastAccessedUserAgent: context.userAgent,
        })
        .where(eq(infraPublicDocumentDeliveryGrantsTable.id, id))
    },
    async revoke(input) {
      const [row] = await db
        .update(infraPublicDocumentDeliveryGrantsTable)
        .set({
          revokedAt: input.revokedAt ?? new Date(),
          revokedBy: input.revokedBy ?? null,
        })
        .where(
          and(
            eq(infraPublicDocumentDeliveryGrantsTable.id, input.id),
            isNull(infraPublicDocumentDeliveryGrantsTable.revokedAt),
          ),
        )
        .returning()
      return row ?? null
    },
  }
}

export async function createPublicDocumentDeliveryGrant(
  store: PublicDocumentDeliveryGrantStore,
  input: CreatePublicDocumentDeliveryInput,
): Promise<PublicDocumentDeliveryEnvelope> {
  const storageKey = maybeString(input.storageKey)
  if (!storageKey) {
    throw new Error("storageKey is required")
  }

  const token = createOpaqueToken()
  const tokenHash = await sha256Base64Url(token)
  const expiresAt = resolveExpiresAt(input)
  const filename = maybeString(input.filename) ?? filenameFromStorageKey(storageKey)
  const contentType = maybeString(input.contentType) ?? DEFAULT_CONTENT_TYPE

  const grant = await store.create({
    tokenHash,
    storageKey,
    storageProvider: maybeString(input.storageProvider),
    filename,
    contentType,
    sourceModule: maybeString(input.source?.module),
    sourceEntity: maybeString(input.source?.entity),
    sourceId: maybeString(input.source?.id),
    createdBy: maybeString(input.createdBy),
    createdByType: maybeString(input.createdByType),
    metadata: input.metadata ?? null,
    expiresAt,
  })

  return {
    grantId: grant.id,
    url: `${normalizePublicBaseUrl(input.publicBaseUrl)}${normalizePublicPath(input.publicPath)}/${token}`,
    expiresAt: expiresAt.toISOString(),
    filename,
  }
}

export async function resolvePublicDocumentDeliveryGrant(
  store: PublicDocumentDeliveryGrantStore,
  token: string,
  now = new Date(),
): Promise<PublicDocumentDeliveryResolution> {
  if (!isPlausiblePublicDocumentToken(token)) {
    return { status: "not_found" }
  }

  const grant = await store.findByTokenHash(await sha256Base64Url(token))
  if (!grant) {
    return { status: "not_found" }
  }
  if (grant.revokedAt) {
    return { status: "revoked", grant }
  }
  if (grant.expiresAt <= now) {
    return { status: "expired", grant }
  }
  return { status: "ready", grant }
}

export async function revokePublicDocumentDeliveryGrant(
  store: PublicDocumentDeliveryGrantStore,
  input: RevokePublicDocumentDeliveryGrantInput,
) {
  return store.revoke(input)
}

export function createPublicDocumentDeliveryRoutes<
  TBindings extends object = Record<string, unknown>,
>(options: PublicDocumentDeliveryRouteOptions<TBindings> = {}) {
  return new Hono<Env<TBindings>>().get("/:token", async (c) => {
    const token = c.req.param("token")
    const store = getStore(options, c.env, c.get("db"))
    const resolution = await resolvePublicDocumentDeliveryGrant(store, token)

    if (resolution.status === "not_found") {
      return c.body(null, 404)
    }
    if (resolution.status === "expired" || resolution.status === "revoked") {
      return c.body(null, 410)
    }

    const storage = getStorage(options, c.env)
    if (!storage) {
      return c.json({ error: "Document storage is not configured" }, 503)
    }

    const body = await storage.get(resolution.grant.storageKey)
    if (!body) {
      return c.body(null, 404)
    }

    await store.recordAccess(resolution.grant.id, {
      accessedAt: new Date(),
      ip: getClientIp(c.req.raw.headers),
      userAgent: c.req.header("user-agent") ?? null,
    })

    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Type": safeContentType(resolution.grant.contentType),
        "Content-Length": String(body.byteLength),
        "Content-Disposition": contentDisposition(resolution.grant.filename),
      },
    })
  })
}

export function createPublicDocumentDeliveryHonoModule<
  TBindings extends object = Record<string, unknown>,
>(options: PublicDocumentDeliveryRouteOptions<TBindings> = {}) {
  return {
    module: {
      name: "documents",
    },
    publicRoutes: createPublicDocumentDeliveryRoutes(options),
  }
}
