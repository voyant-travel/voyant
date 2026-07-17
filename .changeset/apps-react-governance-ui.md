---
"@voyant-travel/apps-react": minor
"@voyant-travel/apps": minor
"@voyant-travel/operator-standard": patch
---

Add the app governance and developer admin UI (RFC Phase 2, "App Governance
UI"). Introduces `@voyant-travel/apps-react`, a `*-react` package following the
`custom-fields-react` conventions (query-options, provider, admin page
registration, i18n): an Installed Apps list + detail surface (status, granted /
optional / revoked scopes, contributed extensions, webhook subscription health,
recent audit activity, active release + available/blocked updates with
human-readable blocked reasons), pause / resume / uninstall (values-retained)
and a separated privileged purge preview; an OAuth consent screen that renders
required + individually-deniable optional grants and completes activation; and a
permission-gated custom-app developer surface (create registration, validate and
create releases, view/rotate credentials shown once, restricted install link,
activate an ingested release). Registers a top-level "Apps" navigation module in
the operator admin gated on the `apps` access resource. Extends the
`@voyant-travel/apps` admin API with installation read-model and lifecycle
routes backing the UI.
