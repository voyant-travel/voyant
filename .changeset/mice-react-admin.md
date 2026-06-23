---
"@voyant-travel/mice-react": minor
"@voyant-travel/i18n": minor
---

Package-delivered MICE admin surface (`@voyant-travel/mice-react/admin`).

- New `./admin` entry exporting `createMiceAdminExtension` — contributes the
  Programs nav item (spliced after Bookings) plus the route implementations for
  the programs list (`/mice`) and a program's detail (`/mice/$id`, where the
  per-currency cost sheet lives). Picked up by `voyant admin generate` via the
  `<module>-react/admin` convention; resolves the `mice.program.list` /
  `mice.program.detail` semantic destinations.
- `@voyant-travel/i18n`: new `nav.mice` operator-admin label (en "Programs",
  ro "Programe").
