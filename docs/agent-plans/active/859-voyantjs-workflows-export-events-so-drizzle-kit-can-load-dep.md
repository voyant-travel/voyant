# @voyantjs/workflows: export ./events so drizzle-kit can load dependent schemas

Issue: https://github.com/voyantjs/voyant/issues/859
Branch: bug/859-voyantjs-workflows-export-events-so-drizzle-kit-can-load-dep
State: active

## Purpose

Prepare an implementation workspace for the maintainer-approved issue.

## Current State

- Project item: PVTI_lADODiwsuc4BXR16zgss0v4
- Repository: voyantjs/voyant
- Base ref: origin/main
- Local workspace: /home/mihai/voyant/voyant/.agent-worktrees/859-voyantjs-workflows-export-events-so-drizzle-kit-can-load-dep
- Risk: Low
- Security risk: None
- Verification lane: verify:fast

## Agent Brief

**Category:** bug
**Summary:** Make the published `@voyantjs/workflows/events` subpath resolvable for Drizzle/schema-generation consumers.

**Current behavior:**
A consuming app that includes Voyant workflow-run persistence in its Drizzle schema can fail during `drizzle-kit generate` with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `@voyantjs/workflows/events`. The source and npm metadata currently show a `./events` subpath, so the likely failing contract is the published export conditions used by Drizzle/CJS-style resolution: `@voyantjs/workflows` declares `types` and `import` conditions but does not include the `default` condition used by other Voyant packages that support Drizzle schema loading.

**Desired behavior:**
Published consumers should be able to resolve `@voyantjs/workflows/events` while loading app schemas through Drizzle tooling. The fix should align `@voyantjs/workflows` public subpath export conditions with the package-export pattern used by Voyant schema/runtime packages, especially for `./events`, without removing existing ESM or type resolution behavior.

**Key interfaces:**
- `@voyantjs/workflows` package `exports` and `publishConfig.exports`
- `@voyantjs/workflows/events` runtime event helpers used by orchestrator and Hono packages
- Package export/tarball verification scripts that protect published manifest shape
- Drizzle schema-generation consumer path that loads Voyant packages from `node_modules`

**Acceptance criteria:**
- [ ] Add a regression test or package-export assertion proving `@voyantjs/workflows/events` is present in the published manifest with resolver-compatible conditions.
- [ ] Update the published `@voyantjs/workflows` export map so `./events` resolves for Drizzle/schema-generation tooling while preserving existing `types` and `import` targets.
- [ ] Audit sibling `@voyantjs/workflows` public subpaths and apply the same condition pattern where needed so the package surface is internally consistent.
- [ ] Confirm packages that import `@voyantjs/workflows/events` still typecheck and build.
- [ ] Add a Changeset for the public package behavior fix.

**Verification lane:**
Run focused workflow package checks plus the export verification lane: `pnpm --filter @voyantjs/workflows test`, `pnpm --filter @voyantjs/workflows typecheck`, `pnpm --filter @voyantjs/workflows build`, `pnpm verify:package-exports`, and `pnpm verify:package-tarballs` if practical. Run `pnpm verify:fast` before handoff if the change touches shared package verification scripts or multiple workflow packages.

**Security:**
Not security-sensitive. This is package resolution metadata for an existing public subpath. Do not expose new runtime capabilities, schema tables, secrets, or admin endpoints.

**Artifacts required:**
None beyond test output and the eventual PR diff.

**Out of scope:**
- Do not redesign workflow event APIs.
- Do not remove existing orchestrator or Hono imports of `@voyantjs/workflows/events` unless a compatibility-preserving replacement is added.
- Do not change workflow-run schema shape or generate a consuming-app migration as the primary fix.

## Desired Behavior

The issue is implemented according to its acceptance criteria and handed off
with evidence.

## Scope

In scope:

- Read the issue, linked comments, relevant docs, and affected code.
- Update this plan with concrete milestones before implementation.
- Keep changes on branch `bug/859-voyantjs-workflows-export-events-so-drizzle-kit-can-load-dep`.

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

- 2026-05-14 06:26 UTC - Local workspace and execution plan prepared by the runner.
- 2026-05-14 06:42 UTC - Keep implementation scoped to `@voyantjs/workflows`: add `default` resolver conditions to its public subpaths, add a package test for `./events` and sibling export consistency, and include a patch changeset.

## Progress Log

- 2026-05-14 06:26 UTC - Created local worktree and plan file. No implementation agent
  has run.
- 2026-05-14 06:42 UTC - Confirmed issue brief from GitHub and local plan match. Found `@voyantjs/workflows` already declares `./events` but its conditional exports only expose `types` and `import`, unlike schema/runtime packages that include `default`.
- 2026-05-14 06:55 UTC - Added `default` conditions for every `@voyantjs/workflows` public subpath in source and publish export maps, added a package export regression test for `./events` and sibling consistency, and added a patch changeset.
- 2026-05-14 06:55 UTC - Verification passed: `pnpm --filter @voyantjs/workflows test`, `pnpm --filter @voyantjs/workflows typecheck`, `pnpm --filter @voyantjs/workflows build`, `pnpm verify:package-exports`, `NODE_OPTIONS=--max-old-space-size=8192 pnpm verify:publish-tarballs`, and `pnpm verify:fast`. A default-heap `pnpm build` and default-heap `pnpm verify:publish-tarballs` hit unrelated UI package Node heap OOMs before the successful high-heap tarball rerun.

## Verification Plan

- `pnpm --filter @voyantjs/workflows test`
- `pnpm --filter @voyantjs/workflows typecheck`
- `pnpm --filter @voyantjs/workflows build`
- `pnpm verify:package-exports`
- `pnpm verify:publish-tarballs`

## Risks And Rollback

- Remove the local worktree with `git worktree remove /home/mihai/voyant/voyant/.agent-worktrees/859-voyantjs-workflows-export-events-so-drizzle-kit-can-load-dep` if this
  task is abandoned before implementation.
