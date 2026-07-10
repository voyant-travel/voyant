import { definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the Sanity CMS plugin. */
export const sanityCmsVoyantPlugin = definePlugin({
  id: "@voyant-travel/plugin-sanity-cms",
  packageName: "@voyant-travel/plugin-sanity-cms",
  localId: "plugin-sanity-cms",
  meta: {
    ownership: "package",
  },
})

export default sanityCmsVoyantPlugin
