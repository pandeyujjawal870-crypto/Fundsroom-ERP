import { Router } from "express";
import { login, me } from "../controllers/auth-controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const authRouter = Router();
authRouter.post("/login", asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(me));
