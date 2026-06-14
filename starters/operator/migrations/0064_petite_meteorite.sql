ALTER TABLE "quote_participants" DROP CONSTRAINT "quote_participants_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "supplier_services" DROP CONSTRAINT "supplier_services_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_primary_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_commission_rules" DROP CONSTRAINT "channel_commission_rules_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_product_mappings" DROP CONSTRAINT "channel_product_mappings_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_allotment_targets" DROP CONSTRAINT "channel_inventory_allotment_targets_slot_id_availability_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_allotment_targets" DROP CONSTRAINT "channel_inventory_allotment_targets_start_time_id_availability_start_times_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_allotments" DROP CONSTRAINT "channel_inventory_allotments_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_allotments" DROP CONSTRAINT "channel_inventory_allotments_option_id_product_options_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_allotments" DROP CONSTRAINT "channel_inventory_allotments_start_time_id_availability_start_times_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_inventory_release_executions" DROP CONSTRAINT "channel_inventory_release_executions_slot_id_availability_slots_id_fk";
--> statement-breakpoint
ALTER TABLE "stay_booking_items" DROP CONSTRAINT "stay_booking_items_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "meal_plans" DROP CONSTRAINT "meal_plans_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "room_types" DROP CONSTRAINT "room_types_property_id_properties_id_fk";
