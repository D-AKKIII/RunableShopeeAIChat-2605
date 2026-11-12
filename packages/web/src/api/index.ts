import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { webhook } from "./routes/webhook";
import { tenants } from "./routes/tenants";
import { logs } from "./routes/logs";
import { knowledge } from "./routes/knowledge";
import { shops } from "./routes/shops";
import { shopeeOauth } from "./routes/shopee-oauth";
import { billing } from "./routes/billing";
import { autumnHandler } from "autumn-js/hono";

const app = new Hono()
  .use(cors({
    origin: (origin) => origin ?? "*",
    credentials: true,
    exposeHeaders: ["set-auth-token"],
  }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .use(
    "/autumn/*",
    autumnHandler({
      secretKey: process.env.AUTUMN_SECRET_KEY!,
      identify: (c) => {
        const user = c.get("user") as { id: string; name?: string; email?: string } | undefined;
        if (!user) return null;
        return {
          customerId: user.id,
          customerData: {
            name: user.name ?? undefined,
            email: user.email ?? undefined,
          },
        };
      },
    })
  )
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .route("/webhook", webhook)
  .route("/tenants", tenants)
  .route("/logs", logs)
  .route("/knowledge", knowledge)
  .route("/shops", shops)
  .route("/shopee-auth", shopeeOauth)
  .route("/billing", billing);

export type AppType = typeof app;
export default app;
