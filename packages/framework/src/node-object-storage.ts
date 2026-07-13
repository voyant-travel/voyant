import { createLocalStorageProvider } from "@voyant-travel/storage/providers/local"
import { createS3CompatibleStorageProvider } from "@voyant-travel/storage/providers/s3-compatible"
import type {
  StorageProvider,
  StorageProviderResolver,
  VoyantStorageName,
} from "@voyant-travel/storage/types"

import type { VoyantNodeProviderPlan } from "./node-provider-plan.js"

export type VoyantNodeStorageResolver = StorageProviderResolver

export function createVoyantNodeStorageResolver(options: {
  plan: Pick<VoyantNodeProviderPlan, "storage">
  env: Readonly<Record<string, unknown>>
  custom?: StorageProviderResolver
}): StorageProviderResolver {
  if (options.plan.storage === "custom") {
    if (!options.custom || typeof options.custom.resolve !== "function") {
      throw new Error(
        "deployment.providers.storage=custom requires a selected storage.object provider or an explicit Node host resolver",
      )
    }
    return options.custom
  }

  if (options.plan.storage === "memory") {
    const apiBaseUrl = resolveApiBaseUrl(options.env)
    return fixedStores({
      documents: createLocalStorageProvider({
        name: "memory:documents",
        baseUrl: `${apiBaseUrl}/v1/admin/documents/files/`,
      }),
      media: createLocalStorageProvider({
        name: "memory:media",
        baseUrl: `${apiBaseUrl}/v1/admin/media/`,
      }),
    })
  }

  const env = stringValues(options.env)
  const mediaPublicBaseUrl = env.MEDIA_PUBLIC_BASE_URL ?? `${resolveApiBaseUrl(env)}/v1/admin/media`
  const shared = {
    region: requireValue(env, "S3_REGION"),
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_ACCESS_KEY_ID ? { accessKeyId: env.S3_ACCESS_KEY_ID } : {}),
    ...(env.S3_SECRET_ACCESS_KEY ? { secretAccessKey: env.S3_SECRET_ACCESS_KEY } : {}),
    ...(env.S3_SESSION_TOKEN ? { sessionToken: env.S3_SESSION_TOKEN } : {}),
    ...(env.S3_FORCE_PATH_STYLE
      ? { forcePathStyle: parseBoolean("S3_FORCE_PATH_STYLE", env.S3_FORCE_PATH_STYLE) }
      : {}),
  }

  return fixedStores({
    documents: createS3CompatibleStorageProvider({
      ...shared,
      name: "s3-compatible:documents",
      bucket: requireValue(env, "STORAGE_DOCUMENTS_BUCKET"),
    }),
    media: createS3CompatibleStorageProvider({
      ...shared,
      name: "s3-compatible:media",
      bucket: requireValue(env, "STORAGE_MEDIA_BUCKET"),
      publicBaseUrl: mediaPublicBaseUrl,
    }),
  })
}

function fixedStores(
  stores: Readonly<Record<"documents" | "media", StorageProvider>>,
): StorageProviderResolver {
  return {
    resolve(name: VoyantStorageName) {
      if (name === "documents") return stores.documents
      if (name === "media") return stores.media
      return null
    },
  }
}

function stringValues(input: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  )
}

function requireValue(env: Readonly<Record<string, string>>, name: string): string {
  const value = env[name]
  if (value) return value
  throw new Error(`env ${name} is required by the Node storage provider`)
}

function parseBoolean(name: string, value: string): boolean {
  if (value === "true") return true
  if (value === "false") return false
  throw new Error(`env ${name} must be either true or false`)
}

function resolveApiBaseUrl(env: Readonly<Record<string, unknown>>): string {
  const configured = [env.API_BASE_URL, env.APP_URL].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )
  const value = configured?.trim().replace(/\/+$/, "") ?? "http://localhost:3300/api"
  try {
    const parsed = new URL(value)
    if (parsed.pathname === "" || parsed.pathname === "/") parsed.pathname = "/api"
    return parsed.toString().replace(/\/+$/, "")
  } catch {
    return value
  }
}
