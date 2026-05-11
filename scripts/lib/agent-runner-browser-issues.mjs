import { readFileSync } from "node:fs"

export function summarizeBrowserEvidenceArtifact(artifactPlan) {
  return summarizeBrowserEvidenceIssues({
    consoleLogText: readFileSync(artifactPlan.consoleLog, "utf8"),
    networkLogText: readFileSync(artifactPlan.networkLog, "utf8"),
  })
}

export function summarizeBrowserEvidenceIssues({ consoleLogText = "", networkLogText = "" } = {}) {
  const consoleEvents = parseJsonLines(consoleLogText)
  const networkEvents = parseJsonLines(networkLogText)
  const consoleErrors = consoleEvents.filter((event) =>
    ["error", "pageerror"].includes(String(event.type)),
  ).length
  const consoleWarnings = consoleEvents.filter((event) =>
    ["warning", "warn"].includes(String(event.type)),
  ).length
  const httpErrors = networkEvents.filter((event) => event.type === "http-error").length
  const requestFailures = networkEvents.filter((event) => event.type === "requestfailed").length
  const malformedLogLines = [...consoleEvents, ...networkEvents].filter(
    (event) => event.type === "malformed-jsonl",
  ).length
  const failedRequests = httpErrors + requestFailures

  return {
    consoleErrors,
    consoleWarnings,
    failedRequests,
    hasBlockingIssues: consoleErrors > 0 || failedRequests > 0 || malformedLogLines > 0,
    httpErrors,
    malformedLogLines,
    requestFailures,
  }
}

export function formatBrowserIssueSummary(summary) {
  return [
    `${summary.consoleErrors} console error${summary.consoleErrors === 1 ? "" : "s"}`,
    `${summary.consoleWarnings} console warning${summary.consoleWarnings === 1 ? "" : "s"}`,
    `${summary.failedRequests} failed request${summary.failedRequests === 1 ? "" : "s"}`,
    summary.malformedLogLines
      ? `${summary.malformedLogLines} malformed log line${
          summary.malformedLogLines === 1 ? "" : "s"
        }`
      : null,
  ]
    .filter(Boolean)
    .join(", ")
}

export function browserIssueMarkdown(summary) {
  if (!summary) return ""

  return `## Browser Issue Summary

- ${formatBrowserIssueSummary(summary)}
- Blocking issues: ${summary.hasBlockingIssues ? "yes" : "no"}
`
}

function parseJsonLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { raw: line, type: "malformed-jsonl" }
      }
    })
}
