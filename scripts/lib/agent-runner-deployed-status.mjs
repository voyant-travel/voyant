import {
  controlPlaneConfigFromArgs,
  requestControlPlaneCapabilities,
} from "./agent-runner-control-plane.mjs"
import {
  requestRunnerAppCapabilities,
  requestRunnerAppSupervisorStatus,
  runnerAppConfigFromArgs,
  summarizeControlPlaneCapabilities,
  summarizeRunnerAppCapabilities,
  summarizeRunnerSupervisorStatus,
} from "./agent-runner-deployment-doctor.mjs"

export async function buildDeployedStatusReport({
  args = {},
  env = process.env,
  fetchImpl = fetch,
  limit = 5,
  repository,
}) {
  const report = {
    checks: [],
    controlPlane: null,
    limit,
    ok: false,
    repository,
    runner: null,
  }

  await readControlPlaneStatus({ args, env, fetchImpl, report })
  await readRunnerStatus({ args, env, fetchImpl, limit, repository, report })

  report.ok = report.checks.every((check) => check.ok)
  return report
}

export function latestRunnerSupervisorTick(status) {
  const latest = status?.supervisorTicks?.latest
  if (!latest) return null

  return summarizeRunnerTick(latest)
}

export function recentRunnerSupervisorTicks(status) {
  const recent = status?.supervisorTicks?.recent
  if (!Array.isArray(recent)) return []

  return recent.map(summarizeRunnerTick)
}

async function readControlPlaneStatus({ args, env, fetchImpl, report }) {
  let config
  try {
    config = controlPlaneConfigFromArgs(args, env)
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "control plane configuration",
      ok: false,
    })
    return
  }

  report.controlPlane = {
    endpoint: config.url,
  }
  report.checks.push({
    detail: `Using ${config.url}; token configured.`,
    name: "control plane configuration",
    ok: true,
  })

  try {
    const capabilities = await requestControlPlaneCapabilities({
      fetchImpl,
      token: config.token,
      url: config.url,
    })
    report.controlPlane.capabilities = capabilities
    report.checks.push({
      name: "control plane capabilities",
      ...summarizeControlPlaneCapabilities(capabilities),
    })
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "control plane capabilities",
      ok: false,
    })
  }
}

async function readRunnerStatus({ args, env, fetchImpl, limit, repository, report }) {
  let config
  try {
    config = runnerAppConfigFromArgs(args, env)
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "runner app configuration",
      ok: false,
    })
    return
  }

  report.runner = {
    endpoint: config.url,
  }
  report.checks.push({
    detail: `Using ${config.url}; token configured.`,
    name: "runner app configuration",
    ok: true,
  })

  try {
    const capabilities = await requestRunnerAppCapabilities({
      fetchImpl,
      token: config.token,
      url: config.url,
    })
    report.runner.capabilities = capabilities
    report.checks.push({
      name: "runner app capabilities",
      ...summarizeRunnerAppCapabilities(capabilities),
    })
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "runner app capabilities",
      ok: false,
    })
  }

  try {
    const supervisorStatus = await requestRunnerAppSupervisorStatus({
      fetchImpl,
      limit,
      repository,
      token: config.token,
      url: config.url,
    })
    report.runner.supervisorStatus = supervisorStatus
    report.checks.push({
      name: "runner app supervisor status",
      ...summarizeRunnerSupervisorStatus(supervisorStatus),
    })
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "runner app supervisor status",
      ok: false,
    })
  }
}

function summarizeRunnerTick(record) {
  const result = record.result ?? {}
  const intent = result.intent ?? result.activeIntent

  return {
    id: record.id ?? null,
    intentId: intent?.id ?? null,
    leased: result.leased ?? null,
    reason: result.reason ?? null,
    recordedAt: record.recordedAt ?? null,
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
