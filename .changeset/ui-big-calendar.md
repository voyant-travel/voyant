---
"@voyantjs/ui": patch
---

Add a `big-calendar` primitive — full-screen month / week / day calendar view with header, navigation, and event interaction primitives — exposed at the new `@voyantjs/ui/components/big-calendar` subpath export.

Also adds a `bg-calendar-disabled-hour` Tailwind utility (uses `color-mix(in oklab, var(--muted) 35%, transparent)`) for shading out-of-business hours in the week / day views, so consumers don't need to hand-roll the rgba.
