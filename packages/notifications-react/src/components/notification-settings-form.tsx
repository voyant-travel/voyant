"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from "@voyant-travel/ui/components"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@voyant-travel/ui/components/field"
import { Switch } from "@voyant-travel/ui/components/switch"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import { useNotificationSettings, useNotificationSettingsMutation } from "../index.js"
import { TimezoneCombobox } from "./timezone-combobox.js"

type BlackoutRow = { rowKey: string; date: string | null }

type FormState = {
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursTz: string
  blackoutDates: BlackoutRow[]
  skipWeekends: boolean
  recipientRateLimitPerDay: string
  suppressionWindowHours: number
}

let blackoutSeq = 0
const nextBlackoutKey = () => `bo-${++blackoutSeq}`

const emptyForm: FormState = {
  quietHoursStart: "",
  quietHoursEnd: "",
  quietHoursTz: "UTC", // i18n-literal-ok IANA timezone default
  blackoutDates: [],
  skipWeekends: false,
  recipientRateLimitPerDay: "",
  suppressionWindowHours: 24,
}

export function NotificationSettingsForm() {
  const messages = useNotificationsUiMessagesOrDefault()
  const { data: settings, isLoading } = useNotificationSettings()
  const mutation = useNotificationSettingsMutation()
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (!settings) return
    setForm({
      quietHoursStart: settings.quietHoursLocal?.start ?? "",
      quietHoursEnd: settings.quietHoursLocal?.end ?? "",
      quietHoursTz: settings.quietHoursLocal?.tz ?? "UTC", // i18n-literal-ok IANA timezone default
      blackoutDates: (settings.blackoutDates ?? []).map((date) => ({
        rowKey: nextBlackoutKey(),
        date,
      })),
      skipWeekends: settings.skipWeekends,
      recipientRateLimitPerDay: settings.recipientRateLimitPerDay?.toString() ?? "",
      suppressionWindowHours: settings.suppressionWindowHours,
    })
  }, [settings])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const addBlackout = () =>
    setField("blackoutDates", [...form.blackoutDates, { rowKey: nextBlackoutKey(), date: null }])
  const removeBlackout = (rowKey: string) =>
    setField(
      "blackoutDates",
      form.blackoutDates.filter((row) => row.rowKey !== rowKey),
    )
  const updateBlackout = (rowKey: string, date: string | null) =>
    setField(
      "blackoutDates",
      form.blackoutDates.map((row) => (row.rowKey === rowKey ? { ...row, date } : row)),
    )

  const handleSubmit = async () => {
    const dates = form.blackoutDates
      .map((row) => row.date)
      .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
    const quiet =
      form.quietHoursStart && form.quietHoursEnd
        ? { start: form.quietHoursStart, end: form.quietHoursEnd, tz: form.quietHoursTz || "UTC" } // i18n-literal-ok IANA timezone default
        : null

    await mutation.mutateAsync({
      quietHoursLocal: quiet,
      blackoutDates: dates.length > 0 ? dates : null,
      skipWeekends: form.skipWeekends,
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

      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">{messages.common.loading}</p>}

        <FieldGroup>
          {/* Quiet hours */}
          <FieldSet>
            <FieldLegend>{messages.settings.sections.quietHours}</FieldLegend>
            <FieldDescription>{messages.settings.sections.quietHoursDesc}</FieldDescription>

            <FieldGroup className="gap-4">
              <Field orientation="horizontal">
                <Switch
                  id="skipWeekends"
                  checked={form.skipWeekends}
                  onCheckedChange={(value) => setField("skipWeekends", value)}
                />
                <FieldLabel htmlFor="skipWeekends" className="!w-auto !flex-row">
                  <FieldTitle>{messages.settings.fields.skipWeekends}</FieldTitle>
                  <FieldDescription>{messages.settings.fields.skipWeekendsDesc}</FieldDescription>
                </FieldLabel>
              </Field>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="quietHoursStart">
                    {messages.settings.fields.quietHoursStart}
                  </FieldLabel>
                  <Input
                    id="quietHoursStart"
                    type="time"
                    value={form.quietHoursStart}
                    onChange={(e) => setField("quietHoursStart", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="quietHoursEnd">
                    {messages.settings.fields.quietHoursEnd}
                  </FieldLabel>
                  <Input
                    id="quietHoursEnd"
                    type="time"
                    value={form.quietHoursEnd}
                    onChange={(e) => setField("quietHoursEnd", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>{messages.settings.fields.quietHoursTz}</FieldLabel>
                  <TimezoneCombobox
                    value={form.quietHoursTz}
                    onChange={(value) =>
                      setField(
                        "quietHoursTz",
                        value ?? "UTC" /* i18n-literal-ok IANA timezone default */,
                      )
                    }
                    placeholder={messages.settings.placeholders.tz}
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          {/* Blackout dates */}
          <FieldSet>
            <FieldLegend>{messages.settings.sections.blackouts}</FieldLegend>
            <FieldDescription>{messages.settings.sections.blackoutsDesc}</FieldDescription>

            <div className="space-y-2">
              {form.blackoutDates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {messages.settings.placeholders.noBlackouts}
                </p>
              )}
              {form.blackoutDates.map((row) => (
                <div key={row.rowKey} className="flex items-center gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={row.date}
                      onChange={(value) => updateBlackout(row.rowKey, value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBlackout(row.rowKey)}
                    aria-label={messages.settings.actions.removeBlackoutDate}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addBlackout}>
                <Plus className="size-4" /> {messages.settings.actions.addBlackoutDate}
              </Button>
            </div>
          </FieldSet>

          {/* Rate limits */}
          <FieldSet>
            <FieldLegend>{messages.settings.sections.rateLimits}</FieldLegend>
            <FieldDescription>{messages.settings.sections.rateLimitsDesc}</FieldDescription>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recipientRateLimitPerDay">
                  {messages.settings.fields.recipientRateLimitPerDay}
                </FieldLabel>
                <Input
                  id="recipientRateLimitPerDay"
                  type="number"
                  min={1}
                  value={form.recipientRateLimitPerDay}
                  onChange={(e) => setField("recipientRateLimitPerDay", e.target.value)}
                  placeholder={messages.common.optionalPlaceholder}
                />
                <FieldDescription>
                  {messages.settings.helpers.recipientRateLimitPerDay}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="suppressionWindowHours">
                  {messages.settings.fields.suppressionWindowHours}
                </FieldLabel>
                <Input
                  id="suppressionWindowHours"
                  type="number"
                  min={0}
                  value={form.suppressionWindowHours}
                  onChange={(e) => setField("suppressionWindowHours", Number(e.target.value))}
                />
                <FieldDescription>
                  {messages.settings.helpers.suppressionWindowHours}
                </FieldDescription>
              </Field>
            </div>
          </FieldSet>
        </FieldGroup>
      </CardContent>

      <CardFooter className="justify-end">
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {messages.common.save}
        </Button>
      </CardFooter>
    </Card>
  )
}
