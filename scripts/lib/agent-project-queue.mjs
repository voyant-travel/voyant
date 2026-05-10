import { spawnSync } from "node:child_process"
import path from "node:path"

const knownTypes = new Set(["task", "bug", "refactor", "investigation", "cleanup"])
const booleanArgs = new Set(["force", "json", "yes"])

export function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--") continue

    const booleanKey = arg.startsWith("--") ? arg.slice(2) : undefined
    if (booleanArgs.has(booleanKey)) {
      parsed[booleanKey] = true
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

export function projectConfigFromArgs(args) {
  const owner = args.owner ?? process.env.VOYANT_ENGINEERING_PROJECT_OWNER ?? "voyantjs"
  const projectNumber = Number(
    args.project ??
      args.projectNumber ??
      projectNumberFromUrl(process.env.VOYANT_ENGINEERING_PROJECT_URL) ??
      1,
  )
  const limit = Number(args.limit ?? 50)

  if (!Number.isInteger(projectNumber) || projectNumber < 1) {
    fail(`invalid project number: ${String(args.project ?? args.projectNumber)}`)
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    fail(`invalid limit: ${String(args.limit)}; expected 1..100`)
  }

  return { owner, projectNumber, limit }
}

export function projectNumberFromUrl(projectUrl) {
  if (!projectUrl) return undefined
  const match = projectUrl.match(/\/projects\/(\d+)(?:$|[/?#])/)
  return match?.[1]
}

export function loadEvaluatedProject({ owner, projectNumber, limit }) {
  const project = readProjectItems({ owner, projectNumber, limit })
  const items = project.items.map(evaluateItem)

  return evaluatedProject({ items, owner, project, projectNumber })
}

export function loadAllEvaluatedProject({ owner, projectNumber, limit }) {
  const pageSize = limit ?? 100
  const pages = []
  let after

  do {
    const page = readProjectItems({ after, limit: pageSize, owner, projectNumber })
    pages.push(page)
    after = page.pageInfo.endCursor
    if (page.pageInfo.hasNextPage && !after) {
      fail("Project item pagination returned no cursor")
    }
  } while (pages.at(-1).pageInfo.hasNextPage)

  const project = pages[0]
  const items = pages.flatMap((page) => page.items).map(evaluateItem)
  return evaluatedProject({ items, owner, project, projectNumber })
}

function evaluatedProject({ items, owner, project, projectNumber }) {
  return {
    owner,
    projectNumber,
    projectId: project.id,
    projectTitle: project.title,
    projectUrl: `https://github.com/orgs/${owner}/projects/${projectNumber}`,
    fieldDefinitions: project.fields,
    items,
    readyItems: items.filter((item) => item.ready),
  }
}

export function readProjectItems({ after, owner, projectNumber, limit }) {
  const query = `
    query($owner: String!, $number: Int!, $limit: Int!, $after: String) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          title
          fields(first: 50) {
            nodes {
              ... on ProjectV2FieldCommon {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
          items(first: $limit, after: $after) {
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
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  `

  const ghArgs = [
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
  ]
  if (after) {
    ghArgs.push("-f", `after=${after}`)
  }

  const result = spawnSync("gh", ghArgs, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  })

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
    id: project.id,
    title: project.title,
    fields: normalizeProjectFields(project.fields?.nodes ?? []),
    items: project.items?.nodes ?? [],
    pageInfo: project.items?.pageInfo ?? { endCursor: null, hasNextPage: false },
  }
}

export function evaluateItem(item) {
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

export function findSelectedReadyItem(items, { issueNumber, repository } = {}) {
  if (issueNumber) {
    const selected = findProjectIssueItem(items, { issueNumber, repository })
    if (!selected.ready) {
      fail(`issue #${issueNumber} is not executable: ${selected.reasons.join("; ")}`)
    }
    return selected
  }

  const scopedItems = filterItemsByRepository(items, repository)
  const readyItems = scopedItems.filter((item) => item.ready)
  if (readyItems.length === 0) {
    fail(
      repository
        ? `no executable project items found for repository ${repository}`
        : "no executable project items found",
    )
  }
  if (readyItems.length > 1) {
    fail(`multiple executable items found; pass --issue <number>`)
  }
  return readyItems[0]
}

export function findProjectIssueItem(items, { issueNumber, repository } = {}) {
  const normalizedIssueNumber = Number(issueNumber)
  if (!Number.isInteger(normalizedIssueNumber) || normalizedIssueNumber < 1) {
    fail(`invalid issue number: ${String(issueNumber)}`)
  }

  const selected = filterItemsByRepository(items, repository).find(
    (item) => item.issue?.number === normalizedIssueNumber,
  )
  if (!selected) {
    fail(
      repository
        ? `issue #${issueNumber} was not found for repository ${repository}`
        : `issue #${issueNumber} was not found in the project item list`,
    )
  }
  return selected
}

export function projectSummaryJson(project) {
  return {
    project: {
      owner: project.owner,
      number: project.projectNumber,
      title: project.projectTitle,
      url: project.projectUrl,
    },
    readyCount: project.readyItems.length,
    totalCount: project.items.length,
    items: project.items,
  }
}

export function printHumanSummary(project) {
  console.log(
    `agent-runner dry run: ${project.projectTitle} (${project.owner}/projects/${project.projectNumber})`,
  )
  console.log(`items scanned: ${project.items.length}`)
  console.log(`ready items: ${project.readyItems.length}`)
  console.log("")

  if (project.readyItems.length > 0) {
    console.log("Ready items:")
    for (const item of project.readyItems) {
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

  const blockedItems = project.items.filter((item) => !item.ready)
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

export function runGit(gitArgs, options = {}) {
  const result = spawnSync("git", gitArgs, {
    encoding: "utf8",
    ...options,
  })

  if (result.error) {
    fail(`failed to run git ${gitArgs.join(" ")}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim()
    fail(stderr || `git ${gitArgs.join(" ")} exited with ${result.status}`)
  }

  return result.stdout.trim()
}

export function currentRepositoryFromOrigin(repoRoot) {
  const remoteUrl = runGit(["remote", "get-url", "origin"], { cwd: repoRoot })
  const repository = repositoryFromGitHubRemote(remoteUrl)
  if (!repository) {
    fail("could not determine repository from origin remote; pass --repo <owner/name>")
  }
  return repository
}

export function fail(message) {
  console.error(`agent-runner: ${message}`)
  process.exit(1)
}

function normalizeProjectFields(fields) {
  return fields
    .filter((field) => field.id && field.name)
    .map((field) => ({
      id: field.id,
      name: field.name,
      dataType: field.dataType,
      options: field.options ?? [],
    }))
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

function repositoriesMatch(left, right) {
  return normalizeRepository(left) === normalizeRepository(right)
}

function filterItemsByRepository(items, repository) {
  return repository
    ? items.filter((item) => repositoriesMatch(item.issue?.repository, repository))
    : items
}

function normalizeRepository(repository) {
  return repository?.trim().toLowerCase()
}

function repositoryFromGitHubRemote(remoteUrl) {
  const normalized = remoteUrl.trim().replace(/\.git$/, "")
  return normalized.match(/github\.com[:/]([^/]+\/[^/]+)$/)?.[1]
}
