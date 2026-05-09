// `@voyantjs/workflows/events` — the events runtime: structured `where`
// predicate + `input` mapper, event-filter registry, manifest builder.
//
// Authoritative architecture: docs/architecture/workflows-runtime-architecture.md
// §12 (trigger.on runtime), §13 (DSLs), §14 (manifest lifecycle).

export {
  compileAndRegister,
  compileEventFilterSync,
  EventFilterCompileError,
} from "./compile.js"
export type { InputMapper } from "./input-mapper.js"
export {
  type InputMapperValidationResult,
  projectInput,
  validateInputMapper,
} from "./input-mapper.js"
export {
  type BuildManifestArgs,
  buildManifest,
} from "./manifest-builder.js"
export {
  canonicalize,
  canonicalJson,
  deriveStableEventId,
  sha256,
  shortHash,
} from "./payload-hash.js"
export {
  evaluatePredicate,
  type PathOrLit,
  type PredicateEnvelope,
  type PredicateExpr,
  type PredicateValidationResult,
  resolvePath,
  validatePredicate,
} from "./predicate.js"
export {
  __resetEventFilterRegistry,
  type EventFilterRuntimeEntry,
  getEventFilterRegistry,
} from "./registry.js"
