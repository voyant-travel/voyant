import path from "node:path"

import { defaultRemoteWorkspaceRepoDir } from "./agent-runner-remote-bootstrap.mjs"

export function remoteEvidencePublicationPlan({
  descriptor,
  evidencePath,
  item,
  remoteDir,
  workspaceReference,
}) {
  const workspace = remoteDir ?? defaultRemoteWorkspaceRepoDir(descriptor)
  const evidencePointer = evidencePath ?? item.fields.Evidence
  const absoluteEvidencePointer =
    typeof evidencePointer === "string" && path.posix.isAbsolute(evidencePointer)
  const evidenceFile = absoluteEvidencePointer
    ? evidencePointer
    : path.posix.join(workspace, evidencePointer ?? "")

  return {
    evidenceFile,
    evidencePointer,
    safeEvidencePath:
      typeof evidencePointer === "string" &&
      evidencePointer.trim().length > 0 &&
      !absoluteEvidencePointer &&
      isPosixPathInside(evidenceFile, workspace),
    workspace,
    workspaceReference,
  }
}

export function remoteReadFileBase64Shell({ file }) {
  assertShellValue("file", file)

  return `set -euo pipefail
file=${shellQuote(file)}
test -f "$file"
base64 "$file" | tr -d '\\n'`
}

export function decodeRemoteBase64File({ file, stdout }) {
  const encoded = String(stdout ?? "").replace(/\s+/g, "")
  if (!encoded) {
    throw new Error(`remote evidence packet is empty: ${file}`)
  }

  return Buffer.from(encoded, "base64").toString("utf8")
}

export function remoteEvidencePublicationFieldValues({ date = new Date(), evidenceUrl }) {
  return {
    Evidence: evidenceUrl,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
}

function isPosixPathInside(candidatePath, parentPath) {
  const relative = path.posix.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.posix.isAbsolute(relative)
}

function assertShellValue(name, value) {
  if (typeof value !== "string" || value.trim().length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`invalid remote evidence ${name}: ${String(value)}`)
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
