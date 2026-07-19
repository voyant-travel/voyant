---
"@voyant-travel/operator-settings": minor
---

Add a managed payment registry injection seam. The Settings → Payments routes now resolve their `PaymentProviderRegistry` from a deployment-provided resolver on the request context (`PAYMENT_PROVIDER_REGISTRY_RESOLVER_VAR`), falling back to the default self-host registry. A managed deployment injects a registry that brokers to the payments control plane; the routes keep a single API surface and never learn where the managed registry lives.
