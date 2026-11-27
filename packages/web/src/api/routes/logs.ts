import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, desc, and, gte, count, sql, inArray } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import { processMessage } from "../agent/engine";
import { sendShopeeReply } from "../services/shopee";
import { getValidAccessToken } from "../lib/shopee-auth";
import { generateText } from "ai";
import { getGeminiModel } from "../agent/gateway";
import { randomUUID } from "crypto";

export const logs = new Hono()
  .use("*", authMiddleware)
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const page = Number(c.req.query("page") ?? 1);
    const limit = Number(c.req.query("limit") ?? 20);
    const status = c.req.query("status");
    const offset = (page - 1) * limit;

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ logs: [], total: 0 }, 200);

    const conditions = [eq(schema.chatLogs.tenantId, tenant.id)];
    if (status) conditions.push(eq(schema.chatLogs.status, status));

    const chatLogs = await db
      .select()
      .from(schema.chatLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.chatLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.chatLogs)
      .where(and(...conditions));

    return c.json({ logs: chatLogs, total }, 200);
  })
  .get("/analytics", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ stats: null }, 200);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total] = await db
      .select({ count: count() })
      .from(schema.chatLogs)
      .where(eq(schema.chatLogs.tenantId, tenant.id));

    const [autoReplied] = await db
      .select({ count: count() })
      .from(schema.chatLogs)
      .where(and(eq(schema.chatLogs.tenantId, tenant.id), eq(schema.chatLogs.status, "auto_replied")));

    const [escalated] = await db
      .select({ count: count() })
      .from(schema.chatLogs)
      .where(and(eq(schema.chatLogs.tenantId, tenant.id), eq(schema.chatLogs.status, "escalated")));

    const [last30] = await db
      .select({ count: count() })
      .from(schema.chatLogs)
      .where(
        and(
          eq(schema.chatLogs.tenantId, tenant.id),
          gte(schema.chatLogs.createdAt, thirtyDaysAgo)
        )
      );

    // Language distribution
    const languageDist = await db
      .select({
        language: schema.chatLogs.detectedLanguage,
        count: count(),
      })
      .from(schema.chatLogs)
      .where(eq(schema.chatLogs.tenantId, tenant.id))
      .groupBy(schema.chatLogs.detectedLanguage);

    // Daily stats (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyStats = await db
      .select({
        date: sql<string>`date(datetime(${schema.chatLogs.createdAt} / 1000, 'unixepoch'))`,
        total: count(),
        autoReplied: sql<number>`sum(case when ${schema.chatLogs.status} = 'auto_replied' then 1 else 0 end)`,
        escalated: sql<number>`sum(case when ${schema.chatLogs.status} = 'escalated' then 1 else 0 end)`,
      })
      .from(schema.chatLogs)
      .where(
        and(
          eq(schema.chatLogs.tenantId, tenant.id),
          gte(schema.chatLogs.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`date(datetime(${schema.chatLogs.createdAt} / 1000, 'unixepoch'))`)
      .orderBy(sql`date(datetime(${schema.chatLogs.createdAt} / 1000, 'unixepoch'))`);

    const autoReplyRate = total.count > 0 ? (autoReplied.count / total.count) * 100 : 0;

    return c.json({
      stats: {
        total: total.count,
        autoReplied: autoReplied.count,
        escalated: escalated.count,
        last30Days: last30.count,
        autoReplyRate: Math.round(autoReplyRate),
        languageDist,
        dailyStats,
      },
    }, 200);
  })
  .get("/escalations", requireAuth, async (c) => {
    const user = c.get("user")!;
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ escalations: [] }, 200);

    const escalations = await db
      .select({
        escalation: schema.escalations,
        log: schema.chatLogs,
      })
      .from(schema.escalations)
      .leftJoin(schema.chatLogs, eq(schema.escalations.chatLogId, schema.chatLogs.id))
      .where(eq(schema.escalations.tenantId, tenant.id))
      .orderBy(desc(schema.escalations.createdAt))
      .limit(50);

    // Enrich with shop country info
    const shops = await db
      .select()
      .from(schema.tenantShops)
      .where(eq(schema.tenantShops.tenantId, tenant.id));

    const shopCountryMap: Record<string, string> = {};
    for (const s of shops) {
      shopCountryMap[s.shopId] = s.country;
    }

    const enriched = escalations.map(({ escalation, log }) => ({
      escalation,
      log,
      country: log?.shopeeShopId ? (shopCountryMap[log.shopeeShopId] ?? null) : null,
    }));

    return c.json({ escalations: enriched }, 200);
  })
  // Translate text to Japanese using Gemini
  .post("/translate", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { text, fromLanguage } = await c.req.json<{ text: string; fromLanguage: string }>();

    if (!text) return c.json({ translated: null }, 200);
    if (fromLanguage === "ja") return c.json({ translated: null }, 200);

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));
    if (!tenant) return c.json({ translated: null }, 200);

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id));

    try {
      const { text: result } = await generateText({
        model: getGeminiModel(settings?.geminiApiKey),
        prompt: `以下のテキストを自然な日本語に翻訳してください。翻訳文のみを返してください（説明や注釈は不要）:\n\n${text}`,
      });
      return c.json({ translated: result.trim() }, 200);
    } catch {
      return c.json({ translated: null }, 200);
    }
  })
  // Send manual reply to escalated chat
  .post("/escalations/:id/reply", requireAuth, async (c) => {
    const user = c.get("user")!;
    const escalationId = c.req.param("id");
    const { memo } = await c.req.json<{ memo: string }>();

    if (!memo?.trim()) return c.json({ error: "memo required" }, 400);

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id));

    // Get escalation + log
    const [esc] = await db
      .select({ escalation: schema.escalations, log: schema.chatLogs })
      .from(schema.escalations)
      .leftJoin(schema.chatLogs, eq(schema.escalations.chatLogId, schema.chatLogs.id))
      .where(and(eq(schema.escalations.id, escalationId), eq(schema.escalations.tenantId, tenant.id)));

    if (!esc) return c.json({ error: "Escalation not found" }, 404);

    const log = esc.log;
    if (!log) return c.json({ error: "Chat log not found" }, 404);

    const detectedLanguage = log.detectedLanguage ?? "en";
    const originalMessage = log.messageContent;

    // Generate translated reply in buyer's language using Gemini
    const langNames: Record<string, string> = {
      en: "English", zh: "Chinese", ko: "Korean", th: "Thai",
      vi: "Vietnamese", ar: "Arabic", ms: "Malay", id: "Indonesian",
    };
    const targetLang = detectedLanguage === "ja"
      ? "Japanese"
      : (langNames[detectedLanguage] ?? "the same language as the customer");

    let finalReply = memo;
    try {
      const { text: translated } = await generateText({
        model: getGeminiModel(settings?.geminiApiKey),
        prompt: `あなたはカスタマーサポート担当者です。以下の日本語メモを元に、丁寧で自然な${targetLang}の返信文を生成してください。
返信文のみを返してください（説明・注釈・前置きは不要）。

顧客の問い合わせ: ${originalMessage}

担当者メモ（日本語）: ${memo}`,
      });
      finalReply = translated.trim();
    } catch (err) {
      console.error("[Escalation Reply] Translation failed:", err);
      // fall through — use memo as-is
    }

    // Resolve shop & token
    const shopRow = log.shopeeShopId
      ? (await db.select().from(schema.tenantShops)
          .where(and(eq(schema.tenantShops.tenantId, tenant.id), eq(schema.tenantShops.shopId, log.shopeeShopId))))[0] ?? null
      : null;

    let sent = false;
    if (shopRow && settings?.shopeePartnerId && settings?.shopeePartnerKey) {
      const tokenResult = await getValidAccessToken(tenant.id, shopRow.shopId);
      if (tokenResult) {
        const replyResult = await sendShopeeReply({
          settings: {
            partnerId: settings.shopeePartnerId,
            partnerKey: settings.shopeePartnerKey,
            shopId: tokenResult.shopId,
            accessToken: tokenResult.accessToken,
          },
          conversationId: log.shopeeConversationId,
          toId: log.buyerUserId ?? "",
          message: finalReply,
        });
        sent = replyResult.success;
        if (!replyResult.success) {
          console.error("[Escalation Reply] sendShopeeReply failed:", replyResult.error);
          if (replyResult.error === "user_is_forbidden") {
            return c.json({
              ok: false,
              sent: false,
              error: "user_is_forbidden",
              message: "このバイヤーへの送信が拒否されました。Shopeeのポリシーにより、7日以内に会話を開始していないか、30日以内に注文がないバイヤーへは送信できません。",
            }, 200);
          }
        }
      }
    }

    // Mark escalation as resolved if sent successfully
    if (sent) {
      await db.update(schema.escalations)
        .set({ status: "resolved", resolvedBy: user.id, resolvedAt: new Date(), notes: memo })
        .where(eq(schema.escalations.id, escalationId));
    }

    return c.json({ ok: true, sent, reply: finalReply, language: detectedLanguage });
  })
  // Update escalation status manually
  .patch("/escalations/:id/status", requireAuth, async (c) => {
    const user = c.get("user")!;
    const escalationId = c.req.param("id");
    const { status } = await c.req.json<{ status: string }>();

    const VALID = ["open", "in_progress", "resolved"];
    if (!VALID.includes(status)) return c.json({ error: "Invalid status" }, 400);

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    if (status === "resolved") {
      await db.run(sql`UPDATE escalations SET status=${status}, resolved_by=${user.id}, resolved_at=${Math.floor(Date.now()/1000)} WHERE id=${escalationId} AND tenant_id=${tenant.id}`);
    } else {
      await db.run(sql`UPDATE escalations SET status=${status}, resolved_by=NULL, resolved_at=NULL WHERE id=${escalationId} AND tenant_id=${tenant.id}`);
    }

    return c.json({ ok: true });
  })
  // Delete one or more logs
  .delete("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { ids } = await c.req.json<{ ids: string[] }>();

    if (!Array.isArray(ids) || ids.length === 0)
      return c.json({ error: "ids required" }, 400);

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));

    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    // Only delete logs belonging to this tenant (security)
    await db
      .delete(schema.chatLogs)
      .where(
        and(
          eq(schema.chatLogs.tenantId, tenant.id),
          inArray(schema.chatLogs.id, ids)
        )
      );

    return c.json({ ok: true });
  })
  // Test endpoint: simulate a customer message without going through Shopee webhook
  .post("/test-message", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { message, buyerUsername } = await c.req.json<{ message: string; buyerUsername?: string }>();

    if (!message) return c.json({ error: "message required" }, 400);

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id));
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id));

    const kb = await db
      .select()
      .from(schema.knowledgeBase)
      .where(and(eq(schema.knowledgeBase.tenantId, tenant.id), eq(schema.knowledgeBase.active, true)));

    const result = await processMessage({
      message,
      geminiApiKey: settings?.geminiApiKey ?? "",
      geminiGemId: settings?.geminiGemId ?? undefined,
      knowledgeBase: kb.map((k) => ({ question: k.question, answer: k.answer })),
      orderInfo: null,
      confidenceThreshold: settings?.confidenceThreshold,
    });

    const logId = randomUUID();
    await db.insert(schema.chatLogs).values({
      id: logId,
      tenantId: tenant.id,
      shopeeConversationId: `test-${logId}`,
      shopeeShopId: "test",
      buyerUserId: "test-user",
      buyerUsername: buyerUsername ?? "テストユーザー",
      messageContent: message,
      detectedLanguage: result.language,
      aiResponse: result.reply,
      confidenceScore: result.confidence,
      informationSource: result.source,
      status: result.shouldEscalate ? "escalated" : "auto_replied",
      escalationReason: result.escalationReason ?? null,
      processedAt: new Date(),
      createdAt: new Date(),
    });

    return c.json({
      ok: true,
      reply: result.reply,
      confidence: result.confidence,
      shouldEscalate: result.shouldEscalate,
      source: result.source,
    });
  });
