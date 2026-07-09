import "./session";
import type { Request } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";

function getClientIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip ?? null;
}

export async function logAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: number,
  entityName: string,
): Promise<void> {
  try {
    const ipAddress = getClientIp(req);
    const userId = (req.session as any).userId as number | null ?? null;
    await db.insert(auditLogsTable).values({
      action,
      entityType,
      entityId,
      entityName,
      userId,
      userName: "System",
      ipAddress,
    });
  } catch {}
}
