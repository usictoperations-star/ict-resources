import type { Request } from "express";

export function parseIdParam(req: Request, param = "id"): number {
  const raw = req.params[param];
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

export function parsePagination(req: Request): { limit: number; offset: number } {
  const rawLimit = parseInt(req.query.limit as string, 10);
  const rawOffset = parseInt(req.query.offset as string, 10);
  const limit = Math.min(isNaN(rawLimit) ? 100 : Math.max(rawLimit, 1), 500);
  const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
  return { limit, offset };
}
