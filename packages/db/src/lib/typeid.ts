// The TypeID system (prefix registry, id generation, zod validators) now lives
// in the pure leaf package @voyant-travel/schema-kit so it sits below the data layer
// and the *-contracts packages can depend on it without pulling Drizzle.
// Re-exported here to keep existing @voyant-travel/db/lib/typeid import paths stable.
export * from "@voyant-travel/schema-kit/typeid"
