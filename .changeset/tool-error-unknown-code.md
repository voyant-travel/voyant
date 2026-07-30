---
"@voyant-travel/tools": patch
---

Stop `ToolError` throwing when constructed with an unrecognised code.

The per-code defaults lookup added alongside `retryable`/`nextSteps` assumed the
code was always present in `TOOL_ERROR_DEFAULTS`. An unknown code made the
lookup `undefined`, so the constructor threw a `TypeError` on the failure path
and MCP dispatch normalised it to a generic `PROVIDER_ERROR` — discarding the
domain code the caller needed. Unknown codes now fall back to the terminal
`PROVIDER_ERROR` defaults while keeping the code itself intact.
