CREATE TABLE "storefront_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"storefront_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_preview" text NOT NULL,
	"name" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefront_customer_auth_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"storefront_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_credentials" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefronts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"hosting_kind" text DEFAULT 'external' NOT NULL,
	"site_id" text,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"methods" jsonb NOT NULL,
	"account_policy" jsonb DEFAULT '{"allowedKinds":["personal"],"personalSignup":"open","businessOnboarding":"disabled"}'::jsonb NOT NULL,
	"host_only_cookies" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storefront_api_keys" ADD CONSTRAINT "storefront_api_keys_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefronts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_api_keys" ADD CONSTRAINT "storefront_api_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_customer_auth_credentials" ADD CONSTRAINT "storefront_customer_auth_credentials_storefront_id_storefronts_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefronts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_customer_auth_credentials" ADD CONSTRAINT "storefront_customer_auth_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_api_keys_token_hash_unique" ON "storefront_api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "storefront_api_keys_storefront_idx" ON "storefront_api_keys" USING btree ("storefront_id");--> statement-breakpoint
CREATE INDEX "storefront_api_keys_org_idx" ON "storefront_api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_customer_auth_credentials_storefront_provider_unique" ON "storefront_customer_auth_credentials" USING btree ("storefront_id","provider");--> statement-breakpoint
CREATE INDEX "storefront_customer_auth_credentials_org_idx" ON "storefront_customer_auth_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storefronts_org_slug_unique" ON "storefronts" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "storefronts_org_idx" ON "storefronts" USING btree ("organization_id");