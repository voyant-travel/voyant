import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { requiresBrowserEvidence } from "./agent-runner-browser-evidence.mjs"
import { browserIssueBlockReason } from "./agent-runner-browser-issues.mjs"

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

    return { browserIssues: summary.browserIssues, ok: true }
  } catch (error) {
    return {
      ok: false,
      parseError: error.message,
    }
  }
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}
