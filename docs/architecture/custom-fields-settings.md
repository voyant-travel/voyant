# Generic custom-field Settings ownership

`@voyant-travel/custom-fields` owns persisted definition access, definition
contracts, the canonical `/v1/admin/custom-fields` API, its OpenAPI document,
and the selected Settings extension. Entity packages retain ownership of their
rows and values, but declare each supported target, allowed field types, and
capabilities in their package manifest. The deployment graph lowers those
declarations into a read-only target registry; Settings and the API reject a
target or type absent from that registry.

Custom fields owns the `custom-fields` access resource and corresponding
`custom-fields:*` scopes. It does not share the operator-settings `settings`
resource. Target capabilities are also server-enforced: definitions can enable
search, export, or invoice visibility only when the selected target declares
that capability; unsupported flags are stored as `false`.

Definition target, field type, and key are immutable in this slice. Changing a
key requires the future namespaced-value migration rather than risking an
orphaned JSON key.

The `custom_field_definitions` table was introduced by immutable Relationships
migrations, but its schema and post-cutline migration source are now owned by
the generic package. Relationships exposes no definition route, registry
adapter, Settings page, or deprecated public export. Namespaces and namespaced
values are intentionally outside this slice.
