import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  remoteProcessMetadata,
  remoteProcessPlan,
  remoteProcessStatusShell,
  remoteStartProcessShell,
  remoteStopProcessShell,
} from "../lib/agent-runner-remote-process.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote process helpers", () => {
  it("plans named process files inside the remote repository", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteProcessPlan({
      descriptor,
      item: workItem(),
      port: 3000,
      workspaceReference: descriptor.reference,
    })

    assert.equal(plan.workspace, "/home/sprite/voyant-workspaces/task-579/repo")
    assert.equal(plan.processName, "579-test-agent-project-intake-workflow")
    assert.equal(
      plan.metadataPointer,
      ".agent-runs/remote-processes/579-test-agent-project-intake-workflow/process.json",
    )
    assert.equal(
      plan.pidFile,
      "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/579-test-agent-project-intake-workflow/process.pid",
    )
    assert.equal(
      plan.processGroupFile,
      "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/579-test-agent-project-intake-workflow/process.pgid",
    )
    assert.equal(plan.port, 3000)
  })

  it("builds a remote start shell with duplicate detection and startup verification", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteProcessPlan({
      descriptor,
      item: workItem(),
      name: "dev server",
      workspaceReference: descriptor.reference,
    })
    const shell = remoteStartProcessShell({
      command: "pnpm dev",
      plan,
      verifyAfterSeconds: 3,
    })

    assert.match(shell, /remote process already running/)
    assert.match(shell, /cG5wbSBkZXY=/)
    assert.match(shell, /command -v setsid/)
    assert.match(shell, /nohup setsid bash "\$command_file"/)
    assert.match(shell, /kill -0 "\$pid"/)
    assert.match(shell, /tail -n 80 "\$log_file"/)
    assert.match(shell, /verify_after='3'/)
  })

  it("builds an idempotent remote stop shell", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteProcessPlan({
      descriptor,
      item: workItem(),
      name: "dev-server",
      workspaceReference: descriptor.reference,
    })
    const shell = remoteStopProcessShell({ graceSeconds: 7, plan })

    assert.match(shell, /missing pid file/)
    assert.match(shell, /stale pid/)
    assert.match(shell, /target="-\$pid"/)
    assert.match(shell, /kill -- "\$target"/)
    assert.match(shell, /kill -KILL -- "\$target"/)
    assert.match(shell, /grace_seconds='7'/)
  })

  it("builds a remote status shell with metadata and bounded log tail", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteProcessPlan({
      descriptor,
      item: workItem(),
      name: "dev-server",
      workspaceReference: descriptor.reference,
    })
    const shell = remoteProcessStatusShell({ plan, tailLines: 25 })

    assert.match(shell, /status="running"/)
    assert.match(shell, /reason="stale-pid"/)
    assert.match(shell, /metadata file:/)
    assert.match(shell, /--- metadata ---/)
    assert.match(shell, /--- log tail \(\$tail_lines\) ---/)
    assert.match(shell, /tail -n "\$tail_lines" "\$log_file"/)
    assert.match(shell, /tail_lines='25'/)
  })

  it("serializes process metadata for evidence and follow-up commands", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteProcessPlan({
      descriptor,
      item: workItem(),
      name: "dev-server",
      port: 3000,
      workspaceReference: descriptor.reference,
    })

    assert.deepEqual(
      remoteProcessMetadata({
        command: "pnpm dev",
        date: new Date("2026-05-12T10:30:00.000Z"),
        item: workItem(),
        plan,
        repository: "voyantjs/voyant",
      }),
      {
        command: "pnpm dev",
        createdAt: "2026-05-12T10:30:00.000Z",
        issue: {
          number: 579,
          title: "Test agent project intake workflow",
          url: "https://github.com/voyantjs/voyant/issues/579",
        },
        logFile:
          "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/dev-server/process.log",
        metadataFile:
          "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/dev-server/process.json",
        pidFile:
          "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/dev-server/process.pid",
        port: 3000,
        processGroupFile:
          "/home/sprite/voyant-workspaces/task-579/repo/.agent-runs/remote-processes/dev-server/process.pgid",
        processName: "dev-server",
        repository: "voyantjs/voyant",
        workspace: "/home/sprite/voyant-workspaces/task-579/repo",
        workspaceReference: "sandbox:sprite:task-579",
      },
    )
  })
})
