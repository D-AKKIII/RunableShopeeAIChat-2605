import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import { randomUUID } from "crypto";

export const knowledge = new Hono()
  .use("*", authMiddleware)
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ items: [] }, 200);

    const items = await db
      .select()
      .from(schema.knowledgeBase)
      .where(eq(schema.knowledgeBase.tenantId, tenant.id));

    return c.json({ items }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json() as {
      question: string;
      answer: string;
      category?: string;
      tags?: string[];
    };

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    const item = {
      id: randomUUID(),
      tenantId: tenant.id,
      question: body.question,
      answer: body.answer,
      category: body.category ?? null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      sourceType: "manual" as const,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(schema.knowledgeBase).values(item);
    return c.json({ item }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const body = await c.req.json() as {
      question?: string;
      answer?: string;
      category?: string;
      tags?: string[];
      active?: boolean;
    };

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ error: "Forbidden" }, 403);

    await db
      .update(schema.knowledgeBase)
      .set({
        ...(body.question && { question: body.question }),
        ...(body.answer && { answer: body.answer }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
        ...(body.active !== undefined && { active: body.active }),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.knowledgeBase.id, id), eq(schema.knowledgeBase.tenantId, tenant.id)));

    return c.json({ success: true }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ error: "Forbidden" }, 403);

    await db
      .delete(schema.knowledgeBase)
      .where(and(eq(schema.knowledgeBase.id, id), eq(schema.knowledgeBase.tenantId, tenant.id)));

    return c.json({ success: true }, 200);
  });
