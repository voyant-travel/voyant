import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  browserIssueMarkdown,
  formatBrowserIssueSummary,
  summarizeBrowserEvidenceArtifact,
} from "./agent-runner-browser-issues.mjs"
import { localWorkspaceReferencePlan } from "./agent-runner-workspace.mjs"

const uiEvidenceLabels = new Set([
  "browser:evidence",
  "frontend",
  "needs-browser-evidence",
  "ui",
  "ui-change",
])

export function requiresBrowserEvidence(item) {
  const labels = item.issue?.labels ?? []
  return labels.some((label) => uiEvidenceLabels.has(label.toLowerCase()))
}

export function browserArtifactPlan({
  basePort = 4300,
  date = new Date(),
  item,
  repoRoot,
  workspaceReference,
}) {
  const slug = slugFromTitle(item.issue.title)
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const localWorkspace = localWorkspaceReferencePlan({
    commandName: "capture-browser mode",
    repoRoot,
    workspaceReference,
  })
  const workspace = localWorkspace.workspace
  const artifactPointer = path.posix.join(
    "docs/agent-evidence/browser",
    `${item.issue.number}-${slug}`,
    timestamp,
  )
  const artifactDir = path.resolve(workspace, artifactPointer)
  const devServerPort = basePort + (Number(item.issue.number) % 1000)

  return {
    artifactDir,
    artifactPointer,
    consoleLog: path.join(artifactDir, "console.jsonl"),
    devServerPort,
    devServerUrl: `http://127.0.0.1:${devServerPort}`,
    networkLog: path.join(artifactDir, "network.jsonl"),
    readme: path.join(artifactDir, "README.md"),
    screenshotDir: path.join(artifactDir, "screenshots"),
    safeArtifactPath: isPathInside(artifactDir, workspace),
    summaryJson: path.join(artifactDir, "summary.json"),
    videoDir: path.join(artifactDir, "videos"),
    workspace,
    workspaceReference: localWorkspace.workspaceReference,
  }
}

export function browserEvidenceEnvironment({ artifactPlan }) {
  return {
    VOYANT_AGENT_BROWSER_ARTIFACT_DIR: artifactPlan.artifactDir,
    VOYANT_AGENT_BROWSER_ARTIFACT_REFERENCE: artifactPlan.artifactPointer,
    VOYANT_AGENT_DEV_SERVER_PORT: String(artifactPlan.devServerPort),
    VOYANT_AGENT_DEV_SERVER_URL: artifactPlan.devServerUrl,
  }
}

export function browserEvidenceMissingReason(item, uiEvidence) {
  if (!requiresBrowserEvidence(item)) return null

  const normalized = uiEvidence?.trim().toLowerCase()
  if (!normalized || ["n/a", "na", "none", "not applicable", "not provided"].includes(normalized)) {
    return "browser evidence is required for UI-labeled work"
  }

  return null
}

export function browserEvidenceReferenceKind(evidence) {
  const normalized = evidence?.trim()
  if (!normalized) return "missing"

  if (/docs\/agent-evidence\/browser\//.test(normalized)) {
    return "browser-artifacts"
  }

  if (/^https?:\/\//.test(normalized) || /docs\/agent-evidence\/active\//.test(normalized)) {
    return "evidence-packet"
  }

  return "generic"
}

export function browserCapturePlan({
  artifactPlan,
  screenshotName = "page.png",
  url = artifactPlan.devServerUrl,
  viewport,
}) {
  const normalizedViewport = normalizeViewport(viewport)
  const screenshotFile = path.resolve(
    artifactPlan.screenshotDir,
    safeScreenshotName(screenshotName),
  )

  return {
    artifactPlan,
    screenshotFile,
    url,
    viewport: normalizedViewport,
  }
}

export function browserCapturePlans({
  artifactPlan,
  screenshotName = "page.png",
  url = artifactPlan.devServerUrl,
  viewports,
}) {
  const normalizedViewports = normalizeViewportList(viewports)
  const multipleViewports = normalizedViewports.length > 1

  return normalizedViewports.map((viewport) =>
    browserCapturePlan({
      artifactPlan,
      screenshotName: screenshotNameForViewport(screenshotName, viewport, multipleViewports),
      url,
      viewport,
    }),
  )
}

export function safeScreenshotName(screenshotName) {
  if (!screenshotName || path.basename(screenshotName) !== screenshotName) {
    throw new Error("screenshot name must be a file name without path separators")
  }

  return screenshotName
}

