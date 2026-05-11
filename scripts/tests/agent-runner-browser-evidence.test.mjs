import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  browserArtifactPlan,
  browserCapturePlan,
  browserCapturePlans,
  browserEvidenceEnvironment,
  browserEvidenceMissingReason,
  browserEvidenceReferenceKind,
  browserEvidenceText,
  captureBrowserEvidence,
  captureBrowserEvidenceSet,
  normalizeViewportList,
  normalizeWaitUntil,
  requiresBrowserEvidence,
  safeScreenshotName,
} from "../lib/agent-runner-browser-evidence.mjs"
import {
  browserIssueBlockReason,
  summarizeBrowserEvidenceIssues,
} from "../lib/agent-runner-browser-issues.mjs"
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

  it("classifies browser evidence references separately from generic evidence", () => {
    assert.equal(browserEvidenceReferenceKind(undefined), "missing")
    assert.equal(
      browserEvidenceReferenceKind(
        "browser artifacts: docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
      ),
      "browser-artifacts",
    )
    assert.equal(
      browserEvidenceReferenceKind("docs/agent-evidence/active/579-test.md"),
      "evidence-packet",
    )
    assert.equal(
      browserEvidenceReferenceKind(".agent-runs/579-test/2026-05-10T12-34-56-000Z.log"),
      "generic",
    )
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
      readme: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/README.md",
      ),
      safeArtifactPath: true,
      screenshotDir: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/screenshots",
      ),
      summaryJson: path.resolve(
        "/repo/.agent-worktrees/579-test-agent-project-intake-workflow/docs/agent-evidence/browser/579-test-agent-project-intake-workflow/2026-05-10T12-34-56-000Z/summary.json",
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

  it("keeps screenshot names inside the screenshot artifact directory", () => {
    assert.equal(safeScreenshotName("after.png"), "after.png")
    assert.throws(() => safeScreenshotName("../outside.md"), /screenshot name must be a file name/)
    assert.throws(
      () =>
        browserCapturePlan({
          artifactPlan: browserArtifactPlan({
            item: workItem(),
            repoRoot: "/repo",
            workspaceReference: ".agent-worktrees/task",
          }),
          screenshotName: "../outside.md",
        }),
      /screenshot name must be a file name/,
    )
  })

  it("normalizes browser navigation wait events", () => {
    assert.equal(normalizeWaitUntil(undefined), "networkidle")
    assert.equal(normalizeWaitUntil("load"), "load")
    assert.equal(normalizeWaitUntil("DOMContentLoaded"), "domcontentloaded")
    assert.equal(normalizeWaitUntil("commit"), "commit")
    assert.throws(
      () => normalizeWaitUntil("interactive"),
      /invalid wait-until: interactive; expected commit, domcontentloaded, load, or networkidle/,
    )
  })

  it("summarizes browser console and request issues", () => {
    assert.deepEqual(
      summarizeBrowserEvidenceIssues({
        consoleLogText: [
          JSON.stringify({ text: "loaded", type: "log" }),
          JSON.stringify({ text: "React hydration failed", type: "error" }),
          JSON.stringify({ text: "deprecated style", type: "warning" }),
          "not json",
        ].join("\n"),
        networkLogText: [
          JSON.stringify({ status: 404, type: "http-error" }),
          JSON.stringify({ failure: "net::ERR_FAILED", type: "requestfailed" }),
        ].join("\n"),
      }),
      {
        consoleErrors: 1,
        consoleWarnings: 1,
        failedRequests: 2,
        hasBlockingIssues: true,
        httpErrors: 1,
        malformedLogLines: 1,
        requestFailures: 1,
      },
    )
  })

  it("blocks UI browser evidence with captured blocking issues unless allowed", () => {
    const summary = summarizeBrowserEvidenceIssues({
      consoleLogText: JSON.stringify({ text: "React hydration failed", type: "error" }),
      networkLogText: JSON.stringify({ status: 404, type: "http-error" }),
    })

    assert.equal(
      browserIssueBlockReason(summary),
      "browser evidence has blocking issues: 1 console error, 0 console warnings, 1 failed request",
    )
    assert.equal(browserIssueBlockReason(summary, { allowBrowserIssues: true }), null)
    assert.equal(browserIssueBlockReason(summary, { required: false }), null)
    assert.equal(
      browserIssueBlockReason(
        summarizeBrowserEvidenceIssues({
          consoleLogText: JSON.stringify({ text: "loaded", type: "log" }),
          networkLogText: "",
        }),
      ),
      null,
    )
  })

  it("plans named browser screenshots for multiple viewports", () => {
    const artifactPlan = browserArtifactPlan({
      item: workItem(),
      repoRoot: "/repo",
      workspaceReference: ".agent-worktrees/task",
    })
    const plans = browserCapturePlans({
      artifactPlan,
      screenshotName: "after.png",
      viewports: "1440x900,390x844",
    })

    assert.deepEqual(normalizeViewportList("1440x900,390x844"), [
      { height: 900, width: 1440 },
      { height: 844, width: 390 },
    ])
    assert.equal(path.basename(plans[0].screenshotFile), "after-1440x900.png")
    assert.equal(path.basename(plans[1].screenshotFile), "after-390x844.png")
    assert.throws(() => normalizeViewportList(","), /at least one viewport is required/)
  })

  it("captures browser evidence through an injected browser launcher", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-browser-evidence-"))
    try {
      const item = workItem()
      const artifactPlan = browserArtifactPlan({
        date: new Date("2026-05-10T12:34:56.000Z"),
        item,
        repoRoot: tempDir,
        workspaceReference: ".",
      })
      const capturePlan = browserCapturePlan({
        artifactPlan,
        url: "http://127.0.0.1:4879/dashboard",
        viewport: "390x844",
      })

      const result = await captureBrowserEvidence({
        browserLauncher: new FakeBrowserLauncher(),
        capturePlan,
        timeoutMs: 1000,
      })

      assert.equal(result.viewport.width, 390)
      assert.equal(result.viewport.height, 844)
      assert.equal(result.url, "http://127.0.0.1:4879/dashboard")
      assert.equal(result.consoleLog, artifactPlan.consoleLog)
      assert.equal(result.failedRequestLog, artifactPlan.networkLog)
      assert.deepEqual(result.browserIssues, {
        consoleErrors: 0,
        consoleWarnings: 0,
        failedRequests: 1,
        hasBlockingIssues: true,
        httpErrors: 1,
        malformedLogLines: 0,
        requestFailures: 0,
      })
      assert.equal(existsSync(result.screenshot), true)
      assert.match(readFileSync(artifactPlan.consoleLog, "utf8"), /loaded dashboard/)
      assert.match(readFileSync(artifactPlan.networkLog, "utf8"), /http-error/)
      assert.match(readFileSync(artifactPlan.summaryJson, "utf8"), /390/)
      assert.doesNotMatch(readFileSync(artifactPlan.summaryJson, "utf8"), /"captures"/)
      assert.match(readFileSync(artifactPlan.readme, "utf8"), /Browser Evidence/)
      assert.match(readFileSync(artifactPlan.readme, "utf8"), /Browser Issue Summary/)
      assert.match(browserEvidenceText(result), /failed-request log:/)
      assert.match(browserEvidenceText(result), /browser issue summary:/)
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("captures a combined browser evidence packet for multiple viewports", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-browser-evidence-"))
    try {
      const item = workItem()
      const artifactPlan = browserArtifactPlan({
        date: new Date("2026-05-10T12:34:56.000Z"),
        item,
        repoRoot: tempDir,
        workspaceReference: ".",
      })
      const capturePlans = browserCapturePlans({
        artifactPlan,
        screenshotName: "page.png",
        url: "http://127.0.0.1:4879/dashboard",
        viewports: "1440x900,390x844",
      })

      const result = await captureBrowserEvidenceSet({
        browserLauncher: new FakeBrowserLauncher(),
        capturePlans,
        timeoutMs: 1000,
      })

      assert.equal(result.captures.length, 2)
      assert.equal(result.browserIssues.failedRequests, 2)
      assert.equal(result.browserIssues.hasBlockingIssues, true)
      assert.equal(path.basename(result.captures[0].screenshot), "page-1440x900.png")
      assert.equal(path.basename(result.captures[1].screenshot), "page-390x844.png")
      assert.equal(existsSync(result.captures[0].screenshot), true)
      assert.equal(existsSync(result.captures[1].screenshot), true)
      assert.match(readFileSync(artifactPlan.summaryJson, "utf8"), /"captures"/)
      assert.match(readFileSync(artifactPlan.readme, "utf8"), /1440x900/)
      assert.match(browserEvidenceText(result), /capture 390x844/)
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })
})

class FakeBrowserLauncher {
  async launch(options) {
    this.options = options
    return new FakeBrowser()
  }
}

class FakeBrowser {
  async newContext(options) {
    this.context = new FakeContext(options)
    return this.context
  }

  async close() {
    this.closed = true
  }
}

class FakeContext {
  constructor(options) {
    this.options = options
  }

  async newPage() {
    return new FakePage(this.options)
  }

  async close() {
    this.closed = true
  }
}

class FakePage {
  #handlers = new Map()

  constructor(options) {
    this.options = options
  }

  on(eventName, handler) {
    const handlers = this.#handlers.get(eventName) ?? []
    handlers.push(handler)
    this.#handlers.set(eventName, handlers)
  }

  async goto(url, options) {
    this.gotoOptions = { options, url }
    this.#emit("console", {
      location: () => ({ columnNumber: 1, lineNumber: 1, url }),
      text: () => "loaded dashboard",
      type: () => "log",
    })
    this.#emit("response", new FakeResponse(`${url}/missing.css`))
  }

  async screenshot(options) {
    writeFileSync(options.path, "fake screenshot", "utf8")
  }

  video() {
    return {
      path: async () => path.join(this.options.recordVideo.dir, "capture.webm"),
    }
  }

  #emit(eventName, value) {
    for (const handler of this.#handlers.get(eventName) ?? []) {
      handler(value)
    }
  }
}

class FakeResponse {
  constructor(url) {
    this.responseUrl = url
  }

  request() {
    return {
      method: () => "GET",
      resourceType: () => "stylesheet",
    }
  }

  status() {
    return 404
  }

  statusText() {
    return "Not Found"
  }

  url() {
    return this.responseUrl
  }
}
