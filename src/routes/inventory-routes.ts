import { Router } from "express";
import { adjust, availability } from "../controllers/inventory-controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const inventoryRouter = Router();
inventoryRouter.get("/availability", requireAuth, requireRole("ADMIN", "SALES"), asyncHandler(availability));
inventoryRouter.patch("/:productId/adjust", requireAuth, requireRole("ADMIN"), asyncHandler(adjust));
