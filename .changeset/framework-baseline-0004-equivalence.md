---
"@voyant-travel/framework-migrations": patch
---

Register the rewritten `framework/0004_framework_baseline` (guarded `custom_field_values` drop → plain `DROP TABLE IF EXISTS`) as hash-equivalent to the original, so databases that applied the 0.9.x bundle don't fail the immutability gate on upgrade.
