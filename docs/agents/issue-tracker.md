# Issue Tracker

Voyant uses GitHub Issues and GitHub Projects for agent work.

The maintainer-controlled project is:

```text
Voyant Engineering
```

## Rules

- Issue reporting can remain open.
- Agent execution is gated by maintainers.
- A task is executable only when:
  - label `agent:ready` is present
  - Project field `Agent State = Ready`
  - Project field `Maintainer Approved = Yes`
- Triage agents may draft recommendations and briefs, but must not set the
  final execution gate.

## Project Automation

Repository workflow `.github/workflows/agent-project-intake.yml` adds issues to
the Project only after the maintainer-applied `agent:ready` label is present.

Required repository configuration:

- variable `VOYANT_ENGINEERING_PROJECT_URL`:
  `https://github.com/orgs/voyantjs/projects/<project-number>`
- secret `ADD_TO_PROJECT_PAT`: a GitHub App token, classic PAT, or fine-grained
  PAT with Projects write access. For the pilot, a fine-grained PAT needs
  organization Projects `read & write`, repository Issues `read-only`, and
  repository Pull requests `read-only`. A classic PAT needs `project`, plus
  `repo` if the repository is private.

GitHub's default `GITHUB_TOKEN` is repository-scoped and is not enough for
organization Projects v2 automation.

The intake workflow only adds eligible issues to the Project. Maintainers still
set `Agent State = Ready` and `Maintainer Approved = Yes` in the Project before
the runner may execute work.

## GitHub CLI

Use `gh` from inside the repository.

Common operations:

```bash
gh issue view <number> --comments
gh issue list --state open --json number,title,labels,updatedAt
gh issue comment <number> --body-file <file>
gh issue edit <number> --add-label agent:ready
```

Prefer the GitHub app/connector for project metadata when available. Use `gh`
or GraphQL when thread-level state or ProjectV2 fields are needed.
