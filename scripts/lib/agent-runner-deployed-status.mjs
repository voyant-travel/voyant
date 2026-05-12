import {
  controlPlaneConfigFromArgs,
  requestActiveDispatchIntent,
  requestControlPlaneCapabilities,
  requestLatestDispatchPlan,
  requestRecentTickSnapshots,
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
  activeDispatchRequest,
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

  await readRunnerStatus({ args, env, fetchImpl, limit, repository, report })
  await readControlPlaneStatus({
    activeDispatchRequest,
    args,
    dispatchPlanRequest: dispatchPlanRequestForDeployedRunner({
      repository,
      runnerCapabilities: report.runner?.capabilities,
    }),
    env,
    fetchImpl,
    limit,
    repository,
    report,
  })

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

export function latestControlPlaneTickSnapshot(snapshotHistory) {
  const latest = snapshotHistory?.records?.[0]
  if (!latest) return null

  return summarizeTickSnapshot(latest)
}

export function recentControlPlaneTickSnapshots(snapshotHistory) {
  const recent = snapshotHistory?.records
  if (!Array.isArray(recent)) return []

  return recent.map(summarizeTickSnapshot)
}

export function summarizeActiveDispatchIntent(result) {
  const intent = result?.intent
  if (!intent) {
    return {
      active: false,
      found: false,
    }
  }

  return {
    action: intent.plan?.action ?? null,
    active: Boolean(result.active),
    expiresAt: intent.lease?.expiresAt ?? null,
    found: true,
    holder: intent.lease?.holder ?? null,
    intentId: intent.id ?? null,
    issueNumber: intent.plan?.issue?.number ?? null,
    status: intent.status ?? null,
  }
}

export function summarizeDispatchPlan(result) {
  const plan = result?.plan
  if (!plan) {
    return {
      found: false,
      reason: result?.reason ?? null,
      snapshotAcceptedAt: result?.source?.acceptedAt ?? null,
    }
  }

  return {
    action: plan.action ?? null,
    command: Array.isArray(plan.command) ? plan.command.join(" ") : null,
    found: true,
    issueNumber: plan.issue?.number ?? null,
    issueTitle: plan.issue?.title ?? null,
    reason: plan.reason ?? null,
    snapshotAcceptedAt: result?.source?.acceptedAt ?? null,
  }
}

export function dispatchPlanRequestForDeployedRunner({ repository, runnerCapabilities }) {
  const action = runnerCapabilities?.defaults?.action

  return {
    repository,
    ...(action
      ? {
          filters: {
            action,
          },
        }
      : {}),
  }
}

async function readControlPlaneStatus({
  activeDispatchRequest,
  args,
  dispatchPlanRequest,
  env,
  fetchImpl,
  limit,
  repository,
  report,
}) {
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

  try {
    const recentTickSnapshots = await requestRecentTickSnapshots({
      fetchImpl,
      limit,
      repository,
      token: config.token,
      url: config.url,
    })
    report.controlPlane.recentTickSnapshots = recentTickSnapshots
    const latest = latestControlPlaneTickSnapshot(recentTickSnapshots)
    report.checks.push({
      detail: latest
        ? `latest accepted: ${latest.acceptedAt}; recommendations: ${String(latest.recommendationCount)}; dispatchable: ${String(latest.dispatchableRecommendationCount)}`
        : "no persisted queue snapshots found",
      name: "control plane queue snapshots",
      ok: true,
    })
  } catch (error) {
    report.checks.push({
      detail: errorMessage(error),
      name: "control plane queue snapshots",
      ok: false,
    })
  }

  try {
    const dispatchPlan = await requestLatestDispatchPlan({
      fetchImpl,
      request: dispatchPlanRequest,
      token: config.token,
      url: config.url,
    })
    report.controlPlane.dispatchPlan = dispatchPlan
    const summary = summarizeDispatchPlan(dispatchPlan)
    const actionFilter = dispatchPlanRequest?.filters?.action
    report.checks.push({
      detail: summary.found
        ? `next: #${summary.issueNumber} ${summary.action}; reason: ${summary.reason ?? "unknown"}${actionFilter ? `; filter: ${actionFilter}` : ""}`
        : `plan: none (${summary.reason ?? "unknown"})${actionFilter ? `; filter: ${actionFilter}` : ""}`,
      name: "control plane dispatch plan",
      ok: true,
    })
  } catch (error) {
    const snapshotMissing =
      error?.status === 404 && error?.body?.error === "tick_snapshot_not_found"
    if (snapshotMissing) {
      report.controlPlane.dispatchPlan = {
        plan: null,
        reason: "tick_snapshot_not_found",
      }
      report.checks.push({
        detail: "plan: none (tick_snapshot_not_found)",
        name: "control plane dispatch plan",
        ok: true,
      })
    } else {
      report.checks.push({
        detail: errorMessage(error),
        name: "control plane dispatch plan",
        ok: false,
      })
    }
  }

  if (!activeDispatchRequest) return

  try {
    const activeDispatch = await requestActiveDispatchIntent({
      fetchImpl,
      request: activeDispatchRequest,
      token: config.token,
      url: config.url,
    })
    report.controlPlane.activeDispatch = activeDispatch
    const summary = summarizeActiveDispatchIntent(activeDispatch)
    report.checks.push({
      detail: `intent: ${summary.intentId}; status: ${summary.status}; active: ${String(summary.active)}; holder: ${summary.holder ?? "unknown"}`,
      name: "control plane active dispatch",
      ok: true,
    })
  } catch (error) {
    if (error?.status === 404) {
      report.controlPlane.activeDispatch = {
        active: false,
        intent: null,
      }
      report.checks.push({
        detail: `no active dispatch intent for #${activeDispatchRequest.issueNumber} ${activeDispatchRequest.action}`,
        name: "control plane active dispatch",
        ok: true,
      })
      return
    }

    report.checks.push({
      detail: errorMessage(error),
      name: "control plane active dispatch",
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

function summarizeTickSnapshot(record) {
  return {
    acceptedAt: record.acceptedAt ?? null,
    dispatchableRecommendationCount: record.summary?.dispatchableRecommendationCount ?? null,
    firstDispatchableAction: record.summary?.firstDispatchableAction ?? null,
    firstDispatchableIssueNumber: record.summary?.firstDispatchableIssueNumber ?? null,
    recommendationCount: record.summary?.recommendationCount ?? null,
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
