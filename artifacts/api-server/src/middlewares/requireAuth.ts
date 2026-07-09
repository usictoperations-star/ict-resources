import type { Request, Response, NextFunction } from "express";

export type Role = "admin" | "editor" | "analyst" | "viewer";

const ROLE_RANK: Record<string, number> = {
  admin: 4,
  editor: 3,
  analyst: 2,
  viewer: 1,
};

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userRole = (req as any).userRole as string | undefined;
    const rank = ROLE_RANK[userRole ?? ""] ?? 0;
    const required = ROLE_RANK[minRole] ?? 0;
    if (rank < required) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
