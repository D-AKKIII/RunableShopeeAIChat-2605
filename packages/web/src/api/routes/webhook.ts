import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { processMessage, getEscalationAck } from "../agent/engine";
import { sendShopeeReply, sendStickerReply, getShopeeOrderInfo, getShopeeItemInfo, validateShopeeWebhook } from "../services/shopee";
import { sendSlackEscalation } from "../services/slack";
import { getValidAccessToken } from "../lib/shopee-auth";
import { Autumn } from "autumn-js";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

// ── Cart inquiry pending timers ────────────────────────────────────────────
const cartPendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Escalation followup timers (5-min) ─────────────────────────────────────
const escalationFollowupTimers = new Map<string, ReturnType<typeof setTimeout>>();

const CART_INQUIRY_REPLY =
  "ご連絡ありがとうございます！こちらの商品/注文についてご不明な点はございますか？サイズ・在庫・発送日など、何でもお気軽にお尋ねください😊";

/** 5分後フォローアップメッセージ（言語別） */
function getEscalationFollowup(language: string): string {
  const messages: Record<string, string> = {
    ja: "お待たせしております。現在担当者が対応中です。もうしばらくお待ちいただけますでしょうか。引き続きよろしくお願いいたします。",
    en: "Thank you for your patience. Our team is currently working on your inquiry. We appreciate your understanding and will respond as soon as possible.",
    zh: "感谢您的耐心等待。我们的工作人员正在处理您的问题，请稍候，我们将尽快回复您。",
    ko: "기다려 주셔서 감사합니다. 담당자가 현재 문의를 처리 중입니다. 조금 더 기다려 주시면 감사하겠습니다.",
    th: "ขอบคุณสำหรับความอดทนของคุณ ทีมงานของเรากำลังดำเนินการกับคำถามของคุณ กรุณารอสักครู่",
    vi: "Cảm ơn sự kiên nhẫn của bạn. Nhân viên của chúng tôi đang xử lý yêu cầu của bạn. Vui lòng chờ thêm một chút.",
    id: "Terima kasih atas kesabarannya. Tim kami sedang menangani pertanyaan Anda. Kami akan segera merespons.",
    ms: "Terima kasih atas kesabaran anda. Pasukan kami sedang memproses pertanyaan anda dan akan bertindak balas secepat mungkin.",
  };
  return messages[language] ?? messages["en"];
}

const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY! });

