import { catalogSourcesRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import { defineAdapter, providePort } from "@voyant-travel/graph-contracts"

/**
 * Voyant Connect as one catalog inventory channel.
 *
 * Declared as an adapter, not a plugin: RFC #3395 retired that classification,
 * and the catalog spine resolves this through a port rather than importing it,
 * so a self-hosted channel can provide the same contract.
 */
export const voyantConnectAdapter = defineAdapter({
  id: "@voyant-travel/plugin-voyant-connect",
  packageName: "@voyant-travel/plugin-voyant-connect",
  localId: "voyant-connect",
  provides: {
    ports: [providePort(catalogSourcesRuntimeExtensionPort)],
  },
  meta: { ownership: "package" },
})

export default voyantConnectAdapter
