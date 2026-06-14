import {
  type ActionLedgerCapabilityDefinition,
  createActionLedgerCapabilityRegistry,
} from "@voyant-travel/action-ledger"

export const BOOKING_PII_READ_CAPABILITY = {
  id: "bookings-pii:read",
  version: "v1",
  resource: "booking_traveler",
  action: "read",
  risk: "high",
  ledgerPolicy: "required",
  approvalPolicy: "none",
  reversible: false,
  allowedActorTypes: ["staff", "system"],
  requiredGrants: [{ resource: "bookings-pii", action: "read" }],
} as const satisfies ActionLedgerCapabilityDefinition

export const BOOKING_STATUS_CAPABILITIES = {
  confirm: {
    id: "bookings:status:confirm",
    version: "v1",
    resource: "booking",
    action: "confirm",
    risk: "medium",
    ledgerPolicy: "required",
    approvalPolicy: "none",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
  expire: {
    id: "bookings:status:expire",
    version: "v1",
    resource: "booking",
    action: "expire",
    risk: "medium",
    ledgerPolicy: "required",
    approvalPolicy: "none",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
  cancel: {
    id: "bookings:status:cancel",
    version: "v1",
    resource: "booking",
    action: "cancel",
    risk: "high",
    ledgerPolicy: "required",
    approvalPolicy: "conditional",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
  start: {
    id: "bookings:status:start",
    version: "v1",
    resource: "booking",
    action: "start",
    risk: "medium",
    ledgerPolicy: "required",
    approvalPolicy: "none",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
  complete: {
    id: "bookings:status:complete",
    version: "v1",
    resource: "booking",
    action: "complete",
    risk: "medium",
    ledgerPolicy: "required",
    approvalPolicy: "none",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
  override: {
    id: "bookings:status:override",
    version: "v1",
    resource: "booking",
    action: "override_status",
    risk: "high",
    ledgerPolicy: "required",
    approvalPolicy: "conditional",
    reversible: false,
    allowedActorTypes: ["staff", "system"],
    requiredGrants: [{ resource: "bookings", action: "write" }],
  },
} as const satisfies Record<string, ActionLedgerCapabilityDefinition>

export const BOOKING_ACTION_LEDGER_CAPABILITIES = [
  BOOKING_PII_READ_CAPABILITY,
  ...Object.values(BOOKING_STATUS_CAPABILITIES),
] as const

export const bookingActionLedgerCapabilityRegistry = createActionLedgerCapabilityRegistry(
  BOOKING_ACTION_LEDGER_CAPABILITIES,
)
