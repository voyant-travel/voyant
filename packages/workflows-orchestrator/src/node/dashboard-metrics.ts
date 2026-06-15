import type { MetricsSnapshot } from "./dashboard-types.js"

export function renderMetrics(snapshot: MetricsSnapshot): string {
  const lines = [
    "# HELP voyant_selfhost_up Self-host server availability.",
    "# TYPE voyant_selfhost_up gauge",
    "voyant_selfhost_up 1",
    "# HELP voyant_selfhost_workflows_registered Registered workflow count.",
    "# TYPE voyant_selfhost_workflows_registered gauge",
    `voyant_selfhost_workflows_registered ${snapshot.workflowsRegistered}`,
    "# HELP voyant_selfhost_schedules_registered Registered schedule count.",
    "# TYPE voyant_selfhost_schedules_registered gauge",
    `voyant_selfhost_schedules_registered ${snapshot.schedulesRegistered}`,
    "# HELP voyant_selfhost_runs_total Persisted run count.",
    "# TYPE voyant_selfhost_runs_total gauge",
    `voyant_selfhost_runs_total ${snapshot.runsTotal}`,
    "# HELP voyant_selfhost_runs_status Run count by status.",
    "# TYPE voyant_selfhost_runs_status gauge",
  ]
  for (const [status, count] of Object.entries(snapshot.runsByStatus).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`voyant_selfhost_runs_status{status="${escapeMetricLabelValue(status)}"} ${count}`)
  }
  lines.push(
    "# HELP voyant_selfhost_wakeups_total Persisted wakeup count.",
    "# TYPE voyant_selfhost_wakeups_total gauge",
    `voyant_selfhost_wakeups_total ${snapshot.wakeupsTotal}`,
    "# HELP voyant_selfhost_metrics_generated_at_seconds Metrics generation timestamp.",
    "# TYPE voyant_selfhost_metrics_generated_at_seconds gauge",
    `voyant_selfhost_metrics_generated_at_seconds ${Math.floor(snapshot.generatedAtMs / 1000)}`,
    "",
  )
  return lines.join("\n")
}

function escapeMetricLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
}
