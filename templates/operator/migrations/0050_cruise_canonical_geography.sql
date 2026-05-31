ALTER TABLE "cruises" ADD COLUMN "region_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "waterway_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "port_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "country_iso" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "waterways" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "ports" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruises" ADD COLUMN "countries" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "region_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "waterway_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "port_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "country_iso" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "waterways" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "ports" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_search_index" ADD COLUMN "countries" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_cruises_region_ids_gin" ON "cruises" USING gin ("region_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_waterway_ids_gin" ON "cruises" USING gin ("waterway_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_port_ids_gin" ON "cruises" USING gin ("port_ids");--> statement-breakpoint
CREATE INDEX "idx_cruises_country_iso_gin" ON "cruises" USING gin ("country_iso");--> statement-breakpoint
CREATE INDEX "idx_cruises_waterways_gin" ON "cruises" USING gin ("waterways");--> statement-breakpoint
CREATE INDEX "idx_cruises_ports_gin" ON "cruises" USING gin ("ports");--> statement-breakpoint
CREATE INDEX "idx_cruises_countries_gin" ON "cruises" USING gin ("countries");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_region_ids_gin" ON "cruise_search_index" USING gin ("region_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_waterway_ids_gin" ON "cruise_search_index" USING gin ("waterway_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_port_ids_gin" ON "cruise_search_index" USING gin ("port_ids");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_country_iso_gin" ON "cruise_search_index" USING gin ("country_iso");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_waterways_gin" ON "cruise_search_index" USING gin ("waterways");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_ports_gin" ON "cruise_search_index" USING gin ("ports");--> statement-breakpoint
CREATE INDEX "idx_cruise_search_index_countries_gin" ON "cruise_search_index" USING gin ("countries");
