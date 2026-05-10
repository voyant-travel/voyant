import assert from "node:assert/strict"
import path from "node:path"
import { describe, it } from "node:test"

import {
  browserArtifactPlan,
  browserEvidenceEnvironment,
  browserEvidenceMissingReason,
  requiresBrowserEvidence,
} from "../lib/agent-runner-browser-evidence.mjs"
import {
  buildCommandEvidencePacket,
  commandRunArtifactPlan,
  commandRunBrowserEvidenceBlockReason,
  commandRunEnvironment,
  commandRunFieldUpdate,
} from "../lib/agent-runner-execution.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner browser evidence helpers", () => {
  it("detects UI-labeled work that needs browser evidence", () => {
    const item = workItem()
    item.issue.labels = ["agent:ready", "ui-change"]

    assert.equal(requiresBrowserEvidence(item), true)
    assert.equal(
      browserEvidenceMissingReason(item, undefined),
      "browser evidence is required for UI-labeled work",
    )
    assert.equal(
      browserEvidenceMissingReason(item, "screenshots: docs/agent-evidence/browser/579"),
      null,
    )
    assert.equal(requiresBrowserEvidence(workItem()), false)
  })

  it("allocates deterministic per-workspace browser artifact paths", () => {
    const item = workItem()
    const plan = browserArtifactPlan({
      date: new Date("2026-05-10T12:34:56.000Z"),
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })

    assert.deepEqual(plan, {
      artifactDir: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z",
      ),
      artifactPointer:
        "docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z",
      consoleLog: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/console.jsonl",
      ),
      devServerPort: 4879,
      devServerUrl: "http://127.0.0.1:4879",
      networkLog: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/network.jsonl",
      ),
      safeArtifactPath: true,
      screenshotDir: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/screenshots",
      ),
      videoDir: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/videos",
      ),
      workspace: path.resolve("/repo/.agent-worktrees/579-test-agent-project-intake-workflow"),
      workspaceReference: ".agent-worktrees/579-test-agent-project-intake-workflow",
    })
  })

  it("passes browser artifact context to supervised commands", () => {
    const item = workItem()
    item.issue.labels = ["agent:ready", "ui"]
    const artifactPlan = commandRunArtifactPlan({
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })
    const env = commandRunEnvironment({
      artifactPlan,
      branch: item.dryRunPlan.branch,
      item,
      repository: "voyantjs/voyant",
    })

    assert.equal(env.VOYANT_AGENT_DEV_SERVER_PORT, "4879")
    assert.equal(env.VOYANT_AGENT_DEV_SERVER_URL, "http://127.0.0.1:4879")
    assert.match(
      env.VOYANT_AGENT_BROWSER_ARTIFACT_REFERENCE,
      /^docs\/agent-evidence\/browser\/579-/,
    )
    assert.deepEqual(
      browserEvidenceEnvironment({
        artifactPlan: browserArtifactPlan({
          item,
          repoRoot: "/repo",
          workspaceReference: item.dryRunPlan.workspace,
        }),
      }).VOYANT_AGENT_DEV_SERVER_URL,
      "http://127.0.0.1:4879",
    )
  })

  it("marks browser evidence as required in command evidence for UI work", () => {
    const item = workItem()
    item.issue.labels = ["agent:ready", "frontend"]
    const artifactPlan = commandRunArtifactPlan({
      item,
      repoRoot: "/repo",
      workspaceReference: item.dryRunPlan.workspace,
    })
    const evidence = buildCommandEvidencePacket({
      artifactPlan,
      branch: item.dryRunPlan.branch,
      command: "pnpm verify:fast",
      exitCode: 0,
      item,
      repository: "voyantjs/voyant",
      startedAt: new Date("2026-05-10T12:34:56.000Z"),
      stoppedAt: new Date("2026-05-10T12:35:56.000Z"),
    })

    assert.match(evidence, /## Browser Evidence/)
    assert.match(evidence, /Required for UI-labeled work/)
  })

  it("blocks successful command handoff for UI work without browser evidence", () => {
    const item = workItem()
    item.issue.labels = ["agent:ready", "ui-change"]
    const blockedBy = commandRunBrowserEvidenceBlockReason({
      exitCode: 0,
      item,
      uiEvidence: undefined,
    })

    assert.equal(
      blockedBy,
      "browser evidence is required for UI-labeled work; pass --ui-evidence or --force with an accepted exception",
    )
    assert.deepEqual(
      commandRunFieldUpdate({
        blockedBy,
        date: new Date("2026-05-10T12:34:56.000Z"),
        evidencePointer: "docs/agent-evidence/active/579-test.md",
        exitCode: 0,
      }),
      {
        clear: [],
        values: {
          "Agent State": "Blocked",
          "Last Heartbeat": "2026-05-10",
          Evidence: "docs/agent-evidence/active/579-test.md",
          "Blocked By": blockedBy,
        },
      },
    )

    assert.equal(
      commandRunBrowserEvidenceBlockReason({
        exitCode: 0,
        item,
        uiEvidence: "screenshots: docs/agent-evidence/browser/579",
      }),
      null,
    )
    assert.equal(commandRunBrowserEvidenceBlockReason({ exitCode: 1, item }), null)
  })
})
