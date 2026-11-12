/**
 * Shopee OAuth routes
 *
 * GET  /api/shopee-auth/url          → 認証URL生成（設定画面から呼ぶ）
 * GET  /api/shopee-auth/callback     → Shopeeからのリダイレクト受け取り
 * POST /api/shopee-auth/refresh/:id（店舗行ID） → 手動でトークン更新
 * GET  /api/shopee-auth/status       → 全国のトークン有効期限チェック
 */

import { Hono } from "hono";
import { randomUUID } from "crypto";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, authMiddleware } from "../middleware/auth";
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  isSandbox,
} from "../lib/shopee-auth";
import { COUNTRIES } from "./shops";

async function getTenantId(userId: string, userName?: string): Promise<string> {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.ownerId, userId));

  if (tenant) return tenant.id;

  // Auto-create tenant on first access
  const newId = randomUUID();
  await db.insert(schema.tenants).values({
    id: newId,
    name: userName ?? "My Shop",
    ownerId: userId,
    createdAt: new Date(),
  });
  return newId;
}

async function getTenantSettings(tenantId: string) {
  const [s] = await db
    .select()
    .from(schema.tenantSettings)
    .where(eq(schema.tenantSettings.tenantId, tenantId));
  return s ?? null;
}

export const shopeeOauth = new Hono()
  .use("*", authMiddleware)

  // ── 認証URL生成 ──────────────────────────────────────────────────────────────
  .get("/url", requireAuth, async (c) => {
    const user = c.get("user")!;
    const country = (c.req.query("country") ?? "").toUpperCase();
    const tenantId = await getTenantId(user.id, user.name ?? undefined);

    if (!COUNTRIES.find((cc) => cc.code === country)) {
      return c.json({ error: "無効な国コードです" }, 400);
    }

    const settings = await getTenantSettings(tenantId);
    if (!settings?.shopeePartnerId || !settings?.shopeePartnerKey) {
      return c.json({ error: "Partner IDとPartner Keyを先に設定してください" }, 400);
    }

    const websiteUrl = process.env.WEBSITE_URL ?? "http://localhost:4200";
    const redirectUri = `${websiteUrl}/api/shopee-auth/callback`;
    const state = Buffer.from(JSON.stringify({ tenantId, country, userId: user.id })).toString("base64url");

    const url = buildAuthUrl(Number(settings.shopeePartnerId), settings.shopeePartnerKey, redirectUri, state);

    return c.json({ url, sandbox: isSandbox() }, 200);
  })

  // ── OAuthコールバック ─────────────────────────────────────────────────────────
  .get("/callback", async (c) => {
    const code = c.req.query("code");
    const stateB64 = c.req.query("state");
    const shopId = c.req.query("shop_id"); // Shopeeがshop_idも返す

    if (!code || !stateB64) {
      return c.html(`<html><body><h2>認証エラー</h2><p>codeまたはstateがありません。</p></body></html>`, 400);
    }

    let state: { tenantId: string; country: string; userId: string };
    try {
      state = JSON.parse(Buffer.from(stateB64, "base64url").toString());
    } catch {
      return c.html(`<html><body><h2>認証エラー</h2><p>不正なstateパラメータです。</p></body></html>`, 400);
    }

    const settings = await getTenantSettings(state.tenantId);
    if (!settings?.shopeePartnerId || !settings?.shopeePartnerKey) {
      return c.html(`<html><body><h2>認証エラー</h2><p>Partner情報が見つかりません。</p></body></html>`, 400);
    }

    try {
      const tokens = await exchangeCodeForTokens(
        Number(settings.shopeePartnerId),
        settings.shopeePartnerKey,
        code
      );

      if (tokens.error) {
        return c.html(`<html><body><h2>認証エラー</h2><p>${tokens.message}</p></body></html>`, 400);
      }

      const now = Math.floor(Date.now() / 1000);
      const resolvedShopId = shopId ?? String(tokens.shop_id ?? "");
      const tokenExpiresAt = new Date((now + tokens.expire_in) * 1000);
      const refreshTokenExpiresAt = new Date((now + 30 * 24 * 3600) * 1000); // 30日

      // Upsert shop record
      if (!resolvedShopId) {
        return c.html(`<html><body><h2>認証エラー</h2><p>shop_id を取得できませんでした。</p></body></html>`, 400);
      }
      // Shops are identified by shopId — a country may have several shops
      const [existing] = await db
        .select()
        .from(schema.tenantShops)
        .where(
          and(
            eq(schema.tenantShops.tenantId, state.tenantId),
            eq(schema.tenantShops.shopId, resolvedShopId)
          )
        );

      if (existing) {
        await db
          .update(schema.tenantShops)
          .set({
            country: state.country,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiresAt,
            refreshTokenExpiresAt,
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.tenantShops.id, existing.id));
      } else {
        await db.insert(schema.tenantShops).values({
          id: randomUUID(),
          tenantId: state.tenantId,
          country: state.country,
          shopId: resolvedShopId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt,
          refreshTokenExpiresAt,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Redirect back to settings page with success
      const websiteUrl = process.env.WEBSITE_URL ?? "http://localhost:4200";
      return c.redirect(`${websiteUrl}/settings?oauth=success&country=${state.country}&shop=${resolvedShopId}`);
    } catch (err) {
      console.error("[shopee-oauth] callback error:", err);
      return c.html(`<html><body><h2>認証エラー</h2><p>${String(err)}</p></body></html>`, 500);
    }
  })

  // ── 手動トークン更新 ──────────────────────────────────────────────────────────
  .post("/refresh/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const rowId = c.req.param("id");
    const tenantId = await getTenantId(user.id, user.name ?? undefined);

    const settings = await getTenantSettings(tenantId);
    if (!settings?.shopeePartnerId || !settings?.shopeePartnerKey) {
      return c.json({ error: "Partner情報が見つかりません" }, 400);
    }

    const [shop] = await db
      .select()
      .from(schema.tenantShops)
      .where(
        and(
          eq(schema.tenantShops.tenantId, tenantId),
          eq(schema.tenantShops.id, rowId)
        )
      );

    if (!shop?.refreshToken) {
      return c.json({ error: "Refresh Tokenがありません。再認証してください。" }, 400);
    }

    const result = await refreshAccessToken(
      Number(settings.shopeePartnerId),
      settings.shopeePartnerKey,
      Number(shop.shopId),
      shop.refreshToken
    );

    if (result.error) {
      return c.json({ error: result.message ?? result.error }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = new Date((now + result.expire_in) * 1000);
    const refreshTokenExpiresAt = new Date((now + 30 * 24 * 3600) * 1000);

    await db
      .update(schema.tenantShops)
      .set({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        tokenExpiresAt,
        refreshTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenantShops.id, shop.id));

    return c.json({ success: true, expiresAt: tokenExpiresAt.toISOString() }, 200);
  })

  // ── トークン有効期限チェック ───────────────────────────────────────────────────
  .get("/status", requireAuth, async (c) => {
    const user = c.get("user")!;
    const tenantId = await getTenantId(user.id, user.name ?? undefined);
    if (!tenantId) return c.json({ shops: [] }, 200);

    const rows = await db
      .select()
      .from(schema.tenantShops)
      .where(eq(schema.tenantShops.tenantId, tenantId));

    const now = Date.now();
    const shops = rows.map((s) => {
      const tokenExpiresMs = s.tokenExpiresAt?.getTime() ?? 0;
      const refreshExpiresMs = s.refreshTokenExpiresAt?.getTime() ?? 0;
      const tokenValid = tokenExpiresMs > now;
      const refreshValid = refreshExpiresMs > now;

      return {
        id: s.id,
        country: s.country,
        shopId: s.shopId,
        shopName: s.shopName,
        hasAccessToken: !!s.accessToken,
        hasRefreshToken: !!s.refreshToken,
        tokenValid,
        refreshValid,
        tokenExpiresAt: s.tokenExpiresAt?.toISOString() ?? null,
        refreshTokenExpiresAt: s.refreshTokenExpiresAt?.toISOString() ?? null,
        needsReauth: !s.refreshToken || !refreshValid,
      };
    });

    return c.json({ shops }, 200);
  });
