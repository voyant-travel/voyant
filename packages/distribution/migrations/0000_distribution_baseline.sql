CREATE TYPE "public"."booking_dist_payment_owner" AS ENUM('operator', 'channel', 'split');--> statement-breakpoint
CREATE TYPE "public"."external_ref_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel_allotment_release_mode" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."channel_allotment_unsold_action" AS ENUM('release_to_general_pool', 'expire', 'retain');--> statement-breakpoint
CREATE TYPE "public"."channel_commission_scope" AS ENUM('booking', 'product', 'rate', 'category');--> statement-breakpoint
CREATE TYPE "public"."channel_commission_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."channel_contract_status" AS ENUM('draft', 'active', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."channel_kind" AS ENUM('direct', 'affiliate', 'ota', 'reseller', 'marketplace', 'api_partner', 'connect');--> statement-breakpoint
CREATE TYPE "public"."channel_reconciliation_issue_type" AS ENUM('missing_booking', 'status_mismatch', 'amount_mismatch', 'cancel_mismatch', 'missing_payout', 'other');--> statement-breakpoint
CREATE TYPE "public"."channel_reconciliation_policy_frequency" AS ENUM('manual', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."channel_reconciliation_resolution_status" AS ENUM('open', 'ignored', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."channel_reconciliation_run_status" AS ENUM('draft', 'running', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel_reconciliation_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."channel_release_execution_action" AS ENUM('released', 'expired', 'retained', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."channel_release_execution_status" AS ENUM('pending', 'completed', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."channel_release_schedule_kind" AS ENUM('manual', 'hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."channel_remittance_exception_status" AS ENUM('open', 'investigating', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."channel_settlement_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."channel_settlement_item_status" AS ENUM('pending', 'approved', 'disputed', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."channel_settlement_policy_frequency" AS ENUM('manual', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."channel_settlement_run_status" AS ENUM('draft', 'open', 'posted', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'inactive', 'pending', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel_webhook_status" AS ENUM('pending', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."distribution_cancellation_owner" AS ENUM('operator', 'channel', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."distribution_payment_owner" AS ENUM('operator', 'channel', 'split');--> statement-breakpoint
CREATE TYPE "public"."rate_unit" AS ENUM('per_person', 'per_group', 'per_night', 'per_vehicle', 'flat');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('accommodation', 'transfer', 'experience', 'guide', 'meal', 'other');--> statement-breakpoint
CREATE TYPE "public"."supplier_contract_status" AS ENUM('active', 'expired', 'pending', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'inactive', 'pending');--> statement-breakpoint
CREATE TYPE "public"."supplier_type" AS ENUM('hotel', 'transfer', 'guide', 'experience', 'airline', 'restaurant', 'other');--> statement-breakpoint
CREATE TABLE "booking_distribution_details" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"market_id" text,
	"source_channel_id" text,
	"fx_rate_set_id" text,
	"payment_owner" "booking_dist_payment_owner" DEFAULT 'operator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_refs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"source_system" text NOT NULL,
	"object_type" text NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"external_id" text NOT NULL,
	"external_parent_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "external_ref_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_reconciliation_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"contract_id" text,
	"frequency" "channel_reconciliation_policy_frequency" DEFAULT 'manual' NOT NULL,
	"auto_run" boolean DEFAULT false NOT NULL,
	"compare_gross_amounts" boolean DEFAULT true NOT NULL,
	"compare_statuses" boolean DEFAULT true NOT NULL,
	"compare_cancellations" boolean DEFAULT true NOT NULL,
	"amount_tolerance_cents" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_release_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"release_rule_id" text NOT NULL,
	"schedule_kind" "channel_release_schedule_kind" DEFAULT 'manual' NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_settlement_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"contract_id" text,
	"frequency" "channel_settlement_policy_frequency" DEFAULT 'manual' NOT NULL,
	"auto_generate" boolean DEFAULT false NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"remittance_days_after_period_end" integer,
	"minimum_payout_amount_cents" integer,
	"currency_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_booking_links" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"booking_item_id" text,
	"external_booking_id" text,
	"external_reference" text,
	"external_status" text,
	"booked_at_external" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"source_kind" text,
	"source_connection_id" text,
	"push_status" text DEFAULT 'pending' NOT NULL,
	"push_attempts" integer DEFAULT 0 NOT NULL,
	"last_push_at" timestamp with time zone,
	"last_error" text,
	"pushed_payload_hash" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_commission_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"scope" "channel_commission_scope" NOT NULL,
	"product_id" text,
	"external_rate_id" text,
	"external_category_id" text,
	"commission_type" "channel_commission_type" NOT NULL,
	"amount_cents" integer,
	"percent_basis_points" integer,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_contact_projections" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"website_contact_point_id" text,
	"primary_named_contact_id" text,
	"website" text,
	"contact_name" text,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"supplier_id" text,
	"status" "channel_contract_status" DEFAULT 'draft' NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date,
	"payment_owner" "distribution_payment_owner" DEFAULT 'operator' NOT NULL,
	"cancellation_owner" "distribution_cancellation_owner" DEFAULT 'operator' NOT NULL,
	"settlement_terms" text,
	"notes" text,
	"rate_limit_rps" integer,
	"rate_limit_burst" integer,
	"rate_limit_priority_gates" jsonb,
	"policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_product_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"product_id" text NOT NULL,
	"external_product_id" text,
	"external_rate_id" text,
	"external_category_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"source_kind" text,
	"source_connection_id" text,
	"push_bookings" boolean DEFAULT true NOT NULL,
	"push_availability" boolean DEFAULT true NOT NULL,
	"push_content" boolean DEFAULT true NOT NULL,
	"policy" jsonb,
	"last_pushed_content_hash" text,
	"last_pushed_content_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"event_type" text NOT NULL,
	"external_event_id" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" "channel_webhook_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "channel_kind" NOT NULL,
	"status" "channel_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"rate_limit_rps" integer,
	"rate_limit_burst" integer,
	"rate_limit_priority_gates" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_reconciliation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"reconciliation_run_id" text NOT NULL,
	"booking_link_id" text,
	"booking_id" text,
	"external_booking_id" text,
	"issue_type" "channel_reconciliation_issue_type" DEFAULT 'other' NOT NULL,
	"severity" "channel_reconciliation_severity" DEFAULT 'warning' NOT NULL,
	"resolution_status" "channel_reconciliation_resolution_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_reconciliation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"contract_id" text,
	"status" "channel_reconciliation_run_status" DEFAULT 'draft' NOT NULL,
	"period_start" date,
	"period_end" date,
	"external_report_reference" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_remittance_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"settlement_item_id" text,
	"reconciliation_item_id" text,
	"exception_type" text NOT NULL,
	"severity" "channel_reconciliation_severity" DEFAULT 'warning' NOT NULL,
	"status" "channel_remittance_exception_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_settlement_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"settlement_run_id" text NOT NULL,
	"approver_user_id" text,
	"status" "channel_settlement_approval_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_settlement_items" (
	"id" text PRIMARY KEY NOT NULL,
	"settlement_run_id" text NOT NULL,
	"booking_link_id" text,
	"booking_id" text,
	"commission_rule_id" text,
	"status" "channel_settlement_item_status" DEFAULT 'pending' NOT NULL,
	"gross_amount_cents" integer DEFAULT 0 NOT NULL,
	"commission_amount_cents" integer DEFAULT 0 NOT NULL,
	"net_remittance_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency_code" text,
	"remittance_due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_settlement_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"contract_id" text,
	"status" "channel_settlement_run_status" DEFAULT 'draft' NOT NULL,
	"currency_code" text,
	"period_start" date,
	"period_end" date,
	"statement_reference" text,
	"generated_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_inventory_allotment_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"allotment_id" text NOT NULL,
	"slot_id" text,
	"start_time_id" text,
	"date_local" date,
	"guaranteed_capacity" integer,
	"max_capacity" integer,
	"sold_capacity" integer,
	"remaining_capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_inventory_allotments" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"contract_id" text,
	"product_id" text NOT NULL,
	"option_id" text,
	"start_time_id" text,
	"valid_from" date,
	"valid_to" date,
	"guaranteed_capacity" integer,
	"max_capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_inventory_release_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"allotment_id" text NOT NULL,
	"release_rule_id" text,
	"target_id" text,
	"slot_id" text,
	"action_taken" "channel_release_execution_action" DEFAULT 'released' NOT NULL,
	"status" "channel_release_execution_status" DEFAULT 'pending' NOT NULL,
	"released_capacity" integer,
	"executed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_inventory_release_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"allotment_id" text NOT NULL,
	"release_mode" "channel_allotment_release_mode" DEFAULT 'automatic' NOT NULL,
	"release_days_before_start" integer,
	"release_hours_before_start" integer,
	"unsold_action" "channel_allotment_unsold_action" DEFAULT 'release_to_general_pool' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_availability_push_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"source_connection_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"product_id" text NOT NULL,
	"option_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_content_push_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"source_connection_id" text NOT NULL,
	"product_id" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"date" date NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"agreement_number" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"renewal_date" date,
	"terms" text,
	"status" "supplier_contract_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_directory_projections" (
	"supplier_id" text NOT NULL,
	"email" text,
	"phone" text,
	"website" text,
	"address" text,
	"city" text,
	"country" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"unit" "rate_unit" NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"min_pax" integer,
	"max_pax" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_services" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"service_type" "service_type" NOT NULL,
	"facility_id" text,
	"name" text NOT NULL,
	"description" text,
	"duration" text,
	"capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "supplier_type" NOT NULL,
	"status" "supplier_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"default_currency" text,
	"payment_terms_days" integer,
	"reservation_timeout_minutes" integer,
	"primary_facility_id" text,
	"customer_payment_policy" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_reconciliation_policies" ADD CONSTRAINT "channel_reconciliation_policies_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reconciliation_policies" ADD CONSTRAINT "channel_reconciliation_policies_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_release_schedules" ADD CONSTRAINT "channel_release_schedules_release_rule_id_channel_inventory_release_rules_id_fk" FOREIGN KEY ("release_rule_id") REFERENCES "public"."channel_inventory_release_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_policies" ADD CONSTRAINT "channel_settlement_policies_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_policies" ADD CONSTRAINT "channel_settlement_policies_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_booking_links" ADD CONSTRAINT "channel_booking_links_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_commission_rules" ADD CONSTRAINT "channel_commission_rules_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_contact_projections" ADD CONSTRAINT "channel_contact_projections_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD CONSTRAINT "channel_contracts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_contracts" ADD CONSTRAINT "channel_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_product_mappings" ADD CONSTRAINT "channel_product_mappings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_webhook_events" ADD CONSTRAINT "channel_webhook_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reconciliation_items" ADD CONSTRAINT "channel_reconciliation_items_reconciliation_run_id_channel_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliation_run_id") REFERENCES "public"."channel_reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reconciliation_items" ADD CONSTRAINT "channel_reconciliation_items_booking_link_id_channel_booking_links_id_fk" FOREIGN KEY ("booking_link_id") REFERENCES "public"."channel_booking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reconciliation_runs" ADD CONSTRAINT "channel_reconciliation_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_reconciliation_runs" ADD CONSTRAINT "channel_reconciliation_runs_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_remittance_exceptions" ADD CONSTRAINT "channel_remittance_exceptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_remittance_exceptions" ADD CONSTRAINT "channel_remittance_exceptions_settlement_item_id_channel_settlement_items_id_fk" FOREIGN KEY ("settlement_item_id") REFERENCES "public"."channel_settlement_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_remittance_exceptions" ADD CONSTRAINT "channel_remittance_exceptions_reconciliation_item_id_channel_reconciliation_items_id_fk" FOREIGN KEY ("reconciliation_item_id") REFERENCES "public"."channel_reconciliation_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_approvals" ADD CONSTRAINT "channel_settlement_approvals_settlement_run_id_channel_settlement_runs_id_fk" FOREIGN KEY ("settlement_run_id") REFERENCES "public"."channel_settlement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_items" ADD CONSTRAINT "channel_settlement_items_settlement_run_id_channel_settlement_runs_id_fk" FOREIGN KEY ("settlement_run_id") REFERENCES "public"."channel_settlement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_items" ADD CONSTRAINT "channel_settlement_items_booking_link_id_channel_booking_links_id_fk" FOREIGN KEY ("booking_link_id") REFERENCES "public"."channel_booking_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_items" ADD CONSTRAINT "channel_settlement_items_commission_rule_id_channel_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."channel_commission_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_runs" ADD CONSTRAINT "channel_settlement_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_settlement_runs" ADD CONSTRAINT "channel_settlement_runs_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_allotment_targets" ADD CONSTRAINT "channel_inventory_allotment_targets_allotment_id_channel_inventory_allotments_id_fk" FOREIGN KEY ("allotment_id") REFERENCES "public"."channel_inventory_allotments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_allotments" ADD CONSTRAINT "channel_inventory_allotments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_allotments" ADD CONSTRAINT "channel_inventory_allotments_contract_id_channel_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."channel_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_release_executions" ADD CONSTRAINT "channel_inventory_release_executions_allotment_id_channel_inventory_allotments_id_fk" FOREIGN KEY ("allotment_id") REFERENCES "public"."channel_inventory_allotments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_release_executions" ADD CONSTRAINT "channel_inventory_release_executions_release_rule_id_channel_inventory_release_rules_id_fk" FOREIGN KEY ("release_rule_id") REFERENCES "public"."channel_inventory_release_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_release_executions" ADD CONSTRAINT "channel_inventory_release_executions_target_id_channel_inventory_allotment_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."channel_inventory_allotment_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_inventory_release_rules" ADD CONSTRAINT "channel_inventory_release_rules_allotment_id_channel_inventory_allotments_id_fk" FOREIGN KEY ("allotment_id") REFERENCES "public"."channel_inventory_allotments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_availability_push_intents" ADD CONSTRAINT "channel_availability_push_intents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_content_push_intents" ADD CONSTRAINT "channel_content_push_intents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_availability" ADD CONSTRAINT "supplier_availability_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_directory_projections" ADD CONSTRAINT "supplier_directory_projections_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_notes" ADD CONSTRAINT "supplier_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_rates" ADD CONSTRAINT "supplier_rates_service_id_supplier_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."supplier_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_services" ADD CONSTRAINT "supplier_services_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bdd_market" ON "booking_distribution_details" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "idx_bdd_source_channel" ON "booking_distribution_details" USING btree ("source_channel_id");--> statement-breakpoint
CREATE INDEX "idx_bdd_fx_rate_set" ON "booking_distribution_details" USING btree ("fx_rate_set_id");--> statement-breakpoint
CREATE INDEX "idx_external_refs_updated" ON "external_refs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_external_refs_entity_updated" ON "external_refs" USING btree ("entity_type","entity_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_external_refs_source_updated" ON "external_refs" USING btree ("source_system","object_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_external_refs_namespace_updated" ON "external_refs" USING btree ("namespace","updated_at");--> statement-breakpoint
CREATE INDEX "idx_external_refs_external_id" ON "external_refs" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_external_refs_status_updated" ON "external_refs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_external_refs_entity_source_external" ON "external_refs" USING btree ("entity_type","entity_id","source_system","namespace","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_external_refs_source_object_external" ON "external_refs" USING btree ("source_system","object_type","namespace","external_id");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_policies_updated" ON "channel_reconciliation_policies" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_policies_channel_updated" ON "channel_reconciliation_policies" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_policies_contract_updated" ON "channel_reconciliation_policies" USING btree ("contract_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_policies_frequency_updated" ON "channel_reconciliation_policies" USING btree ("frequency","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_policies_active_updated" ON "channel_reconciliation_policies" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_release_schedules_updated" ON "channel_release_schedules" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_release_schedules_rule_updated" ON "channel_release_schedules" USING btree ("release_rule_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_release_schedules_kind_updated" ON "channel_release_schedules" USING btree ("schedule_kind","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_release_schedules_active_updated" ON "channel_release_schedules" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_policies_updated" ON "channel_settlement_policies" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_policies_channel_updated" ON "channel_settlement_policies" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_policies_contract_updated" ON "channel_settlement_policies" USING btree ("contract_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_policies_frequency_updated" ON "channel_settlement_policies" USING btree ("frequency","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_policies_active_updated" ON "channel_settlement_policies" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_channel_created" ON "channel_booking_links" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_booking_created" ON "channel_booking_links" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_external_booking_created" ON "channel_booking_links" USING btree ("external_booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_push_status" ON "channel_booking_links" USING btree ("push_status","last_push_at");--> statement-breakpoint
CREATE INDEX "idx_channel_booking_links_booking_item" ON "channel_booking_links" USING btree ("booking_item_id") WHERE "channel_booking_links"."booking_item_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_channel_booking_links_per_item" ON "channel_booking_links" USING btree ("channel_id","booking_id",COALESCE("booking_item_id", ''));--> statement-breakpoint
CREATE INDEX "idx_channel_commission_rules_contract_created" ON "channel_commission_rules" USING btree ("contract_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_commission_rules_product_created" ON "channel_commission_rules" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_commission_rules_scope_created" ON "channel_commission_rules" USING btree ("scope","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_contracts_channel_created" ON "channel_contracts" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_contracts_supplier_created" ON "channel_contracts" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_contracts_status_created" ON "channel_contracts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_product_mappings_channel_created" ON "channel_product_mappings" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_product_mappings_product_created" ON "channel_product_mappings" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_product_mappings_active_created" ON "channel_product_mappings" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_product_mappings_source_connection" ON "channel_product_mappings" USING btree ("source_connection_id");--> statement-breakpoint
CREATE INDEX "idx_channel_webhook_events_channel_received" ON "channel_webhook_events" USING btree ("channel_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_channel_webhook_events_status_received" ON "channel_webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "idx_channel_webhook_events_event_type_received" ON "channel_webhook_events" USING btree ("event_type","received_at");--> statement-breakpoint
CREATE INDEX "idx_channel_webhook_events_external_event" ON "channel_webhook_events" USING btree ("external_event_id");--> statement-breakpoint
CREATE INDEX "idx_channels_created" ON "channels" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_channels_kind_created" ON "channels" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "idx_channels_status_created" ON "channels" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_updated" ON "channel_reconciliation_items" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_run_updated" ON "channel_reconciliation_items" USING btree ("reconciliation_run_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_booking_link_updated" ON "channel_reconciliation_items" USING btree ("booking_link_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_booking_updated" ON "channel_reconciliation_items" USING btree ("booking_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_issue_updated" ON "channel_reconciliation_items" USING btree ("issue_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_items_resolution_updated" ON "channel_reconciliation_items" USING btree ("resolution_status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_runs_updated" ON "channel_reconciliation_runs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_runs_channel_updated" ON "channel_reconciliation_runs" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_runs_contract_updated" ON "channel_reconciliation_runs" USING btree ("contract_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_reconciliation_runs_status_updated" ON "channel_reconciliation_runs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_remittance_exceptions_updated" ON "channel_remittance_exceptions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_remittance_exceptions_channel_updated" ON "channel_remittance_exceptions" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_remittance_exceptions_settlement_item_updated" ON "channel_remittance_exceptions" USING btree ("settlement_item_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_remittance_exceptions_reconciliation_item_updated" ON "channel_remittance_exceptions" USING btree ("reconciliation_item_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_remittance_exceptions_status_updated" ON "channel_remittance_exceptions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_approvals_updated" ON "channel_settlement_approvals" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_approvals_run_updated" ON "channel_settlement_approvals" USING btree ("settlement_run_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_approvals_status_updated" ON "channel_settlement_approvals" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_items_updated" ON "channel_settlement_items" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_items_run_updated" ON "channel_settlement_items" USING btree ("settlement_run_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_items_booking_link_updated" ON "channel_settlement_items" USING btree ("booking_link_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_items_booking_updated" ON "channel_settlement_items" USING btree ("booking_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_items_status_updated" ON "channel_settlement_items" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_runs_updated" ON "channel_settlement_runs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_runs_channel_updated" ON "channel_settlement_runs" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_runs_contract_updated" ON "channel_settlement_runs" USING btree ("contract_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_runs_status_updated" ON "channel_settlement_runs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_settlement_runs_period" ON "channel_settlement_runs" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_updated" ON "channel_inventory_allotment_targets" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_allotment_updated" ON "channel_inventory_allotment_targets" USING btree ("allotment_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_slot_updated" ON "channel_inventory_allotment_targets" USING btree ("slot_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_start_time_updated" ON "channel_inventory_allotment_targets" USING btree ("start_time_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_date_updated" ON "channel_inventory_allotment_targets" USING btree ("date_local","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotment_targets_active_updated" ON "channel_inventory_allotment_targets" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_updated" ON "channel_inventory_allotments" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_channel_updated" ON "channel_inventory_allotments" USING btree ("channel_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_contract_updated" ON "channel_inventory_allotments" USING btree ("contract_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_product_updated" ON "channel_inventory_allotments" USING btree ("product_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_option_updated" ON "channel_inventory_allotments" USING btree ("option_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_start_time_updated" ON "channel_inventory_allotments" USING btree ("start_time_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_allotments_active_updated" ON "channel_inventory_allotments" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_updated" ON "channel_inventory_release_executions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_allotment_updated" ON "channel_inventory_release_executions" USING btree ("allotment_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_rule_updated" ON "channel_inventory_release_executions" USING btree ("release_rule_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_target_updated" ON "channel_inventory_release_executions" USING btree ("target_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_slot_updated" ON "channel_inventory_release_executions" USING btree ("slot_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_executions_status_updated" ON "channel_inventory_release_executions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_rules_updated" ON "channel_inventory_release_rules" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_rules_allotment_updated" ON "channel_inventory_release_rules" USING btree ("allotment_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_channel_inventory_release_rules_mode_updated" ON "channel_inventory_release_rules" USING btree ("release_mode","updated_at");--> statement-breakpoint
CREATE INDEX "idx_chan_avail_push_intents_requested" ON "channel_availability_push_intents" USING btree ("channel_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_chan_avail_push_intents_product" ON "channel_availability_push_intents" USING btree ("product_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_chan_avail_push_intents_per_slot" ON "channel_availability_push_intents" USING btree ("channel_id","slot_id");--> statement-breakpoint
CREATE INDEX "idx_chan_content_push_intents_requested" ON "channel_content_push_intents" USING btree ("channel_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_chan_content_push_intents_per_product" ON "channel_content_push_intents" USING btree ("channel_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_availability_supplier_date" ON "supplier_availability" USING btree ("supplier_id","date");--> statement-breakpoint
CREATE INDEX "idx_supplier_availability_date" ON "supplier_availability" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_supplier_contracts_supplier_created" ON "supplier_contracts" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_contracts_status" ON "supplier_contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_supplier_directory_projections_supplier" ON "supplier_directory_projections" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_notes_supplier_created" ON "supplier_notes" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_rates_service_created" ON "supplier_rates" USING btree ("service_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_rates_validity" ON "supplier_rates" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_supplier_services_supplier_created" ON "supplier_services" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_services_type" ON "supplier_services" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_supplier_services_facility" ON "supplier_services" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "idx_suppliers_created" ON "suppliers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_suppliers_type_created" ON "suppliers" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "idx_suppliers_status_created" ON "suppliers" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_suppliers_primary_facility_created" ON "suppliers" USING btree ("primary_facility_id","created_at");