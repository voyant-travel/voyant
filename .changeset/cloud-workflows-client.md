---
"@voyantjs/workflows": patch
"@voyantjs/workflow-runs": patch
"@voyantjs/workflows-orchestrator": patch
"@voyantjs/workflows-orchestrator-cloudflare": patch
"@voyantjs/workflows-orchestrator-node": patch
---

Add a client-safe managed Cloud workflows subpath for trigger/event forwarding,
enrich workflow release manifest metadata, and gate tenant-admin workflow
management actions by deployment surface. Release registration stays disabled
by default in managed Cloud app runtimes. Manifests now emit structured
release/runtime capabilities and per-workflow definition capabilities. The
client preserves queued trigger statuses returned by managed Cloud. Zod
workflow schemas are serialized into manifest schema metadata before manifest
identity hashing. Orchestrator manifest fixtures and deserializers now support
the structured manifest capabilities shape.
