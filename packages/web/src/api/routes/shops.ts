import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import { randomUUID } from "crypto";

export const COUNTRIES = [
  { code: "TH", name: "タイ",           flag: "🇹🇭" },
  { code: "MY", name: "マレーシア",     flag: "🇲🇾" },
  { code: "SG", name: "シンガポール",   flag: "🇸🇬" },
  { code: "ID", name: "インドネシア",   flag: "🇮🇩" },
  { code: "PH", name: "フィリピン",     flag: "🇵🇭" },
  { code: "VN", name: "ベトナム",       flag: "🇻🇳" },
  { code: "TW", name: "台湾",           flag: "🇹🇼" },
  { code: "BR", name: "ブラジル",       flag: "🇧🇷" },
  { code: "MX", name: "メキシコ",       flag: "🇲🇽" },
] as const;

async function getTenantId(userId: string) {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.ownerId, userId));
  return tenant?.id ?? null;
}

export const shops = new Hono()
  .use("*", authMiddleware)
  // List all countries with shop config status
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ shops: [], countries: COUNTRIES }, 200);

    const rows = await db
      .select()
      .from(schema.tenantShops)
      .where(eq(schema.tenantShops.tenantId, tenantId));

    // mask access tokens
    const shops = rows.map((r) => ({
      ...r,
      accessToken: r.accessToken ? "••••••••" + r.accessToken.slice(-4) : null,
    }));

    return c.json({ shops, countries: COUNTRIES }, 200);
  })
  // Add or update a shop. Shops are identified by shopId (many shops per country allowed).
  // body.id given -> edit that row; otherwise upsert by (tenant, shopId).
  .put("/:country", requireAuth, async (c) => {
    const user = c.get("user")!;
    const country = c.req.param("country").toUpperCase();
    const body = await c.req.json() as {
      id?: string; shopId?: string; shopName?: string; accessToken?: string; enabled?: boolean;
    };

    if (!COUNTRIES.find((cc) => cc.code === country)) {
      return c.json({ error: "Invalid country" }, 400);
    }
    const newShopId = (body.shopId ?? "").trim();
    if (!newShopId) return c.json({ error: "Shop ID is required" }, 400);

    let tenantId = await getTenantId(user.id);
    if (!tenantId) {
      const newTenant = { id: randomUUID(), name: user.name ?? "My Shop", ownerId: user.id, createdAt: new Date() };
      await db.insert(schema.tenants).values(newTenant);
      tenantId = newTenant.id;
    }

    const [byId] = body.id
      ? await db.select().from(schema.tenantShops)
          .where(and(eq(schema.tenantShops.tenantId, tenantId), eq(schema.tenantShops.id, body.id)))
      : [];
    const [byShopId] = await db.select().from(schema.tenantShops)
      .where(and(eq(schema.tenantShops.tenantId, tenantId), eq(schema.tenantShops.shopId, newShopId)));

    // Prevent changing a row's shopId to one that already belongs to another row
    if (byId && byShopId && byId.id !== byShopId.id) {
      return c.json({ error: "この Shop ID は既に登録されています" }, 409);
    }
    const existing = byId ?? byShopId;

    const updateData: Partial<typeof schema.tenantShops.$inferInsert> = {
      country,
      shopId: newShopId,
      shopName: body.shopName?.trim() || existing?.shopName || null,
      enabled: body.enabled ?? existing?.enabled ?? true,
      updatedAt: new Date(),
    };
    if (body.accessToken && !String(body.accessToken).startsWith("••")) {
      updateData.accessToken = body.accessToken;
    }

    if (existing) {
      await db.update(schema.tenantShops).set(updateData).where(eq(schema.tenantShops.id, existing.id));
      return c.json({ success: true, id: existing.id }, 200);
    }
    const id = randomUUID();
    await db.insert(schema.tenantShops).values({ id, tenantId, ...updateData, shopId: newShopId, country, createdAt: new Date() });
    return c.json({ success: true, id }, 200);
  })
  // Delete one shop (by row id)
  .delete("/item/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");
    const tenantId = await getTenantId(user.id);
    if (!tenantId) return c.json({ success: true }, 200);
    await db.delete(schema.tenantShops)
      .where(and(eq(schema.tenantShops.tenantId, tenantId), eq(schema.tenantShops.id, id)));
    return c.json({ success: true }, 200);
  });
