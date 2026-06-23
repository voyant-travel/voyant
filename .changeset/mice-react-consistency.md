---
"@voyant-travel/mice-react": patch
---

MICE admin surfaces — consistency polish across the program views.

- `ProgramsPage` and `ProgramSessionsSection` now request the backend's max
  page and show a "Showing the first N" notice when capped, matching the
  delegates and RFP surfaces (no silent truncation). The Programs admin SSR
  loader limit is bumped to match the page so its prefetch still hits the
  query key.
- The create-session and add-delegate dialogs reset their form on every close
  (cancel/escape), matching the enroll/RFP dialogs — a cancelled draft no
  longer reappears on reopen.
