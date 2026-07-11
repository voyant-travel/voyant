---
"@voyant-travel/core": major
"@voyant-travel/workflows": major
---

Remove the legacy core application manifest API so applications use
`@voyant-travel/framework` `defineConfig` exclusively. Rename standalone
workflow runtime configuration to `defineWorkflowConfig` and
`VoyantWorkflowConfig`.
