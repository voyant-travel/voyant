import type { EventBus } from "@voyantjs/core"
import type { StorageProvider, StorageUploadBody } from "@voyantjs/storage"
import { renderPdfDocument } from "@voyantjs/utils/pdf-renderer"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { contractAttachments, contracts, contractTemplateVersions } from "./schema.js"
import { contractRecordsService } from "./service-contracts.js"
import type { CreateContractAttachmentInput } from "./service-shared.js"
import { renderTemplate } from "./service-shared.js"
import type { GenerateContractDocumentInput } from "./validation.js"

export interface GeneratedContractDocumentArtifact {
  kind?: string | null
  name: string
  mimeType?: string | null
  fileSize?: number | null
  storageKey?: string | null
  checksum?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ContractDocumentGeneratorContext {
  db: PostgresJsDatabase
  contract: typeof contracts.$inferSelect
  templateVersion: typeof contractTemplateVersions.$inferSelect | null
  renderedBody: string
  renderedBodyFormat: "markdown" | "html" | "lexical_json"
  variables: Record<string, unknown>
  bindings: Record<string, unknown>
}

export type ContractDocumentGenerator = (
  context: ContractDocumentGeneratorContext,
) => Promise<GeneratedContractDocumentArtifact>

export interface ContractDocumentRuntimeOptions {
  bindings?: Record<string, unknown>
  generator: ContractDocumentGenerator
  eventBus?: EventBus
}

export interface StorageBackedContractDocumentUpload {
  body: StorageUploadBody
  name?: string | null
  mimeType?: string | null
  key?: string | null
  metadata?: Record<string, unknown> | null
  kind?: string | null
}

export type StorageBackedContractDocumentSerializer = (
  context: ContractDocumentGeneratorContext,
) => Promise<StorageBackedContractDocumentUpload> | StorageBackedContractDocumentUpload

export interface StorageBackedContractDocumentGeneratorOptions {
  storage: StorageProvider
  keyPrefix?: string | ((context: ContractDocumentGeneratorContext) => Promise<string> | string)
  serializer?: StorageBackedContractDocumentSerializer
}

export interface GeneratedContractDocumentRecord {
  contractId: string
  contractStatus: (typeof contracts.$inferSelect)["status"]
  renderedBodyFormat: "markdown" | "html" | "lexical_json"
  renderedBody: string
  attachment: typeof contractAttachments.$inferSelect
}

export interface ContractDocumentGeneratedEvent {
  contractId: string
  contractStatus: (typeof contracts.$inferSelect)["status"]
  attachmentId: string
  attachmentKind: string
  attachmentName: string
  renderedBodyFormat: "markdown" | "html" | "lexical_json"
  regenerated: boolean
}

type EnsureRenderedContractResult =
  | { status: "not_found" }
  | { status: "not_draft"; contract: null }
  | {
      status: "render_unavailable"
      contract: typeof contracts.$inferSelect
      templateVersion: typeof contractTemplateVersions.$inferSelect | null
    }
  | {
      status: "ready"
      contract: typeof contracts.$inferSelect
      templateVersion: typeof contractTemplateVersions.$inferSelect | null
      renderedBody: string
      renderedBodyFormat: "markdown" | "html" | "lexical_json"
    }

function normalizeAttachmentInput(
  input: GeneratedContractDocumentArtifact,
  fallbackKind: string,
): CreateContractAttachmentInput {
  return {
    kind: input.kind ?? fallbackKind,
    name: input.name,
    mimeType: input.mimeType ?? null,
    fileSize: input.fileSize ?? null,
    storageKey: input.storageKey ?? null,
    checksum: input.checksum ?? null,
    metadata: input.metadata ?? null,
  }
}

function defaultContractDocumentExtension(
  format: ContractDocumentGeneratorContext["renderedBodyFormat"],
) {
  switch (format) {
    case "html":
      return "html"
    case "lexical_json":
      return "json"
    default:
      return "md"
  }
}

function defaultContractDocumentMimeType(
  format: ContractDocumentGeneratorContext["renderedBodyFormat"],
) {
  switch (format) {
    case "html":
      return "text/html; charset=utf-8"
    case "lexical_json":
      return "application/json; charset=utf-8"
    default:
      return "text/markdown; charset=utf-8"
  }
}

function encodeStringBody(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function getBodySize(body: StorageUploadBody) {
  if (body instanceof Uint8Array) return body.byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  return body.size
}

function toUploadMetadata(metadata: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(metadata ?? {}).filter(([, value]) =>
    ["string", "number", "boolean"].includes(typeof value),
  )

  return entries.length > 0
    ? Object.fromEntries(entries.map(([key, value]) => [key, String(value)]))
    : undefined
}

export function defaultStorageBackedContractDocumentSerializer(
  context: ContractDocumentGeneratorContext,
): StorageBackedContractDocumentUpload {
  const extension = defaultContractDocumentExtension(context.renderedBodyFormat)
  return {
    body: encodeStringBody(context.renderedBody),
    name: `contract-${context.contract.id}.${extension}`,
    mimeType: defaultContractDocumentMimeType(context.renderedBodyFormat),
    metadata: {
      renderedBodyFormat: context.renderedBodyFormat,
    },
  }
}

export async function defaultPdfContractDocumentSerializer(
  context: ContractDocumentGeneratorContext,
): Promise<StorageBackedContractDocumentUpload> {
  const body = await renderPdfDocument({
    title: `Contract ${context.contract.id}`,
    content: context.renderedBody,
    format:
      context.renderedBodyFormat === "lexical_json"
        ? "lexical_json"
        : context.renderedBodyFormat === "html"
          ? "html"
          : "markdown",
    metadataLines: [`Contract ID: ${context.contract.id}`, `Status: ${context.contract.status}`],
  })

  return {
    body,
    name: `contract-${context.contract.id}.pdf`,
    mimeType: "application/pdf",
    metadata: {
      renderedBodyFormat: context.renderedBodyFormat,
      renderer: "voyant-basic-pdf",
    },
  }
}

export function createStorageBackedContractDocumentGenerator(
  options: StorageBackedContractDocumentGeneratorOptions,
): ContractDocumentGenerator {
  const serializer = options.serializer ?? defaultStorageBackedContractDocumentSerializer

  return async (context) => {
    const upload = await serializer(context)
    const keyPrefix =
      typeof options.keyPrefix === "function"
        ? await options.keyPrefix(context)
        : (options.keyPrefix ?? `contracts/${context.contract.id}`)
    const normalizedName =
      upload.name?.trim() ||
      `contract-${context.contract.id}.${defaultContractDocumentExtension(context.renderedBodyFormat)}`
    const normalizedKey = upload.key?.trim() || `${keyPrefix.replace(/\/$/, "")}/${normalizedName}`
    const uploaded = await options.storage.upload(upload.body, {
      key: normalizedKey,
      contentType: upload.mimeType ?? defaultContractDocumentMimeType(context.renderedBodyFormat),
      metadata: toUploadMetadata(upload.metadata),
    })

    return {
      kind: upload.kind ?? "document",
      name: normalizedName,
      mimeType: upload.mimeType ?? defaultContractDocumentMimeType(context.renderedBodyFormat),
      fileSize: getBodySize(upload.body),
      storageKey: uploaded.key,
      metadata: {
        ...(upload.metadata ?? {}),
        storageProvider: options.storage.name,
        ...(uploaded.url ? { url: uploaded.url } : {}),
      },
    }
  }
}

export function createPdfContractDocumentGenerator(
  options: Omit<StorageBackedContractDocumentGeneratorOptions, "serializer">,
): ContractDocumentGenerator {
  return createStorageBackedContractDocumentGenerator({
    ...options,
    serializer: defaultPdfContractDocumentSerializer,
  })
}

async function loadTemplateVersion(
  db: PostgresJsDatabase,
  templateVersionId: string | null,
): Promise<typeof contractTemplateVersions.$inferSelect | null> {
  if (!templateVersionId) {
    return null
  }

  const [version] = await db
    .select()
    .from(contractTemplateVersions)
    .where(eq(contractTemplateVersions.id, templateVersionId))
    .limit(1)

  return version ?? null
}

async function ensureRenderedContract(
  db: PostgresJsDatabase,
  contractId: string,
  issueIfDraft: boolean,
): Promise<EnsureRenderedContractResult> {
  let contract = await contractRecordsService.getContractById(db, contractId)
  if (!contract) {
    return { status: "not_found" as const }
  }

  if (contract.status === "draft" && issueIfDraft) {
    const issued = await contractRecordsService.issueContract(db, contractId)
    if (issued.status !== "issued" || !issued.contract) {
      if (issued.status === "not_found") {
        return { status: "not_found" }
      }
      return { status: "not_draft", contract: null }
    }
    contract = issued.contract
  }

  const templateVersion = await loadTemplateVersion(db, contract.templateVersionId ?? null)
  let renderedBody = contract.renderedBody
  let renderedBodyFormat = contract.renderedBodyFormat

  if ((!renderedBody || !renderedBodyFormat) && templateVersion) {
    const variables = (contract.variables as Record<string, unknown> | null) ?? {}
    renderedBody = renderTemplate(templateVersion.body, "html", variables)
    renderedBodyFormat = "html"

    const [updated] = await db
      .update(contracts)
      .set({
        renderedBody,
        renderedBodyFormat,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId))
      .returning()

    contract = updated ?? contract
  }

  if (!renderedBody || !renderedBodyFormat) {
    return { status: "render_unavailable" as const, contract, templateVersion }
  }

  return {
    status: "ready" as const,
    contract,
    templateVersion,
    renderedBody,
    renderedBodyFormat,
  }
}

export const contractDocumentsService = {
  async generateContractDocument(
    db: PostgresJsDatabase,
    contractId: string,
    input: GenerateContractDocumentInput,
    runtime: ContractDocumentRuntimeOptions,
    options: { regenerated?: boolean } = {},
  ): Promise<
    | { status: "not_found" | "not_draft" | "render_unavailable" | "generator_failed" }
    | ({ status: "generated" } & GeneratedContractDocumentRecord)
  > {
    const prepared = await ensureRenderedContract(db, contractId, input.issueIfDraft)

    if (prepared.status === "not_found") {
      return { status: "not_found" }
    }
    if (prepared.status === "not_draft") {
      return { status: "not_draft" }
    }
    if (prepared.status === "render_unavailable") {
      return { status: "render_unavailable" }
    }

    let artifact: GeneratedContractDocumentArtifact
    try {
      artifact = await runtime.generator({
        db,
        contract: prepared.contract,
        templateVersion: prepared.templateVersion,
        renderedBody: prepared.renderedBody,
        renderedBodyFormat: prepared.renderedBodyFormat,
        variables: (prepared.contract.variables as Record<string, unknown> | null) ?? {},
        bindings: runtime.bindings ?? {},
      })
    } catch (err) {
      // Generator failures (Cloud SDK 5xx, R2 outage, malformed
      // template) are silently fatal at this layer — the caller
      // (subscriber / workflow step) only sees `generator_failed`
      // and can't tell why. Log here so the wrangler dev log /
      // production observability captures the actual cause.
      console.error(
        `[legal] contract document generator failed for contract ${contractId}:`,
        err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : err,
      )
      return { status: "generator_failed" }
    }

    if (input.replaceExisting) {
      const existing = await db
        .select({ id: contractAttachments.id })
        .from(contractAttachments)
        .where(eq(contractAttachments.contractId, contractId))
        .orderBy(desc(contractAttachments.createdAt))

      for (const attachment of existing) {
        const row = await db
          .select({ id: contractAttachments.id, kind: contractAttachments.kind })
          .from(contractAttachments)
          .where(eq(contractAttachments.id, attachment.id))
          .limit(1)
          .then((rows) => rows[0] ?? null)

        if (row?.kind === (artifact.kind ?? input.kind)) {
          await contractRecordsService.deleteAttachment(db, attachment.id)
        }
      }
    }

    const attachment = await contractRecordsService.createAttachment(
      db,
      contractId,
      normalizeAttachmentInput(artifact, input.kind),
    )

    if (!attachment) {
      return { status: "not_found" }
    }

    await runtime.eventBus?.emit(
      "contract.document.generated",
      {
        contractId: prepared.contract.id,
        contractStatus: prepared.contract.status,
        attachmentId: attachment.id,
        attachmentKind: attachment.kind,
        attachmentName: attachment.name,
        renderedBodyFormat: prepared.renderedBodyFormat,
        regenerated: options.regenerated ?? false,
      } satisfies ContractDocumentGeneratedEvent,
      {
        category: "internal",
        source: "service",
      },
    )

    return {
      status: "generated",
      contractId: prepared.contract.id,
      contractStatus: prepared.contract.status,
      renderedBodyFormat: prepared.renderedBodyFormat,
      renderedBody: prepared.renderedBody,
      attachment,
    }
  },

  async regenerateContractDocument(
    db: PostgresJsDatabase,
    contractId: string,
    input: GenerateContractDocumentInput,
    runtime: ContractDocumentRuntimeOptions,
  ) {
    return this.generateContractDocument(
      db,
      contractId,
      {
        ...input,
        issueIfDraft: input.issueIfDraft,
      },
      runtime,
      { regenerated: true },
    )
  },
}
