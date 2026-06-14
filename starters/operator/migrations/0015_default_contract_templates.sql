ALTER TABLE "contract_templates" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_contract_templates_channel" ON "contract_templates" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_contract_templates_default_selector" ON "contract_templates" USING btree ("scope","channel_id","language","is_default","active");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_contract_templates_default_global" ON "contract_templates" USING btree ("scope","language") WHERE "contract_templates"."is_default" = true AND "contract_templates"."channel_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_contract_templates_default_channel" ON "contract_templates" USING btree ("scope","channel_id","language") WHERE "contract_templates"."is_default" = true AND "contract_templates"."channel_id" IS NOT NULL;
