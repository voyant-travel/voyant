import type { Invoice } from "@voyantjs/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SmartbillClientApi } from "../client.js"
import type {
  SmartbillEstimateInvoicesResponse,
  SmartbillInvoiceResponse,
  SmartbillPdfResponse,
  SmartbillStatusResponse,
} from "../types.js"
import type {
  SmartbillCandidateExternalRefRecorder,
  SmartbillCandidateInvoice,
  SmartbillWorkflowCandidateSource,
} from "../workflow-candidates.js"

export type {
  SmartbillCandidateExternalRefRecorder,
  SmartbillCandidateExternalRefRecorderContext,
  SmartbillCandidateInvoice,
  SmartbillWorkflowCandidateSource,
} from "../workflow-candidates.js"

export type SmartbillWorkflowDocumentType = "invoice" | "proforma"

export interface SmartbillWorkflowLogger {
  info?: (message: string, meta?: unknown) => void
  error?: (message: string, meta?: unknown) => void
}

export interface SmartbillWorkflowInvoice {
  id: string
  invoiceNumber: string
  invoiceType: Invoice["invoiceType"]
  status: Invoice["status"]
  currency: string
  totalCents: number
  paidCents: number
  balanceDueCents: number
}

export interface SmartbillWorkflowExternalRef {
  id: string
  invoiceId: string
  provider: string
  externalId: string | null
  externalNumber: string | null
  externalUrl: string | null
  status: string | null
  metadata: unknown
  syncError: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  invoice?: SmartbillWorkflowInvoice | null
}

export interface SmartbillReferenceParts {
  companyVatCode: string
  seriesName: string
  number: string
  documentType: SmartbillWorkflowDocumentType
}

export interface SmartbillProformaConversion {
  proformaRef: SmartbillWorkflowExternalRef
  invoice: SmartbillWorkflowInvoice | null
  companyVatCode: string
  proformaSeriesName: string
  proformaNumber: string
  invoiceSeriesName: string
  invoiceNumber: string
  invoiceUrl: string | null
  response: SmartbillEstimateInvoicesResponse
  smartbillInvoice: SmartbillInvoiceResponse
}

export interface SmartbillProformaConversionPollerOptions {
  db?: PostgresJsDatabase
  client: SmartbillClientApi
  limit?: number
  requestSpacingMs?: number
  companyVatCode?: string
  source?: SmartbillWorkflowCandidateSource
  logger?: SmartbillWorkflowLogger
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
  onConverted: (
    proformaRef: SmartbillWorkflowExternalRef,
    conversion: SmartbillProformaConversion,
  ) => void | Promise<void>
  onError?: (error: SmartbillWorkflowError) => void | Promise<void>
}

export interface SmartbillWorkflowError {
  ref?: SmartbillWorkflowExternalRef
  error: unknown
}

export interface SmartbillProformaConversionPollerResult {
  checked: number
  converted: SmartbillProformaConversion[]
  skipped: Array<{ ref: SmartbillWorkflowExternalRef; reason: string }>
  errors: SmartbillWorkflowError[]
}

export type SmartbillRemoteDocumentStatus =
  | "present"
  | "issued"
  | "paid"
  | "unpaid"
  | "partially_paid"
  | "voided"
  | "cancelled"
  | "reversed"
  | "deleted"
  | "missing"

export interface SmartbillRemoteDocument extends SmartbillReferenceParts {
  status?: SmartbillRemoteDocumentStatus
  metadata?: Record<string, unknown>
  accessors?: SmartbillRemoteDocumentAccessors
}

export interface SmartbillRemoteDocumentAccessors {
  viewPdf: () => Promise<SmartbillPdfResponse>
  getPaymentStatus?: () => Promise<SmartbillStatusResponse>
  listEstimateInvoices?: () => Promise<SmartbillEstimateInvoicesResponse>
}

export type SmartbillDriftFindingType = "missing_local" | "missing_remote" | "voided_remote"

interface SmartbillDriftFindingBase {
  document: SmartbillReferenceParts
  error?: unknown
}

export interface SmartbillMissingLocalDriftFinding extends SmartbillDriftFindingBase {
  type: "missing_local"
  remote: SmartbillRemoteDocument
}

export interface SmartbillKnownLocalDriftFinding extends SmartbillDriftFindingBase {
  type: "missing_remote" | "voided_remote"
  ref?: SmartbillWorkflowExternalRef
  invoice?: SmartbillWorkflowInvoice | null
  remote?: SmartbillRemoteDocument | null
}

export type SmartbillDriftFinding =
  | SmartbillMissingLocalDriftFinding
  | SmartbillKnownLocalDriftFinding

export interface SmartbillDriftReconcilerOptions {
  db?: PostgresJsDatabase
  client: SmartbillClientApi
  limit?: number
  requestSpacingMs?: number
  companyVatCode?: string
  logger?: SmartbillWorkflowLogger
  discoverRemote?: boolean
  source?: SmartbillWorkflowCandidateSource
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
  listRemoteDocuments?: (context: {
    refs: SmartbillWorkflowExternalRef[]
  }) => Promise<SmartbillRemoteDocument[]>
  verifyRemoteDocument?: (context: {
    ref: SmartbillWorkflowExternalRef
    document: SmartbillReferenceParts
  }) => Promise<SmartbillRemoteDocumentStatus | SmartbillRemoteDocument>
  onFinding?: (finding: SmartbillDriftFinding) => void | Promise<void>
  onMissingLocal?: (finding: SmartbillMissingLocalDriftFinding) => void | Promise<void>
  onError?: (error: SmartbillWorkflowError) => void | Promise<void>
}

export interface SmartbillDriftReconcilerResult {
  checked: number
  findings: SmartbillDriftFinding[]
  skipped: Array<{ ref: SmartbillWorkflowExternalRef; reason: string }>
  errors: SmartbillWorkflowError[]
}

export type SmartbillProformaConversionPoller =
  () => Promise<SmartbillProformaConversionPollerResult>

export type SmartbillDriftReconciler = () => Promise<SmartbillDriftReconcilerResult>
