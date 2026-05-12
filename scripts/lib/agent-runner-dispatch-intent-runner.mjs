import { dispatchIntentCommandArgs, runDispatchIntentCommand } from "./agent-runner-dispatch.mjs"
import { issueEventDetails, tryAppendAgentRunnerEvent } from "./agent-runner-events.mjs"

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

  return {
    finish: finishResult,
    lease: requestLatestDispatchIntentResult,
    status,
    terminalStatus,
  }
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
