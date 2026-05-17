import { people, personDirectoryView } from "@voyantjs/crm/schema"
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  appendContractStageHistory,
  buildContractLifecycleEvent,
  type ContractLifecycleRuntimeOptions,
  checkContractLifecycleTransition,
  createContractStageHistoryEntry,
  emitContractLifecycleEvent,
} from "./lifecycle.js"
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
    const search = query.search?.trim()
    if (search) {
      const term = `%${search}%`
      conditions.push(
        or(
          ilike(contracts.title, term),
          ilike(contracts.contractNumber, term),
          ilike(people.firstName, term),
          ilike(people.lastName, term),
          sql`${people.firstName} || ' ' || ${people.lastName} ILIKE ${term}`,
          ilike(personDirectoryView.email, term),
          ilike(personDirectoryView.phone, term),
        ),
      )
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select({
          ...getTableColumns(contracts),
          personFirstName: people.firstName,
          personLastName: people.lastName,
          personEmail: personDirectoryView.email,
          personPhone: personDirectoryView.phone,
        })
        .from(contracts)
        .leftJoin(people, eq(contracts.personId, people.id))
        .leftJoin(personDirectoryView, eq(contracts.personId, personDirectoryView.personId))
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(contracts.createdAt)),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(contracts)
        .leftJoin(people, eq(contracts.personId, people.id))
        .leftJoin(personDirectoryView, eq(contracts.personId, personDirectoryView.personId))
        .where(where),
      query.limit,
      query.offset,
    )
  },
  async getContractById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1)
    return row ?? null
  },
  async createContract(db: PostgresJsDatabase, data: CreateContractInput) {
    const now = new Date()
    const stage = data.status ?? "draft"
    const [row] = await db
      .insert(contracts)
      .values({
        ...data,
        stageHistory: [createContractStageHistoryEntry(stage, { enteredAt: now })],
        expiresAt: toTimestamp(data.expiresAt),
      })
      .returning()
    return row ?? null
  },
  async updateContract(db: PostgresJsDatabase, id: string, data: UpdateContractInput) {
    const { status: _status, ...update } = data as UpdateContractInput & {
      status?: never
    }
    const [row] = await db
      .update(contracts)
      .set({
        ...update,
        expiresAt: update.expiresAt === undefined ? undefined : toTimestamp(update.expiresAt),
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
  async issueContract(
    db: PostgresJsDatabase,
    contractId: string,
    runtime?: ContractLifecycleRuntimeOptions,
  ) {
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      const transition = checkContractLifecycleTransition(contract.status, "issued")
      if (!transition.ok) return { status: transition.reason }
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
      const now = new Date()
      const stageHistory = appendContractStageHistory(
        contract.stageHistory,
        createContractStageHistoryEntry("issued", {
          previousStage: contract.status,
          transition: "issued",
          enteredAt: now,
        }),
      )
      const [updated] = await tx
        .update(contracts)
        .set({
          status: "issued",
          stageHistory,
          issuedAt: now,
          renderedBody,
          renderedBodyFormat,
          contractNumber,
          updatedAt: now,
        })
        .where(eq(contracts.id, contractId))
        .returning()
      return {
        status: "issued" as const,
        contract: updated ?? null,
        event:
          updated && buildContractLifecycleEvent(updated, contract.status, "issued", "issued", now),
      }
    })
    if (result.status === "issued" && result.event) {
      await emitContractLifecycleEvent(runtime, result.event)
    }
    return result
  },
  async sendContract(
    db: PostgresJsDatabase,
    contractId: string,
    runtime?: ContractLifecycleRuntimeOptions,
    delivery?: { recipientEmail?: string | null; subject?: string | null; message?: string | null },
  ) {
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      const transition = checkContractLifecycleTransition(contract.status, "sent")
      if (!transition.ok) return { status: transition.reason }
      if (contract.status === "sent") {
        return { status: "sent" as const, contract, event: null }
      }
      const now = new Date()
      const stageHistory = appendContractStageHistory(
        contract.stageHistory,
        createContractStageHistoryEntry("sent", {
          previousStage: contract.status,
          transition: "sent",
          enteredAt: now,
        }),
      )
      const [updated] = await tx
        .update(contracts)
        .set({ status: "sent", stageHistory, sentAt: now, updatedAt: now })
        .where(eq(contracts.id, contractId))
        .returning()
      // Forward the operator's send-dialog customization onto the
      // lifecycle event so the notification subscriber (template
      // wires this up) can deliver the typed-in subject + message
      // instead of falling back to a static contract-sent template.
      const deliveryPayload = delivery
        ? {
            recipientEmail: delivery.recipientEmail ?? null,
            subject: delivery.subject ?? null,
            message: delivery.message ?? null,
          }
        : null
      return {
        status: "sent" as const,
        contract: updated ?? null,
        event:
          updated &&
          buildContractLifecycleEvent(
            updated,
            contract.status,
            "sent",
            "sent",
            now,
            deliveryPayload,
          ),
      }
    })
    if (result.status === "sent" && result.event) {
      await emitContractLifecycleEvent(runtime, result.event)
    }
    return result
  },
  async voidContract(
    db: PostgresJsDatabase,
    contractId: string,
    runtime?: ContractLifecycleRuntimeOptions,
  ) {
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      const transition = checkContractLifecycleTransition(contract.status, "voided")
      if (!transition.ok) return { status: transition.reason }
      const now = new Date()
      const stageHistory = appendContractStageHistory(
        contract.stageHistory,
        createContractStageHistoryEntry("void", {
          previousStage: contract.status,
          transition: "voided",
          enteredAt: now,
        }),
      )
      const [updated] = await tx
        .update(contracts)
        .set({ status: "void", stageHistory, voidedAt: now, updatedAt: now })
        .where(eq(contracts.id, contractId))
        .returning()
      return {
        status: "voided" as const,
        contract: updated ?? null,
        event:
          updated && buildContractLifecycleEvent(updated, contract.status, "void", "voided", now),
      }
    })
    if (result.status === "voided" && result.event) {
      await emitContractLifecycleEvent(runtime, result.event)
    }
    return result
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
    runtime?: ContractLifecycleRuntimeOptions,
  ) {
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      const transition = checkContractLifecycleTransition(contract.status, "signed")
      if (!transition.ok) return { status: "not_signable" as const }
      const [signature] = await tx
        .insert(contractSignatures)
        .values({ ...data, contractId })
        .returning()
      const now = new Date()
      const stageHistory = appendContractStageHistory(
        contract.stageHistory,
        createContractStageHistoryEntry("signed", {
          previousStage: contract.status,
          transition: "signed",
          enteredAt: now,
        }),
      )
      const [updated] = await tx
        .update(contracts)
        .set({ status: "signed", stageHistory, updatedAt: now })
        .where(eq(contracts.id, contractId))
        .returning()
      return {
        status: "signed" as const,
        contract: updated ?? null,
        signature: signature ?? null,
        event:
          updated && buildContractLifecycleEvent(updated, contract.status, "signed", "signed", now),
      }
    })
    if (result.status === "signed" && result.event) {
      await emitContractLifecycleEvent(runtime, result.event)
    }
    return result
  },
  async executeContract(
    db: PostgresJsDatabase,
    contractId: string,
    runtime?: ContractLifecycleRuntimeOptions,
  ) {
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .for("update")
        .limit(1)
      if (!contract) return { status: "not_found" as const }
      const transition = checkContractLifecycleTransition(contract.status, "executed")
      if (!transition.ok) return { status: transition.reason }
      const now = new Date()
      const stageHistory = appendContractStageHistory(
        contract.stageHistory,
        createContractStageHistoryEntry("executed", {
          previousStage: contract.status,
          transition: "executed",
          enteredAt: now,
        }),
      )
      const [updated] = await tx
        .update(contracts)
        .set({ status: "executed", stageHistory, executedAt: now, updatedAt: now })
        .where(eq(contracts.id, contractId))
        .returning()
      return {
        status: "executed" as const,
        contract: updated ?? null,
        event:
          updated &&
          buildContractLifecycleEvent(updated, contract.status, "executed", "executed", now),
      }
    })
    if (result.status === "executed" && result.event) {
      await emitContractLifecycleEvent(runtime, result.event)
    }
    return result
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
