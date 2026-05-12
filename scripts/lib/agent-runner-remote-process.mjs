import path from "node:path"

import { defaultRemoteWorkspaceRepoDir } from "./agent-runner-remote-bootstrap.mjs"
import { isRemoteWorkspaceDescriptor } from "./agent-runner-workspace-contract.mjs"

export function remoteProcessPlan({
  descriptor,
  item,
  name,
  port,
  remoteDir,
  workspaceReference,
} = {}) {
  if (!isRemoteWorkspaceDescriptor(descriptor)) {
    throw new Error(
      `remote process requires a remote-sandbox reference; got ${descriptor?.kind ?? "unknown"}`,
    )
  }

  const processName = safeProcessName(
    name ??
      `${item?.issue?.number ?? "task"}-${slugFromTitle(item?.issue?.title ?? "remote-process")}`,
  )
  const processPort = port === undefined ? undefined : Number(port)
  if (processPort !== undefined) {
    assertPositiveInteger("port", processPort)
  }

  const workspace = remoteDir ?? defaultRemoteWorkspaceRepoDir(descriptor)
  assertShellValue("remote directory", workspace)

  const processDir = path.posix.join(workspace, ".agent-runs", "remote-processes", processName)
  const metadataFile = path.posix.join(processDir, "process.json")

  return {
    commandFile: path.posix.join(processDir, "command.sh"),
    logFile: path.posix.join(processDir, "process.log"),
    metadataFile,
    metadataPointer: path.posix.relative(workspace, metadataFile),
    processGroupFile: path.posix.join(processDir, "process.pgid"),
    pidFile: path.posix.join(processDir, "process.pid"),
    port: processPort,
    processDir,
    processName,
    workspace,
    workspaceReference,
  }
}

export function remoteStartProcessShell({ command, plan, verifyAfterSeconds = 2 }) {
  assertShellValue("command", command)
  assertPositiveInteger("verifyAfterSeconds", verifyAfterSeconds)

  return `set -euo pipefail
process_dir=${shellQuote(plan.processDir)}
pid_file=${shellQuote(plan.pidFile)}
process_group_file=${shellQuote(plan.processGroupFile)}
log_file=${shellQuote(plan.logFile)}
command_file=${shellQuote(plan.commandFile)}
encoded_command=${shellQuote(Buffer.from(command, "utf8").toString("base64"))}
verify_after=${shellQuote(String(verifyAfterSeconds))}

mkdir -p "$process_dir"
if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
  echo "remote process already running: $(cat "$pid_file")" >&2
  exit 1
fi
rm -f "$pid_file" "$process_group_file"

printf '%s' "$encoded_command" | base64 -d > "$command_file"
chmod +x "$command_file"
: > "$log_file"
if command -v setsid >/dev/null 2>&1; then
  nohup setsid bash "$command_file" >> "$log_file" 2>&1 < /dev/null &
  printf '1\\n' > "$process_group_file"
else
  nohup bash "$command_file" >> "$log_file" 2>&1 < /dev/null &
  printf '0\\n' > "$process_group_file"
fi
pid=$!
printf '%s\\n' "$pid" > "$pid_file"
sleep "$verify_after"

if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$pid_file" "$process_group_file"
  echo "remote process exited during startup: $pid" >&2
  tail -n 80 "$log_file" >&2 || true
  exit 1
fi

echo "remote process started: $pid"
echo "pid file: $pid_file"
echo "log file: $log_file"`
}

export function remoteStopProcessShell({ graceSeconds = 10, plan }) {
  assertPositiveInteger("graceSeconds", graceSeconds)

  return `set -euo pipefail
pid_file=${shellQuote(plan.pidFile)}
process_group_file=${shellQuote(plan.processGroupFile)}
log_file=${shellQuote(plan.logFile)}
grace_seconds=${shellQuote(String(graceSeconds))}

if [ ! -f "$pid_file" ]; then
  echo "remote process is not running: missing pid file"
  exit 0
fi

pid="$(cat "$pid_file")"
if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$pid_file" "$process_group_file"
  echo "remote process is not running: stale pid $pid"
  exit 0
fi

target="$pid"
if [ -f "$process_group_file" ] && [ "$(cat "$process_group_file")" = "1" ]; then
  target="-$pid"
fi

kill -- "$target" 2>/dev/null || kill "$pid" 2>/dev/null || true
deadline=$((SECONDS + grace_seconds))
while kill -0 "$pid" 2>/dev/null && [ "$SECONDS" -lt "$deadline" ]; do
  sleep 1
done

if kill -0 "$pid" 2>/dev/null; then
  kill -KILL -- "$target" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
fi

rm -f "$pid_file" "$process_group_file"
echo "remote process stopped: $pid"
if [ -f "$log_file" ]; then
  echo "log file: $log_file"
fi`
}

export function remoteProcessStatusShell({ plan, tailLines = 80 }) {
  assertPositiveInteger("tailLines", tailLines)

  return `set -euo pipefail
pid_file=${shellQuote(plan.pidFile)}
process_group_file=${shellQuote(plan.processGroupFile)}
metadata_file=${shellQuote(plan.metadataFile)}
log_file=${shellQuote(plan.logFile)}
tail_lines=${shellQuote(String(tailLines))}

status="stopped"
reason="missing-pid-file"
pid=""
process_group="unknown"

if [ -f "$pid_file" ]; then
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    status="running"
    reason="pid-live"
  else
    status="stopped"
    reason="stale-pid"
  fi
fi

if [ -f "$process_group_file" ]; then
  if [ "$(cat "$process_group_file")" = "1" ]; then
    process_group="yes"
  else
    process_group="no"
  fi
fi

echo "status: $status"
echo "reason: $reason"
echo "pid: \${pid:-none}"
echo "process group: $process_group"
echo "pid file: $pid_file"
echo "metadata file: $metadata_file"
echo "log file: $log_file"

if [ -f "$metadata_file" ]; then
  echo ""
  echo "--- metadata ---"
  cat "$metadata_file"
fi

if [ -f "$log_file" ]; then
  echo ""
  echo "--- log tail ($tail_lines) ---"
  tail -n "$tail_lines" "$log_file" || true
else
  echo ""
  echo "log: missing"
fi`
}

export function remoteProcessMetadata({ command, date = new Date(), item, plan, repository }) {
  return {
    command,
    createdAt: date.toISOString(),
    issue: item?.issue
      ? {
          number: item.issue.number,
          title: item.issue.title,
          url: item.issue.url,
        }
      : null,
    logFile: plan.logFile,
    metadataFile: plan.metadataFile,
    pidFile: plan.pidFile,
    processGroupFile: plan.processGroupFile,
    port: plan.port ?? null,
    processName: plan.processName,
    repository,
    workspace: plan.workspace,
    workspaceReference: plan.workspaceReference,
  }
}

function safeProcessName(value) {
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")

  if (!normalized) {
    throw new Error("remote process name is empty")
  }

  return normalized
}

function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "")

  return slug || "remote-process"
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(Number(value)) || Number(value) < 1) {
    throw new Error(`invalid remote process ${name}: ${String(value)}`)
  }
}

function assertShellValue(name, value) {
  if (typeof value !== "string" || value.trim().length === 0 || /[\0\r\n]/.test(value)) {
    throw new Error(`invalid remote process ${name}: ${String(value)}`)
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
