// Shopee Chat API & Order API service
import crypto from "crypto";

export type ShopeeSettings = {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken: string;
};

function generateSignature(
  partnerId: string,
  partnerKey: string,
  path: string,
  timestamp: number,
  accessToken?: string,
  shopId?: string
): string {
  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

// Send reply via Shopee Chat API
export async function sendShopeeReply(params: {
  settings: ShopeeSettings;
  conversationId: string;
  toId: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const { settings, conversationId, toId, message } = params;
  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(
    settings.partnerId,
    settings.partnerKey,
    path,
    timestamp,
    settings.accessToken,
    settings.shopId
  );

  const url = `https://partner.shopeemobile.com${path}?partner_id=${settings.partnerId}&timestamp=${timestamp}&sign=${sign}&shop_id=${settings.shopId}&access_token=${settings.accessToken}`;

  try {
    const payload = {
      to_id: Number(toId),
      message_type: "text",
      content: { text: message },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as Record<string, unknown>;
    if (data.error && data.error !== "" && data.error !== "error_none") {
      console.error(`[sendShopeeReply] failed: ${data.error} — ${data.message}`);
      return { success: false, error: String(data.error) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Get order info via Shopee Order API
export async function getShopeeOrderInfo(params: {
  settings: ShopeeSettings;
  orderId: string;
}): Promise<Record<string, unknown> | null> {
  const { settings, orderId } = params;
  const path = "/api/v2/order/get_order_detail";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(
    settings.partnerId,
    settings.partnerKey,
    path,
    timestamp,
    settings.accessToken,
    settings.shopId
  );

  const url = `https://partner.shopeemobile.com${path}?partner_id=${settings.partnerId}&timestamp=${timestamp}&sign=${sign}&shop_id=${settings.shopId}&access_token=${settings.accessToken}&order_sn_list=${orderId}`;

  try {
    const res = await fetch(url);
    const data = await res.json() as { response?: { order_list?: unknown[] } };
    return (data.response?.order_list?.[0] as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

// Get product info from Shopee Product API
export async function getShopeeItemInfo(params: {
  settings: ShopeeSettings;
  itemId: string;
}): Promise<{ name: string; image: string; price: number } | null> {
  const { settings, itemId } = params;
  const path = "/api/v2/product/get_item_base_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(
    settings.partnerId,
    settings.partnerKey,
    path,
    timestamp,
    settings.accessToken,
    settings.shopId
  );
  const url = `https://partner.shopeemobile.com${path}?partner_id=${settings.partnerId}&timestamp=${timestamp}&sign=${sign}&shop_id=${settings.shopId}&access_token=${settings.accessToken}&item_id_list=${itemId}&need_tax_info=false&need_complaint_policy=false`;
  try {
    const res = await fetch(url);
    const data = await res.json() as Record<string, unknown>;
    console.log(`[getShopeeItemInfo] raw response keys:`, Object.keys(data));
    const response = data.response as Record<string, unknown> | undefined;
    const item = (response?.item_list as Record<string, unknown>[])?.[0];
    if (!item) {
      console.warn(`[getShopeeItemInfo] no item found. error=${data.error} msg=${data.message}`);
      return null;
    }
    const name = String(item.item_name ?? "");
    // image field structure varies — try both formats
    const imageField = item.image as Record<string, unknown> | undefined;
    const imageUrlList = imageField?.image_url_list as string[] | undefined;
    const image = imageUrlList?.[0] ?? "";
    console.log(`[getShopeeItemInfo] item=${name} image=${image} imageField=${JSON.stringify(imageField)}`);
    // price_info array → first entry current_price
    const priceInfo = item.price_info as { current_price?: number }[] | undefined;
    const price = priceInfo?.[0]?.current_price ?? 0;
    return { name, image, price };
  } catch (err) {
    console.error(`[getShopeeItemInfo] exception:`, err);
    return null;
  }
}

// Send sticker reply via Shopee Chat API
export async function sendStickerReply(params: {
  settings: ShopeeSettings;
  conversationId: string;
  toId: string;
  stickerId: string | number;
  stickerPackageId: string | number;
}): Promise<{ success: boolean; error?: string }> {
  const { settings, conversationId, toId, stickerId, stickerPackageId } = params;
  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSignature(
    settings.partnerId,
    settings.partnerKey,
    path,
    timestamp,
    settings.accessToken,
    settings.shopId
  );

  const url = `https://partner.shopeemobile.com${path}?partner_id=${settings.partnerId}&timestamp=${timestamp}&sign=${sign}&shop_id=${settings.shopId}&access_token=${settings.accessToken}`;

  try {
    // Shopee API requires sticker_id and sticker_package_id as STRINGS (not numbers)
    const payload: Record<string, unknown> = {
      to_id: Number(toId),
      message_type: "sticker",
      content: {
        sticker_id: String(stickerId),
        sticker_package_id: String(stickerPackageId),
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as Record<string, unknown>;
    if (data.error && data.error !== "" && data.error !== "error_none") {
      console.error(`[sendStickerReply] failed: ${data.error} — ${data.message} | payload=${JSON.stringify(payload)}`);
      return { success: false, error: String(data.error) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Validate webhook signature from Shopee
export function validateShopeeWebhook(
  body: string,
  signature: string,
  partnerKey: string
): boolean {
  const expected = crypto
    .createHmac("sha256", partnerKey)
    .update(body)
    .digest("hex");
  return expected === signature;
}
