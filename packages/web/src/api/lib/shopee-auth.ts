/**
 * Shopee OAuth helpers
 *
 * Sandbox base:  https://partner.uat.shopeemobile.com
 * Production:    https://partner.shopeemobile.com
 */

import crypto from "crypto";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";

// ─── Config ───────────────────────────────────────────────────────────────────

export function getShopeeBase(sandbox = false) {
  return sandbox
    ? "https://partner.uat.shopeemobile.com"
    : "https://partner.shopeemobile.com";
}

export function isSandbox() {
  return process.env.SHOPEE_SANDBOX === "true";
}

// ─── Signature ────────────────────────────────────────────────────────────────

export function makeSignature(
  partnerId: number,
  partnerKey: string,
  path: string,
  timestamp: number,
  extra: { shopId?: number; accessToken?: string } = {}
): string {
  let base = `${partnerId}${path}${timestamp}`;
  if (extra.accessToken) base += extra.accessToken;
  if (extra.shopId) base += extra.shopId;
  return crypto.createHmac("sha256", partnerKey).update(base).digest("hex");
}

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export function buildAuthUrl(
  partnerId: number,
  partnerKey: string,
  redirectUri: string,
  state?: string,
  sandbox = isSandbox()
): string {
  const timestamp = Math.floor(Date.now() / 1000);

  if (sandbox) {
    // Sandbox: /api/v2/shop/auth_partner — requires signature
    const path = "/api/v2/shop/auth_partner";
    const sign = makeSignature(partnerId, partnerKey, path, timestamp);
    const params = new URLSearchParams({
      partner_id: String(partnerId),
      timestamp: String(timestamp),
      sign,
      redirect: redirectUri,
    });
    if (state) params.set("state", state);
    return `https://partner.uat.shopeemobile.com${path}?${params}`;
  } else {
    // Production: open.shopee.com/auth
    const params = new URLSearchParams({
      partner_id: String(partnerId),
      redirect_uri: redirectUri,
      auth_type: "seller",
      response_type: "code",
    });
    if (state) params.set("state", state);
    return `https://open.shopee.com/auth?${params}`;
  }
}

// ─── Exchange code → tokens ───────────────────────────────────────────────────

export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;   // seconds until access_token expires (typically 14400 = 4h)
  shop_id: number;
  error?: string;
  message?: string;
}

export async function exchangeCodeForTokens(
  partnerId: number,
  partnerKey: string,
  code: string,
  sandbox = isSandbox()
): Promise<ShopeeTokenResponse> {
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = makeSignature(partnerId, partnerKey, path, timestamp);
  const base = getShopeeBase(sandbox);

  const res = await fetch(`${base}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, partner_id: partnerId, shop_id: 0 }),
  });

  if (!res.ok) {
    throw new Error(`Shopee token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ShopeeTokenResponse>;
}

// ─── Refresh access token ─────────────────────────────────────────────────────

export async function refreshAccessToken(
  partnerId: number,
  partnerKey: string,
  shopId: number,
  refreshToken: string,
  sandbox = isSandbox()
): Promise<ShopeeTokenResponse> {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = makeSignature(partnerId, partnerKey, path, timestamp);
  const base = getShopeeBase(sandbox);

  const res = await fetch(`${base}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, partner_id: partnerId, shop_id: shopId }),
  });

  if (!res.ok) {
    throw new Error(`Shopee token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ShopeeTokenResponse>;
}

// ─── Auto-refresh: get a valid access token (refresh if expired) ──────────────

const REFRESH_BUFFER_SECONDS = 300; // refresh 5 min before expiry

export async function getValidAccessToken(tenantId: string, shopId: string): Promise<{
  accessToken: string;
  shopId: string;
} | null> {
  const [shop] = await db
    .select()
    .from(schema.tenantShops)
    .where(
      and(
        eq(schema.tenantShops.tenantId, tenantId),
        eq(schema.tenantShops.shopId, shopId)
      )
    );

  if (!shop?.accessToken) return null;
  const country = shop.country;

  // Check if still valid (with buffer)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = shop.tokenExpiresAt ? Math.floor(shop.tokenExpiresAt.getTime() / 1000) : 0;

  if (expiresAt > now + REFRESH_BUFFER_SECONDS) {
    // Token still valid
    return { accessToken: shop.accessToken, shopId: shop.shopId };
  }

  // Need refresh — get partner credentials
  const [settings] = await db
    .select()
    .from(schema.tenantSettings)
    .where(eq(schema.tenantSettings.tenantId, tenantId));

  if (!settings?.shopeePartnerId || !settings?.shopeePartnerKey || !shop.refreshToken) {
    console.warn(`[shopee-auth] Cannot refresh token for tenant=${tenantId} country=${country}: missing credentials`);
    return shop.accessToken ? { accessToken: shop.accessToken, shopId: shop.shopId } : null;
  }

  console.log(`[shopee-auth] Refreshing access token for tenant=${tenantId} country=${country}`);

  try {
    const result = await refreshAccessToken(
      Number(settings.shopeePartnerId),
      settings.shopeePartnerKey,
      Number(shop.shopId),
      shop.refreshToken
    );

    if (result.error) {
      console.error(`[shopee-auth] Refresh error: ${result.error} ${result.message}`);
      return shop.accessToken ? { accessToken: shop.accessToken, shopId: shop.shopId } : null;
    }

    const newExpiresAt = new Date((now + result.expire_in) * 1000);
    const newRefreshExpiresAt = new Date((now + 30 * 24 * 3600) * 1000); // 30 days

    await db
      .update(schema.tenantShops)
      .set({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        tokenExpiresAt: newExpiresAt,
        refreshTokenExpiresAt: newRefreshExpiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tenantShops.tenantId, tenantId),
          eq(schema.tenantShops.shopId, shop.shopId)
        )
      );

    return { accessToken: result.access_token, shopId: shop.shopId };
  } catch (err) {
    console.error("[shopee-auth] Token refresh failed:", err);
    return shop.accessToken ? { accessToken: shop.accessToken, shopId: shop.shopId } : null;
  }
}

// ─── Background: refresh all shops nearing expiry ────────────────────────────

export async function refreshAllShopsIfNeeded(): Promise<void> {
  const BUFFER = 60 * 60; // refresh if expires within 1 hour
  const now = Math.floor(Date.now() / 1000);

  const shops = await db.select().from(schema.tenantShops);

  for (const shop of shops) {
    if (!shop.accessToken || !shop.refreshToken) continue;

    const expiresAt = shop.tokenExpiresAt
      ? Math.floor(shop.tokenExpiresAt.getTime() / 1000)
      : 0;

    if (expiresAt > now + BUFFER) continue; // still valid, skip

    console.log(`[shopee-auth] Background refresh: tenant=${shop.tenantId} country=${shop.country} shop=${shop.shopId}`);
    await getValidAccessToken(shop.tenantId, shop.shopId);
  }
}
