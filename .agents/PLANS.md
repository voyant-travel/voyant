# Voyant Execution Plans

Use execution plans for work that may outlive one agent context window or one
work session.

## Location

- Active: `docs/agent-plans/active/`
- Completed: `docs/agent-plans/completed/`
- Abandoned: `docs/agent-plans/abandoned/`

File name format:

```text
<issue-number>-<short-slug>.md
```

Use `no-issue-<short-slug>.md` only for maintainer-approved work without an
issue yet.

## Template

```md
# <Plan Title>

Issue: <link or number>
Branch: <type>/<issue-number>-<short-slug>
State: active | completed | abandoned

## Purpose

Why this work exists.

## Current State

What exists now, with durable references to modules, interfaces, docs, and
observed behavior.

## Desired Behavior

The outcome in user-facing or maintainer-facing terms.

## Scope

In scope:

- ...

Out of scope:

- ...

## Milestones

- [ ] Milestone 1
- [ ] Milestone 2

## Decisions

- Decision, date, reason.

## Progress Log

- YYYY-MM-DD HH:MM UTC - note.

## Verification Plan

- command or browser proof
- command or test

## Risks And Rollback

Known risks and how to abandon or revert safely.
```

Update the progress log as work proceeds. Do not leave abandoned plans without
an abandonment reason.
