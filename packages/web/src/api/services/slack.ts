// Slack notification service
export async function sendSlackEscalation(params: {
  webhookUrl: string;
  channel?: string;
  buyerUsername: string;
  conversationId: string;
  message: string;
  aiResponse: string;
  reason: string;
  confidence: number;
  language: string;
  orderId?: string | null;
}): Promise<{ success: boolean; ts?: string }> {
  const {
    webhookUrl,
    channel,
    buyerUsername,
    conversationId,
    message,
    aiResponse,
    reason,
    confidence,
    language,
    orderId,
  } = params;

  const reasonLabels: Record<string, string> = {
    low_confidence: "🔶 AI信頼度不足",
    escalation_keyword_detected: "🔴 エスカレーションキーワード検出",
    ai_error: "❌ AIエラー",
    refund_request: "💰 返金・返品リクエスト",
    complaint: "😤 クレーム・トラブル",
    angry_customer: "😡 感情的な顧客",
  };

  const payload = {
    channel,
    text: `🚨 *Shopeeチャット エスカレーション通知*`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 Shopeeチャット エスカレーション",
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*理由:*\n${reasonLabels[reason] ?? reason}` },
          { type: "mrkdwn", text: `*AI信頼度:*\n${(confidence * 100).toFixed(0)}%` },
          { type: "mrkdwn", text: `*顧客:*\n${buyerUsername}` },
          { type: "mrkdwn", text: `*言語:*\n${language.toUpperCase()}` },
          ...(orderId ? [{ type: "mrkdwn", text: `*注文ID:*\n${orderId}` }] : []),
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*顧客メッセージ:*\n> ${message}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*AI一次対応（送信済み）:*\n> ${aiResponse}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*会話ID:* \`${conversationId}\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Shopeeで返信する" },
            style: "primary",
            url: `https://seller.shopee.com.my/portal/chat`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { success: true };
    return { success: false };
  } catch (err) {
    console.error("[Slack] Error:", err);
    return { success: false };
  }
}
