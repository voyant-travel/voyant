import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

export function actionableReviewDetails(pr) {
  const reviewDecision = pr.reviewDecision ?? ""
  const threads = Array.isArray(pr.reviewThreads?.unresolved) ? pr.reviewThreads.unresolved : []

  return {
    actionable: reviewDecision === "CHANGES_REQUESTED" || threads.length > 0,
    reviewDecision,
    threads,
  }
}

export function reviewRepairBlocker(details) {
  const parts = []
  if (details.reviewDecision === "CHANGES_REQUESTED") {
    parts.push("PR changes requested")
  }

  if (details.threads.length > 0) {
    parts.push(formatThreadBlocker(details.threads))
  }

  return parts.join("; ") || "PR review requires attention"
}

export function hasReviewRepairEvidence(evidence) {
  return (
    typeof evidence === "string" &&
    !evidence.split("/").includes("..") &&
    /^\.agent-runs\/.+\/review-repair-[^/]+\.md$/.test(evidence)
  )
}

export function reviewRepairEvidenceEnvironment({ evidenceReference, repoRoot }) {
  const evidencePath = resolveReviewRepairEvidencePath({ evidenceReference, repoRoot })
  if (!evidencePath) return {}

  return {
    VOYANT_AGENT_REVIEW_REPAIR_EVIDENCE_PATH: evidencePath,
    VOYANT_AGENT_REVIEW_REPAIR_EVIDENCE_REFERENCE: evidenceReference,
  }
}

export function resolveReviewRepairEvidencePath({ evidenceReference, repoRoot }) {
  if (!hasReviewRepairEvidence(evidenceReference)) return null

  const evidenceRoot = path.resolve(repoRoot, ".agent-runs")
  const evidencePath = path.resolve(repoRoot, evidenceReference)
  if (!isPathInside(evidencePath, evidenceRoot)) return null

  return evidencePath
}

export function reviewRepairArtifactPlan({ date = new Date(), item, repoRoot }) {
  const timestamp = date.toISOString().replace(/[:.]/g, "-")
  const slug = slugFromTitle(item.issue.title)
  const evidencePointer = path.posix.join(
    ".agent-runs",
    `${item.issue.number}-${slug}`,
    `review-repair-${timestamp}.md`,
  )

  return {
    evidenceFile: path.resolve(repoRoot, evidencePointer),
    evidencePointer,
  }
}

export function writeReviewRepairEvidencePacket({ artifactPlan, details, item, pr, repository }) {
  mkdirSync(path.dirname(artifactPlan.evidenceFile), { recursive: true })
  writeFileSync(
    artifactPlan.evidenceFile,
    buildReviewRepairEvidencePacket({
      details,
      generatedAt: new Date(),
      item,
      pr,
      repository,
    }),
    "utf8",
  )
}

export function buildReviewRepairEvidencePacket({ details, generatedAt, item, pr, repository }) {
  return `# Review Repair Packet: ${item.issue.title}

Issue: ${item.issue.url}
Repository: ${repository}
Pull Request: ${pr.url}
Generated: ${generatedAt.toISOString()}

## Review State

- Review decision: ${details.reviewDecision || "none"}
- Unresolved current review threads: ${String(details.threads.length)}

## Review Threads

${formatThreadDetails(details.threads)}

## Repair Prompt

Use this packet to address the current PR review feedback before editing code.
Prefer the smallest fix that resolves the actionable comments, preserve
unrelated changes, rerun the smallest local verification lane that covers the
fix, and update the evidence packet before asking for another review.
`
}

function formatThreadBlocker(threads) {
  const first = threads[0]
  const suffix = first ? ` (${formatThreadLocation(first)}: ${excerpt(first.body)})` : ""
  return `Unresolved PR review threads: ${String(threads.length)}${suffix}`
}

function formatThreadDetails(threads) {
  if (threads.length === 0) return "No unresolved current review threads were present."

  return threads
    .map(
      (thread, index) => `### Thread ${String(index + 1)}

- Location: ${formatThreadLocation(thread)}
- Author: ${thread.author ?? "unknown"}

${quoteBody(thread.body)}`,
    )
    .join("\n\n")
}

function formatThreadLocation(thread) {
  const location = [thread.path, thread.line ? `:${String(thread.line)}` : ""]
    .filter(Boolean)
    .join("")
  return location || "unknown location"
}

function quoteBody(body) {
  const trimmed = String(body ?? "").trim()
  if (!trimmed) return "> No comment body was available."
  return trimmed
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n")
}

function excerpt(value, maxLength = 140) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return "no comment body"
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}...`
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
