# Custom fields

Runtime custom-field definitions are managed in Operator Settings and persisted
in `custom_field_definitions`. A definition created or updated there is used by
validation, export, invoice, and search consumers on the next request; no
rebuild, deployment, or process restart is required.

Project-local TypeScript declarations in this directory are a deprecated
compatibility surface only and are not loaded into the runtime registry. They
will be removed by the final custom-fields cleanup tracked in #3401.

See `docs/architecture/custom-fields.md` for the database-authority and entity
adoption rules.
