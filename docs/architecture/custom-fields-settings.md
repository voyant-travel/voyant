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

Definition target and field type remain immutable. A key rename is allowed and
atomically delegates to the selected target package, which moves only
`custom_fields[definition.namespace][oldKey]` to the new key. Definition delete
removes values only from that same namespace.

## Namespace and ownership

Every definition persists its owner kind, optional owner identifier, physical
namespace, lifecycle state, and provenance. Its durable identity is
`(target, namespace, key)`, not `(target, key)`.

- Operator Settings creates only `owner_kind = operator` definitions. The
  server assigns the reserved `custom` namespace and Settings provenance; these
  are the only definitions that ordinary Settings CRUD may structurally edit or
  delete.
- App and platform callers use a trusted domain owner context. The caller's
  authenticated installation or platform identity supplies the owner id and
  physical namespace; request bodies do not accept either. App namespaces must
  be platform-assigned `app--…` values, never `$app` aliases or arbitrary input.
- Settings lists active selected-target definitions from every owner and shows
  owner and namespace. App/platform-owned definitions are visible but read-only.
  The list can filter by owner kind. Inactive and deprecated definitions are
  hidden by default; owner-scoped reconciliation can request a lifecycle state
  explicitly.

Entity values use `custom_fields[namespace][key]`. All active definitions enter
the runtime validation and visibility registry, so two owners may use the same
key without collision. Ordinary operator entity routes validate only the
server-reserved `custom` namespace and preserve app/platform namespaces on
partial updates. Trusted app/platform value operations receive owner and
namespace from authenticated runtime context rather than request input.

The namespace-ownership migration intentionally discards existing definition
rows before adding the required ownership columns. Custom fields had no
production adoption at this cutline, so retaining ambiguous rows would add
compatibility semantics with no user data to preserve. There is no backfill,
legacy read path, inferred owner fallback, or transitional column default.

The `custom_field_definitions` table was introduced by immutable Relationships
migrations, but its schema and post-cutline migration source are now owned by
the generic package. Relationships exposes no definition route, registry
adapter, Settings page, or deprecated public export.
