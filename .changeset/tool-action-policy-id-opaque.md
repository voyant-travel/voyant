---
"@voyant-travel/tools": patch
---

Specify the format of `ToolActionPolicyBinding.id`. It is an opaque key of the selected graph action, matched by exact equality against that action's own `id` — it is not an owner-scoped identity, and a manifest consumer must not parse it, require a package prefix on it, or infer an owner from it. Ownership is asserted by `capabilityId` against the Tool's `owner`, which is validated separately. Most first-party actions read `<package>#action.<name>`, but the legacy `booking.*` family does not and is equally valid: the id is persisted verbatim as the action ledger's `action_name` and feeds the approval command fingerprint, so it cannot be renamed after the fact.
