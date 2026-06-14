---
"@voyantjs/commerce": patch
---

Remove Sellability's legacy construct-offer route, service method, validation
schemas, and public `service-construct-offer` export. Commerce now keeps
sellability focused on commercial resolution and persisted decision snapshots;
Quote, Trip Composer, and Booking flows own downstream materialization.
