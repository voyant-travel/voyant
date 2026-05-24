import type { EventBus, ModuleContainer } from "@voyantjs/core"
import {
  idempotencyKey,
  parseJsonBody,
  parseOptionalJsonBody,
  parseQuery,
  resolveStoredDocumentDownload,
} from "@voyantjs/hono"
import type { StorageProvider } from "@voyantjs/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import type { ContractLifecycleHook } from "./lifecycle.js"
import {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
  type ContractsRouteRuntime,
} from "./route-runtime.js"
import { renderPreviewResponse } from "./route-template-preview.js"
import { contractsService } from "./service.js"
import { generateContractForBookingFromDefaults } from "./service-auto-generate.js"
import {
  contractListQuerySchema,
  contractNumberSeriesListQuerySchema,
  contractTemplateDefaultQuerySchema,
  contractTemplateListQuerySchema,
  generateContractDocumentInputSchema,
  generateContractForBookingInputSchema,
  insertContractAttachmentSchema,
  insertContractNumberSeriesSchema,
  insertContractSchema,
  insertContractSignatureSchema,
  insertContractTemplateSchema,
  insertContractTemplateVersionSchema,
  publicRenderTemplatePreviewInputSchema,
  renderTemplateInputSchema,
  sendContractInputSchema,
  updateContractAttachmentSchema,
  updateContractNumberSeriesSchema,
  updateContractSchema,
  updateContractTemplateSchema,
} from "./validation.js"

type Env = {
  Bindings: Record<string, unknown>
  Variables: {
    container: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
  }
}

export type ContractDocumentGenerator = Parameters<
  typeof contractsService.generateContractDocument
>[3]["generator"]

export interface ContractsRouteOptions {
  documentGenerator?: ContractDocumentGenerator
  resolveDocumentGenerator?: (
    bindings: Record<string, unknown>,
  ) => ContractDocumentGenerator | undefined
  resolveDocumentDownloadUrl?: (
    bindings: Record<string, unknown>,
    storageKey: string,
  ) => Promise<string | null> | string | null
  documentStorage?: StorageProvider | null
  resolveDocumentStorage?: (bindings: Record<string, unknown>) => StorageProvider | null | undefined
  eventBus?: EventBus
  resolveEventBus?: (bindings: Record<string, unknown>) => EventBus | undefined
  lifecycleHooks?: readonly ContractLifecycleHook[]
  resolveLifecycleHooks?: (
    bindings: Record<string, unknown>,
  ) => readonly ContractLifecycleHook[] | undefined
}

function getRuntime(
  options: ContractsRouteOptions | undefined,
  bindings: Record<string, unknown>,
  resolveFromContainer?: (key: string) => ContractsRouteRuntime | undefined,
) {
  return (
    resolveFromContainer?.(CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY) ??
    buildContractsRouteRuntime(bindings, options)
  )
}

function getMultipartString(value: unknown) {
  const resolved = Array.isArray(value) ? value[0] : value
  return typeof resolved === "string" ? resolved : null
}

function sanitizeStorageFileName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
  return normalized || "document"
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Checksum(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer.slice(0))
  return `sha256:${toHex(digest)}`
}

async function buildUploadedAttachmentInput({
  storage,
  contractId,
  form,
  file,
}: {
  storage: StorageProvider
  contractId: string
  form: Record<string, unknown>
  file: File
}) {
  const originalName = file.name || "document"
  const name = getMultipartString(form.name)?.trim() || originalName
  const kind = getMultipartString(form.kind)?.trim() || "document"
  const mimeType = file.type || "application/octet-stream"
  const body = await file.arrayBuffer()
  const checksum = await sha256Checksum(body)
  const storageName = sanitizeStorageFileName(originalName)
  const key = `contracts/${contractId}/attachments/${crypto.randomUUID()}-${storageName}`
  const uploaded = await storage.upload(body, {
    key,
    contentType: mimeType,
    metadata: {
      checksum,
      contractId,
      kind,
      name,
      originalName,
    },
  })

  return {
    kind,
    name,
    mimeType,
    fileSize: file.size,
    storageKey: uploaded.key,
    checksum,
    metadata: {
      originalName,
      uploadedAt: new Date().toISOString(),
      ...(uploaded.url ? { url: uploaded.url } : {}),
    },
  }
}

