import { Checkbox, Label } from "@voyantjs/ui/components"

import type { NotificationsUiMessages } from "../i18n/index.js"
import {
  ATTACHMENT_VALUES,
  attachmentItemLabel,
  type TemplateAttachment,
} from "./notification-template-dialog-utils.js"

type NotificationTemplateAttachmentsFieldProps = {
  attachments: ReadonlyArray<TemplateAttachment>
  onAttachmentChange: (attachment: TemplateAttachment, checked: boolean) => void
  t: NotificationsUiMessages["admin"]["templateDialog"]
}

export function NotificationTemplateAttachmentsField({
  attachments,
  onAttachmentChange,
  t,
}: NotificationTemplateAttachmentsFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{t.attachmentsLabel}</Label>
      <div className="flex flex-wrap gap-3">
        {ATTACHMENT_VALUES.map((value) => (
          <div key={value} className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <Checkbox
              id={`notification-template-attachment-${value}`}
              checked={attachments.includes(value)}
              onCheckedChange={(checked) => onAttachmentChange(value, checked === true)}
            />
            <Label
              htmlFor={`notification-template-attachment-${value}`}
              className="cursor-pointer text-sm font-normal"
            >
              {attachmentItemLabel(t, value)}
            </Label>
          </div>
        ))}
      </div>
    </div>
  )
}
