import {
  buildCiRepairEvidencePacket,
  ciRepairArtifactPlan,
  failingCheckDetails,
} from "./agent-runner-ci.mjs"
import {
  commandRunArtifactPlan,
  commandRunEnvironment,
  commandRunFieldUpdate,
} from "./agent-runner-execution.mjs"
import { evaluatePullRequestGate, pullRequestSyncFieldValues } from "./agent-runner-pr.mjs"
import { recommendQueueAction } from "./agent-runner-tick.mjs"

export function buildCiRepairDrillReport({
  date = new Date(),
  repository,
  repoRoot,
  item = drillWorkItem({ repository }),
}) {
  const failingPr = drillPullRequest({
    conclusion: "FAILURE",
    detailsUrl: `https://github.com/${repository}/actions/runs/123/job/456`,
    repository,
  })
  const failedSync = syncFieldsForPr({ date, pr: failingPr })
  const failedSyncItem = withFields(item, {
    ...item.fields,
    ...failedSync.values,
    PR: failingPr.url,
  })
  const collectRecommendation = recommendQueueAction(failedSyncItem, { maxAgeDays: 1, repository })
  const checks = failingCheckDetails(failingPr)
  const ciArtifactPlan = ciRepairArtifactPlan({ date, item, repoRoot })
  const ciRepairFields = {
    "Agent State": "CI Repair",
    "Blocked By": `Failing checks: ${checks.map((check) => check.name).join(", ")}`,
    Evidence: ciArtifactPlan.evidencePointer,
    "Last Heartbeat": date.toISOString().slice(0, 10),
  }
  const ciRepairItem = withFields(item, {
    ...item.fields,
    ...ciRepairFields,
    PR: failingPr.url,
  })
  const repairRecommendation = recommendQueueAction(ciRepairItem, { maxAgeDays: 1, repository })
  const commandArtifactPlan = commandRunArtifactPlan({
    date,
    item: ciRepairItem,
    repoRoot,
    workspaceReference: ciRepairItem.fields.Workspace ?? ciRepairItem.dryRunPlan.workspace,
  })
  const commandEnvironment = commandRunEnvironment({
    artifactPlan: commandArtifactPlan,
    branch: ciRepairItem.fields.Branch ?? ciRepairItem.dryRunPlan.branch,
    item: ciRepairItem,
    repository,
  })
  const commandResult = commandRunFieldUpdate({
    date,
    evidencePointer: commandArtifactPlan.evidencePointer,
    exitCode: 0,
  })
  const greenPr = drillPullRequest({
    conclusion: "SUCCESS",
    detailsUrl: `https://github.com/${repository}/actions/runs/789/job/101`,
    repository,
  })
  const greenSync = syncFieldsForPr({ date, pr: greenPr })

  return {
    checks,
    ciRepairEvidence: {
      pointer: ciArtifactPlan.evidencePointer,
      preview: buildCiRepairEvidencePacket({
        checks,
        generatedAt: date,
        item,
        logs: [{ output: "Synthetic failing test log for the CI repair drill.", runId: "123" }],
        pr: failingPr,
        repository,
      }),
    },
    commandEnvironment: {
      ciRepairEvidencePath: commandEnvironment.VOYANT_AGENT_CI_REPAIR_EVIDENCE_PATH ?? null,
      ciRepairEvidenceReference:
        commandEnvironment.VOYANT_AGENT_CI_REPAIR_EVIDENCE_REFERENCE ?? null,
      evidencePath: commandEnvironment.VOYANT_AGENT_EVIDENCE_PATH,
      issue: commandEnvironment.VOYANT_AGENT_ISSUE,
      repository: commandEnvironment.VOYANT_AGENT_REPOSITORY,
    },
    repository,
    steps: [
      {
        name: "sync failing PR",
        result: failedSync.result,
        values: failedSync.values,
      },
      {
        name: "recommend CI evidence collection",
        recommendation: collectRecommendation.action,
        reason: collectRecommendation.reason,
        values: failedSync.values,
      },
      {
        name: "collect CI repair packet",
        values: ciRepairFields,
      },
      {
        name: "recommend narrow repair command",
        recommendation: repairRecommendation.action,
        reason: repairRecommendation.reason,
        values: ciRepairFields,
      },
      {
        name: "run narrow repair command",
        values: commandResult.values,
      },
      {
        name: "sync green PR",
        result: greenSync.result,
        values: greenSync.values,
      },
    ],
  }
}

export function drillWorkItem({
  fields = {},
  issueNumber = 579,
  repository = "voyantjs/voyant",
  title = "[Task] Validate CI repair shepherd loop",
} = {}) {
  const slug = "validate-ci-repair-shepherd-loop"
  return {
    dryRunPlan: {
      agentProvider: "manual",
      branch: `task/${issueNumber}-${slug}`,
      planPath: `docs/agent-plans/active/${issueNumber}-${slug}.md`,
      risk: "Low",
      securityRisk: "None",
      verificationLane: "verify:fast",
      workspace: `.agent-worktrees/${issueNumber}-${slug}`,
    },
    fields: {
      "Agent State": "Human Review",
      Branch: `task/${issueNumber}-${slug}`,
      Evidence: `docs/agent-evidence/active/${issueNumber}-${slug}.md`,
      PR: `https://github.com/${repository}/pull/${issueNumber}`,
      Workspace: `.agent-worktrees/${issueNumber}-${slug}`,
      ...fields,
    },
    issue: {
      agentBrief:
        "Validate the CI repair path from failed checks through repair evidence and PR sync.",
      hasAgentBrief: true,
      labels: ["agent:ready"],
      number: issueNumber,
      repository,
      state: "OPEN",
      title,
      url: `https://github.com/${repository}/issues/${issueNumber}`,
    },
    itemId: `item-${issueNumber}`,
    ready: false,
    reasons: [],
  }
}

function syncFieldsForPr({ date, pr }) {
  const result = evaluatePullRequestGate(pr)
  const values = pullRequestSyncFieldValues({ date, pr, result })
  if (result.blockedBy) {
    values["Blocked By"] = result.blockedBy
  }

  return { result, values }
}

function drillPullRequest({ conclusion, detailsUrl, repository }) {
  return {
    isDraft: false,
    number: 579,
    reviewDecision: "",
    reviewThreads: {
      unresolved: [],
      unresolvedCount: 0,
    },
    state: "OPEN",
    statusCheckRollup: [
      {
        conclusion,
        detailsUrl,
        name: "checks",
        status: "COMPLETED",
        workflowName: "CI",
      },
    ],
    title: "Validate CI repair shepherd loop",
    url: `https://github.com/${repository}/pull/579`,
  }
}

function withFields(item, fields) {
  return {
    ...item,
    fields,
  }
}