export const webhook = new Hono()
  .post("/shopee/:tenantId", async (c) => {
    const tenantId = c.req.param("tenantId");
    const rawBody = await c.req.text();

    const [settings] = await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenantId));

    if (!settings) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const signature = c.req.header("Authorization") ?? "";
    if (
      settings.shopeePartnerKey &&
      !validateShopeeWebhook(rawBody, signature, settings.shopeePartnerKey)
    ) {
      console.warn(`[Webhook] Invalid signature for tenant ${tenantId}`);
      // Don't reject — Shopee sometimes sends test webhooks without valid sigs
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (body.code !== 10) {
      return c.json({ ok: true }, 200);
    }

    const conversationData = body.data as Record<string, unknown>;

    const dataType = conversationData?.["type"] as string | undefined;
    if (dataType && dataType !== "message") {
      return c.json({ ok: true }, 200);
    }

    const innerData = conversationData?.["content"] as Record<string, unknown> | undefined;
    const messageType = innerData?.["message_type"] as string | undefined;

    // ── Sticker ───────────────────────────────────────────────────────────────
    if (messageType === "sticker") {
      const buyerUserIdSticker = String(innerData?.["from_id"] ?? "");
      const conversationIdSticker = String(innerData?.["conversation_id"] ?? "");
      const webhookShopIdSticker = String(innerData?.["shop_id"] ?? body["shop_id"] ?? "");
      const stickerContent = innerData?.["content"] as Record<string, unknown> | undefined;
      const incomingStickerId = String(stickerContent?.["sticker_id"] ?? "");
      const incomingPackageId = String(stickerContent?.["sticker_package_id"] ?? "");
      processStickerAsync(
        tenantId, buyerUserIdSticker, conversationIdSticker, webhookShopIdSticker,
        incomingStickerId, incomingPackageId, settings
      ).catch((err) => console.error(`[Webhook] Sticker processing error:`, err));
      return c.json({ ok: true }, 200);
    }

    // ── Item (product inquiry) → 5-min timer ──────────────────────────────────
    if (messageType === "item") {
      const convId = String(innerData?.["conversation_id"] ?? "");
      const buyerIdItem = String(innerData?.["from_id"] ?? "");
      const webhookShopIdItem = String(innerData?.["shop_id"] ?? body["shop_id"] ?? "");
      const itemContent = innerData?.["content"] as Record<string, unknown> | undefined;
      const sourceContentItem = innerData?.["source_content"] as Record<string, unknown> | undefined;
      const resolvedItemId =
        (itemContent?.["item_id"] ? String(itemContent["item_id"]) : undefined) ??
        (sourceContentItem?.["item_id"] ? String(sourceContentItem["item_id"]) : undefined);

      const timerKey = `${tenantId}:${convId}`;
      const existing = cartPendingTimers.get(timerKey);
      if (existing) clearTimeout(existing);

      console.log(`[Webhook] Item inquiry received: tenant=${tenantId} conv=${convId} item=${resolvedItemId} — starting 5-min timer`);
      const handle = setTimeout(() => {
        cartPendingTimers.delete(timerKey);
        processCartInquiryAsync(tenantId, convId, buyerIdItem, webhookShopIdItem, resolvedItemId, settings)
          .catch((err) => console.error(`[Webhook] Cart inquiry processing error:`, err));
      }, 5 * 60 * 1000);
      cartPendingTimers.set(timerKey, handle);
      return c.json({ ok: true }, 200);
    }

    // Skip non-text (images, videos, etc.)
    if (messageType && messageType !== "text") {
      return c.json({ ok: true }, 200);
    }

    const msgContent = innerData?.["content"] as Record<string, unknown> | undefined;
    const messageContent = String(msgContent?.["text"] ?? "");
    const conversationId = String(innerData?.["conversation_id"] ?? "");
    const shopeeMessageId = innerData?.["message_id"] ? String(innerData["message_id"]) : null;
    const buyerUserId = String(innerData?.["from_id"] ?? "");
    const buyerUsername = String(innerData?.["from_user_name"] ?? "unknown");
    const orderId = innerData?.["order_sn"] as string | undefined;
    const webhookShopId = String(innerData?.["shop_id"] ?? body["shop_id"] ?? "");
    const sourceContent = innerData?.["source_content"] as Record<string, unknown> | undefined;
    const itemId = sourceContent?.["item_id"] ? String(sourceContent["item_id"]) : undefined;

    if (!messageContent) {
      return c.json({ ok: true }, 200);
    }

    // Cancel cart-inquiry timer if buyer starts typing
    const cartTimerKey = `${tenantId}:${conversationId}`;
    const pendingCartTimer = cartPendingTimers.get(cartTimerKey);
    if (pendingCartTimer) {
      clearTimeout(pendingCartTimer);
      cartPendingTimers.delete(cartTimerKey);
      console.log(`[Webhook] Cart inquiry timer cancelled — buyer sent text: conv=${conversationId}`);
    }

    // ── Deduplication ─────────────────────────────────────────────────────────
    const timeBucket = Math.floor(Math.floor(Date.now() / 1000) / 10);
    const dedupKey = shopeeMessageId ?? `${conversationId}:${messageContent}:${timeBucket}`;

    const logId = randomUUID();
    const insertResult = await db.run(
      sql`INSERT OR IGNORE INTO chat_logs
        (id, tenant_id, shopee_conversation_id, shopee_message_id, shopee_shop_id,
         buyer_user_id, buyer_username, message_content, status, created_at)
        VALUES (
          ${logId}, ${tenantId}, ${conversationId}, ${dedupKey}, ${webhookShopId},
          ${buyerUserId}, ${buyerUsername}, ${messageContent}, 'pending', ${Date.now()}
        )`
    );

    if ((insertResult.rowsAffected ?? 0) === 0) {
      console.log(`[Webhook] Duplicate ignored — dedup_key=${dedupKey}`);
      return c.json({ ok: true, duplicate: true }, 200);
    }

    // Return 200 immediately; process in background
    processWebhookAsync(
      logId, tenantId, conversationId, buyerUserId, buyerUsername,
      messageContent, orderId, itemId, webhookShopId, settings
    ).catch((err) => console.error(`[Webhook] Background processing error:`, err));

    return c.json({ ok: true }, 200);
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve shop row + valid access token for the given shopId. Falls back to any shop for the tenant. */
async function resolveShopToken(tenantId: string, webhookShopId: string, settings: typeof schema.tenantSettings.$inferSelect) {
  let shopRow: typeof schema.tenantShops.$inferSelect | null = null;
  if (webhookShopId) {
    const rows = await db
      .select()
      .from(schema.tenantShops)
      .where(and(eq(schema.tenantShops.tenantId, tenantId), eq(schema.tenantShops.shopId, webhookShopId)));
    shopRow = rows[0] ?? null;
  }
  if (!shopRow && !webhookShopId) {
    // shop_id missing from payload: only safe to fall back when the tenant has exactly one shop
    const rows = await db.select().from(schema.tenantShops).where(eq(schema.tenantShops.tenantId, tenantId));
    shopRow = rows.length === 1 ? rows[0] : null;
  }
  if (!shopRow) {
    console.warn(`[Webhook] Shop not registered for tenant=${tenantId} shop_id=${webhookShopId || "(none)"}`);
  }

  let accessToken: string | null = null;
  let resolvedShopId: string | null = null;
  if (shopRow) {
    const tokenResult = await getValidAccessToken(tenantId, shopRow.shopId);
    if (tokenResult) {
      accessToken = tokenResult.accessToken;
      resolvedShopId = tokenResult.shopId;
    }
  }

  const partnerId = settings.shopeePartnerId;
  const partnerKey = settings.shopeePartnerKey;
  const shopId = resolvedShopId ?? shopRow?.shopId ?? null;
  const canReply = !!(partnerId && partnerKey && shopId && accessToken);

  return { shopRow, shopId, accessToken, partnerId, partnerKey, canReply };
}

/** Schedule a 5-min followup message to buyer after escalation. Deduped per conversation. */
function scheduleEscalationFollowup(
  key: string,
  language: string,
  sendFn: () => Promise<void>
) {
  // Clear any existing timer for this conversation
  const existing = escalationFollowupTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    console.log(`[Escalation] Followup timer reset for conv=${key}`);
  }
  const handle = setTimeout(async () => {
    escalationFollowupTimers.delete(key);
    try {
      await sendFn();
      console.log(`[Escalation] 5-min followup sent: conv=${key}`);
    } catch (err) {
      console.error(`[Escalation] 5-min followup failed: conv=${key}`, err);
    }
  }, 5 * 60 * 1000);
  escalationFollowupTimers.set(key, handle);
  console.log(`[Escalation] 5-min followup scheduled: conv=${key} lang=${language}`);
}

