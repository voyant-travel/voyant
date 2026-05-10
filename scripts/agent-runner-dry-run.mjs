import { spawnSync } from "node:child_process"
import path from "node:path"

const args = parseArgs(process.argv.slice(2))
const owner = args.owner ?? process.env.VOYANT_ENGINEERING_PROJECT_OWNER ?? "voyantjs"
const knownTypes = new Set(["task", "bug", "refactor", "investigation", "cleanup"])
const projectNumber = Number(
  args.project ??
    args.projectNumber ??
    projectNumberFromUrl(process.env.VOYANT_ENGINEERING_PROJECT_URL) ??
    1,
)
const limit = Number(args.limit ?? 50)
const jsonOutput = Boolean(args.json)

if (!Number.isInteger(projectNumber) || projectNumber < 1) {
  fail(`invalid project number: ${String(args.project ?? args.projectNumber)}`)
}

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  fail(`invalid limit: ${String(args.limit)}; expected 1..100`)
}

const project = readProjectItems({ owner, projectNumber, limit })
const evaluatedItems = project.items.map(evaluateItem)
const readyItems = evaluatedItems.filter((item) => item.ready)

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        project: {
          owner,
          number: projectNumber,
          title: project.title,
          url: `https://github.com/orgs/${owner}/projects/${projectNumber}`,
        },
        readyCount: readyItems.length,
        totalCount: evaluatedItems.length,
        items: evaluatedItems,
      },
      null,
      2,
    ),
  )
} else {
  printHumanSummary({
    owner,
    projectNumber,
    projectTitle: project.title,
    items: evaluatedItems,
    readyItems,
  })
}

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--") continue

    if (arg === "--json") {
      parsed.json = true
      continue
    }

    if (!arg.startsWith("--")) {
      fail(`unexpected positional argument: ${arg}`)
    }

    const [rawKey, rawValue] = arg.slice(2).split("=", 2)
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    const value = rawValue ?? argv[index + 1]
    if (!value || value.startsWith("--")) {
      fail(`missing value for --${rawKey}`)
    }
    parsed[key] = value
    if (rawValue === undefined) index += 1
  }
  return parsed
}

