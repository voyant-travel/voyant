// agent-quality: file-size exception -- owner: legal; existing service module stays co-located until a dedicated split preserves behavior and tests.
import type { EventBus } from "@voyant-travel/core"
import type { StorageProvider, StorageUploadBody } from "@voyant-travel/storage"
import { renderPdfDocument } from "@voyant-travel/utils/pdf-renderer"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  type ContractLifecycleEvent,
  type ContractLifecycleHook,
  emitContractLifecycleEvent,
} from "./lifecycle.js"
import { contractAttachments, contracts, contractTemplateVersions } from "./schema.js"
import { contractRecordsService } from "./service-contracts.js"
import type { CreateContractAttachmentInput } from "./service-shared.js"
import {
  allocateContractNumber,
  isContractTemplateSyntaxError,
  mergeContractNumberIntoVariables,
  renderTemplate,
} from "./service-shared.js"
import type { GenerateContractDocumentInput } from "./validation.js"

type ContractGenerationFailureStatus = "render_unavailable" | "generator_failed"

const GENERATION_METADATA_KEYS = [
  "lastGenerationStatus",
  "lastGenerationError",
  "lastGenerationAttemptedAt",
] as const

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
  lifecycleHooks?: readonly ContractLifecycleHook[]
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
  | { status: "not_draft" }
  | {
      status: "render_unavailable"
      contract: typeof contracts.$inferSelect
      templateVersion: typeof contractTemplateVersions.$inferSelect | null
      error: string
    }
  | {
      status: "ready"
      contract: typeof contracts.$inferSelect
      templateVersion: typeof contractTemplateVersions.$inferSelect | null
      renderedBody: string
      renderedBodyFormat: "markdown" | "html" | "lexical_json"
      lifecycleEvent?: ContractLifecycleEvent | null
    }

type ContractDocumentGeneratorFailedResult = {
  status: "generator_failed"
  contract: typeof contracts.$inferSelect
  error: string | null
}

type ContractDocumentAttemptResult =
  | {
      status: "not_found" | "not_draft"
    }
  | {
      status: "render_unavailable"
      contract: typeof contracts.$inferSelect
      error: string | null
    }
  | ContractDocumentGeneratorFailedResult
  | ({
      status: "generated"
      lifecycleEvent?: ContractLifecycleEvent | null
    } & GeneratedContractDocumentRecord)

type ContractDocumentPublicResult =
  | { status: "not_found" | "not_draft" | "render_unavailable" | "generator_failed" }
  | ({ status: "generated" } & GeneratedContractDocumentRecord)

type ContractDocumentRollbackResult =
  | ContractDocumentGeneratorFailedResult
  | {
      status: "render_unavailable"
      contract: typeof contracts.$inferSelect
      error: string | null
    }

class RollbackDraftDocumentGeneration extends Error {
  readonly result: ContractDocumentRollbackResult

