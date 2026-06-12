export function mergeTags(...groups: ReadonlyArray<ReadonlyArray<string> | undefined>): string[] {
  const tags = new Set<string>()
  for (const group of groups) {
    for (const tag of group ?? []) tags.add(tag)
  }
  return Array.from(tags)
}

export function requireExternalResumeFromStep(resumeFromStep: string | undefined): string {
  if (!resumeFromStep) {
    throw new Error(
      "resumeFromStep is required when the parent run is not stored by this self-host server",
    )
  }
  return resumeFromStep
}

export function requireExternalSeedResults(
  seedResults: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!seedResults) {
    throw new Error(
      "seedResults is required when the parent run is not stored by this self-host server",
    )
  }
  return seedResults
}
