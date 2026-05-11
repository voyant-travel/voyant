import { defaultRemoteWorkspaceRepoDir } from "./agent-runner-remote-bootstrap.mjs"
import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export function remotePullRequestPlan({ branch, descriptor, item, remoteDir } = {}) {
  if (!isRemoteWorkspaceDescriptor(descriptor)) {
    throw new Error(
      `remote open-pr requires a remote-sandbox reference; got ${descriptor?.kind ?? "unknown"}`,
    )
  }

  const selectedBranch = branch ?? item?.fields?.Branch ?? item?.dryRunPlan?.branch
  if (!selectedBranch) {
    throw new Error("remote open-pr requires --branch when no issue plan is available")
  }

  const workspace = remoteDir ?? defaultRemoteWorkspaceRepoDir(descriptor)
  assertShellValue("remote directory", workspace)
  assertShellValue("branch", selectedBranch)

  return {
    branch: selectedBranch,
    workspace,
  }
}

export function remotePushBranchShell({ allowDirty = false, branch }) {
  assertShellValue("branch", branch)

  return `set -euo pipefail
branch=${shellQuote(branch)}
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$branch" ]; then
  echo "remote workspace branch is $current_branch; expected $branch" >&2
  exit 1
fi

status="$(git status --porcelain)"
if [ -n "$status" ] && [ ${allowDirty ? "0" : "1"} -eq 1 ]; then
  echo "remote workspace has uncommitted changes; commit them or pass --allow-dirty" >&2
  echo "$status" >&2
  exit 1
fi

git push -u origin "$branch"`
}

function assertShellValue(name, value) {
  if (typeof value !== "string" || value.trim().length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`invalid remote open-pr ${name}: ${String(value)}`)
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
