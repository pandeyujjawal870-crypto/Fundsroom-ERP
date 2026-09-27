import { Router } from "express";
import { confirm, dispatch, getById, list } from "../controllers/sales-order-controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const salesOrderRouter = Router();
salesOrderRouter.use(requireAuth, requireRole("ADMIN", "SALES"));
salesOrderRouter.post("/:id/confirm", requireRole("ADMIN"), asyncHandler(confirm));
salesOrderRouter.post("/:id/dispatch", requireRole("ADMIN"), asyncHandler(dispatch));
salesOrderRouter.get("/", asyncHandler(list));
salesOrderRouter.get("/:id", asyncHandler(getById));
