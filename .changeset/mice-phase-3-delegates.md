---
"@voyant-travel/mice": minor
"@voyant-travel/schema-kit": minor
---

Delegate registry + rooming manifest + booking extension (Phase 3).

- mice: `mice_program_delegates` (role + lifecycle status; PII stays on the
  linked CRM person/booking per §9-Q7) + `mice_delegate_session_enrollments`
  (idempotent per delegate+session); first-class rooming manifest
  (`mice_rooming_assignments` + `mice_rooming_assignment_delegates` join for
  shared rooms, §9-Q5); `booking_mice_details` HonoExtension on bookings.
  Services + admin routes + delegate/rooming linkables. FK refs validated
  up-front (4xx, not FK 500).
- schema-kit: TypeID prefixes mpdl/mdse/mrma/mrad/bkmd.
- Deployment links: delegate↔person, delegate↔booking, rooming↔roomBlock.
