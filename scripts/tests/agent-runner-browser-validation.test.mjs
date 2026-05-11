import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  browserEvidenceQualityBlockReason,
  browserEvidenceSummaryPlan,
} from "../lib/agent-runner-browser-validation.mjs"
import { commandRunBrowserEvidenceBlockReason } from "../lib/agent-runner-execution.mjs"
import { workItem } from "./agent-fixtures.mjs"

describe("agent runner browser evidence validation", () => {
  it("resolves local browser evidence summary references inside a workspace", () => {
    assert.deepEqual(
      browserEvidenceSummaryPlan({
        uiEvidence:
          "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
        workspace: "/repo/.agent-worktrees/task",
      }),
      {
        reference: "docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z/summary.json",
        safePath: true,
        summaryPath: path.resolve(
          "/repo/.agent-worktrees/task/docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z/summary.json",
        ),
      },
    )
    assert.equal(
      browserEvidenceSummaryPlan({
        uiEvidence: "accepted exception: static copy only",
        workspace: "/repo/.agent-worktrees/task",
      }),
      null,
    )
  })

  it("blocks local browser evidence summaries with captured blocking issues", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-browser-validation-"))
    try {
      const summaryDir = path.join(
        tempDir,
        "docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
      )
      mkdirSync(summaryDir, { recursive: true })
      writeFileSync(
        path.join(summaryDir, "summary.json"),
        JSON.stringify({
          browserIssues: {
            consoleErrors: 1,
            consoleWarnings: 0,
            failedRequests: 1,
            hasBlockingIssues: true,
            httpErrors: 1,
            malformedLogLines: 0,
            requestFailures: 0,
          },
        }),
      )

      const item = workItem()
      item.issue.labels = ["ui"]
      const uiEvidence =
        "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z"

      assert.equal(
        browserEvidenceQualityBlockReason({ item, uiEvidence, workspace: tempDir }),
        "browser evidence has blocking issues: 1 console error, 0 console warnings, 1 failed request",
      )
      assert.equal(
        browserEvidenceQualityBlockReason({
          allowBrowserIssues: true,
          item,
          uiEvidence,
          workspace: tempDir,
        }),
        null,
      )
      assert.equal(
        commandRunBrowserEvidenceBlockReason({
          exitCode: 0,
          item,
          uiEvidence,
          workspace: tempDir,
        }),
        "browser evidence has blocking issues: 1 console error, 0 console warnings, 1 failed request; pass --allow-browser-issues only with an accepted exception",
      )
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("blocks missing, unsafe, or malformed browser summary references", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-browser-validation-"))
    try {
      const item = workItem()
      item.issue.labels = ["ui"]

      assert.equal(
        browserEvidenceQualityBlockReason({
          allowBrowserIssues: true,
          item,
          uiEvidence:
            "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
          workspace: tempDir,
        }),
        "browser evidence summary was not found: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z/summary.json",
      )

      assert.equal(
        browserEvidenceQualityBlockReason({
          allowBrowserIssues: true,
          item,
          uiEvidence: "browser artifacts: docs/agent-evidence/browser/../../../../outside",
          workspace: tempDir,
        }),
        "browser evidence summary is outside the workspace: ../outside/summary.json",
      )

      const summaryDir = path.join(
        tempDir,
        "docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
      )
      mkdirSync(summaryDir, { recursive: true })
      writeFileSync(path.join(summaryDir, "summary.json"), "{")

      assert.equal(
        browserEvidenceQualityBlockReason({
          allowBrowserIssues: true,
          item,
          uiEvidence:
            "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
          workspace: tempDir,
        }),
        "browser evidence summary is malformed: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z/summary.json",
      )
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("does not block clean summaries or non-UI work", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-browser-validation-"))
    try {
      const summaryDir = path.join(
        tempDir,
        "docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
      )
      mkdirSync(summaryDir, { recursive: true })
      writeFileSync(
        path.join(summaryDir, "summary.json"),
        JSON.stringify({
          browserIssues: {
            consoleErrors: 0,
            consoleWarnings: 0,
            failedRequests: 0,
            hasBlockingIssues: false,
            httpErrors: 0,
            malformedLogLines: 0,
            requestFailures: 0,
          },
        }),
      )

      const uiItem = workItem()
      uiItem.issue.labels = ["ui"]
      assert.equal(
        browserEvidenceQualityBlockReason({
          item: uiItem,
          uiEvidence:
            "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
          workspace: tempDir,
        }),
        null,
      )
      assert.equal(
        browserEvidenceQualityBlockReason({
          item: workItem({ fields: {} }),
          uiEvidence:
            "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
          workspace: tempDir,
        }),
        null,
      )
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
