import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Tenants (SaaS multi-tenant) ────────────────────────────────────────────
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Tenant Settings (API keys per tenant) ───────────────────────────────────
export const tenantSettings = sqliteTable("tenant_settings", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  shopeePartnerId: text("shopee_partner_id"),
  shopeePartnerKey: text("shopee_partner_key"),
  shopeeShopId: text("shopee_shop_id"),
  shopeeAccessToken: text("shopee_access_token"),
  geminiApiKey: text("gemini_api_key"),
  geminiGemId: text("gemini_gem_id"), // Custom Gem ID backed by NotebookLM
  slackWebhookUrl: text("slack_webhook_url"),
  slackChannel: text("slack_channel"),
  confidenceThreshold: real("confidence_threshold").default(0.7).notNull(),
  autoReplyEnabled: integer("auto_reply_enabled", { mode: "boolean" }).default(true).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Chat Logs ────────────────────────────────────────────────────────────────
export const chatLogs = sqliteTable("chat_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  shopeeConversationId: text("shopee_conversation_id").notNull(),
  shopeeMessageId: text("shopee_message_id"),
  shopeeShopId: text("shopee_shop_id").notNull(),
  buyerUserId: text("buyer_user_id"),
  buyerUsername: text("buyer_username"),
  messageContent: text("message_content").notNull(),
  detectedLanguage: text("detected_language").default("ja"),
  aiResponse: text("ai_response"),
  confidenceScore: real("confidence_score"),
  informationSource: text("information_source"), // 'gem' | 'order_api' | 'web_search' | 'combined'
  status: text("status").notNull().default("pending"), // 'auto_replied' | 'escalated' | 'pending' | 'error'
  escalationReason: text("escalation_reason"),
  orderId: text("order_id"),
  // Product info from source_content.item_id
  itemId: text("item_id"),
  itemName: text("item_name"),
  itemImage: text("item_image"),
  itemPrice: real("item_price"),
  processedAt: integer("processed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Escalations ─────────────────────────────────────────────────────────────
export const escalations = sqliteTable("escalations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  chatLogId: text("chat_log_id").notNull(),
  reason: text("reason").notNull(), // 'low_confidence' | 'refund_request' | 'complaint' | 'angry_customer' | 'no_info'
  slackNotified: integer("slack_notified", { mode: "boolean" }).default(false).notNull(),
  slackTs: text("slack_ts"), // Slack message timestamp for threading
  ackSent: integer("ack_sent", { mode: "boolean" }).default(false).notNull(), // immediate ack to buyer
  status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'in_progress'
  resolvedBy: text("resolved_by"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Knowledge Base ───────────────────────────────────────────────────────────
export const knowledgeBase = sqliteTable("knowledge_base", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"),
  tags: text("tags"), // JSON array string
  sourceType: text("source_type").default("manual"), // 'manual' | 'escalation_learned' | 'import'
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Tenant Shops (per-country shop config) ───────────────────────────────────
export const tenantShops = sqliteTable("tenant_shops", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  country: text("country").notNull(), // TH | MY | SG | ID | PH | VN | TW | BR | MX
  shopId: text("shop_id").notNull(),
  shopName: text("shop_name"), // 表示用ラベル（同一国の複数店舗を区別）
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }), // Access token expiry (4h)
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }), // Refresh token expiry (30d)
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ─── Re-export auth schema ────────────────────────────────────────────────────
export * from "./auth-schema";
