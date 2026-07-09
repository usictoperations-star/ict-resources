import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgSession = connectPgSimple(session);

const DEV_FALLBACK_SECRET = "mk-doc-dev-secret-change-in-prod";

export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET ?? DEV_FALLBACK_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEV_FALLBACK_SECRET) {
      console.error(
        "[FATAL] SESSION_SECRET is missing or set to the insecure dev fallback in production. " +
        "Set a strong SESSION_SECRET environment variable. Refusing to start."
      );
      process.exit(1);
    }
  }

  return session({
    store: new PgSession({
      pool: pool as any,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    secret,
    name: "mk.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
}
