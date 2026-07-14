---
"@voyant-travel/auth": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/core": patch
"@voyant-travel/db": patch
"@voyant-travel/types": patch
"@voyant-travel/utils": patch
---

Embed TypeScript sources in published JavaScript source maps so consumer dev servers can resolve
them without the omitted `src` tree, and reject publish tarballs whose JavaScript maps reference
sources that are neither packed nor embedded.
