---
"@voyantjs/availability-react": minor
"@voyantjs/availability-ui": minor
---

Packaged-admin RFC availability index page delivered: the last app-side
availability wrapper moves into `@voyantjs/availability-ui/admin` as the
`AvailabilityIndexHost`, unblocked by new client hooks in
`@voyantjs/availability-react` for the module's existing batch endpoints.
New hooks: `useAvailabilityRuleBatchMutation`,
`useAvailabilityStartTimeBatchMutation`, `useAvailabilitySlotBatchMutation`,
`useAvailabilityCloseoutBatchMutation` and
`useAvailabilityPickupPointBatchMutation` — each a typed
`{ batchUpdate, batchDelete }` pair posting the whole id selection to
`POST /v1/availability/<entity>/batch-update|batch-delete` and resolving the
server's success/partial-failure envelope (`{ total, succeeded, failed }`
plus updated rows / `deletedIds`), validated by the new
`batchUpdateEnvelope`/`batchDeleteEnvelope` schemas. Closeouts and pickup
points also gain single-record mutation hooks
(`useAvailabilityCloseoutMutation`, `useAvailabilityPickupPointMutation`)
with their create/update input types re-exported, so neither entity is
query-only anymore. `AvailabilityIndexHost` wires the packaged
`AvailabilityPage`'s bulk update/delete handlers to those batch hooks
(toasts via sonner on the shared operator admin messages), resolves slot
opens through the `availabilitySlot.detail` semantic destination, and ships
with `ensureAvailabilityPageData` — the index loader that awaits the slots +
products first page and background-prefetches the slot dialog's
rules/start-times, taking the app's cookie-forwarding client so the SSR
loader binding stays app-side per the packaged-host recipe. The operator's
availability index route shrinks to the loader binding; the app-side
wrapper and its app-local `BatchMutationResponse` type are deleted. New
availability-ui peer: `sonner`.
