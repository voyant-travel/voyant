---
"@voyant-travel/admin": minor
"@voyant-travel/admin-app": minor
"@voyant-travel/admin-host": minor
"@voyant-travel/framework-migrations": minor
---

Remove the final snapshot-era managed-profile aliases from the admin and migration package surfaces. Admin hosts now consume `AdminAuthRuntime`, `getAdminApiUrl`, and `adminFetcher`; deployment migration collection is exposed as `collectDeploymentMigrationSources`.
