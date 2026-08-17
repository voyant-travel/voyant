import {
  type AdminExtension,
  adminRoutePageModule,
  defineAdminExtension,
  type SelectedAdminExtensionFactoryContext,
} from "@voyant-travel/admin"
import { Inbox } from "lucide-react"

declare module "@voyant-travel/admin" {
  interface AdminDestinations {
    "conversation.list": Record<string, never>
    "conversation.detail": { id: string }
  }
}

export function createConversationsAdminExtension(
  options: { basePath?: string; label?: string } = {},
): AdminExtension {
  const basePath = options.basePath ?? "/inbox"
  const label = options.label ?? "Inbox"
  return defineAdminExtension({
    id: "conversations",
    destinations: {
      "conversation.list": () => basePath,
      "conversation.detail": ({ id }: { id: string }) => `${basePath}/${encodeURIComponent(id)}`,
    },
    navigation: [
      { order: -45, items: [{ id: "inbox", title: label, url: basePath, icon: Inbox }] },
    ],
    routes: [
      {
        id: "conversations-inbox",
        path: basePath,
        title: label,
        page: () =>
          import("./inbox-page.js").then((module) => adminRoutePageModule(module.InboxPage)),
      },
      {
        id: "conversations-detail",
        path: `${basePath}/$id`,
        title: "Conversation",
        page: () => import("./conversation-page.js"),
      },
    ],
  })
}

export function createSelectedConversationsAdminExtension(
  { navMessages }: SelectedAdminExtensionFactoryContext = { navMessages: {} },
): AdminExtension {
  return createConversationsAdminExtension({ label: navMessages.inbox ?? "Inbox" })
}
