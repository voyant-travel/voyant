---
"@voyant-travel/admin-extension-sdk": patch
---

Republish with packaged `dist` exports. The 0.1.0 tarball was published outside
the release train, so its `exports` map pointed at unpackaged `src/*.ts` files
and the package could not be imported.
