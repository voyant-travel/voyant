import type { DistributionUiMessages } from "../i18n/messages.js"
import {
  type ChannelBookingLinkRow,
  classifyRetryResult,
  formatTemplate,
  type RetryFeedbackKind,
  type RetryPushResult,
} from "./channel-sync-page-utils.js"

export type OperationFeedback = {
  tone: "success" | "error"
  title: string
  body: string
}

export function buildRetryFeedback(
  result: RetryPushResult,
  row: ChannelBookingLinkRow,
  messages: DistributionUiMessages["channelSync"],
): OperationFeedback {
  const kind = classifyRetryResult(result)
  const tone = kind === "processed" || kind === "ok" ? "success" : "error"
  const body = retryFeedbackBody(kind, result, row, messages)

  return {
    tone,
    title: messages.feedback.retry.title,
    body,
  }
}

function retryFeedbackBody(
  kind: RetryFeedbackKind,
  result: RetryPushResult,
  row: ChannelBookingLinkRow,
  messages: DistributionUiMessages["channelSync"],
): string {
  const bookingId = result.bookingId || row.link.bookingId
  switch (kind) {
    case "processed":
      return formatTemplate(messages.feedback.retry.processed, {
        attempted: result.attempted ?? 0,
        succeeded: result.succeeded ?? 0,
        failed: result.failed ?? 0,
        compensated: result.compensated ?? 0,
      })
    case "booking_missing":
      return formatTemplate(messages.feedback.retry.bookingMissing, { bookingId })
    case "no_pending_links":
      return formatTemplate(messages.feedback.retry.noPendingLinks, { bookingId })
    case "no_targets":
      return formatTemplate(messages.feedback.retry.noTargets, { bookingId })
    case "no_adapter":
      return messages.feedback.retry.noAdapter
    case "no_mapping":
      return messages.feedback.retry.noMapping
    case "failed":
      return formatTemplate(messages.feedback.retry.failed, {
        bookingId,
        message:
          result.outcomes?.find((outcome) => outcome.error)?.error ??
          messages.feedback.retry.unknownError,
      })
    case "ok":
      return formatTemplate(messages.feedback.retry.ok, { bookingId })
  }
}