export function normalizeViewportList(viewports) {
  if (!viewports) return [normalizeViewport()]

  const viewportValues = Array.isArray(viewports)
    ? viewports
    : String(viewports)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)

  if (viewportValues.length === 0) {
    throw new Error("at least one viewport is required")
  }

  return viewportValues.map((viewport) => normalizeViewport(viewport))
}

export function normalizeViewport(viewport) {
  if (!viewport) return { height: 900, width: 1440 }

  if (typeof viewport === "string") {
    const match = viewport.match(/^(\d+)x(\d+)$/)
    if (!match) {
      throw new Error(`invalid viewport: ${viewport}; expected <width>x<height>`)
    }
    return viewportSize({ height: Number(match[2]), width: Number(match[1]) })
  }

  return viewportSize(viewport)
}

export async function captureBrowserEvidence({ browserLauncher, capturePlan, timeoutMs = 30_000 }) {
  if (!browserLauncher?.launch) {
    throw new Error("browser launcher with launch() is required")
  }

  const artifactPlan = capturePlan.artifactPlan
  prepareBrowserEvidenceArtifacts(artifactPlan)

  const capture = await captureSingleBrowserEvidence({
    browserLauncher,
    capturePlan,
    timeoutMs,
  })
  const result = {
    ...capture,
    browserIssues: summarizeBrowserEvidenceArtifact(artifactPlan),
    consoleLog: artifactPlan.consoleLog,
    failedRequestLog: artifactPlan.networkLog,
  }

  writeFileSync(artifactPlan.summaryJson, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  writeFileSync(artifactPlan.readme, browserEvidenceMarkdown(result), "utf8")

  return result
}

export async function captureBrowserEvidenceSet({
  browserLauncher,
  capturePlans,
  timeoutMs = 30_000,
}) {
  if (!browserLauncher?.launch) {
    throw new Error("browser launcher with launch() is required")
  }

  if (!Array.isArray(capturePlans) || capturePlans.length === 0) {
    throw new Error("at least one browser capture plan is required")
  }

  const artifactPlan = capturePlans[0].artifactPlan
  for (const capturePlan of capturePlans) {
    if (capturePlan.artifactPlan !== artifactPlan) {
      throw new Error("browser capture plans must share an artifact plan")
    }
  }

  prepareBrowserEvidenceArtifacts(artifactPlan)

  const captures = []
  for (const capturePlan of capturePlans) {
    captures.push(
      await captureSingleBrowserEvidence({
        browserLauncher,
        capturePlan,
        timeoutMs,
      }),
    )
  }

  const result = {
    artifactPointer: artifactPlan.artifactPointer,
    browserIssues: summarizeBrowserEvidenceArtifact(artifactPlan),
    captures,
    consoleLog: artifactPlan.consoleLog,
    failedRequestLog: artifactPlan.networkLog,
  }

  writeFileSync(artifactPlan.summaryJson, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  writeFileSync(artifactPlan.readme, browserEvidenceMarkdown(result), "utf8")

  return result
}

function prepareBrowserEvidenceArtifacts(artifactPlan) {
  mkdirSync(artifactPlan.artifactDir, { recursive: true })
  mkdirSync(artifactPlan.screenshotDir, { recursive: true })
  mkdirSync(artifactPlan.videoDir, { recursive: true })
  writeFileSync(artifactPlan.consoleLog, "", "utf8")
  writeFileSync(artifactPlan.networkLog, "", "utf8")
}

async function captureSingleBrowserEvidence({ browserLauncher, capturePlan, timeoutMs }) {
  const { artifactPlan, screenshotFile, url, viewport } = capturePlan
  const browser = await browserLauncher.launch({ headless: true })
  let context
  let page
  let videoPath

  try {
    context = await browser.newContext({
      recordVideo: {
        dir: artifactPlan.videoDir,
        size: viewport,
      },
      viewport,
    })
    page = await context.newPage()
    wireBrowserEvidenceEvents({ artifactPlan, page })

    await page.goto(url, { timeout: timeoutMs, waitUntil: "networkidle" })
    await page.screenshot({ fullPage: true, path: screenshotFile })

    const video = page.video?.()
    await context.close()
    context = undefined
    videoPath = video ? await video.path().catch(() => undefined) : undefined
  } finally {
    if (context) await context.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
  }

  return {
    artifactPointer: artifactPlan.artifactPointer,
    screenshot: screenshotFile,
    url,
    video: videoPath,
    viewport,
  }
}

export function browserEvidenceText(result) {
  if (Array.isArray(result.captures)) {
    const lines = [`browser artifacts: ${result.artifactPointer}`]

    for (const capture of result.captures) {
      lines.push(
        `capture ${capture.viewport.width}x${capture.viewport.height}: ${capture.url}`,
        `screenshot: ${capture.screenshot}`,
      )
      if (capture.video) lines.push(`video: ${capture.video}`)
    }

    if (result.browserIssues) {
      lines.push(`browser issue summary: ${formatBrowserIssueSummary(result.browserIssues)}`)
    }
    lines.push(`console log: ${result.consoleLog}`)
    lines.push(`failed-request log: ${result.failedRequestLog}`)

    return lines.join("\n")
  }

  const lines = [
    `browser artifacts: ${result.artifactPointer}`,
    `url: ${result.url}`,
    `screenshot: ${result.screenshot}`,
    result.browserIssues
      ? `browser issue summary: ${formatBrowserIssueSummary(result.browserIssues)}`
      : null,
    `console log: ${result.consoleLog}`,
    `failed-request log: ${result.failedRequestLog}`,
  ].filter(Boolean)

  if (result.video) lines.push(`video: ${result.video}`)

  return lines.join("\n")
}

export function browserEvidenceMarkdown(result) {
  if (Array.isArray(result.captures)) {
    const captureLines = result.captures
      .map((capture) =>
        [
          `### ${capture.viewport.width}x${capture.viewport.height}`,
          "",
          `URL: ${capture.url}`,
          `Screenshot: ${capture.screenshot}`,
          capture.video ? `Video: ${capture.video}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n")

    return `# Browser Evidence

Artifacts: ${result.artifactPointer}

## Captures

${captureLines}

## Logs

${browserIssueMarkdown(result.browserIssues)}

- Console log: ${result.consoleLog}
- Failed-request log: ${result.failedRequestLog}
`
  }

  return `# Browser Evidence

URL: ${result.url}
Artifacts: ${result.artifactPointer}
Viewport: ${result.viewport.width}x${result.viewport.height}

## Files

${browserIssueMarkdown(result.browserIssues)}

- Screenshot: ${result.screenshot}
- Console log: ${result.consoleLog}
- Failed-request log: ${result.failedRequestLog}
${result.video ? `- Video: ${result.video}\n` : ""}
`
}

function screenshotNameForViewport(screenshotName, viewport, multipleViewports) {
  const safeName = safeScreenshotName(screenshotName)
  if (!multipleViewports) return safeName

  const extension = path.extname(safeName) || ".png"
  const stem = path.basename(safeName, path.extname(safeName))
  return `${stem}-${viewport.width}x${viewport.height}${extension}`
}

function wireBrowserEvidenceEvents({ artifactPlan, page }) {
  page.on("console", (message) => {
    appendJsonLine(artifactPlan.consoleLog, {
      location: message.location?.(),
      text: message.text(),
      timestamp: new Date().toISOString(),
      type: message.type(),
    })
  })

  page.on("pageerror", (error) => {
    appendJsonLine(artifactPlan.consoleLog, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      type: "pageerror",
    })
  })

  page.on("requestfailed", (request) => {
    appendJsonLine(artifactPlan.networkLog, {
      failure: request.failure?.()?.errorText,
      method: request.method(),
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString(),
      type: "requestfailed",
      url: request.url(),
    })
  })

  page.on("response", (response) => {
    if (response.status() < 400) return

    const request = response.request()
    appendJsonLine(artifactPlan.networkLog, {
      method: request.method(),
      resourceType: request.resourceType(),
      status: response.status(),
      statusText: response.statusText(),
      timestamp: new Date().toISOString(),
      type: "http-error",
      url: response.url(),
    })
  })
}

function appendJsonLine(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" })
}

function viewportSize(viewport) {
  const width = Number(viewport.width)
  const height = Number(viewport.height)

  if (!Number.isInteger(width) || width < 320 || width > 7680) {
    throw new Error(`invalid viewport width: ${String(viewport.width)}`)
  }

  if (!Number.isInteger(height) || height < 240 || height > 4320) {
    throw new Error(`invalid viewport height: ${String(viewport.height)}`)
  }

  return { height, width }
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "agent-task"
}
