/**
 * Validate untouched generated metadata without reading any property value.
 *
 * This must run before normalization because spreading or iterating an
 * untrusted record/container could otherwise execute an accessor or erase a
 * caller-controlled prototype before the immutable snapshot sees it.
 */
export function assertPlainRuntimeMetadataGraph(value: unknown): void {
  const visited = new WeakSet<object>()

  const inspect = (current: unknown): void => {
    if (typeof current !== "object" || current === null || visited.has(current)) return
    visited.add(current)

    const prototype = Object.getPrototypeOf(current)
    const validPrototype = Array.isArray(current)
      ? prototype === Array.prototype
      : prototype === Object.prototype || prototype === null
    if (!validPrototype) {
      throw new Error(
        "createVoyantGraphRuntime: runtime metadata must contain only plain records and genuine arrays with no custom prototype.",
      )
    }

    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (!descriptor) continue
      if (!("value" in descriptor)) {
        throw new Error(
          "createVoyantGraphRuntime: runtime metadata must not contain accessor properties.",
        )
      }
      inspect(descriptor.value)
    }
  }

  inspect(value)
}

/**
 * Create an immutable, detached snapshot of framework runtime metadata.
 *
 * Runtime metadata is plain data plus lazy loader functions. Functions are
 * preserved by identity; every record and array that can redirect a loader or
 * change graph policy is copied before it is recursively frozen.
 *
 * Custom prototypes and accessors are rejected. Accepting either would let a
 * caller change inherited policy after minting even though the snapshot's own
 * properties are frozen. Opaque provider, Tool, and schema objects are loaded
 * later through the preserved functions and never cross this metadata boundary.
 */
export function cloneAndDeepFreezeRuntimeSnapshot<T>(value: T): T {
  const copies = new WeakMap<object, unknown>()

  const clone = (current: unknown): unknown => {
    if (typeof current !== "object" || current === null) return current
    const existing = copies.get(current)
    if (existing !== undefined) return existing

    if (Array.isArray(current)) {
      const copy: unknown[] = []
      copies.set(current, copy)
      for (const item of current) copy.push(clone(item))
      return Object.freeze(copy)
    }

    const prototype = Object.getPrototypeOf(current)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        "createVoyantGraphRuntime: runtime metadata must contain only plain records with no custom prototype.",
      )
    }

    const copy: Record<PropertyKey, unknown> = {}
    copies.set(current, copy)
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (!descriptor) continue
      if (!("value" in descriptor)) {
        throw new Error(
          "createVoyantGraphRuntime: runtime metadata must not contain accessor properties.",
        )
      }
      Object.defineProperty(copy, key, {
        ...descriptor,
        value: clone(descriptor.value),
      })
    }
    return Object.freeze(copy)
  }

  return clone(value) as T
}

/** Recursively freeze a newly assembled runtime view without cloning loaders. */
export function deepFreezeRuntimeSnapshot<T>(value: T): T {
  const visited = new WeakSet<object>()

  const freeze = (current: unknown): void => {
    if (typeof current !== "object" || current === null || visited.has(current)) return
    visited.add(current)
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (descriptor && "value" in descriptor) freeze(descriptor.value)
    }
    Object.freeze(current)
  }

  freeze(value)
  return value
}