async function parseAttachmentUploadRequest(c: Context<Env>) {
  const form = (await c.req.parseBody()) as Record<string, unknown>
  const file = Array.isArray(form.file) ? form.file[0] : form.file
  if (!(file instanceof File)) {
    return { error: c.json({ error: "Missing file field in multipart body" }, 400) }
  }
  return { form, file }
}

async function renderAdminTemplatePreview(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "Template not found" }, 404)
  const input = await parseJsonBody(c, renderTemplateInputSchema)
  const template = await contractsService.getTemplateById(c.get("db"), id)
  if (!template) return c.json({ error: "Template not found" }, 404)
  const body = input.body ?? template.body
  return renderPreviewResponse(c, { ...input, body })
}

async function renderPublicTemplatePreview(c: Context<Env>) {
  const id = c.req.param("id")
  if (!id) return c.json({ error: "Template not found" }, 404)
  const input = await parseJsonBody(c, publicRenderTemplatePreviewInputSchema)
  const template = await contractsService.getTemplateById(c.get("db"), id)
  if (!template?.active) return c.json({ error: "Template not found" }, 404)
  return renderPreviewResponse(c, {
    variables: input.variables,
    body: template.body,
  })
}

async function renderPublicTemplatePreviewBySlug(c: Context<Env>) {
  const slug = c.req.param("slug")
  if (!slug) return c.json({ error: "Template not found" }, 404)
  const input = await parseJsonBody(c, publicRenderTemplatePreviewInputSchema)
  const template = await contractsService.findTemplateBySlug(c.get("db"), slug)
  if (!template?.active) return c.json({ error: "Template not found" }, 404)
  return renderPreviewResponse(
    c,
    {
      variables: input.variables,
      body: template.body,
    },
    {
      template: {
        id: template.id,
        slug: template.slug,
        name: template.name,
        language: template.language,
        scope: template.scope,
      },
    },
  )
}

async function uploadContractAttachment(
  c: Context<Env>,
  options: ContractsRouteOptions,
  contractId: string,
) {
  const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
  const storage = runtime.documentStorage
  if (!storage) {
    return c.json({ error: "Contract document storage is not configured" }, 501)
  }

  const contract = await contractsService.getContractById(c.get("db"), contractId)
  if (!contract) return c.json({ error: "Contract not found" }, 404)

  const parsed = await parseAttachmentUploadRequest(c)
  if ("error" in parsed) return parsed.error

  const row = await contractsService.createAttachment(
    c.get("db"),
    contractId,
    await buildUploadedAttachmentInput({
      storage,
      contractId,
      form: parsed.form,
      file: parsed.file,
    }),
  )
  if (!row) return c.json({ error: "Contract not found" }, 404)
  return c.json({ data: row }, 201)
}

async function regenerateContractDocument(
  c: Context<Env>,
  options: ContractsRouteOptions,
  contractId: string,
) {
  const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
  const generator = runtime.documentGenerator
  if (!generator) {
    return c.json({ error: "Contract document generator is not configured" }, 501)
  }

  const result = await contractsService.regenerateContractDocument(
    c.get("db"),
    contractId,
    await parseOptionalJsonBody(c, generateContractDocumentInputSchema),
    {
      generator,
      bindings: c.env,
      eventBus: runtime.eventBus,
      lifecycleHooks: runtime.lifecycleHooks,
    },
  )

  if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
  if (result.status === "not_draft") {
    return c.json({ error: "Only draft contracts can be auto-issued for document generation" }, 409)
  }
  if (result.status === "render_unavailable") {
    return c.json({ error: "Contract has no renderable body or template version" }, 409)
  }
  if (result.status === "generator_failed") {
    return c.json({ error: "Contract document generation failed" }, 502)
  }
  if (!("attachment" in result)) {
    return c.json({ error: "Contract document generation failed" }, 502)
  }

  return c.json({ data: await attachDownloadEnvelope(c.env, runtime, result) })
}

