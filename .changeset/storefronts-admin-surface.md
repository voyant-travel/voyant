---
"@voyant-travel/auth": minor
"@voyant-travel/auth-react": minor
---

Add the operator Storefronts admin surface on top of the storefront runtime port.

The Auth package gains an operator-scoped storefront admin API (CRUD, allowed
origins, reveal-once key issue/rotate/revoke, account policy + auth methods, and
provider credential management), wired into the selected admin graph. Auth React
gains the "Storefronts" admin surface (list, per-storefront detail, keys with
show-once reveal, customer account settings, and provider credentials), with the
former top-level "Sites" surface reparented as a sub-view. Business buyer-account
controls are gated on the runtime capability derived from whether customer
business-account onboarding is wired.
