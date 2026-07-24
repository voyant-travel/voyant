---
"@voyant-travel/notifications": major
"@voyant-travel/schema-kit": patch
---

Add the package-owned durable operation required to restore the approved
`send_notification` action: exact command replay, transactional
requested/completed events, leased retries, dead-letter visibility, and
provider-side idempotency plus reconciliation. Notification providers can now
declare the optional `notification-provider-idempotency-v1` capability;
providers without it fail closed for agent sends while retaining their existing
request-scoped behavior. The action remains quarantined until a production
provider can satisfy the new contract.

The agent Tool now targets the existing active notification template for
approval/audit instead of writing the email address or phone number into the
action ledger, and returns an immutable accepted/pending delivery snapshot.
Delivery happens asynchronously; poll `get_notification_delivery` with the
returned id for the mutable sent/failed state.