async function generateContractDocumentForBooking(c: Context<Env>, options: ContractsRouteOptions) {
  const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
  const generator = runtime.documentGenerator
  if (!generator) {
    return c.json({ error: "Contract document generator is not configured" }, 501)
  }

  const input =
    (await parseOptionalJsonBody(c, generateContractForBookingInputSchema)) ??
    generateContractForBookingInputSchema.parse({})
  const bookingId = c.req.param("bookingId")
  if (!bookingId) {
    return c.json({ error: "Booking id is required" }, 400)
  }

  const result = await generateContractForBookingFromDefaults(
    c.get("db"),
    bookingId,
    input,
    {
      generator,
      bindings: c.env,
      eventBus: runtime.eventBus,
      lifecycleHooks: runtime.lifecycleHooks,
    },
    c.get("userId") ?? null,
  )

  if (result.status === "template_not_found") {
    return c.json({ error: "Default contract template not found" }, 404)
  }
  if (result.status === "template_version_missing") {
    return c.json({ error: "Default contract template has no current version" }, 409)
  }
  if (result.status === "series_not_found") {
    return c.json({ error: "Active contract number series not found" }, 404)
  }
  if (result.status === "series_ambiguous") {
    return c.json({ error: "Multiple active contract number series match this scope" }, 409)
  }
  if (result.status === "booking_not_found") return c.json({ error: "Booking not found" }, 404)
  if (result.status === "contract_create_failed") {
    return c.json({ error: "Contract could not be created" }, 500)
  }
  if (result.status === "document_failed") {
    return c.json({ error: "Contract document generation failed", reason: result.reason }, 502)
  }

  const [contract, attachment] = await Promise.all([
    contractsService.getContractById(c.get("db"), result.contractId),
    contractsService.getAttachmentById(c.get("db"), result.attachmentId),
  ])

  if (!contract || !attachment) {
    return c.json({ error: "Generated contract document could not be loaded" }, 500)
  }

  return c.json(
    {
      data: await attachDownloadEnvelope(c.env, runtime, { contract, attachment }),
    },
    201,
  )
}

