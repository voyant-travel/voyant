"use client"

import {
  type NotificationTemplateRecord,
  type UseNotificationTemplatesOptions,
  useNotificationTemplates,
} from "@voyantjs/notifications-react"
import { Loader2, Pencil, Plus, Search } from "lucide-react"
import { useState } from "react"

import { Badge } from "./badge.js"
import { Button } from "./button.js"
import { Input } from "./input.js"
import { NotificationTemplateDialog } from "./notification-template-dialog.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js"

export function NotificationTemplatesPage() {
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState<UseNotificationTemplatesOptions["channel"] | "all">("all")
  const [status, setStatus] = useState<UseNotificationTemplatesOptions["status"] | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationTemplateRecord | undefined>()
  const { data, isPending, refetch } = useNotificationTemplates({
    search,
    channel: channel === "all" ? undefined : channel,
    status: status === "all" ? undefined : status,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage email and SMS templates rendered with Liquid.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channel} onValueChange={(value) => setChannel(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && (!data?.data || data.data.length === 0) ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No notification templates yet. Create one to start sending branded emails and SMS
            messages.
          </p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((template) => (
                <tr key={template.id} className="border-t">
                  <td className="px-4 py-3">
                    <a
                      href={`/notifications/templates/${template.id}`}
                      className="block rounded-sm outline-none transition-colors hover:text-primary focus-visible:text-primary"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{template.slug}</div>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{template.channel}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={template.status === "active" ? "default" : "secondary"}>
                      {template.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{new Date(template.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(template)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <NotificationTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
