import type { ExternalRef } from "./external-refs/schema.js"
import type { Channel, ChannelReconciliationItem, ChannelWebhookEvent } from "./schema.js"
import type { Supplier } from "./suppliers/schema.js"

export type DistributionCounterpartyRole = "supplier" | "channel"
export type DistributionCounterpartyEntityType = "supplier" | "channel"

export interface DistributionExternalReferenceInput {
  sourceSystem: string
  objectType: string
  externalId: string
  namespace?: string
}

export type DistributionCounterpartyReference =
  | {
      role: DistributionCounterpartyRole
      id: string
      externalRef?: DistributionExternalReferenceInput
    }
  | {
      role?: DistributionCounterpartyRole
      id?: string
      externalRef: DistributionExternalReferenceInput
    }

export type DistributionCounterpartyRecord =
  | {
      role: "supplier"
      entityType: "supplier"
      id: string
      record: Supplier
      externalRef?: ExternalRef | null
    }
  | {
      role: "channel"
      entityType: "channel"
      id: string
      record: Channel
      externalRef?: ExternalRef | null
    }

export type ResolveCounterpartyOutcome =
  | { status: "resolved"; counterparty: DistributionCounterpartyRecord }
  | { status: "not_found"; reason: "counterparty_not_found" | "external_ref_not_found" }
  | { status: "unsupported"; entityType: string }
  | { status: "ambiguous"; reason: "role_required_for_id_lookup" }

export interface LinkExternalReferenceInput {
  counterparty: {
    role: DistributionCounterpartyRole
    id: string
  }
  sourceSystem: string
  objectType: string
  externalId: string
  namespace?: string
  externalParentId?: string | null
  isPrimary?: boolean
  status?: "active" | "inactive" | "archived"
  lastSyncedAt?: string | Date | null
  metadata?: Record<string, unknown> | null
}

export type LinkExternalReferenceOutcome =
  | {
      status: "linked"
      counterparty: DistributionCounterpartyRecord
      externalRef: ExternalRef
      created: boolean
    }
  | Extract<ResolveCounterpartyOutcome, { status: "not_found" | "unsupported" | "ambiguous" }>

export interface RouteCounterpartyEventInput {
  counterparty: DistributionCounterpartyReference
  eventType: string
  externalEventId?: string | null
  payload?: Record<string, unknown>
  receivedAt?: string | Date | null
  status?: "pending" | "processed" | "failed" | "ignored"
}

export type RouteCounterpartyEventOutcome =
  | {
      status: "routed"
      counterparty: DistributionCounterpartyRecord
      destination: "channel_webhook_events"
      event: ChannelWebhookEvent
    }
  | {
      status: "routed"
      counterparty: DistributionCounterpartyRecord
      destination: "supplier_adapter"
      event: null
    }
  | Extract<ResolveCounterpartyOutcome, { status: "not_found" | "unsupported" | "ambiguous" }>

export interface ReconcileCounterpartyActivityInput {
  counterparty?: DistributionCounterpartyReference
  externalRef: DistributionExternalReferenceInput
  createExternalReference?: boolean
  metadata?: Record<string, unknown> | null
  channelReconciliation?: {
    reconciliationRunId: string
    bookingLinkId?: string | null
    bookingId?: string | null
    externalBookingId?: string | null
    issueType?:
      | "missing_booking"
      | "status_mismatch"
      | "amount_mismatch"
      | "cancel_mismatch"
      | "missing_payout"
      | "other"
    severity?: "info" | "warning" | "error"
    resolutionStatus?: "open" | "ignored" | "resolved"
    notes?: string | null
  }
}

export type ReconcileCounterpartyActivityOutcome =
  | {
      status: "matched"
      counterparty: DistributionCounterpartyRecord
      externalRef: ExternalRef
      reconciliationItem?: ChannelReconciliationItem | null
    }
  | {
      status: "linked"
      counterparty: DistributionCounterpartyRecord
      externalRef: ExternalRef
      reconciliationItem?: ChannelReconciliationItem | null
    }
  | {
      status: "unmatched"
      reason: "external_ref_not_found" | "counterparty_required_to_create_link"
    }
  | {
      status: "conflict"
      expected: DistributionCounterpartyRecord
      actual: DistributionCounterpartyRecord
      externalRef: ExternalRef
    }
  | Extract<ResolveCounterpartyOutcome, { status: "not_found" | "unsupported" | "ambiguous" }>
