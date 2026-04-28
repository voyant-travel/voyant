import { renderPdfDocument } from "@voyantjs/utils/pdf-renderer"
import type { StructuredTemplateBodyFormat } from "@voyantjs/utils/template-renderer"

import type {
  ProductBrochureTemplateContext,
  RenderedProductBrochureTemplate,
} from "./brochure-templates.js"

export interface ProductBrochurePrinterContext {
  template: RenderedProductBrochureTemplate
  context: ProductBrochureTemplateContext
}

export interface PrintedProductBrochureArtifact {
  body: Uint8Array
  mimeType?: string | null
  fileSize?: number | null
  metadata?: Record<string, unknown> | null
}

export type ProductBrochurePrinter = (
  input: ProductBrochurePrinterContext,
) => Promise<PrintedProductBrochureArtifact>

export interface CloudflareBrowserBrochurePrinterOptions {
  accountId: string
  apiToken: string
  apiBaseUrl?: string
  addStyleTag?: Array<{ content?: string; url?: string }>
  pdfOptions?: Record<string, unknown>
  gotoOptions?: Record<string, unknown>
  viewport?: Record<string, unknown>
  setExtraHTTPHeaders?: Record<string, string>
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function brochureBodyToHtml(
  body: string,
  bodyFormat: StructuredTemplateBodyFormat,
  title: string,
) {
  const content =
    bodyFormat === "html"
      ? body
      : `<pre style="white-space: pre-wrap; font-family: system-ui, sans-serif;">${escapeHtml(body)}</pre>`

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(title)}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "</head>",
    `<body>${content}</body>`,
    "</html>",
  ].join("")
}

export function createBasicPdfProductBrochurePrinter(): ProductBrochurePrinter {
  return async ({ template, context }) => {
    const body = await renderPdfDocument({
      title: template.title,
      content: template.body,
      format: template.bodyFormat,
      metadataLines: [`Product ID: ${context.product.id}`, ...template.metadataLines],
    })

    return {
      body,
      mimeType: "application/pdf",
      fileSize: body.byteLength,
      metadata: {
        renderer: "voyant-basic-pdf",
        bodyFormat: template.bodyFormat,
      },
    }
  }
}

export function createCloudflareBrowserProductBrochurePrinter(
  options: CloudflareBrowserBrochurePrinterOptions,
): ProductBrochurePrinter {
  const apiBaseUrl =
    options.apiBaseUrl?.replace(/\/$/, "") || "https://api.cloudflare.com/client/v4"

  return async ({ template, context }) => {
    const response = await fetch(
      `${apiBaseUrl}/accounts/${options.accountId}/browser-rendering/pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: brochureBodyToHtml(template.body, template.bodyFormat, template.title),
          addStyleTag: options.addStyleTag,
          pdfOptions: options.pdfOptions,
          gotoOptions: options.gotoOptions,
          viewport: options.viewport,
          setExtraHTTPHeaders: options.setExtraHTTPHeaders,
        }),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new Error(
        `Cloudflare Browser brochure print failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      )
    }

    const body = new Uint8Array(await response.arrayBuffer())

    return {
      body,
      mimeType: "application/pdf",
      fileSize: body.byteLength,
      metadata: {
        renderer: "cloudflare-browser",
        bodyFormat: template.bodyFormat,
        browserMsUsed: response.headers.get("X-Browser-Ms-Used"),
        productId: context.product.id,
      },
    }
  }
}

export function createCloudflareBrowserProductBrochurePrinterFromEnv(
  env?: Record<string, string | undefined>,
): ProductBrochurePrinter {
  const resolvedEnv =
    env ??
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {}
  const accountId = resolvedEnv.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = resolvedEnv.CLOUDFLARE_API_TOKEN?.trim()

  if (!accountId || !apiToken) {
    throw new Error(
      "createCloudflareBrowserProductBrochurePrinterFromEnv requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    )
  }

  return createCloudflareBrowserProductBrochurePrinter({
    accountId,
    apiToken,
  })
}
