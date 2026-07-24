---
"@voyant-travel/commerce": major
---

Restore the `create_promotion` Tool with a fingerprinted created-target command, atomic product-scope materialization, and deterministic transactional-outbox delivery.

The response is now an immutable `{ status, promotion: { id }, replayed }` envelope rather than the full mutable offer. See `docs/migrations/created-target-commerce-charters-cruises.md` for caller migration guidance.
