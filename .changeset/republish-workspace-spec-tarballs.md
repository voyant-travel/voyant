---
"@voyant-travel/runtime": patch
"@voyant-travel/finance": patch
"@voyant-travel/commerce": patch
"@voyant-travel/distribution": patch
"@voyant-travel/inventory": patch
"@voyant-travel/operations": patch
---

Republish with dependency ranges resolved. The prior tarballs for these packages
carry raw `workspace:` specifiers (they were published outside the pnpm-aware
release flow) and cannot be installed by consumers. Also fixes the `runtime`
package's `prepack`, which rebuilt the entire workspace dependency closure on
every publish — the slow build stalled the release train's publish step past its
timeout and wedged the whole batch. `prepack` now builds only the package itself,
matching every other package.
