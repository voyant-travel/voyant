# @voyantjs/auth-ui

## 0.56.0

### Patch Changes

- @voyantjs/admin@0.56.0
- @voyantjs/auth-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/types@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/admin@0.55.1
  - @voyantjs/auth-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/types@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/admin@0.55.0
- @voyantjs/auth-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/types@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/admin@0.54.0
- @voyantjs/auth-react@0.54.0
- @voyantjs/i18n@0.54.0
- @voyantjs/types@0.54.0
- @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/admin@0.53.2
- @voyantjs/auth-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/types@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/admin@0.53.1
- @voyantjs/auth-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/types@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/admin@0.53.0
- @voyantjs/auth-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/types@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/admin@0.52.4
  - @voyantjs/auth-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/types@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/admin@0.52.3
- @voyantjs/auth-react@0.52.3
- @voyantjs/i18n@0.52.3
- @voyantjs/types@0.52.3
- @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Make `@voyantjs/auth-ui` the single source of truth for the operator auth surface so templates stop hand-rolling their own forms.

  - Re-shell `SignInPage`, `SignUpPage`, `AcceptInvitationPage`, `VerifyEmailPage`, and the password-reset pages in `Card`/`CardHeader`/`CardContent` so they render consistently and pick up theme tokens out of the box.
  - Add `AuthLayout` (exported from the package root) that centers the auth card and renders the Voyant wordmark via `@voyantjs/admin`, replacing the per-template auth shells.
  - `templates/operator` now mounts each auth route as a thin wrapper around the corresponding page component instead of duplicating ~200 lines of form code per route.

- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/admin@0.52.2
  - @voyantjs/auth-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/types@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/admin@0.52.1
- @voyantjs/auth-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/types@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/admin@0.52.0
- @voyantjs/auth-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/types@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/admin@0.51.1
  - @voyantjs/auth-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/types@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/admin@0.51.0
  - @voyantjs/auth-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/types@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/admin@0.50.8
- @voyantjs/auth-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/types@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/admin@0.50.7
- @voyantjs/auth-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/types@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/admin@0.50.6
  - @voyantjs/auth-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/types@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/admin@0.50.5
- @voyantjs/auth-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/types@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/admin@0.50.4
- @voyantjs/auth-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/types@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/admin@0.50.3
- @voyantjs/auth-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/types@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/admin@0.50.2
- @voyantjs/auth-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/types@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/admin@0.50.1
- @voyantjs/auth-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/types@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/admin@0.50.0
- @voyantjs/auth-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/types@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/admin@0.49.0
- @voyantjs/auth-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/types@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Minor Changes

- 98e69be: Add `OrganizationMembersPage` with member role management, pending invitation actions, a matching skeleton, docs, and package exports.

### Patch Changes

- @voyantjs/admin@0.48.0
- @voyantjs/auth-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/types@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/admin@0.47.0
- @voyantjs/auth-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/types@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/admin@0.46.0
- @voyantjs/auth-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/types@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/admin@0.45.0
- @voyantjs/auth-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/types@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/admin@0.44.0
- @voyantjs/auth-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/types@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Minor Changes

- d07215e: Add first-class API token rotation and audit-facing token context. The auth facade now supports `POST /auth/api-tokens/:keyId/rotate`, the React hooks and UI expose rotation, and Hono request context includes `apiTokenId` for downstream audit log writers.

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/admin@0.43.0
  - @voyantjs/auth-react@0.43.0
  - @voyantjs/i18n@0.43.0
  - @voyantjs/types@0.43.0
  - @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/admin@0.42.0
- @voyantjs/auth-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/types@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/admin@0.41.3
- @voyantjs/auth-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/types@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/admin@0.41.2
- @voyantjs/auth-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/types@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/admin@0.41.1
- @voyantjs/auth-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/types@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/admin@0.41.0
- @voyantjs/auth-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/types@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/admin@0.40.1
- @voyantjs/auth-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/types@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/admin@0.40.0
- @voyantjs/auth-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/types@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/admin@0.39.0
  - @voyantjs/auth-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/types@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/admin@0.38.2
- @voyantjs/auth-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/types@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/admin@0.38.1
- @voyantjs/auth-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/types@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/admin@0.38.0
- @voyantjs/auth-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/types@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/admin@0.37.1
- @voyantjs/auth-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/types@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Minor Changes

- 208792f: Add shared organization invitation acceptance hooks and a router-agnostic accept-invitation page.
- 5c0cd16: Add shared account self-service profile helpers, account mutation hooks, and reusable account page/forms.
- 9fcfd44: Add provider-backed English and Romanian i18n surfaces for auth and checkout UI components.
- 7bf14d8: Add shared email verification helpers and a router-agnostic VerifyEmailPage for Better Auth token and email OTP flows.
- 5686880: Add the shared account profile update contract, React mutation helper, and card-less onboarding profile completion page.
- 9ec9d4d: Add reusable password reset hooks and shared forgot/reset password auth UI pages.
- 36d145f: Add a reusable email/password sign-in hook and shared auth-ui sign-in page.
- 2b0b492: Add a reusable email/password sign-up hook and shared auth-ui sign-up page, with
  app-owned submission support for invitation-token registration.

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- Updated dependencies [712a441]
- Updated dependencies [208792f]
- Updated dependencies [5c0cd16]
- Updated dependencies [7bf14d8]
- Updated dependencies [5686880]
- Updated dependencies [9ec9d4d]
- Updated dependencies [36d145f]
- Updated dependencies [2b0b492]
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/admin@0.37.0
  - @voyantjs/auth-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/types@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/auth-react@0.36.0
- @voyantjs/types@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/auth-react@0.35.0
  - @voyantjs/types@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Patch Changes

- 1c3f635: Give shipped page components default outer padding and document the page mounting contract.
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/auth-react@0.34.0
  - @voyantjs/types@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/auth-react@0.33.1
- @voyantjs/types@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/auth-react@0.33.0
  - @voyantjs/types@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/auth-react@0.32.3
  - @voyantjs/types@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/auth-react@0.32.2
- @voyantjs/types@0.32.2
- @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- Updated dependencies [085c01b]
  - @voyantjs/auth-react@0.32.1
  - @voyantjs/types@0.32.1
  - @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/auth-react@0.32.0
- @voyantjs/types@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/auth-react@0.31.4
- @voyantjs/types@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/auth-react@0.31.3
- @voyantjs/types@0.31.3
- @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- 54ddc93: Add API token management powered by Better Auth API keys, including reusable React hooks, a shared auth UI package, canonical permission presets, and API-key route permission guards.
- Updated dependencies [54ddc93]
  - @voyantjs/auth-react@0.31.2
  - @voyantjs/types@0.31.2
  - @voyantjs/ui@0.31.2
