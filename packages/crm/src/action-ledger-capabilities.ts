import type { ActionLedgerCapabilityDefinition } from "@voyantjs/action-ledger"

export const PERSON_DOCUMENT_REVEAL_CAPABILITY = {
  id: "crm-pii:read:person-document",
  version: "v1",
  resource: "person_document",
  action: "read",
  risk: "high",
  ledgerPolicy: "required",
  approvalPolicy: "none",
  reversible: false,
  allowedActorTypes: ["staff", "system"],
  requiredGrants: [{ resource: "crm-pii", action: "read" }],
} as const satisfies ActionLedgerCapabilityDefinition

export const PERSON_DOCUMENT_REVEAL_ACTION_NAME = "crm.person_document.reveal"
export const PERSON_DOCUMENT_REVEAL_ACTION_VERSION = "v1"
export const PERSON_DOCUMENT_REVEAL_AUTHORIZATION_SOURCE = "scope" as const
export const PERSON_DOCUMENT_REVEAL_DECISION_POLICY = "scope_grant" as const
