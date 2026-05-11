import { spawnSync } from "node:child_process"

import { fail } from "./agent-project-queue.mjs"

export function findExistingEvidenceComment({ issueNumber, marker, repository }) {
  const result = spawnSync("gh", ["api", `repos/${repository}/issues/${issueNumber}/comments`], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  })

  if (result.error) {
    fail(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    fail(stderr || `gh api exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    fail(`failed to parse gh JSON output: ${error.message}`)
  }

  const comment = payload.find((candidate) => candidate.body?.includes(marker))
  return comment?.html_url
}

export function createIssueComment({ body, issueNumber, repository }) {
  const result = spawnSync(
    "gh",
    [
      "api",
      `repos/${repository}/issues/${issueNumber}/comments`,
      "-X",
      "POST",
      "-f",
      `body=${body}`,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )

  if (result.error) {
    fail(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    fail(stderr || `gh api exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    fail(`failed to parse gh JSON output: ${error.message}`)
  }

  if (!payload.html_url) {
    fail("GitHub did not return an issue comment URL")
  }

  return payload.html_url
}

export function evidenceMarker({ evidenceReference, issueNumber, repository }) {
  const key = Buffer.from(`${repository}#${issueNumber}:${evidenceReference}`).toString("base64url")
  return `<!-- voyant-agent-evidence:${key} -->`
}

export function evidenceCommentBody({ evidenceBody, marker, remoteEvidenceUrl }) {
  const remoteLine = remoteEvidenceUrl ? `Published evidence packet: ${remoteEvidenceUrl}\n\n` : ""
  return `${marker}\n\n${remoteLine}${evidenceBody}`
}

export function isRemoteEvidence(evidence) {
  return /^https?:\/\//.test(evidence)
}
