const NO_TOOL_POSTURES = new Set(["not-applicable", "planned"])

/**
 * Validate package-owned agent Tool coverage declarations and return deterministic
 * diagnostics plus a report model. Tool surfaces are derived from module manifests;
 * only modules without Tools need an explicit posture and rationale.
 */
export function inspectAgentToolCoverage(modules, options = {}) {
  const exclusions = options.exclusions ?? new Map()
  const diagnostics = []
  const rows = []
  const seenUnitIds = new Set()

  for (const module of [...modules].sort(compareModules)) {
    const location = `${module.packageName} (${module.unitId})`
    if (seenUnitIds.has(module.unitId)) {
      diagnostics.push(`${module.unitId}: duplicate module unit in agent Tool coverage inventory`)
      continue
    }
    seenUnitIds.add(module.unitId)

    const tools = [...(module.tools ?? [])].sort((left, right) => left.id.localeCompare(right.id))
    const duplicateToolIds = duplicates(tools.map((tool) => tool.id))
    for (const toolId of duplicateToolIds) {
      diagnostics.push(`${location}: duplicate Tool id ${toolId}`)
    }

    const exclusion = exclusions.get(module.unitId)
    if (exclusion) {
      if (tools.length > 0) {
        diagnostics.push(`${location}: excluded transport module must not declare Tools`)
      }
      if (!nonEmpty(exclusion.rationale)) {
        diagnostics.push(`${location}: transport exclusion requires a non-empty rationale`)
      }
      rows.push({
        packageName: module.packageName,
        unitId: module.unitId,
        posture: "transport-excluded",
        rationale: exclusion.rationale,
        tools,
      })
      continue
    }

    const declaration = module.agentTools
    if (tools.length > 0) {
      if (declaration !== undefined) {
        diagnostics.push(
          `${location}: Tool surface is derived from manifest tools; remove the redundant no-Tool posture`,
        )
      }
      rows.push({
        packageName: module.packageName,
        unitId: module.unitId,
        posture: "tools",
        tools,
      })
      continue
    }

    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
      diagnostics.push(
        `${location}: module has no Tools and must declare meta.agentTools with a posture and rationale`,
      )
      rows.push({
        packageName: module.packageName,
        unitId: module.unitId,
        posture: "missing",
        tools,
      })
      continue
    }

    const posture = declaration.posture
    const rationale = declaration.rationale
    if (!NO_TOOL_POSTURES.has(posture)) {
      diagnostics.push(`${location}: meta.agentTools.posture must be "planned" or "not-applicable"`)
    }
    if (!nonEmpty(rationale)) {
      diagnostics.push(`${location}: meta.agentTools.rationale must be a non-empty string`)
    }
    if (posture === "planned" && !nonEmpty(declaration.issue)) {
      diagnostics.push(`${location}: planned Tool coverage must name a tracking issue`)
    }

    rows.push({
      packageName: module.packageName,
      unitId: module.unitId,
      posture: NO_TOOL_POSTURES.has(posture) ? posture : "invalid",
      rationale: nonEmpty(rationale) ? rationale.trim() : undefined,
      issue: nonEmpty(declaration.issue) ? declaration.issue.trim() : undefined,
      tools,
    })
  }

  return { diagnostics: diagnostics.sort(), rows }
}

export function formatAgentToolCoverageMarkdown(rows) {
  const counts = rows.reduce(
    (result, row) => {
      result.modules += 1
      result.toolCount += row.tools.length
      result.postures[row.posture] = (result.postures[row.posture] ?? 0) + 1
      return result
    },
    { modules: 0, toolCount: 0, postures: {} },
  )
  const lines = [
    "# Agent Tool coverage",
    "",
    `Modules: ${counts.modules} | Tools: ${counts.toolCount} | Tool surfaces: ${counts.postures.tools ?? 0} | Planned: ${counts.postures.planned ?? 0} | Not applicable: ${counts.postures["not-applicable"] ?? 0} | Transport excluded: ${counts.postures["transport-excluded"] ?? 0}`,
    "",
    "| Module | Package | Posture | Tools | Declaration |",
    "| --- | --- | --- | ---: | --- |",
  ]

  for (const row of rows) {
    const declaration =
      row.posture === "tools"
        ? row.tools.map((tool) => `\`${tool.id}\``).join(", ")
        : [row.rationale, row.issue].filter(Boolean).join(" ")
    lines.push(
      `| \`${escapeCell(row.unitId)}\` | \`${escapeCell(row.packageName)}\` | ${escapeCell(row.posture)} | ${row.tools.length} | ${escapeCell(declaration ?? "")} |`,
    )
  }

  return `${lines.join("\n")}\n`
}

function compareModules(left, right) {
  return (
    left.unitId.localeCompare(right.unitId) || left.packageName.localeCompare(right.packageName)
  )
}

function duplicates(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
}
