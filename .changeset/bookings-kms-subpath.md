---
"@voyant-travel/bookings": patch
---

Import booking PII KMS helpers through the explicit utils KMS subpath so release builds do not depend on the utils root barrel declaration cache.
