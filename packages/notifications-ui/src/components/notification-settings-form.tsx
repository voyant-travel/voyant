"use client"

import {
  useNotificationSettings,
  useNotificationSettingsMutation,
} from "@voyantjs/notifications-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

type FormState = {
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursTz: string
  blackoutDates: string
  skipWeekends: boolean
  holidayCalendar: string
  recipientRateLimitPerDay: string
  suppressionWindowHours: number
}

export function NotificationSettingsForm() {
  const messages = useNotificationsUiMessagesOrDefault()
  const { data: settings, isLoading } = useNotificationSettings()
  const mutation = useNotificationSettingsMutation()
  const [form, setForm] = useState<FormState>({
    quietHoursStart: "",
    quietHoursEnd: "",
    quietHoursTz: "UTC",
    blackoutDates: "",
    skipWeekends: false,
    holidayCalendar: "",
    recipientRateLimitPerDay: "",
    suppressionWindowHours: 24,
  })

  useEffect(() => {
    if (!settings) return
    setForm({
      quietHoursStart: settings.quietHoursLocal?.start ?? "",
      quietHoursEnd: settings.quietHoursLocal?.end ?? "",
      quietHoursTz: settings.quietHoursLocal?.tz ?? "UTC",
      blackoutDates: settings.blackoutDates?.join("\n") ?? "",
      skipWeekends: settings.skipWeekends,
      holidayCalendar: settings.holidayCalendar ?? "",
      recipientRateLimitPerDay: settings.recipientRateLimitPerDay?.toString() ?? "",
      suppressionWindowHours: settings.suppressionWindowHours,
    })
  }, [settings])

  const handleSubmit = async () => {
    const dates = form.blackoutDates
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    const quiet =
      form.quietHoursStart && form.quietHoursEnd
        ? { start: form.quietHoursStart, end: form.quietHoursEnd, tz: form.quietHoursTz || "UTC" }
        : null

    await mutation.mutateAsync({
      quietHoursLocal: quiet,
      blackoutDates: dates.length > 0 ? dates : null,
      skipWeekends: form.skipWeekends,
      holidayCalendar: form.holidayCalendar || null,
      recipientRateLimitPerDay: form.recipientRateLimitPerDay
        ? Number(form.recipientRateLimitPerDay)
        : null,
      suppressionWindowHours: form.suppressionWindowHours,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.settings.heading}</CardTitle>
        <CardDescription>{messages.settings.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">{messages.common.loading}</p>}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{messages.settings.fields.quietHoursStart}</Label>
            <Input
              value={form.quietHoursStart}
              onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value })}
              placeholder="22:00"
            />
          </div>
          <div>
            <Label>{messages.settings.fields.quietHoursEnd}</Label>
            <Input
              value={form.quietHoursEnd}
              onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value })}
              placeholder="08:00"
            />
          </div>
          <div>
            <Label>{messages.settings.fields.quietHoursTz}</Label>
            <Input
              value={form.quietHoursTz}
              onChange={(e) => setForm({ ...form, quietHoursTz: e.target.value })}
              placeholder="Europe/Bucharest"
            />
          </div>
        </div>

        <div>
          <Label>{messages.settings.fields.blackoutDates}</Label>
          <Textarea
            value={form.blackoutDates}
            onChange={(e) => setForm({ ...form, blackoutDates: e.target.value })}
            rows={3}
            placeholder={"2026-12-25\n2026-01-01"}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {messages.settings.helpers.blackoutDates}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-end gap-2">
            <Checkbox
              id="skipWeekends"
              checked={form.skipWeekends}
              onCheckedChange={(v) => setForm({ ...form, skipWeekends: Boolean(v) })}
            />
            <Label htmlFor="skipWeekends">{messages.settings.fields.skipWeekends}</Label>
          </div>
          <div>
            <Label>{messages.settings.fields.holidayCalendar}</Label>
            <Input
              value={form.holidayCalendar}
              onChange={(e) => setForm({ ...form, holidayCalendar: e.target.value })}
              placeholder="ro-RO"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{messages.settings.fields.recipientRateLimitPerDay}</Label>
            <Input
              type="number"
              min={1}
              value={form.recipientRateLimitPerDay}
              onChange={(e) => setForm({ ...form, recipientRateLimitPerDay: e.target.value })}
              placeholder={messages.common.optionalPlaceholder}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {messages.settings.helpers.recipientRateLimitPerDay}
            </p>
          </div>
          <div>
            <Label>{messages.settings.fields.suppressionWindowHours}</Label>
            <Input
              type="number"
              min={0}
              value={form.suppressionWindowHours}
              onChange={(e) => setForm({ ...form, suppressionWindowHours: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {messages.settings.helpers.suppressionWindowHours}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {messages.common.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