/** Save escalation if one doesn't already exist for this conversation within the last 10 min. */
async function saveEscalation(
  tenantId: string,
  logId: string,
  conversationId: string,
  reason: string,
  ackSent: boolean = false
) {
  // Check for recent escalation on same conversation (dedup)
  const recentRows = await db
    .select({ id: schema.escalations.id })
    .from(schema.escalations)
    .innerJoin(schema.chatLogs, eq(schema.escalations.chatLogId, schema.chatLogs.id))
    .where(
      and(
        eq(schema.escalations.tenantId, tenantId),
        eq(schema.chatLogs.shopeeConversationId, conversationId),
        sql`${schema.chatLogs.createdAt} > ${Date.now() - 10 * 60 * 1000}`
      )
    )
    .limit(1);

  if (recentRows.length > 0) {
    console.log(`[Webhook] Escalation dedup — reusing ${recentRows[0].id} for conv=${conversationId}`);
    // Update ackSent if it was newly successful
    if (ackSent) {
      await db.update(schema.escalations)
        .set({ ackSent: true })
        .where(eq(schema.escalations.id, recentRows[0].id));
    }
    return recentRows[0].id;
  }

  const escalationId = randomUUID();
  await db.insert(schema.escalations).values({
    id: escalationId,
    tenantId,
    chatLogId: logId,
    reason,
    ackSent,
    createdAt: new Date(),
  });
  return escalationId;
}

