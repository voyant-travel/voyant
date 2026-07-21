import type { VoyantGraphFacetEntity } from "@voyant-travel/core/project"
import type { ProjectConventionFileContribution } from "./project-conventions.js"
import type {
  ProjectLinkConvention,
  ProjectSubscriberConvention,
} from "./project-subscriber-link-conventions.js"

export function generateProjectSubscribersSource(
  subscribers: readonly ProjectSubscriberConvention[],
): string {
  const ordered = [...subscribers].sort(compareConventions)
  return generatedCollectionSource(
    ordered,
    "SubscriberRuntimeDescriptor",
    "projectSubscribers",
    "subscriber",
  )
}

export function generateProjectLinksSource(links: readonly ProjectLinkConvention[]): string {
  const ordered = [...links].sort(compareConventions)
  return generateSelectedLinksSource(ordered, [])
}

export function generateSelectedLinksSource(
  projectLinks: readonly ProjectLinkConvention[],
  selectedLinks: readonly Required<Pick<VoyantGraphFacetEntity, "id" | "source" | "export">>[],
  sourceOverrides: Readonly<Record<string, string>> = {},
): string {
  const orderedProjectLinks = [...projectLinks].sort(compareConventions)
  const orderedSelectedLinks = [...selectedLinks].sort((left, right) =>
    `${left.id}:${left.source}:${left.export}`.localeCompare(
      `${right.id}:${right.source}:${right.export}`,
    ),
  )
  const count = orderedProjectLinks.length + orderedSelectedLinks.length
  return [
    'import type { LinkDefinition } from "@voyant-travel/core"',
    ...orderedProjectLinks.map(
      ({ sourcePath }, index) =>
        `import link${index} from ${JSON.stringify(generatedImportSpecifier(sourcePath))}`,
    ),
    ...orderedSelectedLinks.map(
      (link, index) =>
        `import { ${link.export} as link${orderedProjectLinks.length + index} } from ${JSON.stringify(sourceOverrides[link.source] ?? link.source)}`,
    ),
    "",
    ...Array.from(
      { length: count },
      (_, index) => `export { link${index} as projectLink${index} }`,
    ),
    ...(count > 0 ? [""] : []),
    `export const projectLinks = [${Array.from({ length: count }, (_, index) => `link${index}`).join(", ")}] as const satisfies readonly LinkDefinition[]`,
    "",
  ].join("\n")
}

function generatedCollectionSource(
  contributions: readonly ProjectConventionFileContribution[],
  typeName: "SubscriberRuntimeDescriptor" | "LinkDefinition",
  exportName: "projectSubscribers" | "projectLinks",
  importName: "subscriber" | "link",
): string {
  return [
    `import type { ${typeName} } from "@voyant-travel/core"`,
    ...contributions.map(
      ({ sourcePath }, index) =>
        `import ${importName}${index} from ${JSON.stringify(generatedImportSpecifier(sourcePath))}`,
    ),
    "",
    ...contributions.map(
      (_, index) =>
        `export { ${importName}${index} as project${importName[0]!.toUpperCase()}${importName.slice(1)}${index} }`,
    ),
    ...(contributions.length > 0 ? [""] : []),
    `export const ${exportName} = [${contributions.map((_, index) => `${importName}${index}`).join(", ")}] as const satisfies readonly ${typeName}[]`,
    "",
  ].join("\n")
}

function generatedImportSpecifier(sourcePath: string): string {
  return `../../${sourcePath.replace(/\.ts$/, ".js")}`
}

function compareConventions(
  left: ProjectConventionFileContribution,
  right: ProjectConventionFileContribution,
): number {
  return compareStrings(left.sourcePath, right.sourcePath) || compareStrings(left.id, right.id)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
