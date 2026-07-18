import type {
  BindInvoiceRenditionInput,
  CreateInvoiceAttachmentInput,
  CreateInvoiceRenditionInput,
  CreateInvoiceTemplateInput,
  FinanceServiceRuntime,
  InvoiceRenderedEvent,
  InvoiceTemplateListQuery,
  PostgresJsDatabase,
  RenderInvoiceInput,
  UpdateInvoiceAttachmentInput,
  UpdateInvoiceRenditionInput,
  UpdateInvoiceTemplateInput,
} from "./service-shared.js"
import {
  and,
  desc,
  eq,
  ilike,
  invoiceAttachments,
  invoiceRenditions,
  invoices,
  invoiceTemplates,
  ne,
  or,
  paginate,
  sql,
  toTimestamp,
} from "./service-shared.js"

export const financeInvoiceArtifactService = {
  async listInvoiceTemplates(db: PostgresJsDatabase, query: InvoiceTemplateListQuery) {
    const conditions = []
    if (query.language) conditions.push(eq(invoiceTemplates.language, query.language))
    if (query.jurisdiction) conditions.push(eq(invoiceTemplates.jurisdiction, query.jurisdiction))
    if (typeof query.active === "boolean")
      conditions.push(eq(invoiceTemplates.active, query.active))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(invoiceTemplates.name, term), ilike(invoiceTemplates.slug, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(invoiceTemplates)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(invoiceTemplates.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(invoiceTemplates).where(where),
      query.limit,
      query.offset,
    )
  },

  async getInvoiceTemplateById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceTemplate(db: PostgresJsDatabase, data: CreateInvoiceTemplateInput) {
    const [row] = await db
      .insert(invoiceTemplates)
      .values({
        name: data.name,
        slug: data.slug,
        language: data.language,
        jurisdiction: data.jurisdiction ?? null,
        bodyFormat: data.bodyFormat,
        body: data.body,
        cssStyles: data.cssStyles ?? null,
        isDefault: data.isDefault,
        active: data.active,
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceTemplate(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceTemplateInput,
  ) {
    const [row] = await db
      .update(invoiceTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoiceTemplates.id, id))
      .returning()
    return row ?? null
  },

  async deleteInvoiceTemplate(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceTemplates)
      .where(eq(invoiceTemplates.id, id))
      .returning({ id: invoiceTemplates.id })
    return row ?? null
  },

  // ============================================================================
  // Invoice renditions
  // ============================================================================

  async listInvoiceRenditions(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.invoiceId, invoiceId))
      .orderBy(desc(invoiceRenditions.createdAt))
  },

  async getInvoiceRenditionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceRenditions)
      .where(eq(invoiceRenditions.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceRendition(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceRenditionInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!invoice) return null

    const [row] = await db
      .insert(invoiceRenditions)
      .values({
        invoiceId,
        templateId: data.templateId ?? null,
        format: data.format,
        status: data.status,
        storageKey: data.storageKey ?? null,
        fileSize: data.fileSize ?? null,
        checksum: data.checksum ?? null,
        language: data.language ?? null,
        errorMessage: data.errorMessage ?? null,
        generatedAt: toTimestamp(data.generatedAt),
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceRendition(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateInvoiceRenditionInput,
  ) {
    const { generatedAt, ...rest } = data
    const [row] = await db
      .update(invoiceRenditions)
      .set({
        ...rest,
        ...(generatedAt !== undefined ? { generatedAt: toTimestamp(generatedAt) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(invoiceRenditions.id, id))
      .returning()
    return row ?? null
  },

  async bindInvoiceRendition(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: BindInvoiceRenditionInput,
    runtime: FinanceServiceRuntime = {},
  ) {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
          invoiceType: invoices.invoiceType,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)

      if (!invoice) return { status: "not_found" as const }

      if (data.replaceExisting) {
        await tx
          .update(invoiceRenditions)
          .set({ status: "stale", updatedAt: new Date() })
          .where(
            and(
              eq(invoiceRenditions.invoiceId, invoiceId),
              eq(invoiceRenditions.format, data.format),
              ne(invoiceRenditions.status, "stale"),
            ),
          )
      }

      const [rendition] = await tx
        .insert(invoiceRenditions)
        .values({
          invoiceId,
          templateId: data.templateId ?? null,
          format: data.format,
          status: "ready",
          storageKey: data.storageKey?.trim() || null,
          fileSize: data.fileSize ?? null,
          checksum: data.checksum ?? null,
          language: data.language ?? null,
          generatedAt: toTimestamp(data.generatedAt),
          appProvider: data.appProvider ?? null,
          appIdempotencyDigest: data.appIdempotencyDigest ?? null,
          appFileName: data.appFileName ?? null,
          metadata: {
            ...(data.metadata ?? {}),
            contentType: data.contentType,
          },
        })
        .returning()

      if (!rendition) return { status: "not_found" as const }

      return { status: "bound" as const, invoice, rendition }
    })

    if (result.status !== "bound") {
      return result
    }

    await runtime.eventBus?.emit(
      "invoice.rendered",
      {
        invoiceId: result.invoice.id,
        invoiceStatus: result.invoice.status,
        invoiceType: result.invoice.invoiceType,
        renditionId: result.rendition.id,
        format: result.rendition.format,
        storageKey: result.rendition.storageKey,
        contentType: data.contentType,
        byteSize: result.rendition.fileSize,
        contentHash: result.rendition.checksum,
      } satisfies InvoiceRenderedEvent,
      {
        category: "internal",
        source: "service",
      },
    )

    return result
  },

  async deleteInvoiceRendition(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(invoiceRenditions)
      .where(eq(invoiceRenditions.id, id))
      .returning({ id: invoiceRenditions.id })
    return row ?? null
  },

  // ============================================================================
  // Invoice attachments
  // ============================================================================

  async listInvoiceAttachments(db: PostgresJsDatabase, invoiceId: string) {
    return db
      .select()
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.invoiceId, invoiceId))
      .orderBy(desc(invoiceAttachments.createdAt))
  },

  async getInvoiceAttachmentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(invoiceAttachments)
      .where(eq(invoiceAttachments.id, id))
      .limit(1)
    return row ?? null
  },

  async createInvoiceAttachment(
    db: PostgresJsDatabase,
    invoiceId: string,
    data: CreateInvoiceAttachmentInput,
  ) {
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
    if (!invoice) return null

    const [row] = await db
      .insert(invoiceAttachments)
      .values({
        invoiceId,
        kind: data.kind,
        name: data.name,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        storageKey: data.storageKey ?? null,
        checksum: data.checksum ?? null,
        metadata: data.metadata ?? null,
      })
      .returning()
    return row ?? null
  },

  async updateInvoiceAttachment(
    db: PostgresJsDatabase,
    invoiceId: string,
    id: string,
    data: UpdateInvoiceAttachmentInput,
  ) {
    const [row] = await db
      .update(invoiceAttachments)
      .set(data)
      .where(and(eq(invoiceAttachments.id, id), eq(invoiceAttachments.invoiceId, invoiceId)))
      .returning()
    return row ?? null
  },

  async deleteInvoiceAttachment(db: PostgresJsDatabase, invoiceId: string, id: string) {
    const [row] = await db
      .delete(invoiceAttachments)
      .where(and(eq(invoiceAttachments.id, id), eq(invoiceAttachments.invoiceId, invoiceId)))
      .returning({ id: invoiceAttachments.id })
    return row ?? null
  },

  /**
   * Request an invoice rendition. Creates a `pending` rendition row pointing
   * to a template; the actual rendering (HTML→PDF) is expected to be
   * performed out-of-band by a background job that updates the rendition to
   * `ready` with `storageKey` set.
   */
  async renderInvoice(db: PostgresJsDatabase, invoiceId: string, input: RenderInvoiceInput) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!invoice) return { status: "not_found" as const }

    // Resolve template: explicit input > invoice.templateId > default template
    let templateId = input.templateId ?? invoice.templateId ?? null
    if (!templateId) {
      const [defaultTemplate] = await db
        .select({ id: invoiceTemplates.id })
        .from(invoiceTemplates)
        .where(and(eq(invoiceTemplates.isDefault, true), eq(invoiceTemplates.active, true)))
        .limit(1)
      templateId = defaultTemplate?.id ?? null
    }

    const [row] = await db
      .insert(invoiceRenditions)
      .values({
        invoiceId,
        templateId,
        format: input.format,
        status: "pending",
        language: input.language ?? invoice.language ?? null,
      })
      .returning()

    return { status: "requested" as const, rendition: row ?? null }
  },
}
