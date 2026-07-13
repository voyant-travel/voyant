---
"@voyant-travel/framework": patch
"@voyant-travel/runtime": minor
"@voyant-travel/distribution": patch
"@voyant-travel/webhook-delivery": patch
---

Move the complete graph-native Node application host into runtime,
including generated graph admission, local and managed auth, API/admin serving,
workflow services and schedules, outbound delivery, links, and runtime ports.
Move the generic Postgres webhook enqueue boundary out of Distribution and into
the neutral webhook-delivery package.
