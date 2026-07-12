# Profile Compatibility Retirement

The resolved deployment graph is the sole selection and Node boot authority.
Default generators must not emit a managed-profile JSON file, runtime entries
must not carry a profile snapshot field, and starter readers must not require a
snapshot artifact or environment override.

Snapshot-era contracts remain only for external callers that have not yet
migrated:

- `@voyant-travel/framework/profile` validates the legacy serialized contract.
- `@voyant-travel/framework/managed-jobs` derives legacy provisioning data.
- `@voyant-travel/framework/managed-runtime` aliases the graph-native Node
  runtime for old imports.
- `@voyant-travel/framework/managed-profile-compatibility` contains the legacy
  profile-to-graph conversion API.
- `@voyant-travel/admin-host/managed-profile-compatibility` contains the old
  admin host names.

These subpaths are deprecated. New framework code, generated artifacts,
starters, and generic hosts must use graph, deployment, scheduled-job, and admin
host vocabulary. Historical architecture documents may retain the old terms
when describing the superseded design.
