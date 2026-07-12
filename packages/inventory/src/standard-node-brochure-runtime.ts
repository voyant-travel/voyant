import { getVoyantCloudClient, type VoyantCloudClient } from "@voyant-travel/cloud-sdk"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { createMediaStorage } from "@voyant-travel/storage/standard-node"

import type { ProductBrochureRoutesOptions } from "./routes-brochure.js"
import {
  brochureBodyToHtml,
  type ProductBrochurePrinter,
  type ProductBrochurePrinterContext,
} from "./tasks/brochure-printers.js"

type RuntimeEnv = Readonly<
  Partial<
    Record<
      | "MEDIA_BUCKET"
      | "APP_URL"
      | "VOYANT_API_KEY"
      | "VOYANT_CLOUD_API_KEY"
      | "VOYANT_CLOUD_API_URL"
      | "VOYANT_CLOUD_USER_AGENT",
      unknown
    >
  >
>
type BrochureRuntimePrimitives = Pick<VoyantRuntimeHostPrimitives, "env">

const CLIENT_CACHE = new WeakMap<object, Map<string, VoyantCloudClient>>()
const LOCAL_PLACEHOLDER_KEYS = new Set(["local-dev"])

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 && !LOCAL_PLACEHOLDER_KEYS.has(trimmed) ? trimmed : undefined
}

function resolveVoyantApiKey(env: RuntimeEnv): string | undefined {
  return nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY)
}

function getCloudClient(env: RuntimeEnv): VoyantCloudClient {
  const apiKey = resolveVoyantApiKey(env)
  const cached = apiKey ? CLIENT_CACHE.get(env as object)?.get(apiKey) : undefined
  if (cached) return cached

  const baseUrl = nonEmpty(env.VOYANT_CLOUD_API_URL)
  const userAgent = nonEmpty(env.VOYANT_CLOUD_USER_AGENT)
  const client = getVoyantCloudClient(
    {
      ...(apiKey ? { VOYANT_CLOUD_API_KEY: apiKey } : {}),
      ...(baseUrl ? { VOYANT_CLOUD_API_URL: baseUrl } : {}),
      ...(userAgent ? { VOYANT_CLOUD_USER_AGENT: userAgent } : {}),
    },
    apiKey ? { apiKey } : undefined,
  )
  if (apiKey) {
    const clients = CLIENT_CACHE.get(env as object) ?? new Map<string, VoyantCloudClient>()
    clients.set(apiKey, client)
    CLIENT_CACHE.set(env as object, clients)
  }
  return client
}

function tryGetCloudClient(env: RuntimeEnv): VoyantCloudClient | null {
  return resolveVoyantApiKey(env) ? getCloudClient(env) : null
}

/** Voyant Cloud browser-backed brochure printer used by the standard Node runtime. */
export function createProductBrochurePrinter(env: RuntimeEnv): ProductBrochurePrinter {
  const client = getCloudClient(env)
  return async ({ template, context }: ProductBrochurePrinterContext) => {
    const body = await client.browser.pdf({
      html: brochureBodyToHtml(template.body, template.bodyFormat, template.title),
    })
    return {
      body,
      mimeType: "application/pdf",
      fileSize: body.byteLength,
      metadata: {
        renderer: "voyant-cloud-browser",
        productId: context.product.id,
        bodyFormat: template.bodyFormat,
      },
    }
  }
}

/** Build Inventory's brochure runtime from generic graph host primitives. */
export function createInventoryBrochureStandardNodeRuntime(
  primitives: BrochureRuntimePrimitives,
): ProductBrochureRoutesOptions {
  return {
    resolveStorage: (context) => createMediaStorage(primitives.env(context.env)),
    resolvePrinter: (context) => {
      const env = primitives.env(context.env)
      return tryGetCloudClient(env) ? createProductBrochurePrinter(env) : null
    },
  }
}
