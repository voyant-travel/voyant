import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the catalog demo plugin. */
export const catalogDemoVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-catalog-demo",
  packageName: "@voyant-travel/plugin-catalog-demo",
  localId: "plugin-catalog-demo",
  meta: {
    ownership: "package",
  },
})

export default catalogDemoVoyantPlugin
