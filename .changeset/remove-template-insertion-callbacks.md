---
"@voyant-travel/ui": minor
"@voyant-travel/notifications-react": patch
"@voyant-travel/legal-react": patch
---

Breaking beta cleanup: remove the deprecated `onInsertVariable` and
`onInsertSnippet` props from `ContractTemplateAuthoringHelp`. The helper only
supports copying template values and snippets to the clipboard; consumers
should remove these ignored callbacks. Also remove the inert Legal and
Notifications caller wiring.
