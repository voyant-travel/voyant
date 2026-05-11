import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { requiresBrowserEvidence } from "./agent-runner-browser-evidence.mjs"
import {
  browserIssueBlockReason,
  formatBrowserIssueSummary,
} from "./agent-runner-browser-issues.mjs"

export function browserEvidenceQualityBlockReason({
  allowBrowserIssues = false,
  item,
  uiEvidence,
  workspace,
}) {
  if (!requiresBrowserEvidence(item)) return null

  const summaryPlan = browserEvidenceSummaryPlan({ uiEvidence, workspace })
  if (!summaryPlan) return null
  if (!summaryPlan.safePath) {
    return `browser evidence summary is outside the workspace: ${summaryPlan.reference}`
  }
  if (!existsSync(summaryPlan.summaryPath)) {
    return `browser evidence summary was not found: ${summaryPlan.reference}`
  }

  const summary = readBrowserEvidenceSummary(summaryPlan.summaryPath)
  if (!summary.ok) {
    return `browser evidence summary is malformed: ${summaryPlan.reference}`
  }

  return browserIssueBlockReason(summary.browserIssues, { allowBrowserIssues })
}

export function browserEvidenceReviewMarkdown({ uiEvidence, workspace }) {
  const trimmedEvidence = uiEvidence?.trim()
  if (!trimmedEvidence) return "Not applicable or not provided."

  const summaryPlan = browserEvidenceSummaryPlan({ uiEvidence, workspace })
  if (!summaryPlan?.safePath || !existsSync(summaryPlan.summaryPath)) {
    return trimmedEvidence
  }

  const summary = readBrowserEvidenceSummary(summaryPlan.summaryPath)
  if (!summary.ok) return trimmedEvidence

  return formatBrowserEvidenceSummaryForReview({
    reference: summaryPlan.reference,
    summary: summary.value,
    workspace,
  })
}

export function browserEvidenceSummaryPlan({ uiEvidence, workspace }) {
  const reference = browserEvidenceReferenceFromText(uiEvidence)
  if (!reference) return null
  if (!workspace) return null

  const summaryReference = reference.endsWith("/summary.json")
    ? reference
    : path.posix.join(reference, "summary.json")
  const summaryPath = path.resolve(workspace, summaryReference)

  return {
    reference: summaryReference,
    safePath: isPathInside(summaryPath, workspace),
    summaryPath,
  }
}

function browserEvidenceReferenceFromText(uiEvidence) {
  const match = uiEvidence?.match(/docs\/agent-evidence\/browser\/[^\s)]+/)
  return match?.[0]?.replace(/[),.;]+$/g, "") ?? null
}

function readBrowserEvidenceSummary(summaryPath) {
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf8"))
    if (!summary?.browserIssues || typeof summary.browserIssues.hasBlockingIssues !== "boolean") {
      return { ok: false }
    }

    return { browserIssues: summary.browserIssues, ok: true, value: summary }
  } catch (error) {
    return {
      ok: false,
      parseError: error.message,
    }
  }
}

function formatBrowserEvidenceSummaryForReview({ reference, summary, workspace }) {
  const artifactPointer = summary.artifactPointer ?? path.posix.dirname(reference)
  const captures = Array.isArray(summary.captures) ? summary.captures : [summary]
  const captureLines = captures
    .map((capture) => formatBrowserEvidenceCapture(capture, { workspace }))
    .filter(Boolean)
    .join("\n")

  return [
    `Browser artifacts: ${artifactPointer}`,
    summary.remoteArtifactIndex ? `Remote artifact index: ${summary.remoteArtifactIndex}` : null,
    `Browser issue summary: ${formatBrowserIssueSummary(summary.browserIssues)}`,
    `Blocking browser issues: ${summary.browserIssues.hasBlockingIssues ? "yes" : "no"}`,
    "",
    "Captures:",
    captureLines || "- Not recorded.",
    "",
    "Logs:",
    `- Summary: ${reference}`,
    summary.consoleLog
      ? `- Console log: ${formatArtifactReference(summary.consoleLog, workspace)}`
      : null,
    summary.failedRequestLog
      ? `- Failed-request log: ${formatArtifactReference(summary.failedRequestLog, workspace)}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

function formatBrowserEvidenceCapture(capture, { workspace }) {
  if (!capture) return ""

  const viewport = capture.viewport
    ? `${capture.viewport.width}x${capture.viewport.height}`
    : "browser capture"
  const lines = [`- ${viewport}: ${capture.url ?? "URL not recorded"}`]

  if (capture.screenshot) {
    const screenshot = formatArtifactReference(capture.screenshot, workspace)
    lines.push(`  - Screenshot: ![${viewport} screenshot](${screenshot})`)
  }

  if (capture.video) {
    const video = formatArtifactReference(capture.video, workspace)
    lines.push(`  - Video: ${video}`)
  }

  return lines.join("\n")
}

function formatArtifactReference(reference, workspace) {
  if (!reference) return reference
  if (/^https?:\/\//.test(reference)) return reference
  if (!path.isAbsolute(reference)) return toPosixPath(reference)
  if (!workspace || !isPathInside(reference, workspace)) return toPosixPath(reference)

  return toPosixPath(path.relative(workspace, reference))
}

function toPosixPath(reference) {
  return reference.split(path.sep).join(path.posix.sep)
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}
