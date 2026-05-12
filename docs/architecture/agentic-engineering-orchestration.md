# Agentic Engineering Orchestration

Status: proposal / planning.

This document describes how Voyant should make coding-agent work efficient
without lowering the quality bar. The target agents are Codex and Claude-class
coding agents, but the architecture is deliberately tool-neutral: GitHub
Projects is the work control plane, each task gets an isolated workspace, and
the repository supplies the harness, rules, observability, and verification
contract.

The short version:

- GitHub Projects can replace Linear as the task state machine if only
  maintainers can move work into the agent-ready lane.
- Every agent task should run in an isolated worktree or remote sandbox with a
  deterministic dev-server, browser, log, metric, trace, and video surface.
- Long-running work needs checked-in execution plans, not chat history.
- Agent quality comes from mechanical guardrails: typed boundaries, security
  gates, architecture checks, focused tests, reproducible UI evidence, release
  discipline, and review feedback promoted into docs or scripts.
- The first implementation should be boring: one repo-owned workflow policy,
  agent skills, one GitHub Project, one local runner, and one remote sandbox
  adapter after the local loop is proven.

## Source Review

The plan is based on the following external references, reviewed on
2026-05-10:

- OpenAI's
  [Symphony article](https://openai.com/index/open-source-codex-orchestration-symphony/)
  and the
  [Symphony spec](https://github.com/openai/symphony/blob/main/SPEC.md)
  describe a long-running daemon that reads tracker work, creates one isolated
  workspace per issue, runs a coding agent, restarts stalled runs, and leaves
  ticket mutation to the agent's normal tools.
- OpenAI's
  [harness engineering article](https://openai.com/index/harness-engineering/)
  frames the repository as the agent's system of record. It also identifies
  browser access, logs, metrics, traces, screenshots, videos, mechanical
  architecture checks, and recurring cleanup as the difference between agent
  throughput and agent drift.
- OpenAI's
  [PLANS.md cookbook](https://developers.openai.com/cookbook/articles/codex_exec_plans)
  treats multi-hour work as a self-contained, living execution plan with a
  progress log, decisions, milestones, and explicit verification.
- OpenAI's
  [Codex app-server docs](https://developers.openai.com/codex/app-server)
  show the product-facing protocol for threads, turns, streamed events,
  approvals, history, health checks, and resumable agent sessions. It is useful
  for a rich internal agent console; for CI-style automation the docs point to
  the Codex SDK instead.
- GitHub's docs for
  [Project access](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/managing-access-to-your-projects),
  [auto-add workflows](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically),
  [sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues),
  [issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms),
  [issue fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-issue-fields),
  and
  [Projects REST API](https://docs.github.com/en/rest/projects/items)
  cover the GitHub-native replacement for Linear.
- Sprites docs describe
  [persistent isolated Linux environments](https://docs.sprites.dev/),
  [CLI/SDK automation](https://docs.sprites.dev/quickstart/), command
  execution, HTTP access, idle behavior, and persistent filesystems. Sprites are
  a credible remote sandbox option after the local runner contract is stable.
- Matklad's
  [ARCHITECTURE.md note](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html)
  argues for a short codemap that tells contributors where things live and
  which boundaries matter.
- Alexis King's
  [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
  supports Voyant's existing habit of turning boundary data into typed values
  before domain code sees it.
- Steve Krenzel's
  [AI Is Forcing Us To Write Good Code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code)
  reinforces the same practical requirements: tests, clear docs, small modules,
  static typing, easy dev environments, and explicit guardrails.
- Geoffrey Huntley's
  [ralph loop note](https://ghuntley.com/loop/)
  is useful as a caution: a reliable loop is more important than elaborate
  agent-to-agent protocols early on.
- Matt Pocock's
  [skills repository](https://github.com/mattpocock/skills)
  shows a mature small-skill operating model for real coding agents. The
  reusable ideas are not the specific skills themselves, but the structure:
  per-repo setup docs for issue tracker and labels, durable agent briefs,
  domain-aware grilling, vertical-slice issue generation, TDD and diagnosis
  loops, and an `.out-of-scope/` memory for rejected requests.

## Existing Voyant Assets

Voyant is already unusually close to an agent-friendly codebase:

- `AGENTS.md` is short and points to deeper docs instead of becoming a manual.
- `UBIQUITOUS_LANGUAGE.md` gives agents canonical domain terms.
- `docs/adr/0001-tenant-scoping.md` and `docs/architecture/*` record active
  architectural rules.
- `pnpm verify:fast` combines changed-file linting, affected typecheck/tests,
  and architecture checks.
- `pnpm verify:full` is broad enough for release and high-risk changes.
- `scripts/check-tenant-scoping.mjs` and `scripts/check-route-authoring.mjs`
  already promote repeated review feedback into mechanical checks.
- `.github/workflows/ci.yml` splits source checks and build/package checks.
- The `@voyantjs/workflows` and `@voyantjs/workflows-orchestrator` packages,
  plus `apps/workflows-selfhost-node-server` and
  `apps/workflows-local-dashboard`, provide useful local orchestration and
  observability patterns.

The main gaps are outside the product runtime:

- There is no repository-owned agent workflow policy like `WORKFLOW.md`.
- There is no checked-in execution-plan convention for multi-hour changes.
- There is no GitHub Project schema that acts as the agent state machine.
- There is no runner that maps a GitHub Project item to a worktree, branch,
  agent session, logs, browser session, video, PR, and evidence packet.
- There is no standard local or remote sandbox contract for agent work.
- UI debugging and observability are not yet exposed as first-class tools for
  agents working on this repo.
- CI repair and PR shepherding are still human-or-chat driven rather than
  represented as task states.

## Skills As The Human-Readable Policy Layer

Symphony-style orchestration answers "which work runs where?" Skills answer
"how should the agent behave once it starts?" Voyant should use both.

Matt Pocock's skills repo is useful because it avoids a heavyweight process
engine. Instead, it uses small, composable skills backed by repo-local
configuration:

- a setup skill discovers the issue tracker, triage labels, and domain docs,
  then writes stable docs under `docs/agents/`
- triage maps incoming work through canonical roles like `needs-triage`,
  `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`
- agent briefs become the durable contract for AFK work, written as behavior,
  acceptance criteria, key interfaces, and explicit out-of-scope items
- PRDs can be turned into independently grabbable vertical-slice issues
- TDD is framed as one red-green tracer bullet at a time, not "write all tests
  then all code"
- diagnosis starts by building the feedback loop, then reproduces, ranks
  hypotheses, instruments, fixes, regression-tests, and cleans up
- rejected enhancements go into `.out-of-scope/` so future triage can avoid
  re-litigating the same decision

For Voyant, this suggests a clear split:

- `AGENTS.md` remains a short map.
- `docs/architecture/*` remains architectural policy.
- `docs/agents/*` should hold operational agent config: issue tracker, Project
  fields, label mapping, domain-doc layout, artifact policy, and evidence
  packet rules.
- `.agents/WORKFLOW.md` should hold the runner policy that the orchestrator
  injects into agent sessions.
- `.agents/PLANS.md` should hold the execution-plan format.
- An `agent-brief` skill should help humans and triage agents turn issue
  context, comments, video evidence, and codebase findings into the durable
  brief format.
- `.out-of-scope/` should hold durable "we do not do this" decisions for
  rejected workflow and product requests.

Do not install third-party skills blindly into the repo as policy. Treat them
as reference implementations and copy the ideas that fit Voyant's vocabulary,
GitHub Project shape, and quality bar.

## Design Principles

### 1. GitHub Projects Is The Control Plane

The task tracker should own work state. Agent sessions, worktrees, branches,
PRs, screenshots, videos, and CI runs are execution details attached to that
state.

Recommended control-plane object:

- An organization-level GitHub Project named `Voyant Engineering`.
- Base permission set to `No access` or `Read`.
- Maintainer team granted `Write`.
- Agent GitHub App granted only the permissions it needs to read project items,
  create branches, open PRs, comment, and update project fields.
- Public or broad contributor issue creation can remain open, but those issues
  do not run agents until a maintainer moves or labels them into the
  agent-ready lane.

GitHub's access model supports this: organization project admins can set base
permission for the organization and grant specific teams `Read`, `Write`, or
`Admin`. Issue forms can set a `projects` key, but GitHub notes that the issue
opener needs write permission to that project. For external reporters, use an
auto-add workflow with a maintainer-controlled label instead of relying on the
form to add the item directly.

### 2. Maintainers Gate Execution, Not Issue Creation

We should not restrict legitimate issue intake just to protect agent budget.
Instead, keep issue reporting open while preventing unreviewed submissions from
spending compute or shaping the agent work queue.

The gate should be:

- Required label: `agent:ready`.
- Required Project field: `Agent State = Ready`.
- Required Project field: `Maintainer Approved = Yes`.
- Optional issue type: `Task`, `Bug`, `Refactor`, `Investigation`, or
  `Cleanup`.

The runner only polls items matching all gates. Contributors may file issues;
only maintainers can promote them to agent work.

There can still be an automated triage lane before this gate. The distinction
is important:

- **Triage agents** may read new issues, classify them, summarize them,
  identify missing information, suggest duplicate/out-of-scope matches, and
  draft an agent brief.
- **Execution agents** may create workspaces, run commands, spend meaningful
  compute, open PRs, or mutate code.

The triage lane can use a cheaper or weaker model because the allowed actions
are low-risk and reviewable. It should not be able to set
`Maintainer Approved = Yes`, add `agent:ready`, or move `Agent State` to
`Ready`. It produces recommendations; maintainers promote work.

### 3. One Task, One Workspace, One Evidence Packet

Every agent task gets:

- a deterministic workspace path
- a branch name derived from the work type, issue number, and slug
- a per-task dependency install/cache policy
- a dev-server allocation
- a browser target
- logs, traces, metrics, and command transcripts
- screenshots or videos for UI work
- a PR or a written no-code investigation result
- a final evidence packet linked back to the Project item

The evidence packet should include:

- summary of changes
- files touched
- verification commands and outcomes
- screenshots/videos when UI behavior changed
- known residual risks
- security considerations when the task touches a sensitive area
- links to PR, CI run, and logs
- explicit handoff state

### 4. Plans Are Source, Chat Is Ephemeral

For narrow tasks, the GitHub issue can be enough. For multi-hour work,
create an execution plan under `docs/agent-plans/active/`.

Each plan should be self-contained enough for a fresh agent to continue after
context loss. It should include:

- purpose
- current state
- desired behavior
- milestones
- files and modules likely involved
- decisions
- progress log
- verification plan
- rollback or abandonment criteria

Completed plans move to `docs/agent-plans/completed/`. Abandoned plans move to
`docs/agent-plans/abandoned/` with the reason they stopped.

### 5. Agent Legibility Is A Product Requirement

Anything the agent must know repeatedly belongs in the repository or in a tool
that the runner exposes. This includes:

- architecture rules
- coding patterns
- product vocabulary
- setup instructions
- local services
- generated schema docs
- current verification lanes
- external API references that are stable enough to vendor or summarize
- recurring review feedback

If a rule is repeated in review, either document it or enforce it. If it is
mechanical enough to enforce, prefer a script.

### 6. Dependency Knowledge Must Be Fresh

Agents should not rely on stale memory for third-party APIs, framework
behavior, or dependency best practices. This matters for auth, deployment,
database tooling, routing, SDKs, UI libraries, and anything with fast-moving
documentation.

Freshness rules:

- If a task touches a third-party integration, dependency config, auth, billing,
  deployment, migrations, SDK usage, or security-sensitive behavior, the agent
  must consult current primary documentation or repo-vendored reference docs.
- Prefer official docs, package docs, changelogs, migration guides, and
  `llms.txt`/`llms-full.txt` sources where available.
- Prefer installed skills or repo-local reference files for dependencies we use
  repeatedly, such as Better Auth, WorkOS, Trigger.dev, Payload, Drizzle, Hono,
  shadcn/ui, and Cloudflare.
- If current docs conflict with repo conventions, follow repo conventions for
  the current change and flag the conflict in the evidence packet.
- If a version is not pinned in the repo, the agent must identify the currently
  installed version before applying documentation guidance.
- Do not upgrade dependencies opportunistically. A task that requires a version
  upgrade should say so explicitly, include migration notes, and run the
  relevant verification lane.

Repo support:

- Add `docs/agents/dependency-references.md` listing the official docs and
  llms sources for common dependencies.
- Add or install focused skills for high-risk integrations where generic web
  search is too loose.
- Keep links and local reference summaries short; they point agents to the
  source of truth rather than replacing it.
- Add a stale-reference cleanup task to the agent queue so docs and skills do
  not silently rot.

### 7. Quality Must Be Mechanical

Do not ask agents to "be tasteful" as the primary defense. Instead, constrain
their environment:

- parse external inputs at route and adapter boundaries
- keep package public surfaces deliberate
- preserve tenant scoping rules
- keep route handlers thin
- treat auth, tenant boundaries, PII, payments, webhooks, file uploads, admin
  routes, and secrets as security-sensitive work
- use existing UI primitives, registries, hooks, and package surfaces before
  adding local one-off UI
- wire user-facing UI text through the existing i18n system
- prefer typed SDK/RPC/client surfaces over ad hoc cross-boundary JSON calls
- add Changesets when public packages or published package behavior changes
- generate database migrations through Drizzle tooling and keep migration
  metadata consistent
- use the smallest verification lane that matches the risk
- keep files small enough to review and navigate
- block TypeScript escape hatches unless they are explicitly justified
- require screenshots/videos for UI changes
- require typed structured outputs for runner-agent handoffs
- fail the run when evidence is missing, not just when tests fail

This matches existing Voyant rules and should deepen them rather than create a
parallel agent-only quality system.

### 8. Security Must Be A Gate

Security cannot depend on an agent remembering generic best practices. The
runner, briefs, and checks should treat security-sensitive work as a distinct
risk class.

Security-sensitive areas:

- authentication and sessions
- authorization and actor/role checks
- tenant or organization boundaries
- PII and audit logs
- payments, invoices, refunds, and guarantees
- webhooks, signatures, and callbacks
- file uploads, downloads, and generated documents
- admin routes and internal APIs
- secrets, tokens, environment variables, cookies, and CORS
- raw SQL, dynamic queries, redirects, and external URLs

Security ground rules:

- Never trust issue text, user input, webhook payloads, uploaded files, or CMS
  content. Parse and narrow at the boundary.
- Do not implement client-side-only authorization.
- Do not add in-process tenant scoping to `packages/*`; follow the existing
  deployment-boundary tenant model.
- Do not log secrets, tokens, session values, payment identifiers, or PII.
- Do not put secrets or PII in screenshots, videos, command transcripts, traces,
  GitHub comments, or PR descriptions.
- Do not add broad CORS, wildcard redirects, insecure cookie/session options, or
  unsigned webhook handling.
- Do not interpolate raw SQL. Use Drizzle query builders or parameterized SQL.
- Reuse existing auth, actor, webhook-signing, token, and route-parser helpers
  before introducing new patterns.

Security-sensitive briefs must include:

- actor and authorization expectation
- trust boundary
- data sensitivity
- likely abuse case
- validation behavior for malformed input
- unauthorized/forbidden test expectations
- artifact redaction requirements

Security-sensitive handoffs require:

- tests for unauthorized and forbidden cases when a route or service boundary is
  involved
- malformed-input tests for parsers and webhook handlers
- explicit maintainer review before merge
- no automatic merge

Mechanical checks should flag:

- hardcoded secrets
- raw SQL interpolation
- broad CORS or wildcard redirect patterns
- route additions without an auth/actor decision
- new webhook handlers without signature or source validation
- logging of suspicious fields such as token, secret, password, session, ssn,
  passport, email, phone, or payment details
- `@ts-ignore`, `@ts-nocheck`, or unsafe assertions in auth/security-sensitive
  files

### 9. Static Checks Should Block Agent Shortcuts

Agents are prone to satisfying the immediate task by making broad, hard-to-review
changes: huge files, weak typing, suppressed compiler errors, and unchecked casts.
Those should be blocked mechanically.

Add or extend lint/typecheck checks for:

- file size: warn above 500 lines and fail above 600 lines, with narrow
  exceptions for generated files, route trees, registries, migration files, or
  deliberately documented legacy files
- TypeScript suppressions: reject `@ts-ignore`, `@ts-nocheck`, and broad
  `@ts-expect-error` unless the line includes a short reason and an issue link
  or TODO owner
- unsafe casts: reject `as unknown as`, repeated `as any`, and broad
  assertion chains outside approved adapter/test seams
- weak types: reject new exported `any` surfaces and new public APIs that use
  `unknown` without a parser or narrowing function
- disabled lint rules: reject blanket file-level disables unless the file is
  generated or the exception is documented
- unreachable TODOs: require owner/context for TODO/FIXME comments introduced by
  agent work

These checks should run in `pnpm verify:fast` once stable. Start as a reporting
script so maintainers can tune exceptions, then make it blocking after the
baseline is clean.

### 10. Release, I18n, And Migration Discipline

Agent work should obey the same release and deployment rules as human work.
These are easy for agents to miss because the code change may compile without
them.

Public package changes:

- If a change affects a published package's public API, runtime behavior,
  styles, assets, generated registry output, docs that ship with a package, or
  package exports, add a Changeset.
- The Changeset should name the affected package, choose `patch`, `minor`, or
  `major` intentionally, and describe the user-visible change in release-note
  language.
- Internal-only refactors that do not affect published behavior may omit a
  Changeset, but the PR evidence packet should say why.
- The runner should flag touched `packages/*/package.json`, package exports,
  public `src/index.ts` barrels, or `files`/`publishConfig` changes without a
  Changeset.

I18n:

- User-facing UI strings must use the existing i18n conventions for the package
  or template.
- Do not add hardcoded English labels, empty states, toasts, validation
  messages, or button text unless the existing file is already intentionally
  non-i18n and the exception is documented.
- UI handoffs should include the relevant i18n check result when text changes.
- Existing `pnpm i18n:check` and `pnpm verify:full` remain the broad
  backstops; `verify:agent-quality:changed` should add a faster changed-file
  signal for obvious hardcoded UI strings.

Database migrations:

- Schema changes should use the repo's Drizzle generation path, not handwritten
  SQL by default.
- If Drizzle generation is blocked by an interactive prompt or missing local
  database state, the agent must stop and report the blocker before inventing a
  migration.
- If a manual migration is explicitly approved, it must follow the repo's
  timestamp/name convention, update any Drizzle migration journal metadata, and
  include a reason in the PR evidence packet.
- The agent should never modify generated migration snapshots or journals
  casually. Those files are part of the migration contract.

### 11. Code Writing Ground Rules

The workflow policy should state how agents are expected to write code, not just
how they verify it.

Ground rules:

- Prefer deep modules: small interface, meaningful behavior behind it, and
  tests through that interface.
- Apply SOLID principles where they reduce coupling or improve locality; do not
  introduce abstract interfaces for hypothetical adapters.
- Keep routes thin: parse inputs, resolve services, call domain workflows, and
  serialize responses.
- Parse, then act. Use Zod, route parsers, or typed mappers at boundaries before
  domain logic sees external data.
- Prefer typed client surfaces for cross-boundary calls. UI code should use
  existing `*-react` hooks; stable app/service boundaries should use typed
  clients, generated SDKs, or Hono/RPC-style clients when they provide real
  request/response types.
- Do not create shallow SDKs for one-off route-local calls. Add a typed client
  when the boundary is reused, public, cross-app, or agent-facing enough that
  discoverability and compile-time checks are worth the surface area.
- Treat SDK/RPC/client packages as contracts: test them at the boundary and add
  Changesets when published behavior changes.
- Name files by domain behavior, not implementation trivia. File names should
  be readable in search results and understandable to a fresh agent.
- Co-locate code with the module that owns the concept; avoid generic
  `utils.ts`, `helpers.ts`, or `types.ts` dumping grounds unless the package
  already has a narrow established convention.
- Avoid broad refactors inside feature or bug-fix tasks unless the brief calls
  for them.
- Keep generated, registry, and migration files clearly separated from
  hand-authored code so agents can inspect the right layer.

### 12. UI Quality Should Be Model-Independent

Codex should get the first execution adapter, but UI quality cannot depend on
which provider happens to be better at frontend work. The repository needs
explicit UI rules and checks that make either Codex or Claude use Voyant's
existing UI system.

UI agent policy:

- Read `docs/frontend-package-strategy.md` before changing user-facing UI.
- Reuse components and primitives from `packages/ui`, package-specific
  `*-ui` packages, and existing template components before creating local
  components.
- Prefer existing React hooks from `*-react` packages over ad hoc fetch/state
  code.
- Prefer typed route/client helpers over raw `fetch` when a stable client
  surface exists.
- If a local component is necessary, keep it scoped to the route or feature and
  promote it to a reusable package only after a second concrete use.
- Do not copy registry-generated component code into app routes when an import
  from the package or registry surface exists.
- Do not introduce new visual language without a screenshot-backed reason.
- UI briefs must name the relevant reusable surfaces to inspect, such as
  `packages/ui`, `packages/products-ui`, `packages/suppliers-ui`, or the
  existing page composition in the target template.
- UI handoffs require browser evidence: screenshot for static UI, video for
  interaction-heavy changes, plus console/network error capture.
- UI handoffs with copy changes require i18n evidence.

The agent-quality checker should eventually flag obvious UI shortcuts:

- new route-local components that duplicate an exported `packages/ui` or
  `*-ui` component name
- direct ad hoc API calls when a `*-react` hook exists for the same surface
- large UI files over the size threshold
- copied registry code where a package import is available
- hardcoded user-facing strings in i18n-covered files

This does not mean Codex must be the only UI worker. For UI-heavy tasks, the
Project item can set `Agent Provider = claude`, or Codex can do backend/data
work while Claude handles the UI slice. The control-plane contract should stay
the same either way.

## GitHub Project Shape

Recommended fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `Status` | Single select | GitHub Project workflow state used by the runner. |
| `Agent State` | Single select | Main state machine. |
| `Maintainer Approved` | Single select | Required execution gate: `No`, `Yes`. |
| `Risk` | Single select | `Low`, `Medium`, `High`, `Unknown`. |
| `Security Risk` | Single select | `None`, `Sensitive`, `Needs security review`. |
| `Verification Lane` | Single select | `package`, `verify:fast`, `verify:full`, `custom`. |
| `Triage Provider` | Single select | Cheap intake model or `manual`. |
| `Agent Provider` | Single select | `codex`, `claude`, `manual`, `none`. |
| `Workspace` | Text | Local worktree path or remote sandbox reference. |
| `Branch` | Text | Current work branch. |
| `PR` | Text | Pull request URL. |
| `Last Heartbeat` | Date | Staleness detection. |
| `Blocked By` | Text | Parent issue, dependency, or human decision. |
| `Evidence` | Text | Link to comment, artifact, or run summary. |

Recommended `Agent State` values:

- `Triage`
- `Ready`
- `Planning`
- `Running`
- `Blocked`
- `Human Review`
- `Changes Requested`
- `CI Repair`
- `Merge Ready`
- `Done`
- `Abandoned`

Recommended `Status` values:

- `Todo`
- `In Progress`
- `Done`

State rules:

- Only maintainers move `Triage` to `Ready`.
- The runner moves `Ready` to `Planning` or `Running`.
- Agents may move their own item to `Blocked`, `Human Review`, `CI Repair`,
  `Done`, or `Abandoned`, but each transition must leave a comment.
- Merge is never implicit. Either a maintainer merges, or a separate
  maintainer-approved merge automation handles `Merge Ready`.
- Sub-issues model decomposition. The runner only starts sub-issues that are
  unblocked.

## Triage And Agent Briefs

Before an item can enter `Ready`, it needs a durable agent brief. The brief is
the handoff contract, not a transcript summary.

Brief authoring should be a skill, not an ad hoc template pasted into comments.
Most briefs will be written with AI assistance anyway; a skill keeps the output
consistent while letting maintainers edit and approve the final contract.

Recommended brief shape:

- `Category`: `bug`, `enhancement`, `refactor`, `investigation`, or `cleanup`
- `Summary`: one sentence
- `Current behavior`: what happens now
- `Desired behavior`: what should happen after the change
- `Key interfaces`: durable interface names, type names, route shapes, config
  shapes, or package surfaces that matter
- `Acceptance criteria`: concrete pass/fail checks
- `Verification lane`: expected command or lane
- `Security`: actor, trust boundary, data sensitivity, abuse case, and required
  tests when relevant
- `Artifacts required`: screenshots, videos, logs, traces, or none
- `Out of scope`: adjacent work the agent must not do

The brief should avoid file paths and line numbers unless the task is a tiny
mechanical edit. Paths drift; behavior and interfaces last longer.

Recommended triage roles:

- `needs-triage`: maintainer must evaluate
- `needs-info`: reporter must answer specific questions
- `ready-for-agent`: fully specified and maintainer-approved
- `ready-for-human`: valid work, but requires human judgment or access
- `wontfix`: not actioned

This role set can map onto labels, Project fields, or both. The runner should
read the mapping from `docs/agents/triage-labels.md` instead of hardcoding label
strings.

A triage agent may apply `needs-triage`, suggest `needs-info`, and draft the
brief. It may also add a comment with an AI-generated disclaimer and a
recommendation such as "ready-for-agent after maintainer approval." It must not
apply the final execution gate itself.

Recommended `agent-brief` skill behavior:

- read the issue body, comments, labels, Project fields, attached evidence, and
  any prior triage notes
- inspect relevant code and architecture docs when the issue points at a
  concrete area
- extract current behavior, desired behavior, key interfaces, acceptance
  criteria, verification lane, required artifacts, and out-of-scope boundaries
- flag contradictions, missing decisions, or insufficient repro details instead
  of inventing certainty
- produce a draft brief as a comment or markdown block for maintainer editing
- never mark the item `Ready` by itself

### Video Bug Reports

Narrated screen recordings are useful triage evidence. Reporters often explain
the expected behavior while showing the broken path, which is faster than
writing perfect reproduction steps.

The triage lane should support video attachments by turning them into structured
evidence:

- transcript of narration
- timestamped summary of visible behavior
- key frames or short clips around the failure
- detected URL, route, component, or workflow area when visible
- observed console/network errors when logs are available
- draft reproduction steps
- missing details to ask the reporter for

The video is not the source of truth for a fix. Before execution starts, the
agent brief should still identify a deterministic feedback loop: a test, curl
script, Playwright repro, captured request replay, or other pass/fail signal.
If the only evidence is a video and no reproducible loop can be built, keep the
item in `needs-info` or `ready-for-human` instead of promoting it to
`ready-for-agent`.

## Runner Architecture

The runner should be a daemon outside the product runtime. It may later become
an app under `apps/`, but it should not be entangled with Voyant's travel
domain packages.

The long-term target is a 24/7 runner, not 24/7 individual agent sessions. The
runner stays alive, polls or receives work, manages state, dispatches bounded
agent attempts, watches heartbeats, repairs CI failures, and archives evidence.
Each agent attempt should stay scoped to one issue, one workspace, one budget,
and one evidence packet. If it stalls, loops, exceeds budget, or loses context,
the runner should pause or stop it and restart from the saved issue brief,
execution plan, logs, and artifacts.

Main modules:

1. `Project Client`
   Reads GitHub Project items, normalizes fields into a typed `AgentTask`, and
   writes comments/state updates.

2. `Policy Loader`
   Reads repository-owned workflow policy. Start with `.agents/WORKFLOW.md` and
   `docs/agents/*`; keep `AGENTS.md` as the pointer.

3. `Workspace Manager`
   Creates deterministic worktrees or remote sandboxes. Handles branch naming,
   cleanup, dependency install, cache reuse, and conflict detection.
   Branches should use the work convention (`fix/123-short-slug`,
   `feature/123-short-slug`, `docs/123-short-slug`, `chore/123-short-slug`),
   not provider names.

4. `Agent Runner`
   Starts Codex or Claude with a typed prompt, the right `cwd`, model/provider
   settings, sandbox policy, and available tools. For Codex-rich-client
   integrations, Codex app-server can stream threads and turns. For
   non-interactive jobs, prefer the corresponding automation SDK/CLI.

5. `Dev Environment Manager`
   Starts the smallest app surface needed for the task. Allocates ports,
   writes per-workspace env files, and exposes health checks.

6. `Browser Harness`
   Uses Playwright, Chrome DevTools Protocol, or an MCP browser tool to capture
   DOM snapshots, screenshots, console errors, network failures, and videos.

7. `Observability Harness`
   Captures command logs, app logs, browser logs, traces, metrics, and CI logs.
   The first version can be files under the workspace. Later versions can add
   Prometheus/LogQL/TraceQL-compatible stores.

8. `Verifier`
   Chooses and runs the declared lane. It should know `pnpm verify:fast`,
   `pnpm verify:full`, package-scoped commands, and any task-specific commands
   declared in the issue or plan.

9. `PR Shepherd`
   Opens draft PRs, updates descriptions, watches CI, asks the agent to repair
   failures, rebases when allowed, and produces the final evidence packet.
   PR titles, descriptions, commit messages, and contributor metadata should
   describe the work without mentioning Codex, Claude, or any agent provider
   unless the maintainer explicitly asks for provenance disclosure.

10. `Run Store`
    Persists task id, workspace id, thread/session id, branch, process ids,
    last heartbeat, attempts, artifacts, and terminal status. SQLite is enough
    for a local prototype. Postgres is better for a shared daemon.

## Workspace Strategy

### Local First

Start with local Git worktrees:

- Cheap to implement.
- Compatible with current `pnpm` and Turbo flows.
- Easy to inspect manually.
- Good enough to prove Project state, prompts, verification, and PR flow.

Required local behavior:

- Use one branch per task.
- Branch names should follow
  `<type>/<issue-number>-<short-slug>`, for example
  `fix/123-calendar-date-filter`, `feature/456-agent-runner`,
  `docs/789-agent-workflow-policy`, or `chore/321-quality-checker`.
- Do not name branches after the agent or provider (`codex/*`, `claude/*`).
  The branch should describe the work, not who or what performed it.
- Do not mention the agent provider in commits or PRs by default. Avoid
  "generated by", provider signatures, co-author trailers, or contributor
  entries naming Codex/Claude unless a maintainer explicitly asks for that
  provenance.
- Do not share dev servers between tasks.
- Prefer shared pnpm store and Turbo cache.
- Keep per-task `.env.local` files out of git.
- Keep artifacts under `.agents/runs/<issue-number>/` or outside the repo.
- Clean up only after PR merge, abandonment, or explicit maintainer action.

### Remote Sandbox Second

After the local runner works, add a remote sandbox adapter. Sprites are a
credible candidate because they provide isolated persistent Linux
environments, command execution, streaming output, HTTP access, and idle
behavior. They may solve local RAM pressure and allow work to keep running
without a developer laptop.

The runner should treat Sprites as one adapter behind the same workspace
interface. The GitHub Project `Workspace` field should use one of two typed
references: `.agent-worktrees/<issue-number>-<slug>` for local worktrees, or
`sandbox:<provider>:<id>` for remote sandboxes. Runner code must parse the
reference before acting on it; a remote sandbox reference must not be resolved
as a local path. Until a remote adapter owns execution, browser capture,
handoff, evidence publishing, and PR publishing, those local-only commands must
reject `sandbox:` workspace references explicitly. Queue recommendation code
must also pause remote-workspace items with adapter wait states instead of
dispatching local lifecycle commands.

```ts
interface AgentWorkspace {
  id: string
  kind: "local-worktree" | "remote-sandbox"
  provider?: string
  reference: string
  cwd: string
  branch: string
  exec(command: WorkspaceCommand): Promise<WorkspaceCommandResult>
  spawn(command: WorkspaceCommand): Promise<WorkspaceProcess>
  exposeHttp(port: number): Promise<{ url: string }>
  collectArtifacts(): Promise<AgentArtifact[]>
  dispose(opts: { keepForReview: boolean }): Promise<void>
}
```

Do not build the orchestration around Sprites-specific concepts until one
adapter proves insufficient.

## Browser, Logs, And Video

UI work is not complete until the agent can see and prove the UI behavior.

Minimum harness:

- allocate a dev server port per workspace
- run Playwright against that port
- capture screenshot on failure
- capture console errors and failed network requests
- record video for user-facing UI changes
- redact secrets and PII from screenshots, videos, logs, traces, and command
  transcripts before durable storage
- attach artifacts to the Project item or PR
- process reporter-provided videos into transcripts, timestamped observations,
  and candidate reproduction steps during triage

Better harness:

- expose a browser MCP server or Chrome DevTools Protocol endpoint
- provide a `browser-smoke` task that accepts a URL and path list
- capture before/after videos for bug fixes
- fail the evidence packet if a UI task lacks browser proof

Observability should follow the same pattern. Start with structured log files
and command transcripts; add local OpenTelemetry, metrics, and query APIs once
the runner has enough demand to justify them.

## Codex And Claude Compatibility

The runner should own task policy and evidence contracts. Agent providers should
be adapters.

Shared contract:

- task prompt
- repository instructions
- workspace path
- allowed commands/tools
- expected output schema
- heartbeat events
- artifact paths
- verification lane
- final handoff schema

Codex-specific:

- Use Codex app-server for rich thread/turn streaming, approvals, history,
  and resumable sessions in an internal console.
- Use Codex automation surfaces for CI-like non-interactive work.
- Keep Codex skills and MCP tools repo-local or runner-provided where possible.

Claude-specific:

- Use the same workspace, prompt, artifact, and verification contracts.
- Treat Claude's browser/log/tooling differences as adapter concerns.
- Do not let provider-specific project states leak into GitHub Projects.

## Security And Abuse Controls

Execution gates:

- private or restricted GitHub Project
- maintainer-only `agent:ready` label or field transition
- allowlist of repositories the runner can mutate
- allowlist of commands for high-risk tasks, or provider sandbox policy
- no secrets in issue body, comments, screenshots, videos, or logs
- per-task token with least privilege where practical
- no automatic merge unless separately approved

Network and sandbox controls:

- local worktrees use the user's local trust model
- remote sandboxes should receive only task-scoped credentials
- browser recordings must redact secrets and PII where possible
- destructive commands require a runner-level denylist and review gate
- public issue text must be treated as untrusted input

GitHub abuse controls:

- Anyone may file an issue if the repo allows it.
- Only maintainers can add `agent:ready` or set `Maintainer Approved`.
- Auto-add workflows should target maintainer labels, not arbitrary new issues.
- Project write access should not be granted to broad contributor groups.
- The agent GitHub App should be install-scoped and permission-scoped.

## Quality Bar

The agent runner should reject a handoff when:

- no verification command was run
- the verification command failed without an explicit accepted reason
- lint/typecheck policy checks fail
- a public package change lacks a required Changeset
- UI copy changes bypass the i18n system
- schema changes include handwritten or inconsistent migrations without an
  approved blocker note
- security-sensitive work lacks actor/trust-boundary notes, required security
  tests, or maintainer-review marker
- artifacts contain unredacted secrets or PII
- new files exceed the file-size threshold without an approved exception
- TypeScript suppressions or unsafe assertion chains were introduced without
  documented justification
- UI changes lack screenshots or videos
- route changes bypass `parseJsonBody(...)` or `parseQuery(...)`
- package code adds in-process tenant scoping
- public exports expand without intent
- architectural docs are changed without relevant checker/docs updates
- PR titles, descriptions, commit messages, or contributor metadata mention the
  agent provider without explicit maintainer approval
- the final answer lacks risks for high-risk work
- the PR description omits the evidence packet

Task-type loops should be explicit:

- Bug work uses a diagnosis loop: create a feedback signal, reproduce, rank
  hypotheses, instrument narrowly, fix, add a regression check, remove debug
  probes.
- Feature work uses vertical slices: one demoable tracer bullet at a time, with
  tests through public interfaces.
- Architecture work uses domain vocabulary and ADRs before proposing a new
  module/interface.
- Ambiguous work starts with grilling or a PRD, then becomes agent-ready issues
  only after acceptance criteria are clear.

This can start as a review checklist in `WORKFLOW.md`, then move into scripts
as violations become mechanical.

## Proposed Repository Additions

Small first additions:

- `docs/agent-plans/active/.gitkeep`
- `docs/agent-plans/completed/.gitkeep`
- `docs/agent-plans/abandoned/.gitkeep`
- `docs/agents/issue-tracker.md`
- `docs/agents/project-fields.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`
- `docs/agents/dependency-references.md`
- `.out-of-scope/.gitkeep`
- `.agents/WORKFLOW.md`
- `.agents/SECURITY.md`
- `.agents/PLANS.md`
- `.agents/skills/agent-brief/SKILL.md`
- `.github/ISSUE_TEMPLATE/agent-task.yml`

Potential later additions:

- `apps/agent-runner` - Hono/Cloudflare deployed runner once scripts prove the
  contract
- `packages/agent-control-plane`
- `packages/agent-workspaces`
- `packages/agent-browser-harness`
- `packages/agent-observability`
- `packages/agent-verifier`
- `scripts/check-agent-code-quality.mjs`

Use the existing package strategy: reusable runner primitives belong in
`packages/*`; runtime wiring and operational surfaces belong in `apps/*`.

## Implementation Plan

Status: Phases 0-2 have a working local pilot. The remaining orchestration
work should focus on Phase 3 browser and UI evidence, then Phase 4 PR shepherd
and CI repair.

### Phase 0: Record And Enforce The Operating Contract

Deliverables:

- Add `.agents/WORKFLOW.md` with state rules, quality bar, tool policy, and
  evidence packet format, release rules, i18n rules, migration rules, and code
  writing ground rules.
- Add `.agents/SECURITY.md` with security-sensitive areas, threat-model prompt,
  artifact redaction policy, and required test expectations.
- Add `.agents/PLANS.md` with Voyant's execution-plan format.
- Add `.agents/skills/agent-brief/SKILL.md` for drafting and updating durable
  agent briefs.
- Add `docs/agents/issue-tracker.md`, `docs/agents/project-fields.md`,
  `docs/agents/triage-labels.md`, `docs/agents/domain.md`, and
  `docs/agents/dependency-references.md`.
- Add `docs/agent-plans/*` directories.
- Add `.out-of-scope/` for durable rejected-scope decisions.
- Add a pointer from `AGENTS.md`.
- Add a reporting-only `scripts/check-agent-code-quality.mjs` prototype for
  file-size, TypeScript suppression, unsafe cast, lint-disable, TODO,
  Changeset, i18n, migration-consistency, and security-pattern checks.
- Add package scripts for the new quality lane, for example
  `verify:agent-quality` and `verify:agent-quality:changed`.
- Wire the new quality lane into local developer feedback. Start with Husky or
  lint-staged in reporting mode if the baseline is noisy; make it blocking once
  exceptions are documented.
- Review existing `pnpm lint`, `pnpm typecheck`, `pnpm verify:fast`, and
  `pnpm verify:full` output so agents get clear failures instead of noisy logs.
- Document the exception process for oversized files, TypeScript suppressions,
  generated files, and adapter/test seams.

Current status: complete for the local pilot. The operating docs, security
rules, execution-plan template, brief skill, issue-tracker docs, quality lane,
and pre-commit feedback path exist. The quality checker remains reporting-only
until the baseline exception list is mature enough to make it blocking.

Verification:

- `pnpm lint:changed`
- `pnpm verify:agent-quality:changed`

### Phase 1: GitHub Project Pilot

Deliverables:

- Create the `Voyant Engineering` project manually.
- Add the fields described above.
- Configure project permissions so only maintainers can mutate the queue.
- Add an `agent-task.yml` issue form that applies labels but does not itself
  grant execution.
- Add an auto-add workflow that only includes issues with maintainer-applied
  `agent:ready`.
- Document the exact Project fields and labels in `docs/agents/` so skills and
  runner code share the same vocabulary.

Current status: complete for the local pilot. The `Voyant Engineering` Project,
fields, intake workflow, issue form, and docs are in place. Execution remains
maintainer-gated by label, Project fields, and the issue-body `Agent Brief`
section.

Verification:

- Create one test issue.
- Confirm it does not run before maintainer approval.
- Confirm the runner query can find it after approval.

### Phase 2: Local Runner Prototype

Deliverables:

- Build a script or small app that polls ready Project items.
- Require an agent brief before dispatch.
- Create a worktree and branch per item.
- Run a supervised provider-neutral implementation command in that worktree.
- Record logs and heartbeats.
- Run a declared verification command.
- Post a Project comment with the evidence packet.
- Include agent code-quality checks in the evidence packet, even if they are
  still reporting-only.

Current status: complete for the local pilot. The runner can inspect the queue,
claim work, prepare a worktree and branch, write the approved brief into the
execution plan, run an explicit command with `VOYANT_AGENT_*` context, record
local logs and evidence, publish evidence, open draft PRs, sync PR state, clean
up worktrees, and recover from restarts from Project fields plus local event
logs.

Verification:

- Run against one low-risk documentation task.
- Confirm `Ready -> Running -> Human Review` transitions.
- Confirm artifacts survive runner restart.

### Phase 3: Browser And UI Evidence

Deliverables:

- Add per-workspace dev-server allocation.
- Add Playwright smoke runner.
- Capture screenshots, console errors, failed requests, and video.
- Require browser evidence for UI-labeled tasks.

Current status: started. The local runner now allocates deterministic
per-workspace browser artifact paths and dev-server ports, exposes them to
supervised commands through `VOYANT_AGENT_*` environment variables, rejects
handoff and successful run-command transitions for UI-labeled work that lacks
browser evidence or an accepted exception, and provides a Playwright capture
command for screenshot, video, console, failed-request, and summary artifacts.
The capture command supports multi-viewport evidence packets so responsive UI
work can include desktop and mobile proof from one run. Browser summaries
classify console errors, console warnings, failed HTTP responses, and failed
requests so reviewers can see quality signals without opening raw logs. For
UI-labeled work, capture fails after writing artifacts when those summaries
contain blocking issues unless the runner passes an explicit accepted exception.
Handoff and successful run-command transitions also validate local browser
artifact summaries before moving UI-labeled work to review, so stale or manually
pasted bad artifacts do not bypass the capture gate. Queue status and tick
output also surface browser-evidence obligations for active UI work; capture
recommendations remain explicit and are not dispatched automatically. Evidence
packets now expand local browser summaries into reviewer-facing artifact indexes
with repo-relative screenshot, video, console-log, failed-request-log, and
summary links.

Verification:

- Run first against `apps/workflows-local-dashboard`, then against a small
  `templates/operator` UI change.
- Confirm the PR includes before/after artifacts.

### Phase 4: PR Shepherd And CI Repair

Deliverables:

- Open draft PRs automatically.
- Update PR descriptions from evidence packets.
- Watch CI.
- Move failed PRs to `CI Repair`.
- Mark Project items done when linked PRs are merged.
- Collect failed CI check URLs and failed-log snippets into local ignored
  repair packets.
- Re-run the agent with CI logs and a narrow repair prompt exposed through the
  supervised command environment.

Current status: started. The local runner can open or reuse PRs from handed-off
workspaces, sync linked PR review and check state back into the Project, collect
failed CI logs into local repair packets, and mark merged PRs done. PR sync can
also refresh a PR description from the current evidence packet with
`pnpm agent:queue:sync-pr -- --issue <number> --update-body --yes`; this is
explicit so maintainer-edited PR descriptions are not overwritten by routine
state polling. Dispatch, loop, lifecycle mutations, supervised command exits,
browser capture, CI evidence collection, evidence publication, PR sync/open
commands, and cleanup commands write JSONL audit events. Status can tail recent
events so a maintainer or future dashboard can see the last supervised actions
without opening raw log files. A filterable `pnpm agent:queue:events` timeline
supports issue-, repository-, and event-type-specific debugging before a full
dashboard exists. Dispatch, loop, and control-plane planning can pass the same
event-log option through to `sync-pr` when the runner intentionally wants that
refresh. Tick output now carries a recent audit-event tail as well as ordered
recommendations, and dispatch keeps nested lifecycle command events in the same
ledger when a supervisor passes a custom `--event-log`. The Cloudflare-ready
control-plane app mirrors the safe local and remote dispatch allow-list and can
include that event-log context when it returns dry-run lifecycle command plans.
It also accepts non-persistent tick snapshots that match
`agent:queue:tick -- --json`, so a future dashboard or supervisor can validate
queue shape and recommendation counts before storage or automatic loops are
introduced.

Verification:

- Use a controlled failing test branch.
- Confirm CI logs are collected and the task returns to review after repair.

### Phase 5: Remote Sandbox Adapter

Deliverables:

- Define and enforce the workspace reference contract shared by local worktrees
  and remote sandboxes.
- Add the first remote sandbox adapter behind the same workspace interface,
  likely `SpriteWorkspace` unless another provider proves better during the
  pilot.
- Clone the repo, install dependencies, expose HTTP dev servers, and collect
  artifacts.
- Compare local and remote performance, cost, and reliability.

Current status: started. The runner has a provider-neutral remote workspace
adapter contract and an unsupported-adapter fallback. Queue recommendations for
`sandbox:<provider>:<id>` items now point maintainers at
`pnpm agent:queue:remote-inspect -- --issue <number>` so remote references are
typed and inspectable before a real sandbox adapter is allowed to execute,
expose HTTP, collect artifacts, or clean up remote state. Remote adapters can
now be loaded from an explicit config module via `--adapter-config`,
`VOYANT_AGENT_REMOTE_ADAPTER_CONFIG`, or trusted
`.agents/remote-workspaces.mjs`; the runner still treats providers as
unavailable unless a config supplies that provider. A conservative CLI-backed
Sprite adapter is available for one-shot command execution once a maintainer
enables it through adapter config. `agent:queue:remote-exec` can validate that
path with a guarded command, while higher-level remote commands own bootstrap,
execution, evidence publication, browser capture, process management, cleanup,
and PR creation. `agent:queue:remote-bootstrap` can now clone/fetch the
repository, prefer an existing remote task branch, and check out the task
branch inside a remote workspace. Ready remote-workspace items can be
dispatched through that bootstrap path and move to `Planning` after success.
`agent:queue:remote-run-command` can run an explicit supervised command in that
remote repository, write a remote transcript and evidence packet, and move the
Project item to `Human Review` or `Blocked`. For UI-labeled remote work,
successful remote commands validate `.agent-runs/remote-browser/.../summary.json`
artifacts before handoff and keep the item blocked when browser capture found
blocking console or request issues unless a maintainer accepts the exception.
Remote execution, browser capture, evidence publication, PR creation, and
cleanup append the same local JSONL audit events as local runner commands, so a
supervisor can trace remote work without provider-specific dashboards.
`agent:queue:remote-publish-evidence`
can read that remote evidence packet through the configured adapter, post or
reuse a GitHub evidence comment, optionally publish the packet to configured
R2-compatible object storage, and update the Project `Evidence` field to the
durable URL. `agent:queue:remote-cleanup` can call an adapter-owned `dispose`
operation for terminal remote work and clear the Project `Workspace` field
after success. `agent:queue:remote-open-pr` can verify and push the remote
branch through the configured adapter, create or reuse a GitHub PR from the
local token, and update the Project `PR` field. `agent:queue:remote-capture-browser`
can call adapter-owned HTTP exposure for a remote port, capture that URL through
local Playwright, store local ignored browser artifacts, and optionally publish
the artifact directory to configured R2-compatible storage. It can also start
and stop a named remote dev-server command around capture, so UI evidence does
not require a manually pre-running server. Queue recommendations now surface
that remote browser capture command for UI-labeled remote work that lacks
browser proof, while leaving the dev-server command and port as explicit
maintainer-filled placeholders.
`agent:queue:remote-start-process` and `agent:queue:remote-stop-process` can
manage named long-running processes through adapter command execution, storing
remote PID, command, log, and metadata files for browser-capture setup and
teardown. `agent:queue:remote-process-status` can inspect those named
processes without mutating Project state, reporting PID liveness, stored
metadata, and a bounded remote log tail for debugging. Adapter-native process
streaming and richer lifecycle supervision remain future slices.

Verification:

- Run the same task locally and in a Sprite.
- Confirm branch, PR, logs, browser evidence, and verification are identical
  from the control-plane point of view.

### Phase 6: Continuous Cleanup

Deliverables:

- Add recurring cleanup tasks for stale docs, stale plans, repeated review
  feedback, and quality drift.
- Promote repeated agent mistakes into `.agents/WORKFLOW.md` or scripts.
- Track quality gaps as GitHub Project items.
- Make the agent code-quality script blocking in `pnpm verify:fast` once the
  baseline is clean and exceptions are documented.

Verification:

- Run a cleanup task that opens a targeted PR.
- Confirm the PR is small, mechanically verifiable, and reviewable in minutes.

## Decisions

- `.agents/WORKFLOW.md` is the canonical runner policy. `docs/architecture/*`
  explains why the policy exists; `.agents/*` is what agents and runners load.
  This keeps operational policy discoverable to tools while keeping
  architecture prose in docs.
- The runner starts as scripts while the control-plane contract is unstable.
  Once it needs always-on polling, shared run state, remote sandbox
  orchestration, CI repair, or a dashboard, promote it to a Hono-based
  `apps/agent-runner` that deploys to Cloudflare. Keep it outside the product
  runtime: it operates on GitHub Projects, workspaces, sandboxes, and PRs, not
  travel-domain requests.
- The long-term architecture is an always-on runner with bounded agent
  attempts. On Cloudflare, the likely composition is a Hono Worker for the
  control API/webhooks, Cron Triggers for polling and stale-run checks, Queues
  for dispatch, Durable Objects for per-run coordination and locks, R2 for
  artifacts, and D1 or Postgres/Neon for run metadata.
- Codex gets the first execution adapter because it is the primary target for
  this orchestration work. Claude remains a supported provider option,
  especially for UI-heavy slices, but UI quality is enforced through repo docs,
  reusable UI surfaces, browser evidence, and quality checks rather than
  provider preference alone.
- Do not require blanket coverage. Require risk-based evidence: tests for
  reusable behavior and bug fixes, browser proof for UI, generator tests for
  generated output, and explicit justification when no good test seam exists.
  Generated files have no direct coverage requirement; verify the generator or
  registry builder instead. Pure presentation UI changes need browser evidence,
  not low-value unit tests. UI logic, data mutations, shared packages, public
  APIs, architecture checkers, and bug fixes need focused behavioral tests.
- Do not require repository-wide 100% code coverage initially, even though some
  agentic-engineering references use that bar. For Voyant, blanket 100%
  coverage would likely create shallow tests around generated files, visual UI,
  migrations, and configuration. Use 100% coverage selectively for new
  mechanical checkers and critical pure logic where line coverage maps well to
  correctness. Add a coverage ratchet later once the baseline is clean:
  prevent coverage from decreasing first, then raise thresholds package by
  package.
- Build the browser/video harness generically so it can target any app,
  template, example, or local route. Use `apps/workflows-local-dashboard` as the
  first fixture because it is smaller and already workflow-oriented, then add
  `templates/operator` as the broader real-product fixture.
- Long-term run artifacts live in object storage, preferably Cloudflare R2.
  GitHub comments and PR descriptions contain the evidence index and key links.
  GitHub Actions artifacts are temporary CI/debug convenience, not the durable
  archive. A small internal dashboard can be added later as a viewer over the
  same run store and R2 artifacts.
- Browser capture can publish artifacts directly to R2-compatible object
  storage with `pnpm agent:queue:capture-browser -- --publish-artifacts`.
  Evidence publishing can use the same object store with
  `pnpm agent:queue:publish-evidence -- --publish-artifacts`; in that mode the
  Project `Evidence` field points at the durable remote evidence packet while
  the GitHub issue comment remains a readable copy.
  Configure it with `VOYANT_AGENT_R2_BUCKET`,
  `VOYANT_AGENT_R2_ACCESS_KEY_ID`, `VOYANT_AGENT_R2_SECRET_ACCESS_KEY`,
  `VOYANT_AGENT_R2_ACCOUNT_ID` or `VOYANT_AGENT_R2_ENDPOINT`, and
  `VOYANT_AGENT_R2_PUBLIC_BASE_URL`. The public base URL should be a durable
  custom domain or authenticated artifact proxy URL prefix, not a temporary
  signed URL.
- The runner can submit fresh or saved tick snapshots to the control-plane
  app with `pnpm agent:queue:submit-tick`, using `AGENT_CONTROL_PLANE_URL` and
  `AGENT_CONTROL_PLANE_TOKEN`. This keeps the Cloudflare endpoint exercised
  without adding storage or automatic dispatch yet.
- The control-plane app can optionally persist the latest accepted tick
  snapshot per repository to R2 through the `AGENT_TICK_SNAPSHOTS` binding.
  This gives dashboards and supervisors a durable read model while dispatch
  remains explicit and runner-owned.
- The control-plane app can also plan dispatch from that latest stored snapshot
  with `POST /api/dispatch-plans/latest`. This keeps the write path split:
  runners submit observed queue state, supervisors request safe lifecycle plans,
  and actual command execution remains outside the Worker.
- The runner can request that read-only plan with
  `pnpm agent:queue:plan-dispatch`, using the same control-plane URL and token
  as snapshot submission. It prints the planned lifecycle command or JSON for a
  supervisor, but does not execute the mutation.
- The control-plane app can persist leased dispatch intents with
  `POST /api/dispatch-intents/latest` when an `AGENT_DISPATCH_INTENTS` R2
  binding is configured. This gives always-on supervisors a durable coordination
  record for the selected lifecycle command, lease holder, and expiration while
  command execution remains runner-owned.
- Runners can finish those leased dispatch intents with
  `pnpm agent:queue:finish-dispatch`, which calls
  `POST /api/dispatch-intents/:id/finish` and records `completed`, `failed`, or
  `released` without waiting for lease TTL expiry. The holder must match the
  holder recorded on the lease.
- A local supervisor can run one complete leased lifecycle step with
  `pnpm agent:queue:run-dispatch-intent -- --holder <id> --yes`. It leases the
  next intent from the control plane, validates that the command is an allowed
  `pnpm agent:queue:*` lifecycle command, executes it without a shell, and then
  records the terminal dispatch intent outcome.
- A bounded local supervisor loop can use
  `pnpm agent:queue:control-plane-loop -- --holder <id> --iterations <n> --yes`.
  Each iteration submits a fresh tick snapshot, leases one intent from that
  stored snapshot, runs the leased lifecycle command, records the terminal
  outcome, and stops on idle, failure, or the configured iteration limit.
- A Cloudflare-ready runner shell exists in `apps/agent-runner`. It exposes
  health, capabilities, a scheduled handler, and a guarded supervisor tick
  planning endpoint. The shell is deliberately non-executing until GitHub
  polling, budget controls, provider credentials, and execution policy are wired
  into a later slice.

## Open Questions

None currently.

## Recommended First Slice

Do not start with remote sandboxes or multi-agent routing. Start with the loop:

1. Add `.agents/WORKFLOW.md`, `.agents/PLANS.md`, `docs/agents/*`, and the
   `agent-brief` skill.
2. Define the agent brief and triage label vocabulary.
3. Create the GitHub Project manually with maintainer-gated fields.
4. Implement a local runner for one ready issue at a time.
5. Require an evidence packet before `Human Review`.
6. Add browser/video evidence only after the basic loop works.
7. Add a remote sandbox adapter only after the workspace interface is proven
   locally.

This gives Voyant the same strategic shape as Symphony without prematurely
building a distributed agent platform.
