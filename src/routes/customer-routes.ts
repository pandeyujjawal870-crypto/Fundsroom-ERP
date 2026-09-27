import { Router } from "express";
import { create, getById, list } from "../controllers/customer-controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const customerRouter = Router();
customerRouter.use(requireAuth);
customerRouter.post("/", requireRole("SALES"), asyncHandler(create));
customerRouter.get("/", requireRole("ADMIN", "SALES"), asyncHandler(list));
customerRouter.get("/:id", requireRole("ADMIN", "SALES"), asyncHandler(getById));
