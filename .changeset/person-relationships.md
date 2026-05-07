---
"@voyantjs/crm": patch
"@voyantjs/crm-react": patch
"@voyantjs/db": patch
---

Add person-to-person relationships table for kinship, emergency contacts, and travel companions (closes #442).

New `crm.person_relationships` table records directed `fromPerson → toPerson` edges of one of eleven kinds (`spouse`, `partner`, `parent`, `child`, `sibling`, `guardian`, `ward`, `emergency_contact`, `friend`, `travel_companion`, `other`). The optional `inverseKind` lets the service auto-write the symmetric edge in the same transaction (parent↔child, guardian↔ward, etc.) so operator UIs don't have to maintain both sides; the auto-inverse path is idempotent on retry. `(from_person_id, to_person_id, kind)` is uniquely indexed and a CHECK constraint rejects self-edges. Migration: `templates/operator/migrations/0026_person_relationships.sql` (registered in `meta/_journal.json`).

API surface:

- `crmService.listPersonRelationships(db, personId, { direction?: "from" | "to" | "both" })` — defaults to `both` so the typical "Jane's family" view returns the union.
- `crmService.createPersonRelationship(db, fromPersonId, { toPersonId, kind, inverseKind?, autoInverse? })`
- `crmService.getPersonRelationship` / `updatePersonRelationship` / `deletePersonRelationship`
- Admin routes: `GET/POST /v1/admin/crm/people/:id/relationships`, `GET/PATCH/DELETE /v1/admin/crm/person-relationships/:id`.
- React hooks: `usePersonRelationships(personId, { direction, kind })`, `usePersonRelationshipMutation(personId)` returning `{ create, update, remove }`.

Out of scope (deferred): UI components for the relationship graph; phone-keyed emergency-contact convenience helpers (use `metadata` for now). The data layer is ready for both.
