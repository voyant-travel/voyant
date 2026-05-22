# @voyantjs/crm-ui

## 0.64.1

### Patch Changes

- @voyantjs/crm-react@0.64.1
- @voyantjs/i18n@0.64.1
- @voyantjs/identity-react@0.64.1
- @voyantjs/ui@0.64.1
- @voyantjs/utils@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/crm-react@0.64.0
- @voyantjs/i18n@0.64.0
- @voyantjs/identity-react@0.64.0
- @voyantjs/ui@0.64.0
- @voyantjs/utils@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/crm-react@0.63.1
- @voyantjs/i18n@0.63.1
- @voyantjs/identity-react@0.63.1
- @voyantjs/ui@0.63.1
- @voyantjs/utils@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Person detail page consolidates onto the canonical surface; identity-document reveal/edit/delete with audit.

  `@voyantjs/crm-ui`

  - `PersonDetailPage` cleanup: removed the 4 header metric cards, the "Fields update on the left panel" hint, and the "Travel profile" overview card (along with the `travelSnapshot` / `travelSnapshotPending` props on `PersonMain` and the internal `usePersonTravelSnapshot` fetch).
  - New `addresses` tab between Documents and the optional commercial tabs — renders `<PersonAddressesSection personId={person.id} />` by default. Tab union extended; new `tabs.addresses` i18n key in EN ("Addresses") + RO ("Adrese").
  - Relationships now show the related person's display name (hydrated via `usePerson`) instead of the raw TypeID. New optional `onPersonOpen` prop on `PersonDetailPage` and `PersonRelationshipsPanel` — when provided, the name renders as a button (`hover:underline`) that calls the callback so the host can route to the related person's detail page.
  - `PersonDocumentsPanel` accepts an optional `personId`. When provided, each row gets:
    - Eye toggle that lazily calls the new reveal hook and shows the decrypted document number inline (or a destructive error caption when blocked).
    - Pencil that opens the new `PersonDocumentDialog` (form fields: type, number, issuing country, issuing authority, issue + expiry date, primary toggle, notes).
    - "Delete" `ConfirmActionButton` wired to `usePersonDocumentMutation().remove`.
  - New `PersonDocumentDialog` (`@voyantjs/crm-ui/components/person-document-dialog`) — exports `PersonDocumentDialogProps` + `PersonDocumentDialogDocument`. Uses `useRevealPersonDocument` on open to pre-fill the number; saves via `usePersonDocumentMutation().updateFromPlaintext`.

  `@voyantjs/crm-react`

  - New hook `useRevealPersonDocument(documentId, { enabled })` — lazy `useQuery` against `GET /v1/crm/person-documents/:id/reveal`. `staleTime: 0` + `gcTime: 0` so every render with `enabled: true` is a fresh audit-logged disclosure on the server. Returns the document id + decrypted number (`null` when no number is on file).
  - New `personDocumentRevealSchema`, `personDocumentRevealResponse`, `PersonDocumentReveal` exports.
  - New `crmQueryKeys.personDocumentReveal(id)`.

  `@voyantjs/crm`

  - New dependency on `@voyantjs/action-ledger` (kept at `workspace:*`).
  - New `action-ledger-capabilities.ts` exports `PERSON_DOCUMENT_REVEAL_CAPABILITY` (resource: `person_document`, action: `read`, risk: `high`, required grant `crm-pii:read`) plus action-name / version / authorization-source / decision-policy constants.
  - New route `GET /person-documents/:id/reveal` — gates on the capability (operator's staff sessions with `scopes: ["*"]` satisfy it), KMS-required (503 when not wired), 404 when the document is missing. Wraps the decrypt with `ledgerSensitiveRead` so every reveal writes an action-ledger row tagged `crm.person_document.reveal` with `targetType: "person_document"`.
  - New service method `revealPersonDocumentNumber(db, documentId, { kms, keyRef? })` — pure KMS unwrap; returns `{ documentId, number: string | null }` (the number is `null` when the doc has no `numberEncrypted`). Authorization + audit logging stay in the route layer.

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/crm-react@0.63.0
  - @voyantjs/i18n@0.63.0
  - @voyantjs/identity-react@0.63.0
  - @voyantjs/ui@0.63.0
  - @voyantjs/utils@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/crm-react@0.62.3
- @voyantjs/i18n@0.62.3
- @voyantjs/identity-react@0.62.3
- @voyantjs/ui@0.62.3
- @voyantjs/utils@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/crm-react@0.62.2
- @voyantjs/i18n@0.62.2
- @voyantjs/identity-react@0.62.2
- @voyantjs/ui@0.62.2
- @voyantjs/utils@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/crm-react@0.62.1
- @voyantjs/i18n@0.62.1
- @voyantjs/identity-react@0.62.1
- @voyantjs/ui@0.62.1
- @voyantjs/utils@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/crm-react@0.62.0
- @voyantjs/i18n@0.62.0
- @voyantjs/identity-react@0.62.0
- @voyantjs/ui@0.62.0
- @voyantjs/utils@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/crm-react@0.61.0
  - @voyantjs/i18n@0.61.0
  - @voyantjs/identity-react@0.61.0
  - @voyantjs/ui@0.61.0
  - @voyantjs/utils@0.61.0

## 0.60.0

### Patch Changes

- Updated dependencies [4ff7f15]
  - @voyantjs/crm-react@0.60.0
  - @voyantjs/i18n@0.60.0
  - @voyantjs/identity-react@0.60.0
  - @voyantjs/ui@0.60.0
  - @voyantjs/utils@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/crm-react@0.59.0
  - @voyantjs/i18n@0.59.0
  - @voyantjs/identity-react@0.59.0
  - @voyantjs/ui@0.59.0
  - @voyantjs/utils@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/crm-react@0.58.0
- @voyantjs/i18n@0.58.0
- @voyantjs/identity-react@0.58.0
- @voyantjs/ui@0.58.0
- @voyantjs/utils@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/crm-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/identity-react@0.57.0
- @voyantjs/ui@0.57.0
- @voyantjs/utils@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/crm-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/identity-react@0.56.0
- @voyantjs/ui@0.56.0
- @voyantjs/utils@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/crm-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/identity-react@0.55.1
  - @voyantjs/ui@0.55.1
  - @voyantjs/utils@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/crm-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/identity-react@0.55.0
- @voyantjs/ui@0.55.0
- @voyantjs/utils@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/crm-react@0.54.0
- @voyantjs/i18n@0.54.0
- @voyantjs/identity-react@0.54.0
- @voyantjs/ui@0.54.0
- @voyantjs/utils@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/crm-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/identity-react@0.53.2
- @voyantjs/ui@0.53.2
- @voyantjs/utils@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/crm-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/identity-react@0.53.1
- @voyantjs/ui@0.53.1
- @voyantjs/utils@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/crm-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/identity-react@0.53.0
- @voyantjs/ui@0.53.0
- @voyantjs/utils@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/crm-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/identity-react@0.52.4
  - @voyantjs/ui@0.52.4
  - @voyantjs/utils@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/crm-react@0.52.3
- @voyantjs/i18n@0.52.3
- @voyantjs/identity-react@0.52.3
- @voyantjs/ui@0.52.3
- @voyantjs/utils@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Expand the CRM person form and detail surface.

  - `PersonForm` gains addresses and relationships subforms with full add/remove/edit affordances; `OrganizationForm` picks up the same address widgets.
  - New exported sections `PersonAddressesSection` and `PersonRelationshipsSection` so the person detail page can render addresses/relationships outside the edit form (e.g. on the read-only detail view).
  - i18n strings for the new sections (EN + RO).
  - `@voyantjs/crm` service/validation: rename the legacy `birthday` field to `dateOfBirth` to match the rest of identity; migrations `0028_rename_birthday.sql` (dev), `0010_rename_birthday.sql` (dmc), and `0018_rename_birthday.sql` (operator) handle the column rename.
  - Document-attach service tightens its validation around the renamed field.

- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/crm-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/identity-react@0.52.2
  - @voyantjs/ui@0.52.2
  - @voyantjs/utils@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/crm-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/identity-react@0.52.1
- @voyantjs/ui@0.52.1
- @voyantjs/utils@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/crm-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/identity-react@0.52.0
- @voyantjs/ui@0.52.0
- @voyantjs/utils@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/crm-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/identity-react@0.51.1
  - @voyantjs/ui@0.51.1
  - @voyantjs/utils@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/crm-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/identity-react@0.51.0
  - @voyantjs/ui@0.51.0
  - @voyantjs/utils@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/crm-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/identity-react@0.50.8
- @voyantjs/ui@0.50.8
- @voyantjs/utils@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/crm-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/identity-react@0.50.7
- @voyantjs/ui@0.50.7
- @voyantjs/utils@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/crm-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/identity-react@0.50.6
  - @voyantjs/ui@0.50.6
  - @voyantjs/utils@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/crm-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/ui@0.50.5
- @voyantjs/utils@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/crm-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/ui@0.50.4
- @voyantjs/utils@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/crm-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/ui@0.50.3
- @voyantjs/utils@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/crm-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/ui@0.50.2
- @voyantjs/utils@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/crm-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/ui@0.50.1
- @voyantjs/utils@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/crm-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/ui@0.50.0
- @voyantjs/utils@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/crm-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/ui@0.49.0
- @voyantjs/utils@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/crm-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/ui@0.48.0
- @voyantjs/utils@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/crm-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/ui@0.47.0
- @voyantjs/utils@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/crm-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/ui@0.46.0
- @voyantjs/utils@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/crm-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/ui@0.45.0
- @voyantjs/utils@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/crm-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/ui@0.44.0
- @voyantjs/utils@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/crm-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/ui@0.43.0
- @voyantjs/utils@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/crm-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/ui@0.42.0
- @voyantjs/utils@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/crm-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/ui@0.41.3
- @voyantjs/utils@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/crm-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/ui@0.41.2
- @voyantjs/utils@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/crm-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/ui@0.41.1
- @voyantjs/utils@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/crm-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/ui@0.41.0
- @voyantjs/utils@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/crm-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/ui@0.40.1
- @voyantjs/utils@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/crm-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/ui@0.40.0
- @voyantjs/utils@0.40.0

## 0.39.0

### Patch Changes

- f01fc0f: Add replacement content slots to operator detail pages so consumers can mount custom CRUD panels without duplicating the shipped read-only sections.
- Updated dependencies [f4235ea]
  - @voyantjs/crm-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/ui@0.39.0
  - @voyantjs/utils@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/crm-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/ui@0.38.2
- @voyantjs/utils@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/crm-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/ui@0.38.1
- @voyantjs/utils@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/crm-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/ui@0.38.0
- @voyantjs/utils@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/crm-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/ui@0.37.1
- @voyantjs/utils@0.37.1

## 0.37.0

### Minor Changes

- c71df12: Add optional commercial-context tab slots to CRM person and organization detail pages for bookings, invoices, payments, and contracts.
- 0689fcb: Add reusable person, organization, supplier, product, and pricing option comboboxes for operator-facing entity reference fields.

### Patch Changes

- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/crm-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/ui@0.37.0
  - @voyantjs/utils@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/crm-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0
- @voyantjs/utils@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/crm-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0
  - @voyantjs/utils@0.35.0

## 0.34.0

### Patch Changes

- 70ee277: Add a shared CurrencyInput and use it for editable operator money fields so forms display decimal amounts with the currency symbol and code while still submitting minor units.
- 1c3f635: Give shipped page components default outer padding and document the page mounting contract.
- Updated dependencies [6ad175a]
- Updated dependencies [a37d4af]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/crm-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0
  - @voyantjs/utils@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/crm-react@0.33.1
- @voyantjs/i18n@0.33.1
- @voyantjs/ui@0.33.1
- @voyantjs/utils@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/crm-react@0.33.0
  - @voyantjs/i18n@0.33.0
  - @voyantjs/ui@0.33.0
  - @voyantjs/utils@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/crm-react@0.32.3
  - @voyantjs/i18n@0.32.3
  - @voyantjs/ui@0.32.3
  - @voyantjs/utils@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/crm-react@0.32.2
- @voyantjs/i18n@0.32.2
- @voyantjs/ui@0.32.2
- @voyantjs/utils@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/crm-react@0.32.1
- @voyantjs/i18n@0.32.1
- @voyantjs/ui@0.32.1
- @voyantjs/utils@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/crm-react@0.32.0
- @voyantjs/i18n@0.32.0
- @voyantjs/ui@0.32.0
- @voyantjs/utils@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/crm-react@0.31.4
- @voyantjs/i18n@0.31.4
- @voyantjs/ui@0.31.4
- @voyantjs/utils@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/crm-react@0.31.3
- @voyantjs/i18n@0.31.3
- @voyantjs/ui@0.31.3
- @voyantjs/utils@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/crm-react@0.31.2
  - @voyantjs/i18n@0.31.2
  - @voyantjs/ui@0.31.2
  - @voyantjs/utils@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/crm-react@0.31.1
  - @voyantjs/i18n@0.31.1
  - @voyantjs/ui@0.31.1
  - @voyantjs/utils@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish smart CRM people and organizations page compositions from the package.
- ee75afb: Publish CRM opportunity summary and board compositions as package exports.
- ee75afb: Publish the quote line-items card used by CRM quote detail compositions.
- ee75afb: Publish the CRM quotes page composition and create quote dialog as package exports.

### Patch Changes

- ee75afb: Publish the CRM organization detail page composition and its inner sections.
- ee75afb: Publish the CRM person detail page composition with editable sidebar, opportunities, activities, relationships, and documents sections.
  - @voyantjs/crm-react@0.31.0
  - @voyantjs/i18n@0.31.0
  - @voyantjs/ui@0.31.0
  - @voyantjs/utils@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/crm-react@0.30.7
- @voyantjs/i18n@0.30.7
- @voyantjs/ui@0.30.7
- @voyantjs/utils@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/crm-react@0.30.6
- @voyantjs/i18n@0.30.6
- @voyantjs/ui@0.30.6
- @voyantjs/utils@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/crm-react@0.30.5
- @voyantjs/i18n@0.30.5
- @voyantjs/ui@0.30.5
- @voyantjs/utils@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/crm-react@0.30.4
- @voyantjs/i18n@0.30.4
- @voyantjs/ui@0.30.4
- @voyantjs/utils@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/crm-react@0.30.3
- @voyantjs/i18n@0.30.3
- @voyantjs/ui@0.30.3
- @voyantjs/utils@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/crm-react@0.30.2
- @voyantjs/i18n@0.30.2
- @voyantjs/ui@0.30.2
- @voyantjs/utils@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/crm-react@0.30.1
- @voyantjs/i18n@0.30.1
- @voyantjs/ui@0.30.1
- @voyantjs/utils@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/crm-react@0.30.0
- @voyantjs/i18n@0.30.0
- @voyantjs/ui@0.30.0
- @voyantjs/utils@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/crm-react@0.29.0
  - @voyantjs/i18n@0.29.0
  - @voyantjs/ui@0.29.0
  - @voyantjs/utils@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/crm-react@0.28.3
  - @voyantjs/i18n@0.28.3
  - @voyantjs/ui@0.28.3
  - @voyantjs/utils@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/crm-react@0.28.2
- @voyantjs/i18n@0.28.2
- @voyantjs/ui@0.28.2
- @voyantjs/utils@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/crm-react@0.28.1
  - @voyantjs/i18n@0.28.1
  - @voyantjs/ui@0.28.1
  - @voyantjs/utils@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/crm-react@0.28.0
- @voyantjs/i18n@0.28.0
- @voyantjs/ui@0.28.0
- @voyantjs/utils@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/crm-react@0.27.0
  - @voyantjs/i18n@0.27.0
  - @voyantjs/ui@0.27.0
  - @voyantjs/utils@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/crm-react@0.26.9
  - @voyantjs/i18n@0.26.9
  - @voyantjs/ui@0.26.9
  - @voyantjs/utils@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/crm-react@0.26.8
- @voyantjs/i18n@0.26.8
- @voyantjs/ui@0.26.8
- @voyantjs/utils@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/crm-react@0.26.7
- @voyantjs/i18n@0.26.7
- @voyantjs/ui@0.26.7
- @voyantjs/utils@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/crm-react@0.26.6
- @voyantjs/i18n@0.26.6
- @voyantjs/ui@0.26.6
- @voyantjs/utils@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/crm-react@0.26.5
- @voyantjs/i18n@0.26.5
- @voyantjs/ui@0.26.5
- @voyantjs/utils@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/crm-react@0.26.4
  - @voyantjs/i18n@0.26.4
  - @voyantjs/ui@0.26.4
  - @voyantjs/utils@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/crm-react@0.26.3
  - @voyantjs/i18n@0.26.3
  - @voyantjs/ui@0.26.3
  - @voyantjs/utils@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/crm-react@0.26.2
- @voyantjs/i18n@0.26.2
- @voyantjs/ui@0.26.2
- @voyantjs/utils@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/crm-react@0.26.1
  - @voyantjs/i18n@0.26.1
  - @voyantjs/ui@0.26.1
  - @voyantjs/utils@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/crm-react@0.26.0
- @voyantjs/i18n@0.26.0
- @voyantjs/ui@0.26.0
- @voyantjs/utils@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/crm-react@0.25.0
- @voyantjs/i18n@0.25.0
- @voyantjs/ui@0.25.0
- @voyantjs/utils@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/crm-react@0.24.3
- @voyantjs/i18n@0.24.3
- @voyantjs/ui@0.24.3
- @voyantjs/utils@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/crm-react@0.24.2
- @voyantjs/i18n@0.24.2
- @voyantjs/ui@0.24.2
- @voyantjs/utils@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
  - @voyantjs/crm-react@0.24.1
  - @voyantjs/i18n@0.24.1
  - @voyantjs/ui@0.24.1
  - @voyantjs/utils@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/crm-react@0.24.0
- @voyantjs/i18n@0.24.0
- @voyantjs/ui@0.24.0
- @voyantjs/utils@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/crm-react@0.23.0
- @voyantjs/i18n@0.23.0
- @voyantjs/ui@0.23.0
- @voyantjs/utils@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/crm-react@0.22.0
- @voyantjs/i18n@0.22.0
- @voyantjs/ui@0.22.0
- @voyantjs/utils@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/crm-react@0.21.1
- @voyantjs/i18n@0.21.1
- @voyantjs/ui@0.21.1
- @voyantjs/utils@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/crm-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0
  - @voyantjs/utils@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/crm-react@0.20.0
- @voyantjs/i18n@0.20.0
- @voyantjs/ui@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/crm-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0
- @voyantjs/utils@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/crm-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0
- @voyantjs/utils@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/crm-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/crm-react@0.16.0
- @voyantjs/ui@0.16.0
- @voyantjs/utils@0.16.0

## 0.15.0

### Minor Changes

- cccc905: New package `@voyantjs/crm-ui` — importable React components for Voyant CRM. First per-domain `*-ui` package, mirrors the `*-react` split.

  **Components included** (12): `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`, `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`, `ActivitiesPage`, `CreateActivityDialog`, `CreateOpportunityDialog`. All take `className` and merge via `cn()`; data fetching is delegated to `@voyantjs/crm-react` hooks.

  **Components NOT included** (registry-only for now): `quotes-page`, `create-quote-dialog`, `quote-detail-sections`, `opportunities-board`, `opportunity-summary-card`, `organization-detail-page`, `organization-detail-sections`. These either hard-couple to `@tanstack/react-router` or depend on template-local helpers (`@/components/voyant/crm/inline-*`, `crm-constants`, etc.) that aren't part of the registry surface. They remain consumable via `npx shadcn add @voyant/...` and can be promoted to the package when the couplings are factored out.

  **Peers:** `@voyantjs/crm-react`, `@voyantjs/ui`, `@tanstack/react-query`, `react`, `react-dom`.

  **Two distribution modes for CRM components going forward:**

  - Use as-is or extend via composition → `pnpm add @voyantjs/crm-ui`
  - Need to fork → `npx shadcn add @voyant/<component>` (registry path, unchanged)

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/crm-react@0.15.0
  - @voyantjs/ui@0.15.0
  - @voyantjs/utils@0.15.0
