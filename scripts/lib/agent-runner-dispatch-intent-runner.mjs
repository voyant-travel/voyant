import { dispatchIntentCommandArgs, runDispatchIntentCommand } from "./agent-runner-dispatch.mjs"
import { issueEventDetails, tryAppendAgentRunnerEvent } from "./agent-runner-events.mjs"
import {
  evaluateExecutorQualityGate,
  executorQualityGateFailure,
} from "./agent-runner-executor-policy.mjs"

export async function runLeasedDispatchIntent({
  config,
  eventLogPath,
  finishDispatchIntent,
  holder,
  intent,
  log = console.log,
  repository,
  requestLatestDispatchIntentResult,
  runDispatchIntentCommandImpl = runDispatchIntentCommand,
}) {
  let commandArgs
  let status = 1
  let terminalStatus = "failed"
  let terminalReason = "command failed"

  try {
    commandArgs = dispatchIntentCommandArgs(intent)
    printIntent({ commandArgs, controlPlaneUrl: config.url, intent, log })
    const qualityGate = evaluateExecutorQualityGate(intent, { eventLogPath })
    appendExecutorQualityGateEvent({
      eventLogPath,
      intent,
      qualityGate,
      repository,
    })
    if (!qualityGate.ok) {
      throw new Error(executorQualityGateFailure(qualityGate))
    }
    tryAppendAgentRunnerEvent({
      eventLogPath,
      event: {
        type: "dispatch-intent.started",
        command: ["pnpm", ...commandArgs],
        intent: intentEventDetails(intent),
        issue: issueEventDetails(intent.plan),
        repository,
      },
    })
    status = runDispatchIntentCommandImpl(intent) ?? 1
    terminalStatus = status === 0 ? "completed" : "failed"
    terminalReason = status === 0 ? "command completed" : `command exited with status ${status}`
  } catch (error) {
    terminalStatus = "failed"
    terminalReason = error instanceof Error ? error.message : String(error)
    console.error(`dispatch intent failed before completion: ${terminalReason}`)
  }

  let finishResult
  try {
    finishResult = await finishDispatchIntent({
      id: intent.id,
      request: {
        exitCode: status,
        holder,
        reason: terminalReason,
        status: terminalStatus,
      },
      token: config.token,
      url: config.url,
    })
  } catch (error) {
    appendDispatchIntentFinishFailureEvent({
      error: error instanceof Error ? error.message : String(error),
      eventLogPath,
      intent,
      repository,
      status,
      terminalStatus,
    })
    throw error
  }
  appendDispatchIntentFinishedEvent({
    eventLogPath,
    finishResult,
    intent,
    repository,
    status,
    terminalStatus,
  })

  return {
    finish: finishResult,
    lease: requestLatestDispatchIntentResult,
    status,
    terminalStatus,
  }
}

function appendExecutorQualityGateEvent({ eventLogPath, intent, qualityGate, repository }) {
  if (!eventLogPath) return

  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: qualityGate.ok
        ? "dispatch-intent.quality_gate_passed"
        : "dispatch-intent.quality_gate_failed",
      intent: intentEventDetails(intent),
      issue: issueEventDetails(intent.plan),
      repository,
      reasons: qualityGate.reasons,
      warnings: qualityGate.warnings,
    },
  })
}

function appendDispatchIntentFinishFailureEvent({
  error,
  eventLogPath,
  intent,
  repository,
  status,
  terminalStatus,
}) {
  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "dispatch-intent.finish_failed",
      error,
      intent: intentEventDetails(intent),
      issue: issueEventDetails(intent.plan),
      repository,
      status,
      terminalStatus,
    },
  })
}

function appendDispatchIntentFinishedEvent({
  eventLogPath,
  finishResult,
  intent,
  repository,
  status,
  terminalStatus,
}) {
  if (!eventLogPath) return

  tryAppendAgentRunnerEvent({
    eventLogPath,
    event: {
      type: "dispatch-intent.finished",
      intent: intentEventDetails(finishResult.intent),
      issue: issueEventDetails(intent.plan),
      repository,
      status,
      terminalStatus,
    },
  })
}

function printIntent({ commandArgs, controlPlaneUrl, intent, log }) {
  log("agent-runner dispatch intent")
  log(`control plane: ${controlPlaneUrl}`)
  log(`intent: ${intent.id}`)
  log(`holder: ${intent.lease.holder}`)
  log(`issue: #${intent.plan.issue.number} ${intent.plan.issue.title}`)
  log(`action: ${intent.plan.action}`)
  log(`command: pnpm ${commandArgs.join(" ")}`)
}

function intentEventDetails(intent) {
  return {
    action: intent.plan.action,
    holder: intent.lease.holder,
    id: intent.id,
    status: intent.status,
  }
}
