import type { Contract as LegalContract } from "./contracts/schema.js"
import type { LegalContractDetail, LegalContractSummary } from "./tools.js"

function iso(value: Date): string {
  return value.toISOString()
}

function nullableIso(value: Date | null): string | null {
  return value ? iso(value) : null
}

export function legalContractSummary(row: LegalContract): LegalContractSummary {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    scope: row.scope,
    status: row.status,
    title: row.title,
    bookingId: row.bookingId,
    personId: row.personId,
    organizationId: row.organizationId,
    supplierId: row.supplierId,
    language: row.language,
    issuedAt: nullableIso(row.issuedAt),
    sentAt: nullableIso(row.sentAt),
    executedAt: nullableIso(row.executedAt),
    expiresAt: nullableIso(row.expiresAt),
    voidedAt: nullableIso(row.voidedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function legalContractDetail(row: LegalContract): LegalContractDetail {
  return {
    ...legalContractSummary(row),
    templateVersionId: row.templateVersionId,
    seriesId: row.seriesId,
    channelId: row.channelId,
    targetKind: row.targetKind,
    targetId: row.targetId,
    targetProvider: row.targetProvider,
    targetSourceRef: row.targetSourceRef,
    renderedBodyFormat: row.renderedBodyFormat,
    renderedBody: row.renderedBody,
    variables: row.variables as LegalContractDetail["variables"],
    metadata: row.metadata as LegalContractDetail["metadata"],
    stageHistory: row.stageHistory,
  }
}
