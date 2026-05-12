# @voyantjs/auth-react

React runtime package for Voyant authentication and optional workspace state.

This package wraps the shared Voyant auth HTTP contract:

- `/auth/me`
- `PATCH /auth/me`
- `/auth/status`
- `/auth/sign-in/email`
- `/auth/change-password`
- `/auth/email-otp/request-email-change`
- `/auth/email-otp/change-email`
- `/auth/sign-up/email`
- `/auth/workspace/current`
- `/auth/workspace/active-organization`
- `/auth/organization/list-members`
- `/auth/organization/list-invitations`
- `/auth/organization/invite-member`
- `/auth/organization/update-member-role`
- `/auth/organization/remove-member`
- `/auth/organization/cancel-invitation`
- `/auth/api-tokens`
- `/auth/api-tokens/:keyId`

It provides reusable React surfaces for:

- current user state
- account profile, password, and email-change mutations
- optional workspace and organization state
- organization member listing
- organization invitation listing
- email/password sign-in
- email/password sign-up
- invite, cancel, remove, and role update mutations
- API token listing, creation, update, and deletion

## Sign-In

`useSignIn()` exposes the shared email/password Better Auth flow:

```tsx
const signIn = useSignIn()

await signIn.email.mutateAsync({
  email,
  password,
  callbackURL: "/",
})
```

After Better Auth accepts the credentials, the hook calls `/auth/status` to
provision the Voyant user profile if needed and invalidates the current auth
queries.

## Account self-service

`useUpdateAccountProfile()` updates Voyant profile fields through
`PATCH /auth/me` and refreshes the current-user query:

```tsx
const updateProfile = useUpdateAccountProfile()

await updateProfile.mutateAsync({
  firstName: "Ana",
  lastName: "Pop",
  locale: "ro",
  timezone: "Europe/Bucharest",
  profilePictureUrl: null,
})
```

Apps can mount `handleAccountProfileRequest(...)` from `@voyantjs/auth/server`
to provide this route without depending on a specific template. The mounted
route validates the session, calls `updateCurrentUserProfile(...)` from
`@voyantjs/auth/workspace`, and returns the updated current-user shape.

Password and email changes call the mounted Better Auth API:

```tsx
const changePassword = useChangeAccountPassword()
await changePassword.mutateAsync({
  currentPassword,
  newPassword,
  revokeOtherSessions: true,
})

const requestEmailChange = useRequestAccountEmailChange()
await requestEmailChange.mutateAsync({ newEmail })

const confirmEmailChange = useConfirmAccountEmailChange()
await confirmEmailChange.mutateAsync({ newEmail, otp })
```

## Sign-Up

`useSignUp()` exposes the shared email/password Better Auth registration flow:

```tsx
const signUp = useSignUp()

await signUp.email.mutateAsync({
  name,
  email,
  password,
  callbackURL: "/",
})
```

The hook posts to the mounted Better Auth `/auth/sign-up/email` endpoint, calls
`/auth/status` after success for profile provisioning fallback, and invalidates
the current auth queries. Invitation-backed registration should use the app's
invitation redemption endpoint, because Better Auth email sign-up cannot redeem
Voyant admin-issued invite tokens.

## Single-Tenant Apps

Single-tenant operator apps should bootstrap their shell from `useCurrentUser()`
or `/auth/me` only. `useCurrentWorkspace()`, `useWorkspaceMutation()`,
organization member hooks, and invitation hooks are opt-in team/workspace
surfaces for apps that expose Better Auth organization routes.

Do not make workspace queries part of the base admin loading gate unless the app
intentionally requires organization switching or team management. Apps that do
not mount the organization routes can still use the current-user hooks without
providing `/auth/workspace/current` or `/auth/organization/*` endpoints.

## API Tokens

The API-token hooks call Voyant's `/auth/api-tokens` facade, not Better Auth's
raw `/auth/api-key/*` plugin routes. Mount
`handleApiTokenManagementRequest(...)` from `@voyantjs/auth/server` before
falling through to `auth.handler(request)` so the shared UI can manage
permissioned `voy_` service tokens.
