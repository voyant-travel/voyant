ALTER TABLE "destinations" ADD COLUMN "canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "cruise_voyage_groups" ADD COLUMN "embark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_voyage_groups" ADD COLUMN "disembark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "embark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "disembark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_sailings" ADD COLUMN "embark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_sailings" ADD COLUMN "disembark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD COLUMN "embark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD COLUMN "disembark_port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_days" ADD COLUMN "port_canonical_place_id" text;--> statement-breakpoint
ALTER TABLE "cruise_sailing_days" ADD COLUMN "port_canonical_place_id" text;--> statement-breakpoint
CREATE INDEX "idx_destinations_canonical_place" ON "destinations" USING btree ("canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_embark_place" ON "cruise_voyage_groups" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_disembark_place" ON "cruise_voyage_groups" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruises_embark_place" ON "cruises" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruises_disembark_place" ON "cruises" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_embark_place" ON "cruise_sailings" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailings_disembark_place" ON "cruise_sailings" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_embark_place" ON "cruise_voyage_group_segments" USING btree ("embark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_disembark_place" ON "cruise_voyage_group_segments" USING btree ("disembark_port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_days_port_place" ON "cruise_days" USING btree ("port_canonical_place_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_sailing_days_port_place" ON "cruise_sailing_days" USING btree ("port_canonical_place_id");
