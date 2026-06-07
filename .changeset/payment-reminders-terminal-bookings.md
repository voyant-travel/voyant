---
"@voyantjs/bookings": patch
"@voyantjs/notifications": patch
---

Stop payment-schedule reminders from sending for terminal bookings by closing open schedules during cancelled/expired booking transitions and by skipping payment reminders when the parent booking is not payable.
