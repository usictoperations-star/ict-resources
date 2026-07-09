import type { Response } from "express";

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
};

export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string,
): Response {
  return res.status(status).json({
    error: message,
    code: code ?? STATUS_CODES[status] ?? "ERROR",
  });
}
