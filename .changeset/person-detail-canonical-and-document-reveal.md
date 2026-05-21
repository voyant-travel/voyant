---
"@voyantjs/crm": minor
"@voyantjs/crm-react": minor
"@voyantjs/crm-ui": minor
---

Person detail page consolidates onto the canonical surface; identity-document reveal/edit/delete with audit.

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
