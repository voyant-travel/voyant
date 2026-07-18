ALTER TABLE "app_installations" ADD COLUMN "workload_environment_id" text;--> statement-breakpoint
ALTER TABLE "app_installations" ADD COLUMN "contract_generation" integer;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD COLUMN "workload_environment_id" text;--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD COLUMN "contract_generation" integer;--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD COLUMN "workload_environment_id" text;--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD COLUMN "contract_generation" integer;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_tokens" ADD COLUMN "workload_environment_id" text;--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_tokens" ADD COLUMN "contract_generation" integer;--> statement-breakpoint
ALTER TABLE "app_session_tokens" ADD COLUMN "workload_environment_id" text;--> statement-breakpoint
ALTER TABLE "app_session_tokens" ADD COLUMN "contract_generation" integer;--> statement-breakpoint
ALTER TABLE "app_installations" ADD CONSTRAINT "app_installations_managed_binding_complete" CHECK (("workload_environment_id" IS NULL AND "contract_generation" IS NULL) OR ("workload_environment_id" IS NOT NULL AND "contract_generation" > 0));--> statement-breakpoint
ALTER TABLE "app_access_credentials" ADD CONSTRAINT "app_access_credentials_managed_binding_complete" CHECK (("workload_environment_id" IS NULL AND "contract_generation" IS NULL) OR ("workload_environment_id" IS NOT NULL AND "contract_generation" > 0));--> statement-breakpoint
ALTER TABLE "app_oauth_authorization_codes" ADD CONSTRAINT "app_oauth_codes_managed_binding_complete" CHECK (("workload_environment_id" IS NULL AND "contract_generation" IS NULL) OR ("workload_environment_id" IS NOT NULL AND "contract_generation" > 0));--> statement-breakpoint
ALTER TABLE "app_oauth_refresh_tokens" ADD CONSTRAINT "app_oauth_refresh_tokens_managed_binding_complete" CHECK (("workload_environment_id" IS NULL AND "contract_generation" IS NULL) OR ("workload_environment_id" IS NOT NULL AND "contract_generation" > 0));--> statement-breakpoint
ALTER TABLE "app_session_tokens" ADD CONSTRAINT "app_session_tokens_managed_binding_complete" CHECK (("workload_environment_id" IS NULL AND "contract_generation" IS NULL) OR ("workload_environment_id" IS NOT NULL AND "contract_generation" > 0));--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_installations_workload_environment_app" ON "app_installations" USING btree ("workload_environment_id","app_id") WHERE "workload_environment_id" IS NOT NULL;
