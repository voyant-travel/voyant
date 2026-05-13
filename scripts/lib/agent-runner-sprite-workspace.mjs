import { spawnSync } from "node:child_process"

const defaultSpritesApiUrl = "https://api.sprites.dev"

export function spriteRemoteWorkspaceAdapter(descriptor, options = {}) {
  const env = options.env ?? process.env
  const token = spritesApiToken({ env, token: options.token })
  if (token) {
    return spriteApiRemoteWorkspaceAdapter(descriptor, { ...options, token })
  }

  return spriteCliRemoteWorkspaceAdapter(descriptor, options)
}

export function spriteApiRemoteWorkspaceAdapter(descriptor, options = {}) {
  const env = options.env ?? process.env
  const token = spritesApiToken({ env, token: options.token })
  const target = resolveSpriteTarget(descriptor, { env, pool: options.pool })
  const apiUrl = normalizeSpritesApiUrl(
    options.apiUrl ?? env.SPRITES_API_URL ?? env.SPRITE_API_URL ?? defaultSpritesApiUrl,
  )
  const fetchImpl = options.fetchImpl ?? fetch

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
      dispose: true,
    },
    async inspect() {
      if (!token) {
        return {
          apiUrl,
          capabilities: this.capabilities,
          id: this.id,
          kind: this.kind,
          provider: this.provider,
          ready: false,
          reason: "SPRITES_TOKEN or SPRITE_TOKEN is not configured",
          reference: this.reference,
          spriteName: target.sprite,
        }
      }

      const response = await requestSpritesApi({
        apiUrl,
        fetchImpl,
        method: "GET",
        path: `/v1/sprites/${encodeURIComponent(target.sprite)}`,
        token,
      })

      return {
        apiUrl,
        capabilities: this.capabilities,
        id: this.id,
        kind: this.kind,
        provider: this.provider,
        ready: response.ok,
        reason: response.ok ? null : spriteApiErrorReason(response),
        reference: this.reference,
        spriteName: target.sprite,
        slot: target.slot,
        sprite: response.body ?? null,
      }
    },
    async exec(command) {
      if (!token) {
        throw new Error("sprite API exec requires SPRITES_TOKEN or SPRITE_TOKEN")
      }

      const commandPlan = spriteApiExecPlan(descriptor, command, { env })
      const response = await requestSpritesApi({
        apiUrl,
        fetchImpl,
        method: "POST",
        path: `/v1/sprites/${encodeURIComponent(target.sprite)}/exec?${commandPlan.query.toString()}`,
        token,
      })
      const output = parseSpriteExecResponse(response)

      return {
        command: commandPlan.displayCommand,
        signal: null,
        status: response.ok ? output.status : 1,
        stderr: response.ok ? output.stderr : output.stderr || spriteApiErrorReason(response),
        stdout: response.ok ? output.stdout : output.stdout,
      }
    },
    async dispose() {
      if (!token) {
        throw new Error("sprite API dispose requires SPRITES_TOKEN or SPRITE_TOKEN")
      }

      const response = await requestSpritesApi({
        apiUrl,
        fetchImpl,
        method: "DELETE",
        path: `/v1/sprites/${encodeURIComponent(target.sprite)}`,
        token,
      })
      if (!response.ok) {
        throw new Error(spriteApiErrorReason(response))
      }

      return {
        disposed: true,
        status: response.status,
        spriteName: target.sprite,
      }
    },
  }
}

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
  const target = resolveSpriteTarget(descriptor, { env })
  const args = ["exec", "--sprite", target.sprite]
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

export function spriteApiExecPlan(_descriptor, command, { env = process.env } = {}) {
  const normalizedCommand = normalizeWorkspaceCommand(command)
  const query = new URLSearchParams()
  for (const part of normalizedCommand.command) {
    query.append("cmd", part)
  }
  if (normalizedCommand.cwd) query.set("dir", normalizedCommand.cwd)
  for (const [key, value] of Object.entries(normalizedCommand.env ?? {})) {
    query.append("env", `${key}=${String(value)}`)
  }

  return {
    displayCommand: normalizedCommand.command.join(" "),
    env: { ...env, ...normalizedCommand.env },
    query,
  }
}

export function parseSpritePool(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      const [rawSprite, rawCapacity] = entry.split(":")
      const sprite = rawSprite?.trim()
      if (!sprite || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(sprite)) return []

      const parsedCapacity = Number(rawCapacity)
      const capacity =
        rawCapacity && Number.isInteger(parsedCapacity) && parsedCapacity > 0
          ? Math.min(parsedCapacity, 10)
          : 1

      return Array.from({ length: capacity }, (_, index) => ({
        id: capacity === 1 ? sprite : `${sprite}-slot-${index + 1}`,
        slot: index + 1,
        sprite,
        workspaceReference: `sandbox:sprite:${capacity === 1 ? sprite : `${sprite}-slot-${index + 1}`}`,
      }))
    })
}

export function resolveSpriteTarget(descriptor, { env = process.env, pool } = {}) {
  const slots = pool ?? parseSpritePool(env.AGENT_SPRITE_POOL ?? env.SPRITE_POOL)
  const slot = slots.find((candidate) => candidate.id === descriptor.id)
  if (slot) {
    return {
      id: descriptor.id,
      slot: slot.slot,
      sprite: slot.sprite,
    }
  }

  return {
    id: descriptor.id,
    slot: null,
    sprite: descriptor.id,
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

async function requestSpritesApi({ apiUrl, fetchImpl, method, path, token }) {
  const response = await fetchImpl(`${apiUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    method,
  })
  const text = await response.text()

  return {
    body: parseJson(text),
    ok: response.ok,
    status: response.status,
    text,
  }
}

function parseSpriteExecResponse(response) {
  const body = response.body
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return {
      status: numberValue(body.exit_code, body.exitCode, body.status) ?? 0,
      stderr: stringValue(body.stderr, body.error, body.message),
      stdout: stringValue(body.stdout, body.output, body.logs),
    }
  }

  return parseSpriteExecText(response.text)
}

function parseSpriteExecText(text) {
  if (!text) return { status: 0, stderr: "", stdout: "" }

  let status = 0
  let sawStructuredLine = false
  const stderr = []
  const stdout = []

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const event = parseJson(line)
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      stdout.push(line)
      continue
    }

    sawStructuredLine = true
    const value = stringValue(event.data, event.message, event.payload, event.text)
    if (event.type === "stderr") {
      if (value) stderr.push(value)
      continue
    }
    if (event.type === "stdout") {
      if (value) stdout.push(value)
      continue
    }
    if (event.type === "exit" || event.type === "exited") {
      status = numberValue(event.exit_code, event.exitCode, event.code) ?? status
      continue
    }
    if (value) stdout.push(value)
  }

  return {
    status,
    stderr: stderr.join("\n"),
    stdout: sawStructuredLine ? stdout.join("\n") : text,
  }
}

function spriteApiErrorReason(response) {
  const detail = stringValue(response.body?.error, response.body?.message, response.text)
  return detail
    ? `sprite API request failed with ${response.status}: ${detail}`
    : `sprite API request failed with ${response.status}`
}

function spritesApiToken({ env, token }) {
  return token ?? env.SPRITES_TOKEN ?? env.SPRITE_TOKEN
}

function normalizeSpritesApiUrl(url) {
  return String(url || defaultSpritesApiUrl).replace(/\/+$/, "")
}

function parseJson(text) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function numberValue(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

function stringValue(...values) {
  for (const value of values) {
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
  }
  return ""
}
