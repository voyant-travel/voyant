import type { BookingLifecycleConformanceScenarioV1 } from "./lifecycle-conformance.js"

const baseSession = {
  id: "bsess_conformance",
  revision: 3,
  expectedRevision: 3,
  state: "active" as const,
}

const baseQuote = {
  id: "bquo_conformance",
  sessionId: "bsess_conformance",
  sessionRevision: 3,
  state: "fresh" as const,
}

const ownedPolicy = {
  id: "owned-default",
  kind: "owned_atomic_commit" as const,
  inventoryAuthority: "owned" as const,
  paymentGuarantee: "required_before_commit" as const,
  allowBookingBeforeSupplierSecured: false,
  operatorBackedRiskAccepted: false,
}

const sourcedSupplierFirstPolicy = {
  id: "sourced-default",
  kind: "sourced_supplier_first" as const,
  inventoryAuthority: "sourced" as const,
  paymentGuarantee: "required_before_commit" as const,
  allowBookingBeforeSupplierSecured: false,
  operatorBackedRiskAccepted: false,
}

const operatorBackedPolicy = {
  id: "operator-backed",
  kind: "operator_backed_supplier_first" as const,
  inventoryAuthority: "sourced" as const,
  paymentGuarantee: "pay_later_authorized" as const,
  allowBookingBeforeSupplierSecured: true,
  operatorBackedRiskAccepted: true,
}

const liveHold = {
  required: true,
  id: "hold_conformance",
  sessionId: "bsess_conformance",
  state: "live" as const,
}

const noSupplier = {
  state: "not_applicable" as const,
  intentPersistedBeforeDispatch: false,
}

export const BOOKING_LIFECYCLE_CONFORMANCE_V1_REQUIRED_SCENARIO_IDS = [
  "owned-atomic-commit",
  "payment-guarantee-required",
  "session-revision-mismatch",
  "quote-revision-mismatch",
  "quote-expired",
  "hold-expired",
  "sourced-supplier-first-pending",
  "sourced-supplier-in-doubt",
  "sourced-supplier-secured",
  "operator-backed-risk-accepted",
  "accepted-proposal-version-fresh-quote",
  "proposal-material-change-renewed-acceptance",
  "idempotent-replay",
] as const

