---
"@voyantjs/ui": patch
---

Fix `packages/ui/registry.json` so the bookings stepper entry points at `option-units-stepper-section.tsx` (and exposes it as `voyant-bookings-option-units-stepper-section`). The previous 0.52.1 release renamed the file but left the registry source-of-truth pointing at the old `rooms-stepper-section.tsx` path, which caused `shadcn build` to ENOENT in the release workflow.
