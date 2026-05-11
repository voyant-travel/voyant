import path from "node:path"

export const localWorkspaceKind = "local-worktree"
export const remoteWorkspaceKind = "remote-sandbox"

const remoteWorkspacePattern = /^sandbox:([a-z][a-z0-9-]{0,31}):([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/

export function parseWorkspaceReference(reference, { repoRoot }) {
  if (typeof reference !== "string" || reference.trim().length === 0) {
    return invalidWorkspace(reference, "workspace reference is empty")
  }

  const normalizedReference = reference.trim()
  const remoteMatch = normalizedReference.match(remoteWorkspacePattern)
  if (remoteMatch) {
    return {
      id: remoteMatch[2],
      kind: remoteWorkspaceKind,
      provider: remoteMatch[1],
      reference: normalizedReference,
    }
  }

  if (normalizedReference.startsWith("sandbox:")) {
    return invalidWorkspace(normalizedReference, "remote sandbox reference is malformed")
  }

  const workspace = path.resolve(repoRoot, normalizedReference)
  const localRoot = path.resolve(repoRoot, ".agent-worktrees")

  return {
    agentWorktreeRoot: localRoot,
    id: path.basename(workspace),
    kind: localWorkspaceKind,
    provider: null,
    reference: normalizedReference,
    safeLocalWorkspace: isPathInside(workspace, localRoot),
    workspace,
  }
}

export function workspaceDescriptorEnvironment(descriptor) {
  const environment = {
    VOYANT_AGENT_WORKSPACE_ID: descriptor.id ?? "",
    VOYANT_AGENT_WORKSPACE_KIND: descriptor.kind,
    VOYANT_AGENT_WORKSPACE_PROVIDER:
      descriptor.kind === remoteWorkspaceKind ? descriptor.provider : "",
    VOYANT_AGENT_WORKSPACE_REFERENCE: descriptor.reference ?? "",
  }

  return environment
}

export function isLocalWorkspaceDescriptor(descriptor) {
  return descriptor.kind === localWorkspaceKind
}

export function isRemoteWorkspaceDescriptor(descriptor) {
  return descriptor.kind === remoteWorkspaceKind
}

function invalidWorkspace(reference, reason) {
  return {
    id: null,
    kind: "invalid",
    provider: null,
    reason,
    reference,
  }
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath)
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative)
}
