# @voyantjs/auth-react

React runtime package for Voyant authentication and optional workspace state.

This package wraps the shared Voyant auth HTTP contract:

- `/auth/me`
- `/auth/status`
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
- optional workspace and organization state
- organization member listing
- organization invitation listing
- invite, cancel, remove, and role update mutations
- API token listing, creation, update, and deletion

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
