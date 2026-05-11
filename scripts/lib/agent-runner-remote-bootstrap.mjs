import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export function remoteBootstrapPlan({
  baseRef = "main",
  branch,
  descriptor,
  item,
  remoteDir,
  repository,
  repoUrl,
} = {}) {
  if (!isRemoteWorkspaceDescriptor(descriptor)) {
    throw new Error(
      `remote bootstrap requires a remote-sandbox reference; got ${descriptor?.kind ?? "unknown"}`,
    )
  }

  const selectedBranch = branch ?? item?.dryRunPlan?.branch
  if (!selectedBranch) {
    throw new Error("remote bootstrap requires --branch when no issue plan is available")
  }

  const selectedRepoUrl = repoUrl ?? (repository ? `https://github.com/${repository}.git` : null)
  if (!selectedRepoUrl) {
    throw new Error("remote bootstrap requires --repo <owner/name> or --repo-url <url>")
  }

  const selectedRemoteDir = remoteDir ?? `/home/sprite/voyant-workspaces/${descriptor.id}/repo`
  assertShellValue("remote directory", selectedRemoteDir)
  assertShellValue("repository URL", selectedRepoUrl)
  assertShellValue("branch", selectedBranch)
  assertShellValue("base ref", baseRef)

  return {
    baseRef: normalizeRemoteBaseRef(baseRef),
    branch: selectedBranch,
    command: remoteBootstrapShell({
      baseRef: normalizeRemoteBaseRef(baseRef),
      branch: selectedBranch,
      remoteDir: selectedRemoteDir,
      repoUrl: selectedRepoUrl,
    }),
    remoteDir: selectedRemoteDir,
    repository,
    repoUrl: selectedRepoUrl,
  }
}

export function remoteBootstrapFieldValues({ branch, workspaceReference }, date = new Date()) {
  return {
    Status: "In Progress",
    "Agent State": "Planning",
    Branch: branch,
    Workspace: workspaceReference,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
}

export function remoteBootstrapShell({ baseRef, branch, remoteDir, repoUrl }) {
  return `set -euo pipefail
repo_dir=${shellQuote(remoteDir)}
repo_url=${shellQuote(repoUrl)}
branch=${shellQuote(branch)}
base_ref=${shellQuote(baseRef)}

mkdir -p "$(dirname "$repo_dir")"
if [ -d "$repo_dir/.git" ]; then
  cd "$repo_dir"
  git remote set-url origin "$repo_url"
elif [ -e "$repo_dir" ]; then
  echo "remote directory exists but is not a git repository: $repo_dir" >&2
  exit 1
else
  git clone "$repo_url" "$repo_dir"
  cd "$repo_dir"
fi

git fetch origin --prune
if git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
  git checkout "$branch"
elif git rev-parse --verify --quiet "refs/remotes/origin/$branch" >/dev/null; then
  git checkout --track -b "$branch" "origin/$branch"
else
  git checkout -b "$branch" "origin/$base_ref"
fi

git status --short --branch`
}

export function normalizeRemoteBaseRef(baseRef) {
  return String(baseRef).replace(/^origin\//, "")
}

function assertShellValue(name, value) {
  if (typeof value !== "string" || value.trim().length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`invalid remote bootstrap ${name}: ${String(value)}`)
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
