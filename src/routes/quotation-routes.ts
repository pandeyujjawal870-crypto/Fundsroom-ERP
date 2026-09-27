import { Router } from "express";
import { create, getById, list, updateStatus } from "../controllers/quotation-controller.js";
import { convert } from "../controllers/sales-order-controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const quotationRouter = Router();
quotationRouter.use(requireAuth);
quotationRouter.post("/", requireRole("SALES"), asyncHandler(create));
quotationRouter.get("/", requireRole("ADMIN", "SALES"), asyncHandler(list));
quotationRouter.get("/:id", requireRole("ADMIN", "SALES"), asyncHandler(getById));
quotationRouter.post("/:id/convert", requireRole("SALES"), asyncHandler(convert));
quotationRouter.patch("/:id/status", requireRole("SALES"), asyncHandler(updateStatus));
