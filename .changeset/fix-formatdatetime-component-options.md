---
"@voyant-travel/i18n": patch
---

Fix `formatDateTime` crashing with `Invalid option : option` when called with individual date-part component options.

`createLocaleFormatters().formatDateTime` unconditionally merged its default `dateStyle`/`timeStyle` on top of the caller's options. `Intl.DateTimeFormat` forbids combining `dateStyle`/`timeStyle` with individual component options (`year`, `month`, `day`, `hour`, `minute`, …), so callers passing component options threw a `TypeError`. This took down the Apps admin surfaces (installed apps list and marketplace consent screen) whenever an app was installed. The default styles are now only applied when the caller hasn't specified a shape of their own (`timeZone` alone does not count as a shape).
