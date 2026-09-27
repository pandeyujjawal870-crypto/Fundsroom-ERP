import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "SALES"]);
export const enquiryStatus = pgEnum("enquiry_status", ["NEW", "QUOTED", "WON", "LOST"]);
export const quotationStatus = pgEnum("quotation_status", ["DRAFT", "SENT", "ACCEPTED", "REJECTED"]);
export const salesOrderStatus = pgEnum("sales_order_status", ["PENDING", "CONFIRMED", "DISPATCHED", "CANCELLED"]);
export const inventoryAdjustmentType = pgEnum("inventory_adjustment_type", ["RECEIVE", "CORRECTION"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const quantity = (name: string) => numeric(name, { precision: 14, scale: 2 });
const percentage = (name: string) => numeric(name, { precision: 5, scale: 2 });
const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerCode: varchar("customer_code", { length: 40 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    contactPerson: varchar("contact_person", { length: 150 }).notNull(),
    mobile: varchar("mobile", { length: 30 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (table) => [unique("customers_customer_code_unique").on(table.customerCode)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productCode: varchar("product_code", { length: 50 }).notNull(),
    productName: varchar("product_name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 30 }).notNull(),
    basePrice: money("base_price").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    unique("products_product_code_unique").on(table.productCode),
    check("products_base_price_non_negative", sql`${table.basePrice} >= 0`),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    productId: uuid("product_id").primaryKey().references(() => products.id, { onDelete: "restrict" }),
    physicalQuantity: quantity("physical_quantity").notNull().default("0"),
    reservedQuantity: quantity("reserved_quantity").notNull().default("0"),
    updatedBy: uuid("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("inventory_physical_quantity_non_negative", sql`${table.physicalQuantity} >= 0`),
    check("inventory_reserved_quantity_non_negative", sql`${table.reservedQuantity} >= 0`),
    check("inventory_reserved_not_above_physical", sql`${table.reservedQuantity} <= ${table.physicalQuantity}`),
  ],
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    adjustmentType: inventoryAdjustmentType("adjustment_type").notNull(),
    quantityDelta: quantity("quantity_delta").notNull(),
    reason: text("reason").notNull(),
    adjustedBy: uuid("adjusted_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inventory_adjustments_product_id_index").on(table.productId)],
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enquiryNumber: varchar("enquiry_number", { length: 40 }).notNull(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    enquiryDate: date("enquiry_date").notNull(),
    requiredDate: date("required_date").notNull(),
    notes: text("notes"),
    status: enquiryStatus("status").notNull().default("NEW"),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (table) => [
    unique("enquiries_enquiry_number_unique").on(table.enquiryNumber),
    check("enquiries_required_date_after_enquiry_date", sql`${table.requiredDate} >= ${table.enquiryDate}`),
    index("enquiries_customer_id_index").on(table.customerId),
  ],
);

export const enquiryItems = pgTable(
  "enquiry_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enquiryId: uuid("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
  },
  (table) => [
    unique("enquiry_items_enquiry_product_unique").on(table.enquiryId, table.productId),
    check("enquiry_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationNumber: varchar("quotation_number", { length: 40 }).notNull(),
    enquiryId: uuid("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    validUntil: date("valid_until").notNull(),
    status: quotationStatus("status").notNull().default("DRAFT"),
    subtotal: money("subtotal").notNull().default("0"),
    discountTotal: money("discount_total").notNull().default("0"),
    gstTotal: money("gst_total").notNull().default("0"),
    grandTotal: money("grand_total").notNull().default("0"),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (table) => [
    unique("quotations_quotation_number_unique").on(table.quotationNumber),
    check("quotations_subtotal_non_negative", sql`${table.subtotal} >= 0`),
    check("quotations_discount_total_non_negative", sql`${table.discountTotal} >= 0`),
    check("quotations_gst_total_non_negative", sql`${table.gstTotal} >= 0`),
    check("quotations_grand_total_non_negative", sql`${table.grandTotal} >= 0`),
    index("quotations_enquiry_id_index").on(table.enquiryId),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quotationId: uuid("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    discountPercent: percentage("discount_percent").notNull().default("0"),
    gstPercent: percentage("gst_percent").notNull().default("0"),
    baseAmount: money("base_amount").notNull(),
    discountAmount: money("discount_amount").notNull(),
    gstAmount: money("gst_amount").notNull(),
    lineAmount: money("line_amount").notNull(),
  },
  (table) => [
    unique("quotation_items_quotation_product_unique").on(table.quotationId, table.productId),
    check("quotation_items_quantity_positive", sql`${table.quantity} > 0`),
    check("quotation_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("quotation_items_discount_percent_range", sql`${table.discountPercent} BETWEEN 0 AND 100`),
    check("quotation_items_gst_percent_range", sql`${table.gstPercent} BETWEEN 0 AND 100`),
    check("quotation_items_base_amount_non_negative", sql`${table.baseAmount} >= 0`),
    check("quotation_items_discount_amount_non_negative", sql`${table.discountAmount} >= 0`),
    check("quotation_items_gst_amount_non_negative", sql`${table.gstAmount} >= 0`),
    check("quotation_items_line_amount_non_negative", sql`${table.lineAmount} >= 0`),
  ],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderNumber: varchar("sales_order_number", { length: 40 }).notNull(),
    quotationId: uuid("quotation_id").notNull().references(() => quotations.id, { onDelete: "restrict" }),
    enquiryId: uuid("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    orderDate: date("order_date").notNull(),
    totalAmount: money("total_amount").notNull(),
    status: salesOrderStatus("status").notNull().default("PENDING"),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    confirmedBy: uuid("confirmed_by").references(() => users.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    unique("sales_orders_sales_order_number_unique").on(table.salesOrderNumber),
    unique("sales_orders_quotation_id_unique").on(table.quotationId),
    check("sales_orders_total_amount_non_negative", sql`${table.totalAmount} >= 0`),
    index("sales_orders_customer_id_index").on(table.customerId),
  ],
);

export const salesOrderItems = pgTable(
  "sales_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesOrderId: uuid("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    discountPercent: percentage("discount_percent").notNull().default("0"),
    gstPercent: percentage("gst_percent").notNull().default("0"),
    baseAmount: money("base_amount").notNull(),
    discountAmount: money("discount_amount").notNull(),
    gstAmount: money("gst_amount").notNull(),
    lineAmount: money("line_amount").notNull(),
  },
  (table) => [
    unique("sales_order_items_order_product_unique").on(table.salesOrderId, table.productId),
    check("sales_order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("sales_order_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
    check("sales_order_items_discount_percent_range", sql`${table.discountPercent} BETWEEN 0 AND 100`),
    check("sales_order_items_gst_percent_range", sql`${table.gstPercent} BETWEEN 0 AND 100`),
    check("sales_order_items_base_amount_non_negative", sql`${table.baseAmount} >= 0`),
    check("sales_order_items_discount_amount_non_negative", sql`${table.discountAmount} >= 0`),
    check("sales_order_items_gst_amount_non_negative", sql`${table.gstAmount} >= 0`),
    check("sales_order_items_line_amount_non_negative", sql`${table.lineAmount} >= 0`),
  ],
);

export const dispatches = pgTable(
  "dispatches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatchNumber: varchar("dispatch_number", { length: 40 }).notNull(),
    salesOrderId: uuid("sales_order_id").notNull().references(() => salesOrders.id, { onDelete: "restrict" }),
    dispatchDate: date("dispatch_date").notNull(),
    vehicleNumber: varchar("vehicle_number", { length: 50 }).notNull(),
    driverName: varchar("driver_name", { length: 150 }).notNull(),
    dispatchedBy: uuid("dispatched_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (table) => [
    unique("dispatches_dispatch_number_unique").on(table.dispatchNumber),
    unique("dispatches_sales_order_id_unique").on(table.salesOrderId),
  ],
);

export const dispatchItems = pgTable(
  "dispatch_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatchId: uuid("dispatch_id").notNull().references(() => dispatches.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: quantity("quantity").notNull(),
  },
  (table) => [
    unique("dispatch_items_dispatch_product_unique").on(table.dispatchId, table.productId),
    check("dispatch_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
