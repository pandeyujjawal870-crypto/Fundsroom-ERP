import "dotenv/config";
import argon2 from "argon2";
import { count } from "drizzle-orm";
import { pool } from "./client.js";
import { db } from "./index.js";
import { customers, inventory, products, users } from "./schema/index.js";

const requireSeedPassword = (name: "SEED_ADMIN_PASSWORD" | "SEED_SALES_PASSWORD") => {
  const value = process.env[name];
  if (!value || value.startsWith("replace_with_")) {
    throw new Error(`${name} must be set to a strong value before seeding.`);
  }
  return value;
};

const seed = async () => {
  const adminPasswordHash = await argon2.hash(requireSeedPassword("SEED_ADMIN_PASSWORD"), { type: argon2.argon2id });
  const salesPasswordHash = await argon2.hash(requireSeedPassword("SEED_SALES_PASSWORD"), { type: argon2.argon2id });

  const [admin] = await db
    .insert(users)
    .values({ fullName: "Aarav Mehta", email: "admin@fundsroom.local", passwordHash: adminPasswordHash, role: "ADMIN" })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: "Aarav Mehta", passwordHash: adminPasswordHash, role: "ADMIN", isActive: true, updatedAt: new Date() },
    })
    .returning();

  const [salesUser] = await db
    .insert(users)
    .values({ fullName: "Neha Kapoor", email: "sales@fundsroom.local", passwordHash: salesPasswordHash, role: "SALES" })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: "Neha Kapoor", passwordHash: salesPasswordHash, role: "SALES", isActive: true, updatedAt: new Date() },
    })
    .returning();

  const productRows = [
    { productCode: "BRG-6205-2RS", productName: "Deep Groove Ball Bearing 6205-2RS", category: "Bearings", unit: "Each", basePrice: "485.00", physicalQuantity: "320.00" },
    { productCode: "HOS-HYD-12", productName: "Hydraulic Hose Assembly 1/2 in", category: "Hydraulics", unit: "Metre", basePrice: "760.00", physicalQuantity: "180.00" },
    { productCode: "PIP-MS-050", productName: "Mild Steel Pipe 50 mm", category: "Pipes", unit: "Metre", basePrice: "935.00", physicalQuantity: "500.00" },
    { productCode: "ROL-CNV-600", productName: "Conveyor Roller 600 mm", category: "Material Handling", unit: "Each", basePrice: "1280.00", physicalQuantity: "150.00" },
    { productCode: "GBX-HLX-40", productName: "Helical Industrial Gearbox 40:1", category: "Power Transmission", unit: "Each", basePrice: "18500.00", physicalQuantity: "24.00" },
    { productCode: "CYL-PNE-050", productName: "Pneumatic Cylinder 50 mm Bore", category: "Pneumatics", unit: "Each", basePrice: "3425.00", physicalQuantity: "80.00" },
  ];

  for (const product of productRows) {
    const [savedProduct] = await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.productCode,
        set: { productName: product.productName, category: product.category, unit: product.unit, basePrice: product.basePrice, isActive: true, updatedAt: new Date() },
      })
      .returning();

    await db
      .insert(inventory)
      .values({ productId: savedProduct.id, physicalQuantity: product.physicalQuantity, reservedQuantity: "0", updatedBy: admin.id })
      .onConflictDoUpdate({
        target: inventory.productId,
        set: { physicalQuantity: product.physicalQuantity, reservedQuantity: "0", updatedBy: admin.id, updatedAt: new Date() },
      });
  }

  const customerRows = [
    { customerCode: "CUST-ACME-001", companyName: "Acme Engineering Pvt. Ltd.", contactPerson: "Rohan Shah", mobile: "+91-98765-12001", email: "rohan.shah@acmeengineering.example", city: "Pune" },
    { customerCode: "CUST-NOVA-002", companyName: "Nova Process Systems", contactPerson: "Priya Nair", mobile: "+91-98765-12002", email: "priya.nair@novaprocess.example", city: "Mumbai" },
    { customerCode: "CUST-VERT-003", companyName: "Vertex Manufacturing Works", contactPerson: "Karan Singh", mobile: "+91-98765-12003", email: "karan.singh@vertexmfg.example", city: "Ahmedabad" },
  ];

  for (const customer of customerRows) {
    await db
      .insert(customers)
      .values({ ...customer, createdBy: salesUser.id })
      .onConflictDoUpdate({
        target: customers.customerCode,
        set: { ...customer, createdBy: salesUser.id, updatedAt: new Date() },
      });
  }

  const [[userTotal], [productTotal], [customerTotal]] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(products),
    db.select({ value: count() }).from(customers),
  ]);
  console.log(`Seeded ${userTotal.value} users, ${productTotal.value} products with inventory, and ${customerTotal.value} customers.`);
};

try {
  await seed();
  console.log("Database seed completed successfully.");
} finally {
  await pool.end();
}
