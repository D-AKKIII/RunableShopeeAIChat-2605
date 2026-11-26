import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import { randomUUID } from "crypto";

export const tenants = new Hono()
  .use("*", authMiddleware)
  // Get my tenant
  .get("/me", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) {
      // Auto-create tenant on first access
      const newTenant = {
        id: randomUUID(),
        name: user.name ?? "My Shop",
        ownerId: user.id,
        createdAt: new Date(),
      };
      await db.insert(schema.tenants).values(newTenant);
      return c.json({ tenant: newTenant }, 200);
    }
    return c.json({ tenant }, 200);
  })
  // Get tenant settings
  .get("/settings", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ settings: null }, 200);

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id));

    // Mask sensitive keys
    if (settings) {
      return c.json({
        settings: {
          ...settings,
          shopeePartnerKey: settings.shopeePartnerKey ? "••••••••" + settings.shopeePartnerKey.slice(-4) : null,
          geminiApiKey: settings.geminiApiKey ? "••••••••" + settings.geminiApiKey.slice(-4) : null,
        },
      }, 200);
    }

    return c.json({ settings: null }, 200);
  })
  // Upsert tenant settings
  .put("/settings", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json() as Record<string, unknown>;

    let [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) {
      const newTenant = {
        id: randomUUID(),
        name: user.name ?? "My Shop",
        ownerId: user.id,
        createdAt: new Date(),
      };
      await db.insert(schema.tenants).values(newTenant);
      tenant = newTenant as typeof tenant;
    }

    const [existing] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id));

    // Don't overwrite masked values
    const updateData: Record<string, unknown> = {
      shopeePartnerId: body.shopeePartnerId ?? existing?.shopeePartnerId,
      shopeeShopId: body.shopeeShopId ?? existing?.shopeeShopId,
      shopeeAccessToken: body.shopeeAccessToken ?? existing?.shopeeAccessToken,
      geminiGemId: body.geminiGemId ?? existing?.geminiGemId,
      slackWebhookUrl: body.slackWebhookUrl ?? existing?.slackWebhookUrl,
      slackChannel: body.slackChannel ?? existing?.slackChannel,
      confidenceThreshold: body.confidenceThreshold ?? existing?.confidenceThreshold ?? 0.7,
      autoReplyEnabled: body.autoReplyEnabled ?? existing?.autoReplyEnabled ?? true,
      updatedAt: new Date(),
    };

    // Only update key fields if not masked
    if (body.shopeePartnerKey && !String(body.shopeePartnerKey).startsWith("••")) {
      updateData.shopeePartnerKey = body.shopeePartnerKey;
    }
    if (body.geminiApiKey && !String(body.geminiApiKey).startsWith("••")) {
      updateData.geminiApiKey = body.geminiApiKey;
    }

    if (existing) {
      await db
        .update(schema.tenantSettings)
        .set(updateData as Partial<typeof schema.tenantSettings.$inferInsert>)
        .where(eq(schema.tenantSettings.tenantId, tenant.id));
    } else {
      await db.insert(schema.tenantSettings).values({
        id: randomUUID(),
        tenantId: tenant.id,
        ...(updateData as Partial<typeof schema.tenantSettings.$inferInsert>),
        updatedAt: new Date(),
      });
    }

    return c.json({ success: true }, 200);
  })
  // Get webhook URL
  .get("/webhook-url", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    const baseUrl = (process.env.WEBSITE_URL ?? "").replace(/\/+$/, "");
    const webhookUrl = tenant ? `${baseUrl}/api/webhook/shopee/${tenant.id}` : null;
    return c.json({ webhookUrl, tenantId: tenant?.id }, 200);
  });