export const bookingLifecycleConformanceScenariosV1 = [
  {
    id: "owned-atomic-commit",
    title: "Owned inventory commits atomically",
    decision:
      "Commit validates the exact Session revision, fresh Quote, live Hold, and required guarantee, then creates Booking, converts Hold to Allocation, and consumes Session/Quote in one transaction.",
    input: {
      scenarioId: "owned-atomic-commit",
      idempotencyKey: "idem_owned_commit",
      policy: ownedPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "committed" as const,
      nextAction: "none" as const,
      effects: {
        bookingCreated: true,
        allocationCreated: true,
        holdConverted: true,
        sessionConsumed: true,
        quoteConsumed: true,
        paymentGuaranteeEstablished: true,
        transactionBoundary: "single" as const,
      },
    },
  },
  {
    id: "payment-guarantee-required",
    title: "Payment guarantee is a precondition when policy requires it",
    decision:
      "Commit returns payment_required and creates no Booking when a required guarantee is missing.",
    input: {
      scenarioId: "payment-guarantee-required",
      idempotencyKey: "idem_payment_required",
      policy: ownedPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: liveHold,
      paymentGuarantee: "missing" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "payment_required" as const,
      nextAction: "establish_payment_guarantee" as const,
      effects: { bookingCreated: false, transactionBoundary: "none" as const },
    },
  },
  {
    id: "session-revision-mismatch",
    title: "Commit rejects stale Session revisions",
    decision: "Commit must validate the caller's exact Booking Session revision.",
    input: {
      scenarioId: "session-revision-mismatch",
      idempotencyKey: "idem_session_revision",
      policy: ownedPolicy,
      session: { ...baseSession, expectedRevision: 2 },
      quote: baseQuote,
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "revision_mismatch" as const,
      nextAction: "refresh_session_state" as const,
      effects: { bookingCreated: false, transactionBoundary: "none" as const },
    },
  },
  {
    id: "quote-revision-mismatch",
    title: "Commit rejects Quotes bound to another revision",
    decision: "Quote is immutable and bound to one exact Booking Session revision.",
    input: {
      scenarioId: "quote-revision-mismatch",
      idempotencyKey: "idem_quote_revision",
      policy: ownedPolicy,
      session: baseSession,
      quote: { ...baseQuote, sessionRevision: 2 },
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "quote_failure" as const,
      nextAction: "request_fresh_quote" as const,
      effects: { bookingCreated: false, transactionBoundary: "none" as const },
    },
  },
  {
    id: "quote-expired",
    title: "Commit rejects expired Quotes",
    decision: "Expired pricing cannot authorize a durable Booking.",
    input: {
      scenarioId: "quote-expired",
      idempotencyKey: "idem_quote_expired",
      policy: ownedPolicy,
      session: baseSession,
      quote: { ...baseQuote, state: "expired" as const },
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "quote_failure" as const,
      nextAction: "request_fresh_quote" as const,
      effects: { bookingCreated: false, transactionBoundary: "none" as const },
    },
  },
  {
    id: "hold-expired",
    title: "Commit rejects non-live Holds",
    decision: "A required Hold must be live and must belong to the exact Booking Session.",
    input: {
      scenarioId: "hold-expired",
      idempotencyKey: "idem_hold_expired",
      policy: ownedPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: { ...liveHold, state: "expired" as const },
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
    },
    expected: {
      outcomeKind: "hold_failure" as const,
      nextAction: "request_new_hold" as const,
      effects: { bookingCreated: false, transactionBoundary: "none" as const },
    },
  },
  {
    id: "sourced-supplier-first-pending",
    title: "Sourced inventory persists supplier intent before dispatch",
    decision:
      "Supplier-first Commit persists Commit/Supplier Operation intent before dispatch and creates no Booking while supplier security is pending.",
    input: {
      scenarioId: "sourced-supplier-first-pending",
      idempotencyKey: "idem_supplier_pending",
      policy: sourcedSupplierFirstPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: { required: false, state: "not_required" as const },
      paymentGuarantee: "established" as const,
      supplier: {
        state: "pending" as const,
        operationId: "sop_pending",
        intentPersistedBeforeDispatch: true,
      },
    },
    expected: {
      outcomeKind: "supplier_pending" as const,
      nextAction: "await_supplier_operation" as const,
      effects: {
        bookingCreated: false,
        supplierOperationPersisted: true,
        supplierDispatched: true,
      },
    },
  },
  {
    id: "sourced-supplier-in-doubt",
    title: "Ambiguous supplier outcomes require reconciliation",
    decision:
      "Supplier ambiguity is represented as supplier_in_doubt with a reconciliation action, not a draft or payment-like Booking status.",
    input: {
      scenarioId: "sourced-supplier-in-doubt",
      idempotencyKey: "idem_supplier_doubt",
      policy: sourcedSupplierFirstPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: { required: false, state: "not_required" as const },
      paymentGuarantee: "established" as const,
      supplier: {
        state: "in_doubt" as const,
        operationId: "sop_doubt",
        intentPersistedBeforeDispatch: true,
      },
    },
    expected: {
      outcomeKind: "supplier_in_doubt" as const,
      nextAction: "reconcile_supplier_operation" as const,
      effects: {
        bookingCreated: false,
        supplierOperationPersisted: true,
        supplierDispatched: true,
      },
    },
  },
  {
    id: "sourced-supplier-secured",
    title: "Supplier security authorizes sourced Booking creation",
    decision: "Default sourced inventory creates Booking only after the supplier is secured.",
    input: {
      scenarioId: "sourced-supplier-secured",
      idempotencyKey: "idem_supplier_secured",
      policy: sourcedSupplierFirstPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: { required: false, state: "not_required" as const },
      paymentGuarantee: "established" as const,
      supplier: {
        state: "secured" as const,
        operationId: "sop_secured",
        intentPersistedBeforeDispatch: true,
      },
    },
    expected: {
      outcomeKind: "committed" as const,
      nextAction: "none" as const,
      effects: {
        bookingCreated: true,
        supplierOperationPersisted: true,
        supplierDispatched: true,
        sessionConsumed: true,
        quoteConsumed: true,
      },
    },
  },
  {
    id: "operator-backed-risk-accepted",
    title: "Explicit operator-backed policy may create Booking before supplier security",
    decision:
      "Early sourced Booking creation is allowed only under an explicit operator-backed policy where the operator assumes fulfillment risk.",
    input: {
      scenarioId: "operator-backed-risk-accepted",
      idempotencyKey: "idem_operator_backed",
      policy: operatorBackedPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: { required: false, state: "not_required" as const },
      paymentGuarantee: "post_commit_authorized" as const,
      supplier: {
        state: "pending" as const,
        operationId: "sop_operator_backed",
        intentPersistedBeforeDispatch: true,
      },
    },
    expected: {
      outcomeKind: "supplier_pending" as const,
      nextAction: "await_supplier_operation" as const,
      effects: {
        bookingCreated: true,
        bookingCreatedBeforeSupplierSecured: true,
        supplierOperationPersisted: true,
        supplierDispatched: true,
      },
    },
  },
  {
    id: "accepted-proposal-version-fresh-quote",
    title: "Accepted Proposal Version seeds a Session, then needs fresh Quote and availability",
    decision:
      "Proposal Version acceptance records customer intent; Booking creation still requires fresh Booking Session pricing and availability.",
    input: {
      scenarioId: "accepted-proposal-version-fresh-quote",
      idempotencyKey: "idem_proposal_fresh_quote",
      policy: ownedPolicy,
      session: baseSession,
      quote: { ...baseQuote, state: "expired" as const },
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
      proposalAcceptance: {
        proposalVersionId: "prvr_conformance",
        acceptedVersionRevision: 1,
        currentVersionRevision: 1,
        materialTermsChanged: false,
        freshQuoteRequired: true,
      },
    },
    expected: {
      outcomeKind: "quote_failure" as const,
      nextAction: "request_fresh_quote" as const,
      effects: { bookingCreated: false },
    },
  },
  {
    id: "proposal-material-change-renewed-acceptance",
    title: "Material Proposal Version changes require renewed acceptance",
    decision:
      "Accepted Proposal Version handoff cannot commit materially changed terms without a renewed acceptance.",
    input: {
      scenarioId: "proposal-material-change-renewed-acceptance",
      idempotencyKey: "idem_proposal_renew_acceptance",
      policy: ownedPolicy,
      session: baseSession,
      quote: baseQuote,
      hold: liveHold,
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
      proposalAcceptance: {
        proposalVersionId: "prvr_conformance",
        acceptedVersionRevision: 1,
        currentVersionRevision: 2,
        materialTermsChanged: true,
        freshQuoteRequired: true,
      },
    },
    expected: {
      outcomeKind: "proposal_acceptance_required" as const,
      nextAction: "renew_proposal_version_acceptance" as const,
      effects: { bookingCreated: false },
    },
  },
  {
    id: "idempotent-replay",
    title: "Idempotent replay returns the original result",
    decision:
      "Repeating Commit with the same idempotency key returns the canonical prior outcome and creates no second Booking or supplier operation.",
    input: {
      scenarioId: "idempotent-replay",
      idempotencyKey: "idem_replay_commit",
      policy: ownedPolicy,
      session: { ...baseSession, state: "consumed" as const },
      quote: baseQuote,
      hold: { ...liveHold, state: "converted" as const },
      paymentGuarantee: "established" as const,
      supplier: noSupplier,
      replayOfCommitId: "commit_conformance",
    },
    expected: {
      outcomeKind: "idempotent_replay" as const,
      nextAction: "return_idempotent_result" as const,
      effects: {
        bookingCreated: false,
        allocationCreated: false,
        holdConverted: false,
        sessionConsumed: false,
        quoteConsumed: false,
        transactionBoundary: "none" as const,
      },
    },
  },
] satisfies BookingLifecycleConformanceScenarioV1[]
