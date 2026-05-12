export function workItem({
  fields = {},
  issueState = "OPEN",
  number = 579,
  title = "Test agent project intake workflow",
} = {}) {
  return {
    itemId: `item-${number}`,
    issue: {
      number,
      title,
      url: `https://github.com/voyantjs/voyant/issues/${number}`,
      state: issueState,
      repository: "voyantjs/voyant",
      labels: ["agent:ready"],
      hasAgentBrief: true,
      agentBrief: "Current behavior, desired behavior, acceptance criteria, and verification lane.",
    },
    fields,
    ready: fields["Agent State"] ? fields["Agent State"] === "Ready" : true,
    reasons: [],
    dryRunPlan: {
      branch: "task/579-test-agent-project-intake-workflow",
      workspace: ".agent-worktrees/579-test-agent-project-intake-workflow",
      planPath: "docs/agent-plans/active/579-test-agent-project-intake-workflow.md",
      verificationLane: "verify:fast",
      risk: "Low",
      securityRisk: "None",
      agentProvider: "manual",
    },
  }
}
