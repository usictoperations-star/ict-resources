import type { Request } from "express";

export function parseIdParam(req: Request, param = "id"): number {
  const raw = req.params[param];
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}
