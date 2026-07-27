---
"@voyant-travel/tools": patch
"@voyant-travel/mcp": patch
---

Serialize Tool input schemas with `io: "input"`. `z.toJSONSchema` defaults to
the output direction, which cannot resolve a transform's output type and threw
— so 26 of 284 Tools were published with a description-only stub carrying no
parameter names, types or required list.
