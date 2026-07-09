import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db";
import { RegisterPushTokenBody } from "@workspace/api-zod";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = RegisterPushTokenBody.parse(req.body);

    if (!body.token.startsWith("ExponentPushToken[")) {
      return res.status(400).json({ error: "Invalid Expo push token format" });
    }

    await db
      .insert(pushTokensTable)
      .values({ token: body.token, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { updatedAt: new Date() },
      });

    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error registering push token");
    return res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