// ── Background processor ──────────────────────────────────────────────────────
async function processWebhookAsync(
  logId: string,
  tenantId: string,
  conversationId: string,
  buyerUserId: string,
  buyerUsername: string,
  messageContent: string,
  orderId: string | undefined,
  itemId: string | undefined,
  webhookShopId: string,
  settings: typeof schema.tenantSettings.$inferSelect
): Promise<void> {
  try {
    const { shopRow, shopId, accessToken, partnerId, partnerKey, canReply } =
      await resolveShopToken(tenantId, webhookShopId, settings);

    console.log(`[Webhook] tenant=${tenantId} shop=${shopId} hasToken=${!!accessToken}`);

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    if (!tenant) {
      await db.run(sql`UPDATE chat_logs SET status='error' WHERE id=${logId}`);
      return;
    }

    // Quota check
    const { allowed } = await autumn.check({ customerId: tenant.ownerId, featureId: "auto_replies" });
    if (!allowed) {
      await db.run(sql`UPDATE chat_logs SET status='escalated', escalation_reason='quota_exceeded' WHERE id=${logId}`);
      return;
    }

    // Knowledge base
    const kb = await db
      .select()
      .from(schema.knowledgeBase)
      .where(and(eq(schema.knowledgeBase.tenantId, tenantId), eq(schema.knowledgeBase.active, true)));

    // Order info
    let orderInfo = null;
    if (orderId && canReply) {
      orderInfo = await getShopeeOrderInfo({
        settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
        orderId,
      });
    }

    // Item info
    let itemInfo: { name: string; image: string; price: number } | null = null;
    if (itemId && canReply) {
      itemInfo = await getShopeeItemInfo({
        settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
        itemId,
      });
      if (itemInfo) console.log(`[Webhook] Item found: ${itemInfo.name} (id=${itemId})`);
    }

    // AI
    const result = await processMessage({
      message: messageContent,
      geminiApiKey: settings.geminiApiKey ?? "",
      geminiGemId: settings.geminiGemId ?? undefined,
      knowledgeBase: kb.map((k) => ({ question: k.question, answer: k.answer })),
      orderInfo,
      itemInfo: itemInfo ?? undefined,
      confidenceThreshold: settings.confidenceThreshold,
    });

    if (!result.shouldEscalate && settings.autoReplyEnabled) {
      // ── Auto-reply ────────────────────────────────────────────────────────
      let replySuccess = false;
      let forbiddenError = false;

      if (canReply) {
        const replyResult = await sendShopeeReply({
          settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
          conversationId,
          toId: buyerUserId,
          message: result.reply,
        });
        replySuccess = replyResult.success;

        if (!replySuccess) {
          console.error(`[Webhook] sendShopeeReply failed: ${replyResult.error}`);

          if (replyResult.error === "user_is_forbidden") {
            // Shopeeポリシー制限 → エスカレーション扱いにして手動対応できるようにする
            forbiddenError = true;
            await db.run(
              sql`UPDATE chat_logs SET
                shopee_shop_id=${shopId ?? ""},
                detected_language=${result.language},
                ai_response=${result.reply},
                confidence_score=${result.confidence},
                information_source=${result.source},
                status='escalated',
                escalation_reason='user_is_forbidden',
                order_id=${orderId ?? null},
                item_id=${itemId ?? null},
                item_name=${itemInfo?.name ?? null},
                item_image=${itemInfo?.image ?? null},
                item_price=${itemInfo?.price ?? null},
                processed_at=${Date.now()}
              WHERE id=${logId}`
            );
            await saveEscalation(tenantId, logId, conversationId, "user_is_forbidden");
            console.log(`[Webhook] user_is_forbidden → escalated: conv=${conversationId}`);

            // NOTE: user_is_forbidden means we cannot send ANY message to this buyer via API.
            // Shopee restricts messaging to buyers who started a chat within 7 days,
            // placed an order within 30 days, or have an unresolved return/refund.
            // We log this for manual follow-up but cannot send ack or followup programmatically.
            console.log(`[Webhook] user_is_forbidden — cannot send ack/followup to conv=${conversationId} (Shopee policy)`);
            return;
          }
        } else {
          console.log(`[Webhook] Reply sent: conv=${conversationId}`);
        }
      } else {
        console.warn(`[Webhook] No valid token — skipping reply for tenant=${tenantId}`);
      }

      // Track usage (even if send failed for non-forbidden reasons)
      if (!forbiddenError) {
        await autumn.track({ customerId: tenant.ownerId, featureId: "auto_replies", value: 1 });
        await db.run(
          sql`UPDATE chat_logs SET
            shopee_shop_id=${shopId ?? ""},
            detected_language=${result.language},
            ai_response=${result.reply},
            confidence_score=${result.confidence},
            information_source=${result.source},
            status=${replySuccess ? "auto_replied" : "error"},
            order_id=${orderId ?? null},
            item_id=${itemId ?? null},
            item_name=${itemInfo?.name ?? null},
            item_image=${itemInfo?.image ?? null},
            item_price=${itemInfo?.price ?? null},
            processed_at=${Date.now()}
          WHERE id=${logId}`
        );
      }
    } else {
      // ── Escalation path ───────────────────────────────────────────────────
      await db.run(
        sql`UPDATE chat_logs SET
          shopee_shop_id=${shopId ?? ""},
          detected_language=${result.language},
          ai_response=${result.reply},
          confidence_score=${result.confidence},
          information_source=${result.source},
          status='escalated',
          escalation_reason=${result.escalationReason ?? "unknown"},
          order_id=${orderId ?? null},
          item_id=${itemId ?? null},
          item_name=${itemInfo?.name ?? null},
          item_image=${itemInfo?.image ?? null},
          item_price=${itemInfo?.price ?? null},
          processed_at=${Date.now()}
        WHERE id=${logId}`
      );

      // Immediate ack to buyer
      let ackSent = false;
      if (canReply && settings.autoReplyEnabled) {
        const ackResult = await sendShopeeReply({
          settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
          conversationId,
          toId: buyerUserId,
          message: getEscalationAck(result.language),
        });
        ackSent = ackResult.success;
        if (ackResult.success) {
          console.log(`[Webhook] Escalation ack sent: conv=${conversationId}`);
          // Schedule 5-min followup only if ack succeeded (buyer is reachable)
          const followupKey = `${tenantId}:${conversationId}`;
          const replySettings = { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! };
          const followupLang = result.language;
          scheduleEscalationFollowup(followupKey, followupLang, async () => {
            const freshToken = await getValidAccessToken(tenantId, shopRow!.shopId).catch(() => null);
            const freshSettings = freshToken
              ? { ...replySettings, accessToken: freshToken.accessToken, shopId: freshToken.shopId }
              : replySettings;
            const followupResult = await sendShopeeReply({
              settings: freshSettings,
              conversationId,
              toId: buyerUserId,
              message: getEscalationFollowup(followupLang),
            });
            if (followupResult.success) {
              console.log(`[Escalation] 5-min followup delivered: conv=${conversationId}`);
            } else {
              console.warn(`[Escalation] 5-min followup failed (${followupResult.error}): conv=${conversationId}`);
            }
          });
        } else {
          console.warn(`[Webhook] Escalation ack failed (${ackResult.error}): conv=${conversationId} — buyer unreachable via Shopee API`);
        }
      }

      const escalationId = await saveEscalation(tenantId, logId, conversationId, result.escalationReason ?? "unknown", ackSent);

      // Slack notification
      if (settings.slackWebhookUrl) {
        const slackResult = await sendSlackEscalation({
          webhookUrl: settings.slackWebhookUrl,
          channel: settings.slackChannel ?? undefined,
          buyerUsername,
          conversationId,
          message: messageContent,
          aiResponse: result.reply,
          reason: result.escalationReason ?? "unknown",
          confidence: result.confidence,
          language: result.language,
          orderId: orderId ?? null,
        });
        if (slackResult.success) {
          await db.update(schema.escalations)
            .set({ slackNotified: true, slackTs: slackResult.ts })
            .where(eq(schema.escalations.id, escalationId));
        }
      }
    }
  } catch (err) {
    console.error(`[Webhook] Unhandled error in processWebhookAsync:`, err);
    await db.run(sql`UPDATE chat_logs SET status='error' WHERE id=${logId}`).catch(() => {});
  }
}

