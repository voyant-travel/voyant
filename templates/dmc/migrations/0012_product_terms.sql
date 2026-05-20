ALTER TABLE "products" ADD COLUMN "terms_html" text;
ALTER TABLE "products" ADD COLUMN "terms_show_on_contract" boolean DEFAULT false NOT NULL;
ALTER TABLE "product_translations" ADD COLUMN "terms_html" text;
