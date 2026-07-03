---
"@voyant-travel/suppliers-contracts": patch
"@voyant-travel/distribution": patch
"@voyant-travel/distribution-react": patch
---

Reject reversed supplier rate and contract ranges. Rate date and pax bounds must be ordered, contract end dates must not precede start dates, and renewal dates must stay within bounded contract terms.

Supplier UI forms now block those invalid ranges and persisted invalid rate rows are flagged in the rate table.
