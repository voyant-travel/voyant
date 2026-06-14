export const projectOptions = [
  ["--owner <org>", "GitHub organization that owns the Project. Defaults to voyant-travel."],
  [
    "--project <number>",
    "GitHub Project number. Defaults from VOYANT_ENGINEERING_PROJECT_URL or 1.",
  ],
  ["--project-number <number>", "Alias for --project."],
  ["--limit <number>", "Project item page size, 1..100. Defaults to the command's page size."],
]

export const repositoryOptions = [
  ["--repo <owner/name>", "Repository scope. Defaults to the current origin remote."],
]

export const mutationOptions = [
  ["--yes", "Apply the mutation. Without this, the command prints the planned change."],
]

export const eventLogOptions = [
  ["--event-log <path>", "JSONL audit log path. Defaults to .agent-runs/events.jsonl."],
]

export function maybePrintHelp(args, help) {
  if (!args.help) return
  printCommandHelp(help)
  process.exit(0)
}

function printCommandHelp({ command, summary, usage, options = [] }) {
  console.log(command)
  console.log("")
  console.log(summary)
  console.log("")
  console.log("Usage:")
  console.log(`  ${usage}`)

  if (options.length > 0) {
    const width = Math.max(...options.map(([flag]) => flag.length))
    console.log("")
    console.log("Options:")
    for (const [flag, description] of options) {
      console.log(`  ${flag.padEnd(width)}  ${description}`)
    }
  }
}
