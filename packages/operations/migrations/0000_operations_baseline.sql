DO $$ BEGIN
 CREATE TYPE "public"."ground_assignment_source" AS ENUM('manual', 'suggested', 'auto');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_checkpoint_status" AS ENUM('pending', 'reached', 'missed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_dispatch_leg_type" AS ENUM('pickup', 'stop', 'dropoff', 'deadhead');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_dispatch_status" AS ENUM('draft', 'scheduled', 'assigned', 'en_route', 'arrived', 'picked_up', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_driver_shift_status" AS ENUM('scheduled', 'available', 'on_duty', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_execution_event_type" AS ENUM('scheduled', 'assigned', 'driver_en_route', 'driver_arrived', 'pickup_completed', 'dropoff_completed', 'cancelled', 'issue', 'note');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_incident_resolution_status" AS ENUM('open', 'mitigated', 'resolved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_incident_severity" AS ENUM('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_service_level" AS ENUM('private', 'shared', 'vip', 'shuttle', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_vehicle_category" AS ENUM('car', 'sedan', 'suv', 'van', 'minibus', 'bus', 'boat', 'train', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ground_vehicle_class" AS ENUM('economy', 'standard', 'premium', 'luxury', 'accessible', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."facility_day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."facility_feature_category" AS ENUM('amenity', 'accessibility', 'security', 'service', 'policy', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."facility_kind" AS ENUM('property', 'hotel', 'resort', 'venue', 'meeting_point', 'transfer_hub', 'airport', 'station', 'marina', 'camp', 'lodge', 'office', 'attraction', 'restaurant', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."facility_owner_type" AS ENUM('supplier', 'organization', 'internal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."facility_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."property_group_membership_role" AS ENUM('member', 'flagship', 'managed', 'franchise', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."property_group_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."property_group_type" AS ENUM('chain', 'brand', 'management_company', 'collection', 'portfolio', 'cluster', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."property_type" AS ENUM('hotel', 'resort', 'villa', 'apartment', 'hostel', 'lodge', 'camp', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."resource_allocation_mode" AS ENUM('shared', 'exclusive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."resource_assignment_status" AS ENUM('reserved', 'assigned', 'released', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."resource_kind" AS ENUM('guide', 'vehicle', 'room', 'boat', 'equipment', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "ground_dispatches" (
	"id" text PRIMARY KEY NOT NULL,
	"transfer_preference_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"booking_item_id" text,
	"operator_id" text,
	"vehicle_id" text,
	"driver_id" text,
	"service_date" date,
	"scheduled_pickup_at" timestamp with time zone,
	"scheduled_dropoff_at" timestamp with time zone,
	"actual_pickup_at" timestamp with time zone,
	"actual_dropoff_at" timestamp with time zone,
	"status" "ground_dispatch_status" DEFAULT 'draft' NOT NULL,
	"passenger_count" integer,
	"checked_bags" integer,
	"carry_on_bags" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_transfer_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"booking_item_id" text,
	"pickup_facility_id" text,
	"dropoff_facility_id" text,
	"pickup_address_id" text,
	"dropoff_address_id" text,
	"requested_vehicle_category" "ground_vehicle_category",
	"requested_vehicle_class" "ground_vehicle_class",
	"service_level" "ground_service_level" DEFAULT 'private' NOT NULL,
	"passenger_count" integer,
	"checked_bags" integer,
	"carry_on_bags" integer,
	"wheelchair_count" integer,
	"child_seat_count" integer,
	"driver_language" text,
	"meet_and_greet" boolean DEFAULT false NOT NULL,
	"accessibility_notes" text,
	"pickup_notes" text,
	"dropoff_notes" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_dispatch_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"operator_id" text,
	"vehicle_id" text,
	"driver_id" text,
	"assignment_source" "ground_assignment_source" DEFAULT 'manual' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_dispatch_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"checkpoint_type" text NOT NULL,
	"status" "ground_checkpoint_status" DEFAULT 'pending' NOT NULL,
	"planned_at" timestamp with time zone,
	"actual_at" timestamp with time zone,
	"facility_id" text,
	"address_id" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_dispatch_legs" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"leg_type" "ground_dispatch_leg_type" DEFAULT 'pickup' NOT NULL,
	"facility_id" text,
	"address_id" text,
	"scheduled_at" timestamp with time zone,
	"actual_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_dispatch_passengers" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"participant_id" text,
	"display_name" text,
	"seat_label" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_driver_shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_id" text NOT NULL,
	"operator_id" text,
	"facility_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "ground_driver_shift_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_execution_events" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"event_type" "ground_execution_event_type" DEFAULT 'note' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"facility_id" text,
	"address_id" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_service_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"dispatch_id" text NOT NULL,
	"severity" "ground_incident_severity" DEFAULT 'warning' NOT NULL,
	"incident_type" text NOT NULL,
	"resolution_status" "ground_incident_resolution_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"operator_id" text,
	"license_number" text,
	"spoken_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_guide" boolean DEFAULT false NOT NULL,
	"is_meet_and_greet_capable" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_operators" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"facility_id" text,
	"name" text NOT NULL,
	"code" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ground_vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"operator_id" text,
	"category" "ground_vehicle_category" DEFAULT 'other' NOT NULL,
	"vehicle_class" "ground_vehicle_class" DEFAULT 'standard' NOT NULL,
	"passenger_capacity" integer,
	"checked_bag_capacity" integer,
	"carry_on_capacity" integer,
	"wheelchair_capacity" integer,
	"child_seat_capacity" integer,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_facility_id" text,
	"owner_type" "facility_owner_type",
	"owner_id" text,
	"kind" "facility_kind" NOT NULL,
	"status" "facility_status" DEFAULT 'active' NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"timezone" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_address_projections" (
	"facility_id" text PRIMARY KEY NOT NULL,
	"address_id" text,
	"full_text" text,
	"line1" text,
	"line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text,
	"latitude" double precision,
	"longitude" double precision,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_features" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"category" "facility_feature_category" DEFAULT 'amenity' NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"value_text" text,
	"highlighted" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_operation_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"day_of_week" "facility_day_of_week",
	"valid_from" date,
	"valid_to" date,
	"opens_at" text,
	"closes_at" text,
	"closed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"property_type" "property_type" DEFAULT 'hotel' NOT NULL,
	"brand_name" text,
	"group_name" text,
	"rating" integer,
	"rating_scale" integer,
	"check_in_time" text,
	"check_out_time" text,
	"policy_notes" text,
	"amenity_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"property_id" text NOT NULL,
	"membership_role" "property_group_membership_role" DEFAULT 'member' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_group_id" text,
	"group_type" "property_group_type" DEFAULT 'chain' NOT NULL,
	"status" "property_group_status" DEFAULT 'active' NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"brand_name" text,
	"legal_name" text,
	"website" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"product_id" text NOT NULL,
	"availability_rule_id" text,
	"start_time_id" text,
	"quantity_required" integer DEFAULT 1 NOT NULL,
	"allocation_mode" "resource_allocation_mode" DEFAULT 'shared' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_closeouts" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"date_local" date NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_pool_members" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text,
	"kind" "resource_kind" NOT NULL,
	"name" text NOT NULL,
	"shared_capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_slot_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"slot_id" text NOT NULL,
	"pool_id" text,
	"resource_id" text,
	"booking_id" text,
	"status" "resource_assignment_status" DEFAULT 'reserved' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" text,
	"released_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"facility_id" text,
	"kind" "resource_kind" NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ground_dispatches" ADD CONSTRAINT "ground_dispatches_transfer_preference_id_ground_transfer_preferences_id_fk" FOREIGN KEY ("transfer_preference_id") REFERENCES "public"."ground_transfer_preferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatches" ADD CONSTRAINT "ground_dispatches_operator_id_ground_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."ground_operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatches" ADD CONSTRAINT "ground_dispatches_vehicle_id_ground_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."ground_vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatches" ADD CONSTRAINT "ground_dispatches_driver_id_ground_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."ground_drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_transfer_preferences" ADD CONSTRAINT "ground_transfer_preferences_pickup_address_id_identity_addresses_id_fk" FOREIGN KEY ("pickup_address_id") REFERENCES "public"."identity_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_transfer_preferences" ADD CONSTRAINT "ground_transfer_preferences_dropoff_address_id_identity_addresses_id_fk" FOREIGN KEY ("dropoff_address_id") REFERENCES "public"."identity_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_assignments" ADD CONSTRAINT "ground_dispatch_assignments_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_assignments" ADD CONSTRAINT "ground_dispatch_assignments_operator_id_ground_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."ground_operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_assignments" ADD CONSTRAINT "ground_dispatch_assignments_vehicle_id_ground_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."ground_vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_assignments" ADD CONSTRAINT "ground_dispatch_assignments_driver_id_ground_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."ground_drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_checkpoints" ADD CONSTRAINT "ground_dispatch_checkpoints_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_checkpoints" ADD CONSTRAINT "ground_dispatch_checkpoints_address_id_identity_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."identity_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_legs" ADD CONSTRAINT "ground_dispatch_legs_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_legs" ADD CONSTRAINT "ground_dispatch_legs_address_id_identity_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."identity_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_dispatch_passengers" ADD CONSTRAINT "ground_dispatch_passengers_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_driver_shifts" ADD CONSTRAINT "ground_driver_shifts_driver_id_ground_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."ground_drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_driver_shifts" ADD CONSTRAINT "ground_driver_shifts_operator_id_ground_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."ground_operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_execution_events" ADD CONSTRAINT "ground_execution_events_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_execution_events" ADD CONSTRAINT "ground_execution_events_address_id_identity_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."identity_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_service_incidents" ADD CONSTRAINT "ground_service_incidents_dispatch_id_ground_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."ground_dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_drivers" ADD CONSTRAINT "ground_drivers_operator_id_ground_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."ground_operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ground_vehicles" ADD CONSTRAINT "ground_vehicles_operator_id_ground_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."ground_operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_parent_facility_id_facilities_id_fk" FOREIGN KEY ("parent_facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_address_projections" ADD CONSTRAINT "facility_address_projections_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_features" ADD CONSTRAINT "facility_features_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_operation_schedules" ADD CONSTRAINT "facility_operation_schedules_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_group_members" ADD CONSTRAINT "property_group_members_group_id_property_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_group_members" ADD CONSTRAINT "property_group_members_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_groups" ADD CONSTRAINT "property_groups_parent_group_id_property_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."property_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_requirements" ADD CONSTRAINT "resource_requirements_pool_id_resource_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."resource_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_closeouts" ADD CONSTRAINT "resource_closeouts_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pool_members" ADD CONSTRAINT "resource_pool_members_pool_id_resource_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."resource_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pool_members" ADD CONSTRAINT "resource_pool_members_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_slot_assignments" ADD CONSTRAINT "resource_slot_assignments_pool_id_resource_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."resource_pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_slot_assignments" ADD CONSTRAINT "resource_slot_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_preference_service_date_created" ON "ground_dispatches" USING btree ("transfer_preference_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_booking_service_date_created" ON "ground_dispatches" USING btree ("booking_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_booking_item_service_date_created" ON "ground_dispatches" USING btree ("booking_item_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_operator_service_date_created" ON "ground_dispatches" USING btree ("operator_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_vehicle_service_date_created" ON "ground_dispatches" USING btree ("vehicle_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_driver_service_date_created" ON "ground_dispatches" USING btree ("driver_id","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_status_service_date_created" ON "ground_dispatches" USING btree ("status","service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatches_service_date_created" ON "ground_dispatches" USING btree ("service_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_transfer_preferences_booking_created" ON "ground_transfer_preferences" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_transfer_preferences_booking_item_created" ON "ground_transfer_preferences" USING btree ("booking_item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_transfer_preferences_pickup_facility_created" ON "ground_transfer_preferences" USING btree ("pickup_facility_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_transfer_preferences_dropoff_facility_created" ON "ground_transfer_preferences" USING btree ("dropoff_facility_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_transfer_preferences_service_level_created" ON "ground_transfer_preferences" USING btree ("service_level","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_assignments_dispatch_assigned" ON "ground_dispatch_assignments" USING btree ("dispatch_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_assignments_operator_assigned" ON "ground_dispatch_assignments" USING btree ("operator_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_assignments_vehicle_assigned" ON "ground_dispatch_assignments" USING btree ("vehicle_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_assignments_driver_assigned" ON "ground_dispatch_assignments" USING btree ("driver_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_assignments_source_assigned" ON "ground_dispatch_assignments" USING btree ("assignment_source","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_checkpoints_dispatch_sequence" ON "ground_dispatch_checkpoints" USING btree ("dispatch_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_checkpoints_status_sequence" ON "ground_dispatch_checkpoints" USING btree ("status","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_checkpoints_facility_sequence" ON "ground_dispatch_checkpoints" USING btree ("facility_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_legs_dispatch_sequence" ON "ground_dispatch_legs" USING btree ("dispatch_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_legs_type_sequence" ON "ground_dispatch_legs" USING btree ("leg_type","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_legs_facility_sequence" ON "ground_dispatch_legs" USING btree ("facility_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_passengers_dispatch_created" ON "ground_dispatch_passengers" USING btree ("dispatch_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_dispatch_passengers_participant_created" ON "ground_dispatch_passengers" USING btree ("participant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_driver_shifts_starts_at" ON "ground_driver_shifts" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_ground_driver_shifts_driver_starts_at" ON "ground_driver_shifts" USING btree ("driver_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_ground_driver_shifts_operator_starts_at" ON "ground_driver_shifts" USING btree ("operator_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_ground_driver_shifts_facility_starts_at" ON "ground_driver_shifts" USING btree ("facility_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_ground_driver_shifts_status_starts_at" ON "ground_driver_shifts" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "idx_ground_execution_events_dispatch_occurred_created" ON "ground_execution_events" USING btree ("dispatch_id","occurred_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_execution_events_type_occurred_created" ON "ground_execution_events" USING btree ("event_type","occurred_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_execution_events_facility_occurred_created" ON "ground_execution_events" USING btree ("facility_id","occurred_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_execution_events_occurred_at" ON "ground_execution_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_ground_service_incidents_dispatch_opened" ON "ground_service_incidents" USING btree ("dispatch_id","opened_at");--> statement-breakpoint
CREATE INDEX "idx_ground_service_incidents_severity_opened" ON "ground_service_incidents" USING btree ("severity","opened_at");--> statement-breakpoint
CREATE INDEX "idx_ground_service_incidents_resolution_opened" ON "ground_service_incidents" USING btree ("resolution_status","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ground_drivers_resource" ON "ground_drivers" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_ground_drivers_created" ON "ground_drivers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_drivers_operator_created" ON "ground_drivers" USING btree ("operator_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_drivers_active_created" ON "ground_drivers" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_operators_name_created" ON "ground_operators" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_operators_supplier_name_created" ON "ground_operators" USING btree ("supplier_id","name","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_operators_facility_name_created" ON "ground_operators" USING btree ("facility_id","name","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_operators_active_name_created" ON "ground_operators" USING btree ("active","name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ground_vehicles_resource" ON "ground_vehicles" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_ground_vehicles_created" ON "ground_vehicles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_vehicles_operator_created" ON "ground_vehicles" USING btree ("operator_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_vehicles_category_created" ON "ground_vehicles" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "idx_ground_vehicles_active_created" ON "ground_vehicles" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "idx_facilities_parent_updated" ON "facilities" USING btree ("parent_facility_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_facilities_owner_updated" ON "facilities" USING btree ("owner_type","owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_facilities_owner_id_updated" ON "facilities" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_facilities_kind_updated" ON "facilities" USING btree ("kind","updated_at");--> statement-breakpoint
CREATE INDEX "idx_facilities_status_updated" ON "facilities" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_facilities_code" ON "facilities" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_facility_address_projections_country" ON "facility_address_projections" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_facility_address_projections_city_country" ON "facility_address_projections" USING btree ("city","country");--> statement-breakpoint
CREATE INDEX "idx_facility_features_facility_sort_name" ON "facility_features" USING btree ("facility_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_facility_features_category_sort_name" ON "facility_features" USING btree ("category","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_facility_features_facility_category_sort_name" ON "facility_features" USING btree ("facility_id","category","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_facility_operation_schedules_facility_day_valid" ON "facility_operation_schedules" USING btree ("facility_id","day_of_week","valid_from");--> statement-breakpoint
CREATE INDEX "idx_facility_operation_schedules_day_valid" ON "facility_operation_schedules" USING btree ("day_of_week","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_properties_facility" ON "properties" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "idx_properties_updated" ON "properties" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_properties_type_updated" ON "properties" USING btree ("property_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_properties_group_updated" ON "properties" USING btree ("group_name","updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_group_members_group_updated" ON "property_group_members" USING btree ("group_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_group_members_updated" ON "property_group_members" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_group_members_property_updated" ON "property_group_members" USING btree ("property_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_group_members_role_updated" ON "property_group_members" USING btree ("membership_role","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_property_group_members_pair" ON "property_group_members" USING btree ("group_id","property_id");--> statement-breakpoint
CREATE INDEX "idx_property_groups_parent_updated" ON "property_groups" USING btree ("parent_group_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_groups_updated" ON "property_groups" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_groups_type_updated" ON "property_groups" USING btree ("group_type","updated_at");--> statement-breakpoint
CREATE INDEX "idx_property_groups_status_updated" ON "property_groups" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_property_groups_code" ON "property_groups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_resource_requirements_pool_priority_created" ON "resource_requirements" USING btree ("pool_id","priority","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_requirements_product_priority_created" ON "resource_requirements" USING btree ("product_id","priority","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_requirements_rule_priority_created" ON "resource_requirements" USING btree ("availability_rule_id","priority","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_requirements_start_time_priority_created" ON "resource_requirements" USING btree ("start_time_id","priority","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_closeouts_resource_created" ON "resource_closeouts" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_closeouts_date_created" ON "resource_closeouts" USING btree ("date_local","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pool_members_created" ON "resource_pool_members" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pool_members_pool_created" ON "resource_pool_members" USING btree ("pool_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pool_members_resource_created" ON "resource_pool_members" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pools_created" ON "resource_pools" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pools_product_created" ON "resource_pools" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pools_kind_created" ON "resource_pools" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_pools_active_created" ON "resource_pools" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_slot_assignments_slot_assigned" ON "resource_slot_assignments" USING btree ("slot_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_resource_slot_assignments_pool_assigned" ON "resource_slot_assignments" USING btree ("pool_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_resource_slot_assignments_resource_assigned" ON "resource_slot_assignments" USING btree ("resource_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_resource_slot_assignments_booking_assigned" ON "resource_slot_assignments" USING btree ("booking_id","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_resource_slot_assignments_status_assigned" ON "resource_slot_assignments" USING btree ("status","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_resources_created" ON "resources" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_resources_supplier_created" ON "resources" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resources_facility_created" ON "resources" USING btree ("facility_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_resources_kind_created" ON "resources" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "idx_resources_active_created" ON "resources" USING btree ("active","created_at");