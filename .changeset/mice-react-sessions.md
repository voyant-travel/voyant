---
"@voyant-travel/mice-react": minor
---

MICE Programs **Agenda** surface — sessions on the program detail page.

- `ProgramSessionsSection` (`./ui`): lists a program's agenda sessions and
  creates new ones in place (title, type, day, track, capacity, registration),
  rendered inside `ProgramDetailPage` below the cost sheet. Sessions are a
  program's agenda, not a top-level surface, so they nest in the detail.
- `useSessionMutation` hook (create + update) invalidating the owning program's
  session list, plus the `sessionSingleResponse` schema for the POST/PATCH
  responses.
