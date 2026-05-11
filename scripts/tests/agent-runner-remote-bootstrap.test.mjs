import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  normalizeRemoteBaseRef,
  remoteBootstrapFieldValues,
  remoteBootstrapPlan,
} from "../lib/agent-runner-remote-bootstrap.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote bootstrap helpers", () => {
  it("builds a conservative remote repository bootstrap command", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteBootstrapPlan({
      baseRef: "origin/main",
      descriptor,
      item: workItem(),
      repository: "voyantjs/voyant",
    })

    assert.equal(plan.baseRef, "main")
    assert.equal(plan.branch, "task/579-test-agent-project-intake-workflow")
    assert.equal(plan.remoteDir, "/home/sprite/voyant-workspaces/task-579/repo")
    assert.equal(plan.repoUrl, "https://github.com/voyantjs/voyant.git")
    assert.match(plan.command, /git clone "\$repo_url" "\$repo_dir"/)
    assert.match(plan.command, /refs\/remotes\/origin\/\$branch/)
    assert.match(plan.command, /git checkout --track -b "\$branch" "origin\/\$branch"/)
    assert.match(plan.command, /git checkout -b "\$branch" "origin\/\$base_ref"/)
    assert.match(plan.command, /remote directory exists but is not a git repository/)
  })

  it("uses explicit direct-workspace bootstrap values", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteBootstrapPlan({
      baseRef: "release/next",
      branch: "feature/579-remote-workspace",
      descriptor,
      remoteDir: "/workspace/voyant",
      repoUrl: "https://github.com/voyantjs/voyant.git",
    })

    assert.equal(plan.baseRef, "release/next")
    assert.equal(plan.branch, "feature/579-remote-workspace")
    assert.equal(plan.remoteDir, "/workspace/voyant")
    assert.match(plan.command, /repo_dir='\/workspace\/voyant'/)
  })

  it("rejects local references and missing branch or repository context", () => {
    assert.throws(
      () =>
        remoteBootstrapPlan({
          branch: "feature/task",
          descriptor: parseWorkspaceReference(".agent-worktrees/task", { repoRoot: "/repo" }),
          repository: "voyantjs/voyant",
        }),
      /remote bootstrap requires a remote-sandbox reference/,
    )

    assert.throws(
      () =>
        remoteBootstrapPlan({
          descriptor: parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" }),
          repository: "voyantjs/voyant",
        }),
      /remote bootstrap requires --branch/,
    )

    assert.throws(
      () =>
        remoteBootstrapPlan({
          branch: "feature/task",
          descriptor: parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" }),
        }),
      /remote bootstrap requires --repo/,
    )
  })

  it("normalizes remote base refs", () => {
    assert.equal(normalizeRemoteBaseRef("origin/main"), "main")
    assert.equal(normalizeRemoteBaseRef("release/next"), "release/next")
  })

  it("builds Project field updates after issue-scoped remote bootstrap", () => {
    assert.deepEqual(
      remoteBootstrapFieldValues(
        {
          branch: "task/579-test-agent-project-intake-workflow",
          workspaceReference: "sandbox:sprite:task-579",
        },
        new Date("2026-05-11T12:00:00.000Z"),
      ),
      {
        Status: "In Progress",
        "Agent State": "Planning",
        Branch: "task/579-test-agent-project-intake-workflow",
        Workspace: "sandbox:sprite:task-579",
        "Last Heartbeat": "2026-05-11",
      },
    )
  })
})
