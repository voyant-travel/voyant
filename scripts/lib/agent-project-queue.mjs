import { spawnSync } from "node:child_process"
import path from "node:path"

import { extractAgentBrief, hasAgentBrief } from "./agent-brief-parser.mjs"

const knownTypes = new Set(["task", "bug", "refactor", "investigation", "cleanup"])
const booleanArgs = new Set([
  "allow-browser-issues",
  "allow-dirty",
  "force",
  "help",
  "json",
  "publish-artifacts",
  "ready",
  "smoke-tick",
  "update-body",
  "yes",
])

export function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--") continue
    if (arg === "-h") {
      parsed.help = true
      continue
    }

    const booleanKey = arg.startsWith("--") ? arg.slice(2) : undefined
    if (booleanArgs.has(booleanKey)) {
      parsed[camelCaseArg(booleanKey)] = true
      continue
    }

    if (!arg.startsWith("--")) {
      fail(`unexpected positional argument: ${arg}`)
    }

    const rawArg = arg.slice(2)
    const equalsIndex = rawArg.indexOf("=")
    const rawKey = equalsIndex === -1 ? rawArg : rawArg.slice(0, equalsIndex)
    const rawValue = equalsIndex === -1 ? undefined : rawArg.slice(equalsIndex + 1)
    const key = camelCaseArg(rawKey)
    const value = rawValue ?? argv[index + 1]
    if (!value || value.startsWith("--")) {
      fail(`missing value for --${rawKey}`)
    }
    parsed[key] = value
    if (rawValue === undefined) index += 1
  }
  return parsed
}

function camelCaseArg(rawKey) {
  return rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
}

export function projectConfigFromArgs(args) {
  const owner = args.owner ?? process.env.VOYANT_ENGINEERING_PROJECT_OWNER ?? "voyant-travel"
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

export function projectScanConfigFromArgs(args) {
  return projectConfigFromArgs({ ...args, limit: args.limit ?? 100 })
}

export function projectNumberFromUrl(projectUrl) {
  if (!projectUrl) return undefined
  const match = projectUrl.match(/\/projects\/(\d+)(?:$|[/?#])/)
  return match?.[1]
}

export function loadAllEvaluatedProject({
  owner,
  projectNumber,
  limit,
  onError = fail,
  readItems = readProjectItems,
}) {
  const pageSize = limit ?? 100
  const pages = []
  let after

  do {
    const page = readItems({ after, limit: pageSize, onError, owner, projectNumber })
    pages.push(page)
    after = page.pageInfo.endCursor
    if (page.pageInfo.hasNextPage && !after) {
      onError("Project item pagination returned no cursor")
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

export function readProjectItems({ after, owner, projectNumber, limit, onError = fail }) {
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
                  body
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
                  body
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
    onError(`failed to run gh: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    onError(stderr || `gh api graphql exited with ${result.status}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    onError(`failed to parse gh JSON output: ${error.message}`)
  }

  if (payload.errors?.length) {
    onError(payload.errors.map((error) => error.message).join("; "))
  }

  const project = payload.data?.organization?.projectV2
  if (!project) {
    onError(`project ${owner}/${projectNumber} was not found or is not visible to gh`)
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
  if (!hasAgentBrief(content?.body)) reasons.push("missing Agent Brief section")
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
          agentBrief: extractAgentBrief(content.body),
          hasAgentBrief: hasAgentBrief(content.body),
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

export function runGit(gitArgs, options = {}) {
  return runCommand("git", gitArgs, options)
}

export function runCommand(command, commandArgs, options = {}) {
  const { allowFailure = false, ...spawnOptions } = options
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    ...spawnOptions,
  })

  if (result.error) {
    fail(`failed to run ${command} ${commandArgs.join(" ")}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    if (allowFailure) return undefined
    const stderr = result.stderr?.trim()
    fail(stderr || `${command} ${commandArgs.join(" ")} exited with ${result.status}`)
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

export function filterItemsByRepository(items, repository) {
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
