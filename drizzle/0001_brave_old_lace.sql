CREATE TYPE "public"."inventory_adjustment_type" AS ENUM('RECEIVE', 'CORRECTION');--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"adjustment_type" "inventory_adjustment_type" NOT NULL,
	"quantity_delta" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_adjusted_by_users_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_adjustments_product_id_index" ON "inventory_adjustments" USING btree ("product_id");