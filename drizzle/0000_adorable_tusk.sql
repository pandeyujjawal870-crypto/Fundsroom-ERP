CREATE TYPE "public"."enquiry_status" AS ENUM('NEW', 'QUOTED', 'WON', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SALES');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_code" varchar(40) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"contact_person" varchar(150) NOT NULL,
	"mobile" varchar(30) NOT NULL,
	"email" varchar(255) NOT NULL,
	"city" varchar(120) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customer_code_unique" UNIQUE("customer_code")
);
--> statement-breakpoint
CREATE TABLE "dispatch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	CONSTRAINT "dispatch_items_dispatch_product_unique" UNIQUE("dispatch_id","product_id"),
	CONSTRAINT "dispatch_items_quantity_positive" CHECK ("dispatch_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_number" varchar(40) NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"dispatch_date" date NOT NULL,
	"vehicle_number" varchar(50) NOT NULL,
	"driver_name" varchar(150) NOT NULL,
	"dispatched_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispatches_dispatch_number_unique" UNIQUE("dispatch_number"),
	CONSTRAINT "dispatches_sales_order_id_unique" UNIQUE("sales_order_id")
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_number" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"enquiry_date" date NOT NULL,
	"required_date" date NOT NULL,
	"notes" text,
	"status" "enquiry_status" DEFAULT 'NEW' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_enquiry_number_unique" UNIQUE("enquiry_number"),
	CONSTRAINT "enquiries_required_date_after_enquiry_date" CHECK ("enquiries"."required_date" >= "enquiries"."enquiry_date")
);
--> statement-breakpoint
CREATE TABLE "enquiry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	CONSTRAINT "enquiry_items_enquiry_product_unique" UNIQUE("enquiry_id","product_id"),
	CONSTRAINT "enquiry_items_quantity_positive" CHECK ("enquiry_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"physical_quantity" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_physical_quantity_non_negative" CHECK ("inventory"."physical_quantity" >= 0),
	CONSTRAINT "inventory_reserved_quantity_non_negative" CHECK ("inventory"."reserved_quantity" >= 0),
	CONSTRAINT "inventory_reserved_not_above_physical" CHECK ("inventory"."reserved_quantity" <= "inventory"."physical_quantity")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" varchar(50) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"unit" varchar(30) NOT NULL,
	"base_price" numeric(14, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_product_code_unique" UNIQUE("product_code"),
	CONSTRAINT "products_base_price_non_negative" CHECK ("products"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"base_amount" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) NOT NULL,
	"gst_amount" numeric(14, 2) NOT NULL,
	"line_amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "quotation_items_quotation_product_unique" UNIQUE("quotation_id","product_id"),
	CONSTRAINT "quotation_items_quantity_positive" CHECK ("quotation_items"."quantity" > 0),
	CONSTRAINT "quotation_items_unit_price_non_negative" CHECK ("quotation_items"."unit_price" >= 0),
	CONSTRAINT "quotation_items_discount_percent_range" CHECK ("quotation_items"."discount_percent" BETWEEN 0 AND 100),
	CONSTRAINT "quotation_items_gst_percent_range" CHECK ("quotation_items"."gst_percent" BETWEEN 0 AND 100),
	CONSTRAINT "quotation_items_base_amount_non_negative" CHECK ("quotation_items"."base_amount" >= 0),
	CONSTRAINT "quotation_items_discount_amount_non_negative" CHECK ("quotation_items"."discount_amount" >= 0),
	CONSTRAINT "quotation_items_gst_amount_non_negative" CHECK ("quotation_items"."gst_amount" >= 0),
	CONSTRAINT "quotation_items_line_amount_non_negative" CHECK ("quotation_items"."line_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_number" varchar(40) NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"valid_until" date NOT NULL,
	"status" "quotation_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number"),
	CONSTRAINT "quotations_subtotal_non_negative" CHECK ("quotations"."subtotal" >= 0),
	CONSTRAINT "quotations_discount_total_non_negative" CHECK ("quotations"."discount_total" >= 0),
	CONSTRAINT "quotations_gst_total_non_negative" CHECK ("quotations"."gst_total" >= 0),
	CONSTRAINT "quotations_grand_total_non_negative" CHECK ("quotations"."grand_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"base_amount" numeric(14, 2) NOT NULL,
	"discount_amount" numeric(14, 2) NOT NULL,
	"gst_amount" numeric(14, 2) NOT NULL,
	"line_amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "sales_order_items_order_product_unique" UNIQUE("sales_order_id","product_id"),
	CONSTRAINT "sales_order_items_quantity_positive" CHECK ("sales_order_items"."quantity" > 0),
	CONSTRAINT "sales_order_items_unit_price_non_negative" CHECK ("sales_order_items"."unit_price" >= 0),
	CONSTRAINT "sales_order_items_discount_percent_range" CHECK ("sales_order_items"."discount_percent" BETWEEN 0 AND 100),
	CONSTRAINT "sales_order_items_gst_percent_range" CHECK ("sales_order_items"."gst_percent" BETWEEN 0 AND 100),
	CONSTRAINT "sales_order_items_base_amount_non_negative" CHECK ("sales_order_items"."base_amount" >= 0),
	CONSTRAINT "sales_order_items_discount_amount_non_negative" CHECK ("sales_order_items"."discount_amount" >= 0),
	CONSTRAINT "sales_order_items_gst_amount_non_negative" CHECK ("sales_order_items"."gst_amount" >= 0),
	CONSTRAINT "sales_order_items_line_amount_non_negative" CHECK ("sales_order_items"."line_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_number" varchar(40) NOT NULL,
	"quotation_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"status" "sales_order_status" DEFAULT 'PENDING' NOT NULL,
	"created_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_orders_sales_order_number_unique" UNIQUE("sales_order_number"),
	CONSTRAINT "sales_orders_quotation_id_unique" UNIQUE("quotation_id"),
	CONSTRAINT "sales_orders_total_amount_non_negative" CHECK ("sales_orders"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_dispatch_id_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."dispatches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_items" ADD CONSTRAINT "enquiry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiries_customer_id_index" ON "enquiries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_enquiry_id_index" ON "quotations" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "sales_orders_customer_id_index" ON "sales_orders" USING btree ("customer_id");