function projectNumberFromUrl(projectUrl) {
  if (!projectUrl) return undefined
  const match = projectUrl.match(/\/projects\/(\d+)(?:$|[/?#])/)
  return match?.[1]
}

function readProjectItems({ owner, projectNumber, limit }) {
  const query = `
    query($owner: String!, $number: Int!, $limit: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          title
          items(first: $limit) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                  url
                  state
                  repository {
                    nameWithOwner
                  }
                  labels(first: 50) {
                    nodes {
                      name
                    }
                  }
                }
                ... on PullRequest {
                  number
                  title
                  url
                  state
                  repository {
                    nameWithOwner
                  }
                  labels(first: 50) {
                    nodes {
                      name
                    }
                  }
                }
              }
              fieldValues(first: 50) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  const result = spawnSync(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `owner=${owner}`,
      "-F",
      `number=${projectNumber}`,
      "-F",
      `limit=${limit}`,
      "-f",
      `query=${query}`,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    },
  )

  if (result.error) {
    fail(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    fail(stderr || `gh api graphql exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    fail(`failed to parse gh JSON output: ${error.message}`)
  }

  if (payload.errors?.length) {
    fail(payload.errors.map((error) => error.message).join("; "))
  }

  const project = payload.data?.organization?.projectV2
  if (!project) {
    fail(`project ${owner}/${projectNumber} was not found or is not visible to gh`)
  }

  return {
    title: project.title,
    items: project.items?.nodes ?? [],
  }
}

function evaluateItem(item) {
  const content = item.content
  const fields = fieldMap(item.fieldValues?.nodes ?? [])
  const labels = content?.labels?.nodes?.map((label) => label.name) ?? []
  const issueNumber = content?.number
  const title = content?.title ?? fields.Title ?? "Untitled item"
  const slug = slugify(title)
  const type = workType(title, labels)
  const branch = issueNumber ? `${type}/${issueNumber}-${slug}` : `${type}/project-item-${item.id}`
  const planPath = issueNumber
    ? path.posix.join("docs/agent-plans/active", `${issueNumber}-${slug}.md`)
    : path.posix.join("docs/agent-plans/active", `${slug}.md`)
  const workspace = issueNumber
    ? path.posix.join(".agent-worktrees", `${issueNumber}-${slug}`)
    : path.posix.join(".agent-worktrees", slug)

  const reasons = []
  if (!content) reasons.push("project item has no issue or pull request content")
  if (content?.state !== "OPEN") reasons.push(`issue state is ${content?.state ?? "unknown"}`)
  if (!labels.includes("agent:ready")) reasons.push("missing label agent:ready")
  if (fields["Agent State"] !== "Ready") {
    reasons.push(`Agent State is ${quoteField(fields["Agent State"])}`)
  }
  if (fields["Maintainer Approved"] !== "Yes") {
    reasons.push(`Maintainer Approved is ${quoteField(fields["Maintainer Approved"])}`)
  }

  return {
    itemId: item.id,
    ready: reasons.length === 0,
    reasons,
    issue: content
      ? {
          number: issueNumber,
          title,
          url: content.url,
          state: content.state,
          repository: content.repository?.nameWithOwner,
          labels,
        }
      : null,
    fields,
    dryRunPlan: {
      branch,
      workspace,
      planPath,
      verificationLane: fields["Verification Lane"] ?? "verify:fast",
      risk: fields.Risk ?? "Unknown",
      securityRisk: fields["Security Risk"] ?? "None",
      agentProvider: fields["Agent Provider"] ?? "none",
    },
  }
}

function fieldMap(fieldValues) {
  const fields = {}
  for (const value of fieldValues) {
    const fieldName = value.field?.name
    if (!fieldName) continue
    if (typeof value.name === "string") fields[fieldName] = value.name
    if (typeof value.text === "string") fields[fieldName] = value.text
    if (typeof value.date === "string") fields[fieldName] = value.date
  }
  return fields
}

function workType(title, labels) {
  const titlePrefix = title.match(/^\[(Task|Bug|Refactor|Investigation|Cleanup)\]/i)?.[1]
  const normalized = (
    titlePrefix ??
    labels.find((label) => knownTypes.has(label.toLowerCase())) ??
    "task"
  )
    .toLowerCase()
    .replace("investigation", "investigate")
  return normalized
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/^\[(task|bug|refactor|investigation|cleanup)\]\s*:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  return slug || "agent-task"
}

function quoteField(value) {
  return value ? `"${value}"` : "unset"
}

function printHumanSummary({ owner, projectNumber, projectTitle, items, readyItems }) {
  console.log(`agent-runner dry run: ${projectTitle} (${owner}/projects/${projectNumber})`)
  console.log(`items scanned: ${items.length}`)
  console.log(`ready items: ${readyItems.length}`)
  console.log("")

  if (readyItems.length > 0) {
    console.log("Ready items:")
    for (const item of readyItems) {
      const issue = item.issue
      console.log(`- #${issue.number} ${issue.title}`)
      console.log(`  url: ${issue.url}`)
      console.log(`  branch: ${item.dryRunPlan.branch}`)
      console.log(`  workspace: ${item.dryRunPlan.workspace}`)
      console.log(`  plan: ${item.dryRunPlan.planPath}`)
      console.log(`  verification: ${item.dryRunPlan.verificationLane}`)
      console.log("")
    }
  }

  const blockedItems = items.filter((item) => !item.ready)
  if (blockedItems.length > 0) {
    console.log("Blocked or ignored items:")
    for (const item of blockedItems) {
      const title = item.issue ? `#${item.issue.number} ${item.issue.title}` : item.itemId
      console.log(`- ${title}`)
      for (const reason of item.reasons) {
        console.log(`  - ${reason}`)
      }
    }
  }
}

function fail(message) {
  console.error(`agent-runner dry run: ${message}`)
  process.exit(1)
}
