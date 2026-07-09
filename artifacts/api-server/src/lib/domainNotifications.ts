import { db } from "@workspace/db";
import {
  domainsTable,
  pushTokensTable,
  domainNotificationStatesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

type UrgencyLevel = "expired" | "critical" | "ok";

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function getDomainUrgency(domain: {
  sslExpiry: string | null;
  registrationExpiry: string | null;
}): UrgencyLevel {
  const expiry = domain.sslExpiry || domain.registrationExpiry;
  if (!expiry) return "ok";
  const days = getDaysUntil(expiry);
  if (days < 0) return "expired";
  if (days < 7) return "critical";
  return "ok";
}

function buildNotificationMessage(
  domainName: string,
  urgency: "expired" | "critical",
  expiry: string | null
): { title: string; body: string } {
  const days = expiry ? getDaysUntil(expiry) : null;
  const daysStr =
    days == null
      ? ""
      : days < 0
        ? ` – expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
        : ` – expires in ${days} day${days === 1 ? "" : "s"}`;

  return {
    title: urgency === "expired" ? "Domain Expired" : "Domain Expiring Soon",
    body: `${domainName}${daysStr}`,
  };
}

async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: "default",
  }));

  try {
    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push API returned non-OK status");
    }
  } catch (err) {
    logger.error({ err }, "Failed to call Expo push API");
  }
}

export async function checkAndSendDomainNotifications(): Promise<void> {
  try {
    const [domains, tokens, storedStates] = await Promise.all([
      db.select().from(domainsTable),
      db.select().from(pushTokensTable),
      db.select().from(domainNotificationStatesTable),
    ]);

    if (tokens.length === 0) return;

    const tokenStrings = tokens.map((t) => t.token);
    const statesByDomainId = new Map(
      storedStates.map((s) => [s.domainId, s])
    );

    for (const domain of domains) {
      const urgency = getDomainUrgency(domain);

      if (urgency !== "expired" && urgency !== "critical") {
        // If urgency improved, clear stored state so we re-notify if it worsens again
        const stored = statesByDomainId.get(domain.id);
        if (stored && stored.lastUrgency !== "ok") {
          await db
            .update(domainNotificationStatesTable)
            .set({ lastUrgency: "ok", notifiedAt: new Date() })
            .where(eq(domainNotificationStatesTable.domainId, domain.id));
        }
        continue;
      }

      const stored = statesByDomainId.get(domain.id);
      const alreadyNotifiedThisUrgency =
        stored?.lastUrgency === urgency;

      if (alreadyNotifiedThisUrgency) continue;

      // Newly entered critical or expired — send push
      const expiry = domain.sslExpiry || domain.registrationExpiry;
      const { title, body } = buildNotificationMessage(domain.name, urgency, expiry);

      await sendExpoPushNotifications(tokenStrings, title, body, {
        filter: urgency,
        domainId: domain.id,
      });

      logger.info(
        { domainId: domain.id, domainName: domain.name, urgency },
        "Sent domain expiry push notification"
      );

      // Upsert state
      if (stored) {
        await db
          .update(domainNotificationStatesTable)
          .set({ lastUrgency: urgency, notifiedAt: new Date(), domainName: domain.name })
          .where(eq(domainNotificationStatesTable.domainId, domain.id));
      } else {
        await db.insert(domainNotificationStatesTable).values({
          domainId: domain.id,
          domainName: domain.name,
          lastUrgency: urgency,
          notifiedAt: new Date(),
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in domain notification check");
  }
}

export function startDomainNotificationScheduler(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // run every hour

  // Run once shortly after startup
  setTimeout(() => {
    checkAndSendDomainNotifications().catch(() => {});
  }, 10_000);

  // Then run on a fixed interval
  setInterval(() => {
    checkAndSendDomainNotifications().catch(() => {});
  }, INTERVAL_MS);

  logger.info("Domain notification scheduler started (interval: 1h)");
}
