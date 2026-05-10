---
name: agent-brief
description: Draft durable agent briefs from issues, comments, video evidence, and codebase context. Use when preparing work for an AFK agent, moving an item toward ready-for-agent, or tightening acceptance criteria before dispatch.
---

# Agent Brief

Create or update the durable handoff contract for agent work. The brief is what
the execution agent works from; the issue discussion is supporting context.

## Workflow

1. Gather context:
   - issue body, comments, labels, Project fields, and prior triage notes
   - attached screenshots, videos, logs, and transcripts
   - relevant `AGENTS.md`, `.agents/WORKFLOW.md`, `.agents/SECURITY.md`, and
     `docs/agents/*`
   - relevant architecture docs and domain vocabulary
2. Inspect the codebase when the issue points at a concrete area. Prefer
   interfaces and behavior over stale file paths.
3. Draft the brief using the template below.
4. Flag missing information instead of inventing certainty.
5. Leave the item for maintainer approval. Do not mark it `Ready`.

## Template

```md
## Agent Brief

**Category:** bug | enhancement | refactor | investigation | cleanup
**Summary:** one-line description

**Current behavior:**
What happens now.

**Desired behavior:**
What should happen after the work is complete, including edge cases.

**Key interfaces:**
- Durable type, route, package surface, config shape, workflow, or UI surface

**Acceptance criteria:**
- [ ] Specific, testable criterion
- [ ] Specific, testable criterion

**Verification lane:**
Expected command(s), browser proof, or custom verification.

**Security:**
Actor, trust boundary, data sensitivity, abuse case, and required tests when
relevant. Write "Not security-sensitive" only when that is clearly true.

**Artifacts required:**
Screenshots, videos, logs, traces, or none.

**Out of scope:**
- Adjacent work the agent must not do
```

## Video Evidence

When a reporter provides a narrated screen recording, extract:

- transcript summary
- timestamped observed behavior
- route/page/component clues
- console or network errors if available
- candidate reproduction steps
- missing details to ask for

The brief still needs a deterministic feedback loop before execution: test,
curl script, Playwright repro, captured request replay, or another pass/fail
signal. If no loop can be built, recommend `needs-info` or `ready-for-human`.

## Quality Rules

- Avoid line numbers and brittle file paths unless the task is a tiny mechanical
  edit.
- Describe behavior and interfaces, not step-by-step implementation.
- Include explicit out-of-scope boundaries.
- Use Voyant domain terms from `UBIQUITOUS_LANGUAGE.md`.
- Mention reusable UI surfaces for UI work: `packages/ui`, `*-ui`,
  `*-react`, registry surfaces, or existing template composition.
- For public package changes, call out whether a Changeset is expected.
