---
"@voyantjs/travel-composer": patch
---

Make trip reservation claims atomic before provider reserve dispatch, release claims after failed preflight, and avoid cancelling replayed holds during proposal accept cleanup.
