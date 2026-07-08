---
"@voyant-travel/framework": minor
---

Resolve a managed profile's `plugins` list at boot so the standard `operator`
profile can run snapshot-declared plugins source-free (issue #2983).

`@voyant-travel/framework/managed-runtime` now imports each `plugins[]` npm
specifier and invokes its managed-plugin factory (`voyantPlugin` /
`createVoyantPlugin` / `createPlugin` / a `default` factory) with the plugin's
`settings[specifier]` and the deployment env, then registers the result like a
starter's inline `plugins: [...]`. A declared plugin that exposes no managed
entry fails loud at boot instead of being silently dropped. The previous
blanket "snapshot plugins are not yet resolved" boot error is removed.

`importPluginModule` is injectable on `loadManagedProfileRuntime` /
`ManagedProfileRuntimeOptions` so Cloud (or tests) can resolve plugins from a
pre-bundled registry instead of node resolution. `resolveManagedPlugins` and
the managed-plugin factory/context types are exported from
`@voyant-travel/framework/managed-runtime`.
