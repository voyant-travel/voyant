const commandBackedActions = new Set([
  "capture-browser",
  "remote-capture-browser",
  "remote-run-command",
  "run-command",
])

const implementationActions = new Set(["remote-run-command", "run-command"])
const browserActions = new Set(["capture-browser", "remote-capture-browser"])

export function evaluateExecutorQualityGate(intent, { eventLogPath } = {}) {
  const reasons = []
  const warnings = []
  const action = intent?.plan?.action
  const command = intent?.plan?.command

  if (!action) {
    reasons.push("dispatch intent action is missing")
  }

  if (!Array.isArray(command) || command.length === 0) {
    reasons.push("dispatch intent command is missing")
  }

  if (containsPlaceholder(command)) {
    reasons.push("dispatch intent command still contains executor placeholders")
  }

  if (implementationActions.has(action)) {
    const implementationCommand = optionValue(command, "--command")
    if (!implementationCommand) {
      reasons.push(`${action} requires --command`)
    }
    if (implementationCommand && isDangerousImplementationCommand(implementationCommand)) {
      reasons.push(`${action} command uses a blocked destructive git pattern`)
    }
  }

  if (browserActions.has(action)) {
    if (!optionValue(command, "--dev-server-command")) {
      reasons.push(`${action} requires --dev-server-command`)
    }
  }

  if (action === "remote-capture-browser") {
    const port = Number(optionValue(command, "--port"))
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      reasons.push("remote-capture-browser requires --port 1..65535")
    }
  }

  if (commandBackedActions.has(action) && !eventLogPath) {
    warnings.push("event log is not configured; recovery evidence will be weaker")
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
  }
}

export function executorQualityGateFailure(gate) {
  return `executor quality gate failed: ${gate.reasons.join("; ")}`
}

function containsPlaceholder(command) {
  return (
    Array.isArray(command) &&
    command.some((part) => typeof part === "string" && /<[^>]+>/.test(part))
  )
}

function optionValue(command, name) {
  if (!Array.isArray(command)) return undefined

  const separator = command.indexOf("--")
  const args = separator === -1 ? command : command.slice(separator + 1)
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function isDangerousImplementationCommand(command) {
  return /\bgit\s+(reset\s+--hard|clean\s+-|checkout\s+--|branch\s+-D)\b/.test(command)
}
