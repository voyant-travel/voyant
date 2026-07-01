---
"@voyant-travel/legal-contracts": patch
"@voyant-travel/legal": patch
---

Fix legal policy PATCH schemas so omitted fields do not receive create defaults, and return a 409 conflict when deleting policies with recorded acceptances.
