import { definePort } from "./project.js"

export type PdfPageFormat =
  | "letter"
  | "legal"
  | "tabloid"
  | "ledger"
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5"
  | "a6"

export interface PdfRenderRequest {
  html: string
  page?: {
    format?: PdfPageFormat
    landscape?: boolean
    printBackground?: boolean
    scale?: number
    margin?: {
      top?: number | string
      bottom?: number | string
      left?: number | string
      right?: number | string
    }
    displayHeaderFooter?: boolean
    headerTemplate?: string
    footerTemplate?: string
  }
  navigation?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2"
    timeoutMs?: number
    referer?: string
  }
  mediaType?: "screen" | "print"
  waitForTimeoutMs?: number
}

/** Cross-cutting HTML-to-document capability supplied by a deployment. */
export interface DocumentRenderer {
  readonly name: string
  renderPdf(request: PdfRenderRequest): Promise<Uint8Array>
}

export const documentRendererPort = definePort<DocumentRenderer>({
  id: "documents.renderer",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.name !== "string" ||
      provider.name.trim().length === 0 ||
      typeof provider.renderPdf !== "function"
    ) {
      throw new Error("documents.renderer provider must define name and implement renderPdf().")
    }
  },
})

export interface HttpDocumentRendererOptions {
  endpoint: string
  name?: string
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  fetch?: typeof fetch
}

/** Portable adapter for a self-hosted or managed Voyant-compatible render endpoint. */
export function createHttpDocumentRenderer(options: HttpDocumentRendererOptions): DocumentRenderer {
  const endpoint = options.endpoint.trim()
  if (!endpoint) throw new Error("HTTP document renderer endpoint is required.")

  return {
    name: options.name?.trim() || "http-document-renderer",
    async renderPdf(request) {
      const configuredHeaders =
        typeof options.headers === "function" ? await options.headers() : options.headers
      const headers = new Headers(configuredHeaders)
      headers.set("content-type", "application/json")
      headers.set("accept", "application/pdf")

      const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      })
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 500)
        throw new Error(
          `Document renderer failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
        )
      }

      return new Uint8Array(await response.arrayBuffer())
    },
  }
}

export interface DocumentRendererEnvironment {
  VOYANT_DOCUMENT_RENDERER_URL?: unknown
  VOYANT_DOCUMENT_RENDERER_TOKEN?: unknown
  VOYANT_DOCUMENT_RENDERER_NAME?: unknown
  VOYANT_CLOUD_DEPLOYMENT_ID?: unknown
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Resolve the zero-code HTTP renderer seam shared by managed and self-hosted deployments. */
export function createHttpDocumentRendererFromEnv(
  env: DocumentRendererEnvironment,
  options: Pick<HttpDocumentRendererOptions, "fetch"> = {},
): DocumentRenderer | null {
  const endpoint = nonEmptyString(env.VOYANT_DOCUMENT_RENDERER_URL)
  if (!endpoint) return null

  const token = nonEmptyString(env.VOYANT_DOCUMENT_RENDERER_TOKEN)
  const deploymentId = nonEmptyString(env.VOYANT_CLOUD_DEPLOYMENT_ID)
  return createHttpDocumentRenderer({
    endpoint,
    name: nonEmptyString(env.VOYANT_DOCUMENT_RENDERER_NAME),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(deploymentId ? { "x-voyant-deployment-id": deploymentId } : {}),
    },
    ...options,
  })
}
