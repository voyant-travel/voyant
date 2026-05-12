import type { EventBus, ModuleContainer } from "@voyantjs/core"
import { parseJsonBody, parseOptionalJsonBody, parseQuery } from "@voyantjs/hono"
import type { StorageProvider } from "@voyantjs/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"

import {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
  type ContractsRouteRuntime,
} from "./route-runtime.js"
import { contractsService } from "./service.js"
import {
  contractListQuerySchema,
  contractTemplateDefaultQuerySchema,
  contractTemplateListQuerySchema,
  generateContractDocumentInputSchema,
  insertContractAttachmentSchema,
  insertContractNumberSeriesSchema,
  insertContractSchema,
  insertContractSignatureSchema,
  insertContractTemplateSchema,
  insertContractTemplateVersionSchema,
  publicRenderTemplatePreviewInputSchema,
  renderTemplateInputSchema,
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

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return metadata as Record<string, unknown>
}

function maybeUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null
}

function getFallbackDownloadUrl(metadata: unknown) {
  const record = getMetadataRecord(metadata)
  if (!record) {
    return null
  }

  return maybeUrl(record.url)
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
    .post("/templates/:id/preview", async (c) => {
      const input = await parseJsonBody(c, renderTemplateInputSchema)
      const template = await contractsService.getTemplateById(c.get("db"), c.req.param("id"))
      if (!template) return c.json({ error: "Template not found" }, 404)
      const body = input.body ?? template.body
      const rendered = contractsService.renderPreview({ ...input, body })
      return c.json({ data: { rendered } })
    })
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
      const rows = await contractsService.listSeries(c.get("db"))
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
    .get("/", async (c) => {
      const query = parseQuery(c, contractListQuerySchema)
      return c.json(await contractsService.listContracts(c.get("db"), query))
    })
    .post("/", async (c) => {
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
      const result = await contractsService.issueContract(c.get("db"), c.req.param("id"))
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_draft") {
        return c.json({ error: "Only draft contracts can be issued" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/send", async (c) => {
      const result = await contractsService.sendContract(c.get("db"), c.req.param("id"))
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_issued") {
        return c.json({ error: "Only issued/sent contracts can be sent" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/sign", async (c) => {
      const input = await parseJsonBody(c, insertContractSignatureSchema)
      const result = await contractsService.signContract(c.get("db"), c.req.param("id"), input)
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_signable") {
        return c.json({ error: "Contract is not in a signable state" }, 409)
      }
      return c.json({ data: { contract: result.contract, signature: result.signature } })
    })
    .post("/:id/execute", async (c) => {
      const result = await contractsService.executeContract(c.get("db"), c.req.param("id"))
      if (result.status === "not_found") return c.json({ error: "Contract not found" }, 404)
      if (result.status === "not_signed") {
        return c.json({ error: "Only signed contracts can be executed" }, 409)
      }
      return c.json({ data: result.contract })
    })
    .post("/:id/void", async (c) => {
      const result = await contractsService.voidContract(c.get("db"), c.req.param("id"))
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
      const rendered = contractsService.renderPreview(input)
      return c.json({ data: { rendered } })
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
        { generator, bindings: c.env, eventBus: runtime.eventBus },
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

      return c.json({ data: result }, 201)
    })
    .post("/:id/regenerate-document", async (c) => {
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const generator = runtime.documentGenerator
      if (!generator) {
        return c.json({ error: "Contract document generator is not configured" }, 501)
      }

      const result = await contractsService.regenerateContractDocument(
        c.get("db"),
        c.req.param("id"),
        await parseOptionalJsonBody(c, generateContractDocumentInputSchema),
        { generator, bindings: c.env, eventBus: runtime.eventBus },
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

      return c.json({ data: result })
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
      const runtime = getRuntime(options, c.env, (key) => c.var.container?.resolve(key))
      const storage = runtime.documentStorage
      if (!storage) {
        return c.json({ error: "Contract document storage is not configured" }, 501)
      }

      const parsed = await parseAttachmentUploadRequest(c)
      if ("error" in parsed) return parsed.error

      const row = await contractsService.createAttachment(
        c.get("db"),
        c.req.param("id"),
        await buildUploadedAttachmentInput({
          storage,
          contractId: c.req.param("id"),
          form: parsed.form,
          file: parsed.file,
        }),
      )
      if (!row) return c.json({ error: "Contract not found" }, 404)
      return c.json({ data: row }, 201)
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

      let location: string | null = null
      if (attachment.storageKey) {
        if (!options.resolveDocumentDownloadUrl) {
          return c.json({ error: "Document download resolver is not configured" }, 501)
        }
        location = await options.resolveDocumentDownloadUrl(c.env, attachment.storageKey)
      }

      location ??= getFallbackDownloadUrl(attachment.metadata)
      if (!location) {
        return c.json({ error: "Attachment file is not available" }, 404)
      }

      return c.redirect(location, 302)
    })
    .delete("/attachments/:attachmentId", async (c) => {
      const row = await contractsService.deleteAttachment(c.get("db"), c.req.param("attachmentId"))
      if (!row) return c.json({ error: "Attachment not found" }, 404)
      return c.json({ success: true })
    })
}

export const contractsAdminRoutes = createContractsAdminRoutes()

export function createContractsPublicRoutes() {
  return (
    new Hono<Env>()
      .get("/templates/default", async (c) => {
        const query = parseQuery(c, contractTemplateDefaultQuerySchema)
        const row = await contractsService.getDefaultTemplate(c.get("db"), query)
        if (!row) return c.json({ error: "Template not found" }, 404)
        return c.json({ data: row })
      })
      .post("/templates/:id/preview", async (c) => {
        const input = await parseJsonBody(c, publicRenderTemplatePreviewInputSchema)
        const template = await contractsService.getTemplateById(c.get("db"), c.req.param("id"))
        if (!template?.active) return c.json({ error: "Template not found" }, 404)
        const rendered = contractsService.renderPreview({
          variables: input.variables,
          body: template.body,
        })
        return c.json({ data: { rendered } })
      })
      /**
       * Slug-based variant — storefronts wire products to a contract
       * template via slug at config time, not id, so they can render the
       * preview in the booking journey before any contract row exists.
       * The dialog at /shop/book/... POSTs here with the draft variables.
       */
      .post("/templates/by-slug/:slug/preview", async (c) => {
        const input = await parseJsonBody(c, publicRenderTemplatePreviewInputSchema)
        const template = await contractsService.findTemplateBySlug(c.get("db"), c.req.param("slug"))
        if (!template?.active) return c.json({ error: "Template not found" }, 404)
        const rendered = contractsService.renderPreview({
          variables: input.variables,
          body: template.body,
        })
        return c.json({
          data: {
            template: {
              id: template.id,
              slug: template.slug,
              name: template.name,
              language: template.language,
              scope: template.scope,
            },
            rendered,
          },
        })
      })
      .get("/:id", async (c) => {
        const row = await contractsService.getContractById(c.get("db"), c.req.param("id"))
        if (!row) return c.json({ error: "Contract not found" }, 404)
        const { metadata: _metadata, ...publicContract } = row
        return c.json({ data: publicContract })
      })
      .post("/:id/sign", async (c) => {
        const input = await parseJsonBody(c, insertContractSignatureSchema)
        const result = await contractsService.signContract(c.get("db"), c.req.param("id"), input)
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
