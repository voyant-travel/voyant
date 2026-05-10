import { spawnSync } from "node:child_process"

import { fail } from "./agent-project-queue.mjs"

export function updateProjectItemFields({ project, item, values, clear = [] }) {
  const projectId = project.projectId
  if (!projectId) {
    fail("project id was not loaded")
  }

  const updates = Object.entries(values).map(([fieldName, value]) => {
    const field = findField(project, fieldName)
    return {
      field,
      value: projectValue(field, value),
    }
  })
  const clears = clear.map((fieldName) => findField(project, fieldName))

  for (const update of updates) {
    updateProjectItemField({ projectId, itemId: item.itemId, ...update })
  }

  for (const field of clears) {
    clearProjectItemField({
      projectId,
      itemId: item.itemId,
      field,
    })
  }
}

function updateProjectItemField({ projectId, itemId, field, value }) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: $value
      }) {
        projectV2Item {
          id
        }
      }
    }
  `

  runGhGraphql(mutation, {
    projectId,
    itemId,
    fieldId: field.id,
    value,
  })
}

function clearProjectItemField({ projectId, itemId, field }) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
      clearProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
      }) {
        projectV2Item {
          id
        }
      }
    }
  `

  runGhGraphql(mutation, {
    projectId,
    itemId,
    fieldId: field.id,
  })
}

function projectValue(field, value) {
  if (field.dataType === "SINGLE_SELECT") {
    const option = field.options.find((candidate) => candidate.name === value)
    if (!option) {
      fail(`option "${value}" was not found for Project field "${field.name}"`)
    }
    return { singleSelectOptionId: option.id }
  }

  if (field.dataType === "DATE") {
    return { date: value }
  }

  if (field.dataType === "TEXT") {
    return { text: value }
  }

  fail(`Project field "${field.name}" has unsupported data type ${field.dataType}`)
}

function findField(project, fieldName) {
  const field = project.fieldDefinitions?.find((candidate) => candidate.name === fieldName)
  if (!field) {
    fail(`Project field "${fieldName}" was not found`)
  }
  return field
}

function runGhGraphql(query, variables) {
  const result = spawnSync("gh", ["api", "graphql", "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({ query, variables }),
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

  return payload.data
}
