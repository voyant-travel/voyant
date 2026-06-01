// The TypeID system (prefix registry, id generation, zod validators) now lives
// in the pure leaf package @voyantjs/schema-kit so it sits below the data layer
// and the *-contracts packages can depend on it without pulling Drizzle.
// Re-exported here to keep existing @voyantjs/db/lib/typeid import paths stable.
export * from "@voyantjs/schema-kit/typeid"
