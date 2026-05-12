import { currentRepositoryFromOrigin, fail, parseArgs, runGit } from "./lib/agent-project-queue.mjs"
import { buildCiRepairDrillReport } from "./lib/agent-runner-ci-repair-drill.mjs"
import { maybePrintHelp, repositoryOptions } from "./lib/agent-runner-help.mjs"

const args = parseArgs(process.argv.slice(2))
maybePrintHelp(args, {
  command: "agent:queue:ci-repair-drill",
  summary: "Run a local, non-mutating drill of the PR CI repair state machine.",
  usage: "pnpm agent:queue:ci-repair-drill -- [--json] [--repo <owner/name>]",
  options: [["--json", "Print machine-readable JSON."], ...repositoryOptions],
})

try {
  const repoRoot = runGit(["rev-parse", "--show-toplevel"])
  const repository = args.repo ?? currentRepositoryFromOrigin(repoRoot)
  const report = buildCiRepairDrillReport({ repoRoot, repository })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHumanReport(report)
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function printHumanReport(report) {
  console.log("agent-runner CI repair drill")
  console.log(`repository: ${report.repository}`)
  console.log("")

  for (const step of report.steps) {
    console.log(step.name)
    if (step.result) {
      console.log(`  agent state: ${step.result.agentState}`)
      console.log(`  reason: ${step.result.reason}`)
    }
    if (step.recommendation) {
      console.log(`  recommendation: ${step.recommendation}`)
      console.log(`  reason: ${step.reason}`)
    }
    for (const [fieldName, value] of Object.entries(step.values)) {
      console.log(`  ${fieldName}: ${value}`)
    }
  }

  console.log("")
  console.log(`repair packet: ${report.ciRepairEvidence.pointer}`)
  console.log(
    `command env: ${report.commandEnvironment.ciRepairEvidenceReference ?? "no repair packet"}`,
  )
}
