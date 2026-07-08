---
"@voyant-travel/framework-migrations": patch
---

Add the missing `cloud_auth_user_links.scopes` column to the shipped framework
migration bundle so managed Cloud admin auth can persist Cloud-granted member
scopes during sign-in and revalidation. The matching db-package migration now
uses `ADD COLUMN IF NOT EXISTS`, with a narrow collector hash compatibility
exception for deployments that already recorded the original equivalent
migration.
