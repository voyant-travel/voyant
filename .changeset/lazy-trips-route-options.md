---
"@voyant-travel/framework": patch
"@voyant-travel/trips": patch
---

Allow trips route options to be provided lazily so deployment-specific booking and payment runtime wiring is not imported into the eager API composition closure.
