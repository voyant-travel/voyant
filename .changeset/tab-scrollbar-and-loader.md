---
"@voyant-travel/finance-react": patch
"@voyant-travel/admin": patch
---

Fix a stray vertical scrollbar inside the invoice detail tab bar (the horizontal
scroll container was also allowing a 1px vertical overflow to scroll) by clipping
the vertical axis. And make the app boot loaders consistent: the initial
"Loading workspace" spinner and the workspace-bootstrap spinner no longer show
text, so users see one steady spinner instead of a spinner-with-text that
flickers into a plain spinner before the shell appears.
