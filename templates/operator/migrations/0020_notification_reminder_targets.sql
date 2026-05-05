ALTER TYPE "public"."notification_reminder_target_type" ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE "public"."notification_reminder_target_type" ADD VALUE IF NOT EXISTS 'payment_complete';
ALTER TYPE "public"."notification_reminder_target_type" ADD VALUE IF NOT EXISTS 'booking_cancelled_non_payment';
