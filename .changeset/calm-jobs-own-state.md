---
"@voyant-travel/bookings": patch
"@voyant-travel/catalog": patch
"@voyant-travel/commerce": patch
"@voyant-travel/cruises": patch
"@voyant-travel/notifications": patch
---

Migrate package-owned scheduled product operations from workflow registrations to payload-free jobs selected through the deployment graph. The jobs retain durable authority in their owning domains and resolve execution dependencies through package runtime ports.
