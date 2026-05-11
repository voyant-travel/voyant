import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  remoteCommandRunArtifactPlan,
  remoteCommandRunEnvironment,
  remoteCommandRunFieldUpdate,
  remoteLoggedCommandShell,
  remoteWriteFileShell,
} from "../lib/agent-runner-remote-execution.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner remote execution helpers", () => {
  it("plans remote command artifacts inside the remote repository", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = remoteCommandRunArtifactPlan({
      date: new Date("2026-05-11T12:34:56.000Z"),
      descriptor,
      item: workItem(),
      workspaceReference: descriptor.reference,
    })

    assert.equal(plan.workspace, "/home/sprite/voyant-workspaces/task-579/repo")
    assert.equal(
      plan.evidencePointer,
      "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
    )
    assert.equal(
      plan.evidenceFile,
      "/home/sprite/voyant-workspaces/task-579/repo/docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
    )
    assert.equal(
      plan.logPointer,
      ".agent-runs/579-test-agent-project-intake-workflow/2026-05-11T12-34-56-000Z.log",
    )
    assert.equal(plan.safeEvidencePath, true)

    const unsafe = remoteCommandRunArtifactPlan({
      descriptor,
      evidencePath: "/tmp/evidence.md",
      item: workItem(),
      workspaceReference: descriptor.reference,
    })
    assert.equal(unsafe.safeEvidencePath, false)
  })

  it("builds remote command environment without local workspace assumptions", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const artifactPlan = remoteCommandRunArtifactPlan({
      descriptor,
      item: workItem(),
      remoteDir: "/workspace/voyant",
      workspaceReference: descriptor.reference,
    })

    assert.deepEqual(
      remoteCommandRunEnvironment({
        artifactPlan,
        branch: "task/579-test-agent-project-intake-workflow",
        descriptor,
        item: workItem(),
        repository: "voyantjs/voyant",
      }),
      {
        VOYANT_AGENT_BRANCH: "task/579-test-agent-project-intake-workflow",
        VOYANT_AGENT_EVIDENCE_PATH:
          "/workspace/voyant/docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
        VOYANT_AGENT_EVIDENCE_REFERENCE:
          "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
        VOYANT_AGENT_ISSUE: "579",
        VOYANT_AGENT_ISSUE_TITLE: "Test agent project intake workflow",
        VOYANT_AGENT_ISSUE_URL: "https://github.com/voyantjs/voyant/issues/579",
        VOYANT_AGENT_LOG_PATH: artifactPlan.logFile,
        VOYANT_AGENT_LOG_REFERENCE: artifactPlan.logPointer,
        VOYANT_AGENT_PLAN_PATH:
          "/workspace/voyant/docs/agent-plans/active/579-test-agent-project-intake-workflow.md",
        VOYANT_AGENT_REPOSITORY: "voyantjs/voyant",
        VOYANT_AGENT_VERIFICATION_LANE: "verify:fast",
        VOYANT_AGENT_WORKSPACE: "/workspace/voyant",
        VOYANT_AGENT_WORKSPACE_ID: "task-579",
        VOYANT_AGENT_WORKSPACE_KIND: "remote-sandbox",
        VOYANT_AGENT_WORKSPACE_PROVIDER: "sprite",
        VOYANT_AGENT_WORKSPACE_REFERENCE: "sandbox:sprite:task-579",
      },
    )
  })

  it("builds shell wrappers for logged execution and remote evidence writes", () => {
    assert.match(
      remoteLoggedCommandShell({
        command: "pnpm verify:fast",
        logFile: "/workspace/voyant/.agent-runs/579/run.log",
      }),
      /bash -lc "\$user_command"/,
    )
    assert.match(
      remoteWriteFileShell({
        content: "hello",
        file: "/workspace/voyant/docs/agent-evidence/active/579.md",
      }),
      /aGVsbG8=/,
    )
  })

  it("builds Project updates for remote command completion", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const artifactPlan = remoteCommandRunArtifactPlan({
      descriptor,
      item: workItem(),
      workspaceReference: descriptor.reference,
    })

    assert.deepEqual(
      remoteCommandRunFieldUpdate({
        artifactPlan,
        date: new Date("2026-05-11T12:00:00.000Z"),
        evidenceWriteStatus: 0,
        exitCode: 0,
        item: workItem(),
      }),
      {
        blockedBy: null,
        clear: ["Blocked By"],
        values: {
          "Agent State": "Human Review",
          "Last Heartbeat": "2026-05-11",
          Evidence: "docs/agent-evidence/active/579-test-agent-project-intake-workflow.md",
        },
      },
    )

    assert.deepEqual(
      remoteCommandRunFieldUpdate({
        artifactPlan,
        date: new Date("2026-05-11T12:00:00.000Z"),
        evidenceWriteStatus: 1,
        exitCode: 0,
        item: workItem(),
      }),
      {
        blockedBy: "remote evidence write exited with 1",
        clear: [],
        values: {
          "Agent State": "Blocked",
          "Blocked By": "remote evidence write exited with 1",
          "Last Heartbeat": "2026-05-11",
          Evidence: artifactPlan.logPointer,
        },
      },
    )
  })
})
