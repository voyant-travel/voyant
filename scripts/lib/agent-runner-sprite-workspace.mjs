import { spawnSync } from "node:child_process"

export function spriteCliRemoteWorkspaceAdapter(descriptor, options = {}) {
  const env = options.env ?? process.env
  const cli = options.cli ?? env.SPRITE_CLI ?? "sprite"
  const runProcess = options.runProcess ?? spawnSync

  return {
    id: descriptor.id,
    kind: descriptor.kind,
    provider: descriptor.provider,
    ready: false,
    reason: "inspect has not run",
    reference: descriptor.reference,
    capabilities: {
      inspect: true,
      exec: true,
      spawn: false,
      exposeHttp: false,
      collectArtifacts: false,
      dispose: false,
    },
    async inspect() {
      const cliCheck = runSpriteCommand({
        cli,
        env,
        runProcess,
        spriteArgs: ["--help"],
      })
      const ready = cliCheck.status === 0

      return {
        capabilities: this.capabilities,
        cli,
        id: this.id,
        kind: this.kind,
        provider: this.provider,
        ready,
        reason: ready ? null : cliCheck.stderr || cliCheck.error || "sprite CLI is unavailable",
        reference: this.reference,
      }
    },
    async exec(command) {
      const commandPlan = spriteExecPlan(descriptor, command, { env })
      const result = runSpriteCommand({
        cli,
        env: commandPlan.env,
        runProcess,
        spriteArgs: commandPlan.args,
      })

      return {
        command: commandPlan.displayCommand,
        signal: result.signal,
        status: result.status,
        stderr: result.stderr,
        stdout: result.stdout,
      }
    },
  }
}

export function spriteExecPlan(descriptor, command, { env = process.env } = {}) {
  const normalizedCommand = normalizeWorkspaceCommand(command)
  const args = ["exec", "--sprite", descriptor.id]
  const org = normalizedCommand.org ?? env.SPRITE_ORG
  if (org) args.push("--org", org)
  if (normalizedCommand.cwd) args.push("--dir", normalizedCommand.cwd)
  if (normalizedCommand.env && Object.keys(normalizedCommand.env).length > 0) {
    args.push("--env", environmentFlag(normalizedCommand.env))
  }
  if (normalizedCommand.httpPost) args.push("--http-post")
  args.push(...normalizedCommand.command)

  return {
    args,
    displayCommand: normalizedCommand.command.join(" "),
    env: { ...env, ...normalizedCommand.env },
  }
}

function normalizeWorkspaceCommand(command) {
  if (typeof command === "string") {
    return { command: ["bash", "-lc", command], httpPost: true }
  }

  if (Array.isArray(command)) {
    return { command, httpPost: true }
  }

  if (!command || typeof command !== "object") {
    throw new Error("remote workspace exec requires a command string, array, or object")
  }

  const binary = command.command ?? command.cmd
  if (typeof binary !== "string" || binary.trim().length === 0) {
    throw new Error("remote workspace exec command object requires command")
  }

  const commandArgs = command.args ?? []
  if (!Array.isArray(commandArgs) || !commandArgs.every((arg) => typeof arg === "string")) {
    throw new Error("remote workspace exec command args must be an array of strings")
  }

  return {
    command: [binary, ...commandArgs],
    cwd: command.cwd,
    env: command.env,
    httpPost: command.httpPost ?? true,
    org: command.org,
  }
}

function environmentFlag(environment) {
  return Object.entries(environment)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",")
}

function runSpriteCommand({ cli, env, runProcess, spriteArgs }) {
  const result = runProcess(cli, spriteArgs, {
    encoding: "utf8",
    env,
  })

  return {
    error: result.error?.message,
    signal: result.signal ?? null,
    status: result.status ?? (result.signal || result.error ? 1 : 0),
    stderr: result.stderr?.trim() ?? "",
    stdout: result.stdout?.trim() ?? "",
  }
}
