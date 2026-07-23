---
"@voyant-travel/webhook-delivery": minor
"@voyant-travel/operator-settings-react": minor
"@voyant-travel/operator-standard": minor
"@voyant-travel/runtime": patch
"@voyant-travel/apps": patch
"@voyant-travel/i18n": patch
---

Add first-class operator webhook subscription settings, delivery history, test and replay actions, permission checks, secret redaction, and protected outbound delivery.

Start the generic Postgres delivery worker only when the webhook module is selected, and compose the new settings surface into the standard operator package.
