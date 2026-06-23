---
"@voyant-travel/mice-react": minor
---

MICE Programs **Delegates** surface — roster + session enrollment on the
program detail page.

- `ProgramDelegatesSection` (`./ui`): lists a program's delegates (role,
  status), adds new ones in place (role, status, optional person), and enrolls
  a delegate into one of the program's agenda sessions — rendered inside
  `ProgramDetailPage` below the Agenda. The roster requests the backend's max
  page (500) and says so when a program hits the cap rather than silently
  dropping delegates.
- `useDelegateMutation` hook (create / update / enroll) invalidating the
  delegates list root; `delegateSingleResponse` + `enrollmentRecordSchema`
  schemas for the POST/PATCH/enroll responses.
