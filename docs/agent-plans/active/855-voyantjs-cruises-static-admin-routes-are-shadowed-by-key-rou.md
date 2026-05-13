# @voyantjs/cruises: static admin routes are shadowed by /:key route

Issue: https://github.com/voyantjs/voyant/issues/855
Branch: bug/855-voyantjs-cruises-static-admin-routes-are-shadowed-by-key-rou
State: active

## Purpose

Prepare an implementation workspace for the maintainer-approved issue.

## Current State

- Project item: PVTI_lADODiwsuc4BXR16zgspO94
- Repository: voyantjs/voyant
- Base ref: origin/main
- Local workspace: /home/mihai/voyant/voyant/.agent-worktrees/855-voyantjs-cruises-static-admin-routes-are-shadowed-by-key-rou
- Risk: Low
- Security risk: None
- Verification lane: verify:fast

## Agent Brief

**Category:** bug
**Summary:** Fix `@voyantjs/cruises` admin route ordering so static cruise subresource routes are not captured by the generic `/:key` route.

**Current behavior:**
`GET /v1/admin/cruises/sailings?limit=25&offset=0` is handled by the earlier cruise detail route and parses `sailings` as a cruise key, returning `400 invalid_key`. The same shadowing risk exists for other static admin subresource routes declared after `/:key`.

**Desired behavior:**
Static admin routes under `/v1/admin/cruises` should match their intended handlers before the generic cruise detail route. Existing valid cruise detail behavior for local TypeID keys and external provider keys must continue to work.

**Key interfaces:**
- `cruiseAdminRoutes` in `packages/cruises/src/routes.ts`
- Route shape coverage in `packages/cruises/tests/unit/routes-shape.test.ts`
- Public client contract in `packages/cruises-react/src/query-options.ts` and related hooks that call `/v1/admin/cruises/sailings`, `/ships`, `/enrichment/:programId`, and `/search-index/*`

**Acceptance criteria:**
- [ ] Add a regression test showing `GET /sailings` is not handled by `GET /:key` and no longer returns `invalid_key`.
- [ ] Audit and protect other static admin subresource routes that are currently declared after `/:key`.
- [ ] Preserve existing tests for `GET /:key`, external cruise keys, `/:key/sailings`, refresh, detach, and external read-only behavior.
- [ ] Add or update a Changeset for the public package behavior fix.

**Verification lane:**
Run `pnpm --filter @voyantjs/cruises test`, `pnpm --filter @voyantjs/cruises typecheck`, `pnpm --filter @voyantjs/cruises-react typecheck`, `pnpm lint:changed`, and `pnpm verify:agent-quality:changed`.

**Security:**
Low security risk. This changes route matching for existing admin endpoints but must not alter authentication, authorization, or tenant scoping behavior.

**Artifacts required:**
None beyond test output and the eventual PR diff.

**Out of scope:**
- Do not redesign the cruises route API.
- Do not change response envelope schemas.
- Do not add new cruise resources or UI behavior.

## Desired Behavior

The issue is implemented according to its acceptance criteria and handed off
with evidence.

## Scope

In scope:

- Read the issue, linked comments, relevant docs, and affected code.
- Update this plan with concrete milestones before implementation.
- Keep changes on branch `bug/855-voyantjs-cruises-static-admin-routes-are-shadowed-by-key-rou`.

Out of scope:

- Running an implementation agent before the plan is reviewed.
- Pushing branches or opening PRs from this local prepare step.

## Milestones

- [x] Expand current-state notes from issue context and codebase findings.
- [x] Identify the narrow implementation path.
- [x] Define focused verification commands.
- [x] Implement and verify.
- [x] Prepare evidence packet.

## Decisions

- 2026-05-13 17:29 UTC - Local workspace and execution plan prepared by the runner.
- 2026-05-13 17:45 UTC - Route audit found `GET /:key` registered before static `GET /sailings`, `GET /prices`, and `GET /ships`; multi-segment static routes are not exact-match shadowed today, but moving all per-cruise wildcard routes after the static subresource block protects the full reserved-segment surface.
- 2026-05-13 17:45 UTC - Implementation path: reorder `cruiseAdminRoutes` so static subresource routes register before wildcard cruise-key routes, add route-shape regression coverage for `GET /sailings`, and add a patch changeset for `@voyantjs/cruises`.

## Progress Log

- 2026-05-13 17:29 UTC - Created local worktree and plan file. No implementation agent
  has run.
- 2026-05-13 17:45 UTC - Read GitHub issue #855, confirmed there are no comments, reviewed route-authoring guidance, and inspected affected route/test/client files.
- 2026-05-13 17:50 UTC - Reordered cruises admin routes so static subresources register before wildcard cruise-key routes.
- 2026-05-13 17:50 UTC - Added route-shape regression tests for `GET /sailings`, plus static collection coverage for `GET /ships` and `GET /prices`.
- 2026-05-13 17:51 UTC - Added a patch changeset for `@voyantjs/cruises`.
- 2026-05-13 17:55 UTC - Installed workspace dependencies with `pnpm install` because the worktree had no linked `node_modules`.
- 2026-05-13 17:58 UTC - Verification passed: `pnpm --filter @voyantjs/cruises test`, `pnpm --filter @voyantjs/cruises typecheck`, `pnpm --filter @voyantjs/cruises-react typecheck`, `pnpm lint:changed`, `pnpm verify:agent-quality:changed`, and `pnpm verify:fast`.
- 2026-05-13 17:58 UTC - `verify:agent-quality:changed` reported the existing `packages/cruises/src/routes.ts` file-size finding in report-only mode; `routes.ts` was already over the threshold on `origin/main` and this change only reorders handlers.

## Verification Plan

- `pnpm --filter @voyantjs/cruises test`
- `pnpm --filter @voyantjs/cruises typecheck`
- `pnpm --filter @voyantjs/cruises-react typecheck`
- `pnpm lint:changed`
- `pnpm verify:agent-quality:changed`

## Risks And Rollback

- Remove the local worktree with `git worktree remove /home/mihai/voyant/voyant/.agent-worktrees/855-voyantjs-cruises-static-admin-routes-are-shadowed-by-key-rou` if this
  task is abandoned before implementation.