  constructor(result: ContractDocumentRollbackResult) {
    super("Rolling back failed draft contract document generation")
    this.result = result
  }
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

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function formatTemplateSyntaxError(error: unknown) {
  if (isContractTemplateSyntaxError(error) && error.issues.length > 0) {
    return error.issues.map((issue) => issue.message).join("; ")
  }

  return error instanceof Error ? error.message : "Contract template could not be rendered"
}

async function recordGenerationFailure(
  db: PostgresJsDatabase,
  contract: typeof contracts.$inferSelect,
  status: ContractGenerationFailureStatus,
  error: string | null,
) {
  await db
    .update(contracts)
    .set({
      metadata: {
        ...normalizeMetadata(contract.metadata),
        lastGenerationStatus: status,
        lastGenerationError: error,
        lastGenerationAttemptedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contract.id))
}

async function clearGenerationFailure(
  db: PostgresJsDatabase,
  contract: typeof contracts.$inferSelect,
) {
  const metadata = normalizeMetadata(contract.metadata)
  for (const key of GENERATION_METADATA_KEYS) {
    delete metadata[key]
  }

  await db
    .update(contracts)
    .set({
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contract.id))
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
  options: { forceRerender?: boolean } = {},
): Promise<EnsureRenderedContractResult> {
  let contract = await contractRecordsService.getContractById(db, contractId)
  let lifecycleEvent: ContractLifecycleEvent | null = null
  if (!contract) {
    return { status: "not_found" as const }
  }

  if (contract.status === "draft" && issueIfDraft) {
    let issued: Awaited<ReturnType<typeof contractRecordsService.issueContract>>
    try {
      issued = await contractRecordsService.issueContract(db, contractId)
    } catch (error) {
      if (isContractTemplateSyntaxError(error)) {
        return {
          status: "render_unavailable" as const,
          contract,
          templateVersion: null,
          error: formatTemplateSyntaxError(error),
        }
      }
      throw error
    }
    if (issued.status !== "issued" || !issued.contract) {
      if (issued.status === "not_found") {
        return { status: "not_found" }
      }
      return { status: "not_draft" }
    }
    contract = issued.contract
    lifecycleEvent = issued.event ?? null
  }

  if (contract.status !== "draft" && !contract.contractNumber && contract.seriesId) {
    const allocated = await allocateContractNumber(db, contract.seriesId)
    if (allocated) {
      const baseVariables = (contract.variables as Record<string, unknown> | null) ?? {}
      const variables = mergeContractNumberIntoVariables(baseVariables, allocated.number)
      const [updated] = await db
        .update(contracts)
        .set({
          contractNumber: allocated.number,
          variables,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contractId))
        .returning()
      contract = updated ?? contract
    }
  }

  const templateVersion = await loadTemplateVersion(db, contract.templateVersionId ?? null)
  let renderedBody = contract.renderedBody
  let renderedBodyFormat = contract.renderedBodyFormat

  // Regenerate flows pass `forceRerender: true` so we don't reuse a
  // cached body that was rendered before the series number was
  // allocated (issue #1335). Without this, contracts issued before the
  // allocate-before-render fix would keep regenerating PDFs from the
  // stale body that still has the missing-value placeholder for
  // `{{ contract.number }}`.
  const needsRender = options.forceRerender || !renderedBody || !renderedBodyFormat

  if (needsRender && templateVersion) {
    const baseVariables = (contract.variables as Record<string, unknown> | null) ?? {}
    // Issue #1335: when re-rendering an already-issued contract (e.g. a
    // regenerate request), make sure the allocated contract number is
    // visible to the template as `{{ contract.number }}` /
    // `{{ contract.contractNumber }}`.
    const variables = contract.contractNumber
      ? mergeContractNumberIntoVariables(baseVariables, contract.contractNumber)
      : baseVariables
    try {
      renderedBody = renderTemplate(templateVersion.body, "html", variables)
    } catch (error) {
      if (isContractTemplateSyntaxError(error)) {
        return {
          status: "render_unavailable" as const,
          contract,
          templateVersion,
          error: formatTemplateSyntaxError(error),
        }
      }
      throw error
    }
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
    return {
      status: "render_unavailable" as const,
      contract,
      templateVersion,
      error: "Contract has no rendered body available for document generation",
    }
  }

  return {
    status: "ready" as const,
    contract,
    templateVersion,
    renderedBody,
    renderedBodyFormat,
    lifecycleEvent,
  }
}

function toPublicResult(result: ContractDocumentAttemptResult): ContractDocumentPublicResult {
  if (result.status !== "generated") {
    return { status: result.status }
  }

  const { lifecycleEvent: _lifecycleEvent, ...publicResult } = result
  return publicResult
}

async function emitGenerationEvents(
  runtime: ContractDocumentRuntimeOptions,
  result: ContractDocumentAttemptResult,
  options: { regenerated?: boolean },
) {
  if (result.status !== "generated") return

  if (result.lifecycleEvent) {
    await emitContractLifecycleEvent(runtime, result.lifecycleEvent)
  }

  await runtime.eventBus?.emit(
    "contract.document.generated",
    {
      contractId: result.contractId,
      contractStatus: result.contractStatus,
      attachmentId: result.attachment.id,
      attachmentKind: result.attachment.kind,
      attachmentName: result.attachment.name,
      renderedBodyFormat: result.renderedBodyFormat,
      regenerated: options.regenerated ?? false,
    } satisfies ContractDocumentGeneratedEvent,
    {
      category: "internal",
      source: "service",
    },
  )
}

async function generateContractDocumentAttempt(
  db: PostgresJsDatabase,
  contractId: string,
  input: GenerateContractDocumentInput,
  runtime: ContractDocumentRuntimeOptions,
  options: { regenerated?: boolean; forceRerender?: boolean } = {},
): Promise<ContractDocumentAttemptResult> {
  const prepared = await ensureRenderedContract(db, contractId, input.issueIfDraft, {
    forceRerender: options.forceRerender,
  })

  if (prepared.status === "not_found") {
    return { status: "not_found" }
  }
  if (prepared.status === "not_draft") {
    return { status: "not_draft" }
  }
  if (prepared.status === "render_unavailable") {
    console.error(
      `[legal] contract document render unavailable for contract ${contractId}: ${prepared.error}`,
    )
    await recordGenerationFailure(db, prepared.contract, "render_unavailable", prepared.error)
    return {
      status: "render_unavailable",
      contract: prepared.contract,
      error: prepared.error,
    }
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
    const error = err instanceof Error ? err.message : String(err)
    await recordGenerationFailure(db, prepared.contract, "generator_failed", error)
    return { status: "generator_failed", contract: prepared.contract, error }
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
    const error = "Contract document attachment could not be created"
    await recordGenerationFailure(db, prepared.contract, "generator_failed", error)
    return { status: "generator_failed", contract: prepared.contract, error }
  }

  await clearGenerationFailure(db, prepared.contract)

  return {
    status: "generated",
    contractId: prepared.contract.id,
    contractStatus: prepared.contract.status,
    renderedBodyFormat: prepared.renderedBodyFormat,
    renderedBody: prepared.renderedBody,
    attachment,
    lifecycleEvent: prepared.lifecycleEvent,
  }
}

export const contractDocumentsService = {
  async generateContractDocument(
    db: PostgresJsDatabase,
    contractId: string,
    input: GenerateContractDocumentInput,
    runtime: ContractDocumentRuntimeOptions,
    options: { regenerated?: boolean; forceRerender?: boolean } = {},
  ): Promise<
    | { status: "not_found" | "not_draft" | "render_unavailable" | "generator_failed" }
    | ({ status: "generated" } & GeneratedContractDocumentRecord)
  > {
    const existing = input.issueIfDraft
      ? await contractRecordsService.getContractById(db, contractId)
      : null
    const rollbackDraftIssue = existing?.status === "draft"

    try {
      const result = rollbackDraftIssue
        ? await db.transaction(async (tx) => {
            const attempt = await generateContractDocumentAttempt(
              tx as PostgresJsDatabase,
              contractId,
              input,
              runtime,
              options,
            )
            if (attempt.status === "generator_failed" || attempt.status === "render_unavailable") {
              throw new RollbackDraftDocumentGeneration(attempt)
            }
            return attempt
          })
        : await generateContractDocumentAttempt(db, contractId, input, runtime, options)

      await emitGenerationEvents(runtime, result, options)
      return toPublicResult(result)
    } catch (error) {
      if (error instanceof RollbackDraftDocumentGeneration) {
        const current = await contractRecordsService.getContractById(db, contractId)
        if (current) {
          await recordGenerationFailure(db, current, error.result.status, error.result.error)
        }
        return toPublicResult(error.result)
      }
      throw error
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
      // Force a fresh render so older contracts whose cached body was
      // produced before the series-number allocation (issue #1335)
      // get re-rendered against the current `contract.variables` /
      // `contract.contractNumber` instead of reusing the stale body.
      { regenerated: true, forceRerender: true },
    )
  },
}
