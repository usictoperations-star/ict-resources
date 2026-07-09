import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendError } from "../lib/errors";

const router = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});

router.post("/auth/login", loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, "Email and password are required");
      return;
    }
    const { email, password } = parsed.data;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      sendError(res, 401, "Invalid email or password");
      return;
    }

    if (user.status !== "Active" && user.status !== "active") {
      sendError(res, 401, "Account is inactive. Contact an administrator.");
      return;
    }

    if (!user.passwordHash) {
      sendError(res, 401, "Account has no password set. Contact an administrator.");
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      sendError(res, 401, "Invalid email or password");
      return;
    }

    await db.update(usersTable)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(usersTable.id, user.id));

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        logger.error({ err }, "Session save error");
        sendError(res, 500, "Session error");
        return;
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        status: user.status,
      });
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    sendError(res, 500, "Internal server error");
  }
});

router.post("/auth/logout", (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destroy error");
    }
    res.clearCookie("mk.sid");
    res.sendStatus(204);
  });
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.session.userId) {
      sendError(res, 401, "Not authenticated");
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
    if (!user) {
      req.session.destroy(() => {});
      sendError(res, 401, "Not authenticated");
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      status: user.status,
    });
  } catch (err) {
    logger.error({ err }, "Auth/me error");
    sendError(res, 500, "Internal server error");
  }
});

export default router;
