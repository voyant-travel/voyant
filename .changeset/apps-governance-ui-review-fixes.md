---
"@voyant-travel/apps": patch
"@voyant-travel/apps-react": patch
---

Resolve the install deployment id per request (body → `VOYANT_CLOUD_DEPLOYMENT_ID` env → construction option) so the standard runtime's Install App flow no longer fails with `app_deployment_required`, and make the restricted install link (`/apps?installApp=<id>`) open the app-preselected consent flow.
