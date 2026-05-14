import type { getDb } from "@voyantjs/db"
import { apikeyTable, type SelectApikey } from "@voyantjs/db/schema/iam"
import { eq } from "drizzle-orm"

const API_TOKEN_SECRET_PREFIX = "voy_"
const API_TOKEN_SECRET_LENGTH = 64
const API_TOKEN_SECRET_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

type ApiTokenRotationRow = Pick<
  SelectApikey,
  | "id"
  | "configId"
  | "name"
  | "start"
  | "prefix"
  | "referenceId"
  | "enabled"
  | "rateLimitEnabled"
  | "rateLimitTimeWindow"
  | "rateLimitMax"
  | "requestCount"
  | "remaining"
  | "lastRequest"
  | "createdAt"
  | "updatedAt"
  | "expiresAt"
  | "permissions"
  | "metadata"
>

interface ApiTokenSecretRotation {
  keyHash: string
  start: string
  updatedAt: Date
  metadata: string | null
}

type ApiTokenRotationDb = Pick<ReturnType<typeof getDb>, "select" | "update">

export interface ApiTokenRotationStore {
  getApiToken(keyId: string): Promise<ApiTokenRotationRow | null>
  rotateApiTokenSecret(
    keyId: string,
    rotation: ApiTokenSecretRotation,
  ): Promise<ApiTokenRotationRow | null>
}

export interface ApiTokenRotationOptions {
  db?: ApiTokenRotationDb
  rotationStore?: ApiTokenRotationStore
  generateApiTokenSecret?: (prefix: string) => string
}

interface RotateApiTokenSecretArgs {
  keyId: string
  body: Record<string, unknown>
  userId: string
  options: ApiTokenRotationOptions
  authorize: (input: {
    keyId: string
    configId?: string
    enabled: boolean
    userId: string
  }) => Promise<void>
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return encodeBase64Url(new Uint8Array(hashBuffer))
}

function generateApiTokenSecret(prefix: string): string {
  let secret = prefix

  while (secret.length < prefix.length + API_TOKEN_SECRET_LENGTH) {
    const bytes = new Uint8Array(API_TOKEN_SECRET_LENGTH)
    crypto.getRandomValues(bytes)

    for (const byte of bytes) {
      if (byte >= 208) continue
      secret += API_TOKEN_SECRET_ALPHABET[byte % API_TOKEN_SECRET_ALPHABET.length]
      if (secret.length >= prefix.length + API_TOKEN_SECRET_LENGTH) break
    }
  }

  return secret
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== "string" || value.trim().length === 0) return null

  try {
    const parsed = JSON.parse(value) as unknown
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function appendRotationMetadata(metadata: unknown, rotatedAt: Date, previousStart: string | null) {
  const parsed = parseJsonObject(metadata) ?? {}
  const voyant = parseJsonObject(parsed.voyant) ?? {}
  const apiToken = parseJsonObject(voyant.apiToken) ?? {}
  const previousStarts = Array.isArray(apiToken.previousStarts)
    ? apiToken.previousStarts.filter((value): value is string => typeof value === "string")
    : []

  return {
    ...parsed,
    voyant: {
      ...voyant,
      apiToken: {
        ...apiToken,
        rotationCount: Number(apiToken.rotationCount ?? 0) + 1,
        lastRotatedAt: rotatedAt.toISOString(),
        previousStarts: previousStart
          ? Array.from(new Set([previousStart, ...previousStarts])).slice(0, 10)
          : previousStarts,
      },
    },
  }
}

function serializeApiTokenRow(row: ApiTokenRotationRow, key?: string) {
  return {
    ...row,
    ...(key ? { key } : {}),
    metadata: parseJsonObject(row.metadata),
    permissions: parseJsonObject(row.permissions),
  }
}

function createDrizzleApiTokenRotationStore(db: ApiTokenRotationDb): ApiTokenRotationStore {
  return {
    async getApiToken(keyId) {
      const [row] = await db.select().from(apikeyTable).where(eq(apikeyTable.id, keyId)).limit(1)
      return row ?? null
    },
    async rotateApiTokenSecret(keyId, rotation) {
      const [row] = await db
        .update(apikeyTable)
        .set({
          key: rotation.keyHash,
          start: rotation.start,
          updatedAt: rotation.updatedAt,
          metadata: rotation.metadata,
        })
        .where(eq(apikeyTable.id, keyId))
        .returning()
      return row ?? null
    },
  }
}

export async function rotateApiTokenSecret({
  keyId,
  body,
  userId,
  options,
  authorize,
}: RotateApiTokenSecretArgs) {
  const rotationStore =
    options.rotationStore ??
    (options.db ? createDrizzleApiTokenRotationStore(options.db) : undefined)

  if (!rotationStore) {
    throw Object.assign(new Error("API token rotation requires a rotation store"), {
      status: 500,
    })
  }

  const existing = await rotationStore.getApiToken(keyId)
  if (!existing) {
    throw Object.assign(new Error("API token not found"), { status: 404 })
  }

  await authorize({
    keyId,
    userId,
    enabled: existing.enabled,
    configId: typeof body.configId === "string" ? body.configId : undefined,
  })

  const prefix = existing.prefix ?? API_TOKEN_SECRET_PREFIX
  const key = (options.generateApiTokenSecret ?? generateApiTokenSecret)(prefix)
  const now = new Date()
  const metadata = appendRotationMetadata(existing.metadata, now, existing.start)
  const updated = await rotationStore.rotateApiTokenSecret(keyId, {
    keyHash: await sha256Base64Url(key),
    start: key.substring(0, 6),
    updatedAt: now,
    metadata: JSON.stringify(metadata),
  })

  if (!updated) {
    throw Object.assign(new Error("API token not found"), { status: 404 })
  }

  return serializeApiTokenRow(updated, key)
}
