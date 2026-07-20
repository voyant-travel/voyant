---
"@voyant-travel/payments": minor
"@voyant-travel/operator-settings": minor
---

Make the managed payment registry injectable via a runtime port (the framework-idiomatic seam). `@voyant-travel/payments` defines `paymentProviderRegistryRuntimePort`; `@voyant-travel/operator-settings` gains a graph-runtime-factory (`createOperatorSettingsVoyantRuntime`) that resolves the optional port and, when a deployment provides it, registers the resolver into the module container at bootstrap. The Settings → Payments routes resolve the registry from the container per request, else the default self-host registry. This supersedes the earlier request-context injection seam (which could not fire in the opaque managed runtime).
