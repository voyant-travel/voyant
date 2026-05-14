---
"@voyantjs/cruises": patch
---

Fix admin cruise route ordering so static subresource endpoints like `/sailings`, `/ships`, and `/prices` are handled before generic cruise-key routes.
