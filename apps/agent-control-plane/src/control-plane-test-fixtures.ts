export const recommendations = [
  {
    action: "run-command",
    reason: "implementation execution remains explicit",
    issue: {
      number: 581,
      title: "Run implementation command",
      url: "https://github.com/voyantjs/voyant/issues/581",
      repository: "voyantjs/voyant",
    },
  },
  {
    action: "start",
    reason: "maintainer-approved item is ready to claim",
    issue: {
      number: 579,
      title: "Test agent project intake workflow",
      url: "https://github.com/voyantjs/voyant/issues/579",
      repository: "voyantjs/voyant",
    },
  },
]

export const tickSnapshot = {
  project: {
    owner: "voyantjs",
    number: 1,
    title: "Voyant Engineering",
    url: "https://github.com/orgs/voyantjs/projects/1",
  },
  repository: "voyantjs/voyant",
  maxAgeDays: 1,
  eventLog: {
    path: "/repo/.agent-runs/events.jsonl",
    recentEvents: [
      {
        timestamp: "2026-05-12T05:00:00.000Z",
        type: "dispatch.completed",
        issue: { number: 579 },
      },
    ],
  },
  recommendations: [
    {
      action: "remote-bootstrap",
      command: "pnpm agent:queue:remote-bootstrap -- --issue 579 --repo voyantjs/voyant --yes",
      issue: {
        number: 579,
        title: "Test agent project intake workflow",
        url: "https://github.com/voyantjs/voyant/issues/579",
        repository: "voyantjs/voyant",
        agentBrief: "Acceptance criteria and verification lane.",
        hasAgentBrief: true,
        labels: ["agent:ready", "ui"],
        state: "OPEN",
      },
      priority: 20,
      reason: "remote workspace is ready for repository bootstrap",
      state: "Ready",
    },
    {
      action: "remote-run-command",
      command:
        'pnpm agent:queue:remote-run-command -- --issue 580 --repo voyantjs/voyant --command "<implementation-command>" --yes',
      issue: {
        number: 580,
        title: "Run implementation",
        url: "https://github.com/voyantjs/voyant/issues/580",
        repository: "voyantjs/voyant",
      },
      priority: 30,
      reason: "implementation execution remains explicit",
      state: "Planning",
    },
  ],
}
