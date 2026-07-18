import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { financeAppApiRuntimePort as importCheapFinanceAppApiRuntimePort } from "./runtime-port.js"

export interface FinanceAppApiIssuanceDocument {
  id: string
  documentType: "invoice" | "proforma"
  number: string
  status: string
  booking: { id: string; number: string | null }
  billing: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    region: string | null
    country: string | null
    vatCode: string | null
    registrationNumber: string | null
  }
  currency: { document: string; base: string | null }
  fx: {
    rateSetId: string | null
    rate: number | null
    effectiveRate: number | null
    source: string | null
    quotedAt: string | null
    validUntil: string | null
    commissionBasisPoints: number | null
    invoiceMention: string | null
  } | null
  totals: { subtotalCents: number; taxCents: number; totalCents: number }
  dates: { issuedOn: string | null; dueOn: string | null }
  language: string | null
  taxRegime: {
    id: string
    code: string
    name: string
    legalReference: string | null
    specialRegime: boolean
    marginSchemeArticle311: boolean
  } | null
  series: { id: string; code: string; name: string; scope: string } | null
  allocation: { required: boolean; pending: boolean; placeholderNumber: string | null }
  lines: readonly {
    id: string
    description: string
    quantity: number
    unitPriceCents: number
    totalCents: number
    tax: { ratePercent: number | null; name: string | null; regimeCode: string | null }
  }[]
}

export interface FinanceAppApiExternalReferenceInput {
  externalId: string | null
  externalNumber: string | null
  externalUrl: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  syncedAt: string | null
  syncError: string | null
}

export interface FinanceAppApiExternalReferenceUpsertInput {
  reference: FinanceAppApiExternalReferenceInput
  allocation?: { invoiceNumber: string }
}

export interface FinanceAppApiExternalReference {
  id: string
  documentId: string
  provider: string
  externalId: string | null
  externalNumber: string | null
  externalUrl: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  syncedAt: string | null
  syncError: string | null
  createdAt: string
  updatedAt: string
}

export type FinanceAppApiReferenceMutationResult =
  | {
      status: "ok"
      reference: FinanceAppApiExternalReference
      referenceOutcome: "created" | "updated" | "unchanged"
      allocationOutcome: "not_requested" | "applied" | "already_applied"
    }
  | { status: "not_found" }
  | { status: "allocation_conflict"; currentNumber: string; currentStatus: string }

export class FinanceAppApiNumberConflictError extends Error {
  constructor(readonly invoiceNumber: string) {
    super(`Finance document number "${invoiceNumber}" is already in use.`)
    this.name = "FinanceAppApiNumberConflictError"
  }
}

export interface FinanceAppApiRuntime {
  getIssuanceDocument(
    db: PostgresJsDatabase,
    documentId: string,
  ): Promise<FinanceAppApiIssuanceDocument | null>
  getExternalReference(
    db: PostgresJsDatabase,
    documentId: string,
    provider: string,
  ): Promise<FinanceAppApiExternalReference | null>
  upsertExternalReference(
    db: PostgresJsDatabase,
    documentId: string,
    provider: string,
    input: FinanceAppApiExternalReferenceUpsertInput,
  ): Promise<FinanceAppApiReferenceMutationResult>
}

/** Typed runtime view of the exact object used by import-cheap manifests. */
export const financeAppApiRuntimePort: {
  readonly id: typeof importCheapFinanceAppApiRuntimePort.id
  readonly test: (provider: FinanceAppApiRuntime) => void
} = importCheapFinanceAppApiRuntimePort
