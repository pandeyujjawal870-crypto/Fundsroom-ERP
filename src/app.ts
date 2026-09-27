import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { authRouter } from "./routes/auth-routes.js";
import { customerRouter } from "./routes/customer-routes.js";
import { inventoryRouter } from "./routes/inventory-routes.js";
import { enquiryRouter } from "./routes/enquiry-routes.js";
import { quotationRouter } from "./routes/quotation-routes.js";
import { salesOrderRouter } from "./routes/sales-order-routes.js";

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.get("/health", (_request, response) => response.json({ success: true, data: { status: "ok" } }));
  app.use("/api/auth", authRouter);
  app.use("/api/customers", customerRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/enquiries", enquiryRouter);
  app.use("/api/quotations", quotationRouter);
  app.use("/api/sales-orders", salesOrderRouter);
  app.get("/api/admin/access", requireAuth, requireRole("ADMIN"), (_request, response) => response.json({ success: true, data: { authorized: true } }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
