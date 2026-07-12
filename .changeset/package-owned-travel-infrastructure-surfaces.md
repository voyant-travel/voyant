---
"@voyant-travel/charters": minor
"@voyant-travel/cruises": minor
"@voyant-travel/db": minor
"@voyant-travel/distribution": minor
"@voyant-travel/framework": patch
"@voyant-travel/workflow-runs": minor
---

Move charter/cruise route activation and travel/infrastructure scheduled work
to graph-selected package manifests. Distribution, Cruises, and DB now publish
their scheduled workflow implementations, while Workflow Runs owns generic
schedule dispatch and the Operator supplies only Node runtime dependencies.
