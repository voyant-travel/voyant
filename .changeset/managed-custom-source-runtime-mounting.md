---
"@voyant-travel/framework": patch
---

Mount managed `customSource` modules/extensions at runtime (voyant#3079,
follow-up to #3069).

`framework@0.22.0` derived `customSource.modules` into migration sources, so a
bring-your-own schema-owning module's tables migrated in a managed deployment —
but the managed runtime never wired `customSource`, so those modules' API routes
404'd and their admin extensions never composed.

`loadManagedProfileRuntime` now resolves each `customSource.modules` and
`customSource.extensions` specifier — the analog of `resolveManagedPlugins` for
schema-owning modules — and merges the resulting factories into
`createManagedProfileApp` → `createVoyantApp`'s `modules`/`extensions` channel,
so routes mount and admin extensions compose against the deployment's installed
dependency tree. A declared-but-unresolved `customSource` entry fails loud at
boot, mirroring the existing `plugins` check. New `resolveManagedCustomModules`
/ `resolveManagedCustomExtensions` APIs are exported, with an injectable
`importCustomSourceModule` loader for pre-bundled registries and tests.
