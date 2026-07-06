---
"@voyant-travel/framework": minor
---

Add the published `@voyant-travel/framework/managed-runtime` entry for booting
a standard managed profile from a serialized profile snapshot without
starter-local imports. Managed Cloud boot now fails fast when required substrate,
auth integration, or snapshot plugin resolution is missing, and source-free
profile composition excludes standard surfaces whose route loaders still live in
the operator starter.