// ── Sticker processor ─────────────────────────────────────────────────────────
async function processStickerAsync(
  tenantId: string,
  buyerUserId: string,
  conversationId: string,
  webhookShopId: string,
  incomingStickerId: string,
  incomingPackageId: string,
  settings: typeof schema.tenantSettings.$inferSelect
): Promise<void> {
  try {
    const { shopId, accessToken, partnerId, partnerKey } =
      await resolveShopToken(tenantId, webhookShopId, settings);

    if (!partnerId || !partnerKey || !shopId || !accessToken) {
      console.warn(`[Webhook] Sticker: missing credentials for tenant=${tenantId}`);
      return;
    }
    if (!incomingPackageId || !incomingStickerId) {
      console.warn(`[Webhook] Sticker: missing sticker IDs, skipping`);
      return;
    }

    const result = await sendStickerReply({
      settings: { partnerId, partnerKey, shopId, accessToken },
      conversationId,
      toId: buyerUserId,
      stickerId: incomingStickerId,
      stickerPackageId: incomingPackageId,
    });

    if (result.success) {
      console.log(`[Webhook] Sticker reply sent OK: conv=${conversationId}`);
    } else {
      console.warn(`[Webhook] Sticker reply failed (${result.error}), falling back to emoji`);
      const fallback = await sendShopeeReply({
        settings: { partnerId, partnerKey, shopId, accessToken },
        conversationId,
        toId: buyerUserId,
        message: "😄👍",
      });
      if (!fallback.success) {
        console.error(`[Webhook] Sticker fallback also failed: ${fallback.error}`);
      }
    }
  } catch (err) {
    console.error(`[Webhook] Unhandled error in processStickerAsync:`, err);
  }
}

