export function hasAgentBrief(body) {
  return Boolean(extractAgentBrief(body))
}

export function extractAgentBrief(body) {
  if (!body) return false

  const lines = body.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => /^#{2,6}\s+Agent Brief\s*$/i.test(line.trim()))
  if (headingIndex === -1) return false

  const sectionLines = []
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^#{1,6}\s+\S/.test(line.trim())) break
    sectionLines.push(line)
  }

  const content = sectionLines
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()

  if (["no response", "_no response_", "tbd", "todo"].includes(content.toLowerCase())) {
    return false
  }

  return content || false
}
