---
"@voyantjs/products": minor
"@voyantjs/products-react": minor
"@voyantjs/products-ui": minor
"@voyantjs/catalog": minor
"@voyantjs/ui": minor
"@voyantjs/admin": minor
---

Release the changes accumulated on main since 0.58.0 that landed without
their own changesets.

- **products / products-react / products-ui** — add `inclusionsHtml` and
  `exclusionsHtml` rich-text fields on `ProductRecord` plus the supporting
  product-form + product-detail UI (#994). Consumer test fixtures may need
  `inclusionsHtml: null, exclusionsHtml: null` added.
- **catalog** — widen `CancelResult.status` to include `"pending"` for
  adapters that submit async cancellations (email / partner portal / batch)
  with a `pending_channel` (#991). Downstream consumers using the narrow
  `"cancelled" | "refused" | "failed"` union need to either widen their
  surface or map `"pending"` at the boundary.
- **ui** — drop heavy passthrough re-exports from `@voyantjs/ui/components`
  barrel: `RichTextEditor`, `chart`, `dashboard-widgets`, `phone-input`,
  and all `NotificationTemplate*` / `notification-template-dialog` /
  `notification-{deliveries,reminder-rules,reminder-runs}-page` entries.
  Import these via subpath from `@voyantjs/ui/components/<file>` instead
  (e.g. `@voyantjs/ui/components/rich-text-editor`). Was leaking ~600 KB
  of tiptap/prosemirror, ~390 KB of recharts, and ~200 KB of
  libphonenumber-js into every barrel consumer.
- **admin** — drop `DashboardPage` from the `@voyantjs/admin` barrel for
  the same reason (recharts leakage). Import from
  `@voyantjs/admin/dashboard` instead.
