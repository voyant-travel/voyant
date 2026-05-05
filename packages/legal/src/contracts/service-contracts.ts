import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  contractAttachments,
  contractSignatures,
  contracts,
  contractTemplateVersions,
} from "./schema.js"
import {
  allocateContractNumber,
  type ContractListQuery,
  type CreateContractAttachmentInput,
  type CreateContractInput,
  type CreateContractSignatureInput,
  paginate,
  renderTemplate,
  toTimestamp,
  type UpdateContractAttachmentInput,
  type UpdateContractInput,
} from "./service-shared.js"

export const contractRecordsService = {
  async listContracts(db: PostgresJsDatabase, query: ContractListQuery) {
    const conditions = []
    if (query.scope) conditions.push(eq(contracts.scope, query.scope))
    if (query.status) conditions.push(eq(contracts.status, query.status))
    if (query.personId) conditions.push(eq(contracts.personId, query.personId))
    if (query.organizationId) conditions.push(eq(contracts.organizationId, query.organizationId))
    if (query.supplierId) conditions.push(eq(contracts.supplierId, query.supplierId))
    if (query.bookingId) conditions.push(eq(contracts.bookingId, query.bookingId))
    if (query.orderId) conditions.push(eq(contracts.orderId, query.orderId))
    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(contracts.title, term), ilike(contracts.contractNumber, term)))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(contracts)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(contracts.createdAt)),
      db.select({ total: sql<number>`count(*)::int` }).from(contracts).where(where),
      query.limit,
      query.offset,
    )
  },
  async getContractById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1)
    return row ?? null
  },
  async createContract(db: PostgresJsDatabase, data: CreateContractInput) {
    const [row] = await db
      .insert(contracts)
      .values({ ...data, expiresAt: toTimestamp(data.expiresAt) })
      .returning()
    return row ?? null
  },
  async updateContract(db: PostgresJsDatabase, id: string, data: UpdateContractInput) {
    const [row] = await db
      .update(contracts)
      .set({
        ...data,
        expiresAt: data.expiresAt === undefined ? undefined : toTimestamp(data.expiresAt),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, id))
      .returning()
    return row ?? null
  },
  async deleteContract(db: PostgresJsDatabase, id: string) {
    const [existing] = await db
      .select({ id: contracts.id, status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, id))
      .limit(1)
    if (!existing) return { status: "not_found" as const }
    if (existing.status !== "draft") return { status: "not_draft" as const }
    await db.delete(contracts).where(eq(contracts.id, id))
    return { status: "deleted" as const }
  },
  async issueContract(db: PostgresJsDatabase, contractId: string) {
    return db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      if (contract.status !== "draft") return { status: "not_draft" as const }
      let renderedBody = contract.renderedBody
      let renderedBodyFormat = contract.renderedBodyFormat
      if (contract.templateVersionId) {
        const [version] = await tx
          .select()
          .from(contractTemplateVersions)
          .where(eq(contractTemplateVersions.id, contract.templateVersionId))
          .limit(1)
        if (version) {
          const vars = (contract.variables as Record<string, unknown>) ?? {}
          renderedBody = renderTemplate(version.body, "html", vars)
          renderedBodyFormat = "html"
        }
      }
      let contractNumber = contract.contractNumber
      if (!contractNumber && contract.seriesId) {
        const allocated = await allocateContractNumber(tx as PostgresJsDatabase, contract.seriesId)
        if (allocated) contractNumber = allocated.number
      }
      const [updated] = await tx
        .update(contracts)
        .set({
          status: "issued",
          issuedAt: new Date(),
          renderedBody,
          renderedBodyFormat,
          contractNumber,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contractId))
        .returning()
      return { status: "issued" as const, contract: updated ?? null }
    })
  },
  async sendContract(db: PostgresJsDatabase, contractId: string) {
    const [contract] = await db
      .select({ id: contracts.id, status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)
    if (!contract) return { status: "not_found" as const }
    if (contract.status !== "issued" && contract.status !== "sent")
      return { status: "not_issued" as const }
    const [updated] = await db
      .update(contracts)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contractId))
      .returning()
    return { status: "sent" as const, contract: updated ?? null }
  },
  async voidContract(db: PostgresJsDatabase, contractId: string) {
    const [contract] = await db
      .select({ id: contracts.id, status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)
    if (!contract) return { status: "not_found" as const }
    if (contract.status === "void") return { status: "already_void" as const }
    const [updated] = await db
      .update(contracts)
      .set({ status: "void", voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contractId))
      .returning()
    return { status: "voided" as const, contract: updated ?? null }
  },
  listSignatures(db: PostgresJsDatabase, contractId: string) {
    return db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, contractId))
      .orderBy(desc(contractSignatures.signedAt))
  },
  async signContract(
    db: PostgresJsDatabase,
    contractId: string,
    data: CreateContractSignatureInput,
  ) {
    return db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      if (contract.status !== "issued" && contract.status !== "sent")
        return { status: "not_signable" as const }
      const [signature] = await tx
        .insert(contractSignatures)
        .values({ ...data, contractId })
        .returning()
      const [updated] = await tx
        .update(contracts)
        .set({ status: "signed", updatedAt: new Date() })
        .where(eq(contracts.id, contractId))
        .returning()
      return { status: "signed" as const, contract: updated ?? null, signature: signature ?? null }
    })
  },
  async executeContract(db: PostgresJsDatabase, contractId: string) {
    const [contract] = await db
      .select({ id: contracts.id, status: contracts.status })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)
    if (!contract) return { status: "not_found" as const }
    if (contract.status !== "signed") return { status: "not_signed" as const }
    const [updated] = await db
      .update(contracts)
      .set({ status: "executed", executedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, contractId))
      .returning()
    return { status: "executed" as const, contract: updated ?? null }
  },
  listAttachments(db: PostgresJsDatabase, contractId: string) {
    return db
      .select()
      .from(contractAttachments)
      .where(eq(contractAttachments.contractId, contractId))
      .orderBy(desc(contractAttachments.createdAt))
  },
  async getAttachmentById(db: PostgresJsDatabase, attachmentId: string) {
    const [row] = await db
      .select()
      .from(contractAttachments)
      .where(eq(contractAttachments.id, attachmentId))
      .limit(1)
    return row ?? null
  },
  async createAttachment(
    db: PostgresJsDatabase,
    contractId: string,
    data: CreateContractAttachmentInput,
  ) {
    const [contract] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1)
    if (!contract) return null
    const [row] = await db
      .insert(contractAttachments)
      .values({ ...data, contractId })
      .returning()
    return row ?? null
  },
  async updateAttachment(
    db: PostgresJsDatabase,
    attachmentId: string,
    data: UpdateContractAttachmentInput,
  ) {
    const [row] = await db
      .update(contractAttachments)
      .set(data)
      .where(eq(contractAttachments.id, attachmentId))
      .returning()
    return row ?? null
  },
  async deleteAttachment(db: PostgresJsDatabase, attachmentId: string) {
    const [row] = await db
      .delete(contractAttachments)
      .where(eq(contractAttachments.id, attachmentId))
      .returning({ id: contractAttachments.id })
    return row ?? null
  },
}
