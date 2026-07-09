import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendError } from "../lib/errors";

export type Role = "admin" | "editor" | "analyst" | "viewer";

const ROLE_RANK: Record<string, number> = {
  admin: 4,
  editor: 3,
  analyst: 2,
  viewer: 1,
};

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    sendError(res, 401, "Not authenticated", "UNAUTHENTICATED");
    return;
  }
  try {
    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));
    if (!user) {
      req.session.destroy(() => {});
      sendError(res, 401, "Not authenticated", "UNAUTHENTICATED");
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      sendError(res, 401, "Not authenticated", "UNAUTHENTICATED");
      return;
    }
    const userRole = req.user?.role ?? "viewer";
    const rank = ROLE_RANK[userRole] ?? 0;
    const required = ROLE_RANK[minRole] ?? 0;
    if (rank < required) {
      sendError(res, 403, "Insufficient permissions", "FORBIDDEN");
      return;
    }
    next();
  };
}