export function createContractsAdminRoutes(options: ContractsRouteOptions = {}) {
  return new Hono<Env>()
    .get("/templates", async (c) => {
      const query = parseQuery(c, contractTemplateListQuerySchema)
      return c.json(await contractsService.listTemplates(c.get("db"), query))
    })
    .get("/templates/default", async (c) => {
      const query = parseQuery(c, contractTemplateDefaultQuerySchema)
      const row = await contractsService.getDefaultTemplate(c.get("db"), query)
      if (!row) return c.json({ error: "Template not found" }, 404)
      return c.json({ data: row })
    })
    .post("/templates", async (c) => {
      const row = await contractsService.createTemplate(
        c.get("db"),
        await parseJsonBody(c, insertContractTemplateSchema),
      )
      return c.json({ data: row }, 201)
    })
    .get("/templates/:id", async (c) => {
      const row = await contractsService.getTemplateById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Template not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/templates/:id", async (c) => {
      const row = await contractsService.updateTemplate(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateContractTemplateSchema),
      )
      if (!row) return c.json({ error: "Template not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/templates/:id", async (c) => {
      const row = await contractsService.deleteTemplate(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Template not found" }, 404)
      return c.json({ success: true })
    })
    .post("/templates/:id/preview", renderAdminTemplatePreview)
    .post("/templates/:id/render-preview", renderAdminTemplatePreview)
    .get("/templates/:id/versions", async (c) => {
      const rows = await contractsService.listTemplateVersions(c.get("db"), c.req.param("id"))
      return c.json({ data: rows })
    })
    .post("/templates/:id/versions", async (c) => {
      const version = await contractsService.createTemplateVersion(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertContractTemplateVersionSchema),
      )
      if (!version) return c.json({ error: "Template not found" }, 404)
      return c.json({ data: version }, 201)
    })
    .get("/template-versions/:id", async (c) => {
      const row = await contractsService.getTemplateVersionById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Template version not found" }, 404)
      return c.json({ data: row })
    })
    .get("/number-series", async (c) => {
      const query = parseQuery(c, contractNumberSeriesListQuerySchema)
      const rows = await contractsService.listSeries(c.get("db"), query)
      return c.json({ data: rows })
    })
    .post("/number-series", async (c) => {
      const row = await contractsService.createSeries(
        c.get("db"),
        await parseJsonBody(c, insertContractNumberSeriesSchema),
      )
      return c.json({ data: row }, 201)
    })
    .get("/number-series/:id", async (c) => {
      const row = await contractsService.getSeriesById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Series not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/number-series/:id", async (c) => {
      const row = await contractsService.updateSeries(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateContractNumberSeriesSchema),
      )
      if (!row) return c.json({ error: "Series not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/number-series/:id", async (c) => {
      const row = await contractsService.deleteSeries(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Series not found" }, 404)
      return c.json({ success: true })
    })
    .post("/bookings/:bookingId/generate-document", async (c) => {
      return generateContractDocumentForBooking(c, options)
    })
    .get("/", async (c) => {
      const query = parseQuery(c, contractListQuerySchema)
      return c.json(await contractsService.listContracts(c.get("db"), query))
    })
    .post("/", idempotencyKey({ scope: "POST /v1/admin/legal/contracts" }), async (c) => {
      const row = await contractsService.createContract(
        c.get("db"),
        await parseJsonBody(c, insertContractSchema),
      )
      return c.json({ data: row }, 201)
    })
    .get("/:id", async (c) => {
      const row = await contractsService.getContractById(c.get("db"), c.req.param("id"))
      if (!row) return c.json({ error: "Contract not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/:id", async (c) => {
      const row = await contractsService.updateContract(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, updateContractSchema),
      )
      if (!row) return c.json({ error: "Contract not found" }, 404)
      return c.json({ data: row })
    })
    .delete("/:id", async (c) => {
      const result = await contractsService.deleteContract(c.get("db"), c.req.param("id"))
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_draft") {
        return c.json({ error: "Only draft contracts can be deleted" }, 409)
      }
      return c.json({ success: true })
    })
    .post("/:id/issue", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const result = await contractsService.issueContract(c.get("db"), c.req.param("id"), runtime)
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_draft") {
        return c.json({ error: "Only draft contracts can be issued" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/send", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      // Body is optional — older callers POST without one and the
      // service falls back to defaults. The Send-contract dialog POSTs
      // `{ recipientEmail, subject, message }` so the notification
      // subscriber can deliver the operator's customised copy.
      const input = await parseOptionalJsonBody(c, sendContractInputSchema)
      const result = await contractsService.sendContract(
        c.get("db"),
        c.req.param("id"),
        runtime,
        input ?? undefined,
      )
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_issued") {
        return c.json({ error: "Only issued/sent contracts can be sent" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/sign", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const input = await parseJsonBody(c, insertContractSignatureSchema)
      const result = await contractsService.signContract(
        c.get("db"),
        c.req.param("id"),
        input,
        runtime,
      )
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_signable") {
        return c.json({ error: "Contract is not in a signable state" }, 409)
      }
      return c.json({ data: { contract: result.contract, signature: result.signature } })
    })
    .post("/:id/execute", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const result = await contractsService.executeContract(c.get("db"), c.req.param("id"), runtime)
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_signed") {
        return c.json({ error: "Only signed contracts can be executed" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/void", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const result = await contractsService.voidContract(c.get("db"), c.req.param("id"), runtime)
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "already_void") {
        return c.json({ error: "Contract is already void" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/render", async (c) => {
      const input = await parseJsonBody(c, renderTemplateInputSchema)
      const contract = await contractsService.getContractById(c.get("db"), c.req.param("id"))
      if (!contract) return c.json({ error: "Contract not found" }, 404)
      return renderPreviewResponse(c, input)
    })
    .post("/:id/generate-document", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.documentGenerator
      if (!generator) {
        return c.json({ error: "Contract document generator is not configured" }, 501)
      }

      const result = await contractsService.generateContractDocument(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, generateContractDocumentInputSchema),
        {
          generator,
          bindings: c.env,
          eventBus: runtime.eventBus,
          lifecycleHooks: runtime.lifecycleHooks,
        },
      )

      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_draft") {
        return c.json(
          { error: "Only draft contracts can be auto-issued for document generation" },
          409,
        )
      }
      if (result.status === "render_unavailable") {
        return c.json({ error: "Contract has no renderable body or template version" }, 409)
      }
      if (result.status === "generator_failed") {
        return c.json({ error: "Contract document generation failed" }, 502)
      }
      if (!("attachment" in result)) {
        return c.json({ error: "Contract document generation failed" }, 502)
      }

      return c.json({ data: await attachDownloadEnvelope(c.env, runtime, result) }, 201)
    })
    .post("/:id/regenerate-document", async (c) => {
      return regenerateContractDocument(c, options, c.req.param("id"))
    })
    .post("/:id/regenerate-pdf", async (c) => {
      return regenerateContractDocument(c, options, c.req.param("id"))
    })
    .get("/:id/signatures", async (c) => {
      const rows = await contractsService.listSignatures(c.get("db"), c.req.param("id"))
      return c.json({ data: rows })
    })
    .get("/:id/attachments", async (c) => {
      const rows = await contractsService.listAttachments(c.get("db"), c.req.param("id"))
      return c.json({ data: rows })
    })
    .post("/:id/attachments", async (c) => {
      const row = await contractsService.createAttachment(
        c.get("db"),
        c.req.param("id"),
        await parseJsonBody(c, insertContractAttachmentSchema),
      )
      if (!row) return c.json({ error: "Contract not found" }, 404)
      return c.json({ data: row }, 201)
    })
    .post("/:id/attachments/upload", async (c) => {
      return uploadContractAttachment(c, options, c.req.param("id"))
    })
    .post("/:id/attach-document", async (c) => {
      return uploadContractAttachment(c, options, c.req.param("id"))
    })
    .patch("/attachments/:attachmentId", async (c) => {
      const row = await contractsService.updateAttachment(
        c.get("db"),
        c.req.param("attachmentId"),
        await parseJsonBody(c, updateContractAttachmentSchema),
      )
      if (!row) return c.json({ error: "Attachment not found" }, 404)
      return c.json({ data: row })
    })
    .patch("/attachments/:attachmentId/upload", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const storage = runtime.documentStorage
      if (!storage) {
        return c.json({ error: "Contract document storage is not configured" }, 501)
      }

      const existing = await contractsService.getAttachmentById(
        c.get("db"),
        c.req.param("attachmentId"),
      )
      if (!existing) return c.json({ error: "Attachment not found" }, 404)

      const parsed = await parseAttachmentUploadRequest(c)
      if ("error" in parsed) return parsed.error

      const row = await contractsService.updateAttachment(
        c.get("db"),
        c.req.param("attachmentId"),
        await buildUploadedAttachmentInput({
          storage,
          contractId: existing.contractId,
          form: parsed.form,
          file: parsed.file,
        }),
      )
      if (!row) return c.json({ error: "Attachment not found" }, 404)
      if (existing.storageKey && existing.storageKey !== row.storageKey) {
        try {
          await storage.delete(existing.storageKey)
        } catch (error) {
          console.warn(
            `[legal] failed to delete replaced contract attachment object ${existing.storageKey}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }
      return c.json({ data: row })
    })
    .get("/attachments/:attachmentId/download", async (c) => {
      const attachment = await contractsService.getAttachmentById(
        c.get("db"),
        c.req.param("attachmentId"),
      )
      if (!attachment) return c.json({ error: "Attachment not found" }, 404)

      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const download = await resolveStoredDocumentDownload(
        { ...attachment, filename: attachment.name },
        {
          bindings: c.env,
          resolveDocumentDownloadUrl: runtime.resolveDocumentDownloadUrl,
        },
      )
      if (download.status === "resolver_not_configured") {
        return c.json({ error: "Document download resolver is not configured" }, 501)
      }
      if (download.status !== "ready") {
        return c.json({ error: "Attachment file is not available" }, 404)
      }

      return c.redirect(download.download.url, 302)
    })
    .delete("/attachments/:attachmentId", async (c) => {
      const row = await contractsService.deleteAttachment(c.get("db"), c.req.param("attachmentId"))
      if (!row) return c.json({ error: "Attachment not found" }, 404)
      return c.json({ success: true })
    })
}

export const contractsAdminRoutes = createContractsAdminRoutes()

async function attachDownloadEnvelope<
  T extends {
    attachment: { storageKey?: string | null; metadata?: unknown; name?: string | null }
  },
>(bindings: Record<string, unknown>, runtime: ContractsRouteRuntime, result: T) {
  const download = await resolveStoredDocumentDownload(
    { ...result.attachment, filename: result.attachment.name },
    {
      bindings,
      resolveDocumentDownloadUrl: runtime.resolveDocumentDownloadUrl,
    },
  )
  return download.status === "ready" ? { ...result, download: download.download } : result
}

export function createContractsPublicRoutes(options: ContractsRouteOptions = {}) {
  return (
    new Hono<Env>()
      .get("/templates/default", async (c) => {
        const query = parseQuery(c, contractTemplateDefaultQuerySchema)
        const row = await contractsService.getDefaultTemplate(c.get("db"), query)
        if (!row) return c.json({ error: "Template not found" }, 404)
        return c.json({ data: row })
      })
      .post("/templates/:id/preview", renderPublicTemplatePreview)
      .post("/templates/:id/render-preview", renderPublicTemplatePreview)
      /**
       * Slug-based variant — storefronts wire products to a contract
       * template via slug at config time, not id, so they can render the
       * preview in the booking journey before any contract row exists.
       * The dialog at /shop/book/... POSTs here with the draft variables.
       */
      .post("/templates/by-slug/:slug/preview", renderPublicTemplatePreviewBySlug)
      .post("/templates/by-slug/:slug/render-preview", renderPublicTemplatePreviewBySlug)
      .get("/:id", async (c) => {
        const row = await contractsService.getContractById(c.get("db"), c.req.param("id"))
        if (!row) return c.json({ error: "Contract not found" }, 404)
        const { metadata: _metadata, ...publicContract } = row
        return c.json({ data: publicContract })
      })
      .post("/:id/sign", async (c) => {
        const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
        const input = await parseJsonBody(c, insertContractSignatureSchema)
        const result = await contractsService.signContract(
          c.get("db"),
          c.req.param("id"),
          input,
          runtime,
        )
        if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
        if (result.status === "not_signable") {
          return c.json({ error: "Contract is not in a signable state" }, 409)
        }
        return c.json({ data: { signature: result.signature } })
      })
  )
}

export const contractsPublicRoutes = createContractsPublicRoutes()

export type ContractsAdminRoutes = typeof contractsAdminRoutes
export type ContractsPublicRoutes = typeof contractsPublicRoutes
