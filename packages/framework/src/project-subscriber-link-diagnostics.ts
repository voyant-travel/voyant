import type {
  ProjectSubscriberConvention,
  ProjectSubscriberLinkDiagnostic,
} from "./project-subscriber-link-conventions.js"

export function findSubscriberIdCollisions(
  subscribers: readonly ProjectSubscriberConvention[],
): ProjectSubscriberLinkDiagnostic[] {
  const byId = new Map<string, ProjectSubscriberConvention[]>()
  for (const subscriber of subscribers) {
    const matches = byId.get(subscriber.subscriberId)
    if (matches) matches.push(subscriber)
    else byId.set(subscriber.subscriberId, [subscriber])
  }
  return [...byId]
    .filter(([, matches]) => matches.length > 1)
    .map(([subscriberId, matches]) => {
      const sourcePaths = matches.map(({ sourcePath }) => sourcePath).sort(compareStrings)
      return {
        code: "PROJECT_SUBSCRIBER_ID_COLLISION",
        severity: "error",
        subscriberId,
        sourcePaths,
        message: `Subscriber id "${subscriberId}" is exported by ${formatSources(sourcePaths)}.`,
      }
    })
}

export function importEscapeDiagnostic(
  sourcePath: string,
  specifier: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_IMPORT_ESCAPE",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Convention file "${sourcePath}" import "${specifier}" escapes the project root.`,
  }
}

export function missingDefaultExportDiagnostic(
  sourcePath: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" must have a default export.`,
  }
}

export function multipleDefaultExportsDiagnostic(
  sourcePath: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MULTIPLE_DEFAULT_EXPORTS",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" has more than one default export.`,
  }
}

export function invalidDefaultExportDiagnostic(
  sourcePath: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" must default-export an expression.`,
  }
}

export function unsupportedExportDiagnostic(
  sourcePath: string,
  exportName: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_UNSUPPORTED_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName,
    message: `Convention file "${sourcePath}" has unsupported runtime export "${exportName}".`,
  }
}

export function invalidSubscriberDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Subscriber file "${sourcePath}" must default-export an object with non-empty literal "id" and "eventType" fields.`,
  }
}

export function invalidLinkDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_LINK_INVALID_DEFINITION",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Link file "${sourcePath}" must default-export defineLink(left, right, options?).`,
  }
}

export function compareDiagnostics(
  left: ProjectSubscriberLinkDiagnostic,
  right: ProjectSubscriberLinkDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.sourcePaths.join("\0"), right.sourcePaths.join("\0")) ||
    compareStrings(left.exportName ?? "", right.exportName ?? "")
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function formatSources(sourcePaths: readonly string[]): string {
  return sourcePaths.map((sourcePath) => `"${sourcePath}"`).join(", ")
}
