function extractArray(source, property) {
  const match = new RegExp(`\\b${property}\\s*:\\s*\\[`, "g").exec(source)
  if (!match) return ""
  const start = source.indexOf("[", match.index)
  let depth = 0
  let quote = null
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === "[") depth += 1
    if (character === "]" && --depth === 0) return source.slice(start + 1, index)
  }
  return ""
}

function objectEntries(arraySource) {
  const entries = []
  let depth = 0
  let start = -1
  let quote = null
  let escaped = false
  for (let index = 0; index < arraySource.length; index += 1) {
    const character = arraySource[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === "{") {
      if (depth === 0) start = index
      depth += 1
    } else if (character === "}" && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) entries.push(arraySource.slice(start, index + 1))
    }
  }
  return entries
}

function stringProperty(source, property) {
  return new RegExp(`\\b${property}\\s*:\\s*["']([^"']+)["']`).exec(source)?.[1]
}

export function collectPhase5EventAuthority(source, location = "voyant.ts") {
  const events = new Map(
    objectEntries(extractArray(source, "events"))
      .map((entry) => [stringProperty(entry, "id"), { entry, location }])
      .filter(([id]) => id),
  )
  const webhooks = objectEntries(extractArray(source, "webhooks"))
    .filter((entry) => stringProperty(entry, "direction") === "outbound")
    .map((entry) => ({
      entry,
      id: stringProperty(entry, "id") ?? "<unknown webhook>",
      eventId: stringProperty(entry, "eventId"),
      location,
    }))
  return { events, webhooks }
}

export function inspectPhase5EventAuthority(
  source,
  location = "voyant.ts",
  eventCatalog = collectPhase5EventAuthority(source, location).events,
) {
  const { webhooks } = collectPhase5EventAuthority(source, location)
  const failures = []

  for (const webhook of webhooks) {
    const event = webhook.eventId ? eventCatalog.get(webhook.eventId)?.entry : undefined
    const prefix = `${webhook.location}: outbound webhook "${webhook.id}"`
    if (!webhook.eventId || !event) {
      failures.push(`${prefix} must reference an event declared in a package manifest`)
      continue
    }
    if (stringProperty(event, "visibility") !== "external") {
      failures.push(`${prefix} event "${webhook.eventId}" must declare visibility: "external"`)
    }
    if (!/^\d+\.\d+\.\d+$/.test(stringProperty(event, "version") ?? "")) {
      failures.push(`${prefix} event "${webhook.eventId}" must declare a semantic version`)
    }
    if (!/\bpayloadSchema\s*:/.test(event)) {
      failures.push(`${prefix} event "${webhook.eventId}" must declare payloadSchema`)
    }
    const audit = /\baudit\s*:\s*\{([\s\S]*?)\}/.exec(event)?.[1] ?? ""
    if (!stringProperty(audit, "sourceModule") || !stringProperty(audit, "category")) {
      failures.push(
        `${prefix} event "${webhook.eventId}" must declare audit sourceModule and category`,
      )
    }
  }
  return failures
}
