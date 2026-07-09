---
"@voyant-travel/framework": minor
"@voyant-travel/admin": minor
---

Expose the managed profile's active module set at runtime so the source-free
admin can gate its composition by the deployment's module subset (voyant#3063).

The managed runtime already honors a profile's `modules: [...]` subset for the
API (`createVoyantApp({ exclude })`), but the shared, framework-version-tagged
admin image composed *every* `create<Module>AdminExtension()` factory
unconditionally — so every managed operator saw the full nav even when its
profile activated a subset, with nav entries linking to pages whose API isn't
mounted (dead links / 404s).

`@voyant-travel/framework`:

- Add `resolveActiveModuleIds(project)` (`/profile`) — the resolved module `include`
  set (the same one that drives `createVoyantApp({ exclude })`) as `moduleId`s.
- `GET /auth/bootstrap-status` now returns `modules` on `ManagedBootstrapStatus`,
  so the workspace bootstrap probe learns what's active for this deployment.

`@voyant-travel/admin`:

- `AdminBootstrapStatus` carries an optional `modules` module-id list the
  source-free admin filters its nav/widget composition by (fail-open when
  absent).
