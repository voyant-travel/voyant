ALTER TABLE "cruise_cabin_categories" ADD COLUMN "feature_codes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_cabin_categories" ADD COLUMN "bed_configurations" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_cabin_categories" ADD COLUMN "accessibility_features" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "cruise_cabin_categories" ADD COLUMN "view_type" text;--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_features_gin" ON "cruise_cabin_categories" USING gin ("feature_codes");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_beds_gin" ON "cruise_cabin_categories" USING gin ("bed_configurations");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_accessibility_gin" ON "cruise_cabin_categories" USING gin ("accessibility_features");--> statement-breakpoint
CREATE INDEX "idx_cruise_cabin_categories_view_type" ON "cruise_cabin_categories" USING btree ("view_type");
