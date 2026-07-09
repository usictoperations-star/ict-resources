import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { createSessionMiddleware } from "./lib/session";
import { sendError } from "./lib/errors";

const app: Express = express();

// Security headers — applied before all routes
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS: allow the real app domains in production, all origins in development
const productionOrigins: string[] = process.env.NODE_ENV === "production" && process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(",").map((d) => `https://${d.trim()}`).filter(Boolean)
  : [];

app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? productionOrigins : true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(createSessionMiddleware());

// Require application/json Content-Type on POST and PATCH requests.
// Missing or non-JSON Content-Type returns 415 — storage upload routes (multipart)
// are explicitly exempted.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST" || req.method === "PATCH") {
    const ct = (req.headers["content-type"] ?? "").toLowerCase();
    if (req.path.startsWith("/api/storage") && ct.includes("multipart/form-data")) {
      return next();
    }
    if (!ct.includes("application/json")) {
      sendError(res, 415, "Content-Type must be application/json", "UNSUPPORTED_MEDIA_TYPE");
      return;
    }
  }
  next();
});

app.use("/api", router);

// Global error handler — catches any error passed to next(err) or thrown in async handlers
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    sendError(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
});

export default app;
