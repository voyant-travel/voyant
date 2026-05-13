---
"@voyantjs/finance": patch
---

Enrich `invoice.issued` and `invoice.proforma.issued` event payloads with booking contact fields, issue/due dates, and persisted invoice line items so billing adapter default mappers can build complete invoice bodies.