// ── Cart inquiry processor ────────────────────────────────────────────────────
async function processCartInquiryAsync(
  tenantId: string,
  conversationId: string,
  buyerUserId: string,
  webhookShopId: string,
  itemId: string | undefined,
  settings: typeof schema.tenantSettings.$inferSelect
): Promise<void> {
  try {
    console.log(`[Webhook] Cart inquiry 5-min timer fired: tenant=${tenantId} conv=${conversationId} item=${itemId}`);

    const { shopId, accessToken, partnerId, partnerKey, canReply } =
      await resolveShopToken(tenantId, webhookShopId, settings);

    let itemInfo: { name: string; image: string; price: number } | null = null;
    if (itemId && canReply) {
      itemInfo = await getShopeeItemInfo({
        settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
        itemId,
      }).catch(() => null);
    }

    const logId = randomUUID();
    await db.run(
      sql`INSERT INTO chat_logs
        (id, tenant_id, shopee_conversation_id, shopee_message_id, shopee_shop_id,
         buyer_user_id, buyer_username, message_content, detected_language,
         ai_response, status, item_id, item_name, item_image, item_price,
         created_at, processed_at)
        VALUES (
          ${logId}, ${tenantId}, ${conversationId},
          ${"cart_inquiry:" + conversationId + ":" + Date.now()},
          ${shopId ?? ""},
          ${buyerUserId}, ${"unknown"},
          ${"[商品問い合わせ] カート情報のみ受信（テキストなし）"},
          ${"ja"}, ${CART_INQUIRY_REPLY}, ${"auto_replied"},
          ${itemId ?? null}, ${itemInfo?.name ?? null}, ${itemInfo?.image ?? null}, ${itemInfo?.price ?? null},
          ${Date.now()}, ${Date.now()}
        )`
    );

    if (canReply && settings.autoReplyEnabled) {
      const result = await sendShopeeReply({
        settings: { partnerId: partnerId!, partnerKey: partnerKey!, shopId: shopId!, accessToken: accessToken! },
        conversationId,
        toId: buyerUserId,
        message: CART_INQUIRY_REPLY,
      });
      if (result.success) {
        console.log(`[Webhook] Cart inquiry reply sent: conv=${conversationId}`);
      } else {
        console.error(`[Webhook] Cart inquiry reply failed: ${result.error}`);
        await db.run(sql`UPDATE chat_logs SET status='error' WHERE id=${logId}`);
      }
    } else {
      console.warn(`[Webhook] Cart inquiry: cannot reply (canReply=${canReply} autoReply=${settings.autoReplyEnabled})`);
    }
  } catch (err) {
    console.error(`[Webhook] Unhandled error in processCartInquiryAsync:`, err);
  }
}
