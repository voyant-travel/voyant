---
"@voyantjs/admin-contracts": patch
---

Add a descriptor consistency guard (test): asserts every admin operation
descriptor is well-formed and internally consistent — unique ids, an
`/v1/admin/<domain>` path matching the operation's id prefix, a valid
method/classification, `resource:action` scopes, and a `path()` builder that
substitutes every template param. Catches the authoring-drift class that makes a
descriptor diverge from the API surface. (The complementary live route-existence
check belongs in a deployment test; #1411 5.4.)
