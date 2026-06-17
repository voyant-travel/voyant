import { createCustomFieldRegistry, customFieldsFromGlob } from "@voyant-travel/core/custom-fields"

/**
 * The deployment's custom-field registry, discovered from `src/custom-fields/*.ts`
 * (each file default-exports a `defineCustomField(...)` or an array). Vite compiles
 * the `import.meta.glob` to static imports at build time (Workers-safe). Empty
 * until a deployment adds a field.
 *
 * Inject this registry into the services/readers that should honor it (write
 * validation, export/invoice/search visibility). See
 * docs/architecture/custom-fields.md.
 */
export const operatorCustomFields = createCustomFieldRegistry(
  customFieldsFromGlob(import.meta.glob("../custom-fields/*.ts", { eager: true })),
)
