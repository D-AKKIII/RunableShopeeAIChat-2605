import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import { Autumn } from "autumn-js";

const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });

export const billing = new Hono()
  .use("*", authMiddleware)
  .get("/quota", requireAuth, async (c) => {
    const user = c.get("user")!;

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ allowed: true, unlimited: true }, 200);

    try {
      const result = await autumn.check({
        customerId: user.id,
        featureId: "auto_replies",
      });

      // SDK returns camelCase: nextResetAt, overageAllowed, etc.
      const b = result.balance as any;

      return c.json({
        allowed: result.allowed,
        unlimited: b?.unlimited ?? false,
        remaining: b?.remaining ?? 0,
        usage: b?.usage ?? 0,
        granted: b?.granted ?? 0,
        nextResetAt: b?.nextResetAt ?? null,
      });
    } catch {
      // Autumn unavailable → don't block UI
      return c.json({ allowed: true, unlimited: true }, 200);
    }
  });

