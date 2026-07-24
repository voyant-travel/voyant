---
"@voyant-travel/ui": patch
"@voyant-travel/operator-standard": patch
"@voyant-travel/event-catalog-react": patch
"@voyant-travel/notifications-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/auth-react": patch
"@voyant-travel/legal-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/media-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/quotes-react": patch
"@voyant-travel/identity-react": patch
---

Replace native browser dialogs with styled UI-package dialogs across the admin
surface. Adds `confirmDialog`/`ConfirmDialogHost` and `promptDialog`/
`PromptDialogHost` to `@voyant-travel/ui`, mounts both hosts once in the
operator admin shell, and migrates every `window.confirm`/`window.prompt` call
and stray `window.alert` in the `*-react` packages to the styled equivalents
(destructive confirmations rendered with the destructive action variant). Also
fixes the event-catalog "selected event contracts" count to use ICU plural
formatting.
