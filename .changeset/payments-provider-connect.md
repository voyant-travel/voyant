---
"@voyant-travel/payments": minor
"@voyant-travel/operator-settings": minor
"@voyant-travel/operator-settings-react": minor
"@voyant-travel/i18n": minor
"@voyant-travel/schema-kit": minor
"@voyant-travel/framework": minor
---

Add a Settings → Payments surface where operators browse first-party payment
processors and connect one (single active provider per org). Introduces the
payment provider catalog + credential-field schema + registry port and a remote
adapter transport in `@voyant-travel/payments`, a `payment_provider_config`
table, service, and `/v1/admin/settings/payments/*` routes in
`@voyant-travel/operator-settings`, the Payments settings page in
`@voyant-travel/operator-settings-react`, the `managed` payments provider value
in the framework deployment graph, and en/ro catalog strings. Self-host
deployments configure their processor via environment variables (read-only in
the UI); managed connect brokering lands in a follow-up.
