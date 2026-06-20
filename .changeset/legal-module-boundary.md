---
"@voyant-travel/legal": minor
"@voyant-travel/framework-migrations": patch
---

legal: remove cross-package foreign-key constraints from `contracts` and `contract_signatures` (`person_id → relationships.people`, `organization_id → relationships.organizations`, `supplier_id → distribution.suppliers`). These horizontal cross-module associations now follow the module-decoupling pattern — plain id columns + `defineLink` at the deployment (person/organization/supplier ↔ contract) + service-layer validation — instead of hard cross-package FKs. The `person_id`/`organization_id`/`supplier_id` columns and their indexes are unchanged; only the FK constraints are dropped. `createContract`/`updateContract` now validate that referenced person/organization/supplier ids exist (400 on a stale/mistyped id), preserving the integrity the FK used to enforce.

framework-migrations: bundle migration drops the four legal cross-package FK constraints so the shipped bundle matches the decoupled schema. (The deployment migrate runner's baseline-import guard now also verifies dropped constraints are actually gone before importing — so existing deployments can't silently baseline this constraint drop without applying it.)
