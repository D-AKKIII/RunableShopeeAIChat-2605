import { generateText } from "ai";
import { gateway } from "./gateway";

export type ProcessResult = {
  reply: string;
  confidence: number;
  language: string;
  source: string;
  shouldEscalate: boolean;
  escalationReason?: string;
};

// Detect language from text
function detectLanguage(text: string): string {
  // Japanese
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
    if (/[\u3040-\u309f]/.test(text)) return "ja";
    return "zh";
  }
  // Korean
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  // Thai
  if (/[\u0E00-\u0E7F]/.test(text)) return "th";
  // Vietnamese heuristic
  if (/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text)) return "vi";
  // Arabic
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
}

// Keywords that trigger escalation
const ESCALATION_KEYWORDS = [
  // Refund/return
  "返金", "返品", "キャンセル", "補償", "賠償",
  "refund", "return", "cancel", "compensation", "reimburse",
  "คืนเงิน", "คืนสินค้า", "환불", "退款", "退货",
  // Anger / complaint
  "詐欺", "クレーム", "怒り", "ひどい", "最悪",
  "fraud", "scam", "terrible", "awful", "lawsuit", "legal",
  "骗", "投诉",
  // Legal
  "弁護士", "裁判", "訴訟",
];

function detectEscalationKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// Core AI processing using Gemini Gem (backed by NotebookLM)
export async function processMessage(params: {
  message: string;
  geminiApiKey: string;
  geminiGemId?: string;
  knowledgeBase?: Array<{ question: string; answer: string }>;
  orderInfo?: Record<string, unknown> | null;
  itemInfo?: { name: string; image: string; price: number };
  confidenceThreshold?: number;
}): Promise<ProcessResult> {
  const {
    message,
    geminiApiKey,
    geminiGemId,
    knowledgeBase = [],
    orderInfo,
    itemInfo,
    confidenceThreshold = 0.7,
  } = params;

  const language = detectLanguage(message);
  const hasEscalationKeyword = detectEscalationKeywords(message);

  if (hasEscalationKeyword) {
    return {
      reply: getEscalationAck(language),
      confidence: 0,
      language,
      source: "escalation_keyword",
      shouldEscalate: true,
      escalationReason: "escalation_keyword_detected",
    };
  }

  // Build knowledge context
  const kbContext =
    knowledgeBase.length > 0
      ? `\n\n## ナレッジベース（店舗固有情報 - 最優先）:\n${knowledgeBase
          .map((kb) => `Q: ${kb.question}\nA: ${kb.answer}`)
          .join("\n---\n")}`
      : "";

  const orderContext = orderInfo
    ? `\n\n## 注文情報:\n${JSON.stringify(orderInfo, null, 2)}`
    : "";

  const itemContext = itemInfo
    ? `\n\n## 問い合わせ対象商品:\n商品名: ${itemInfo.name}\n価格: ${itemInfo.price}\n\nこの商品名をもとに、あなたの知識から商品の特徴・使い方・メリット・ユーザーへのおすすめポイントを積極的に活用して回答してください。商品の魅力が伝わるよう、具体的かつ親切に説明してください。購買意欲を高める表現を使ってください。`
    : "";

  const langInstructions: Record<string, string> = {
    ja: "日本語で回答してください。",
    en: "Please respond in English.",
    zh: "请用中文回答。",
    ko: "한국어로 답해주세요.",
    th: "กรุณาตอบเป็นภาษาไทย",
    vi: "Vui lòng trả lời bằng tiếng Việt.",
    ar: "يرجى الرد باللغة العربية.",
  };
  const langInstruction = langInstructions[language] ?? "Please respond in the same language as the customer's message.";

  const itemGuidance = itemInfo
    ? `
## 商品に関する問い合わせへの対応方針:
- 商品名「${itemInfo.name}」について、あなたの知識を最大限に活用して詳しく・具体的に回答してください
- 使い方・特徴・メリットを分かりやすく説明し、顧客が「買って良かった」「早く使いたい」と感じられる回答にしてください
- 単なる事実の列挙ではなく、顧客の立場に立った共感・提案を含めてください
- 回答は200〜400文字程度で、読みやすく構成してください
- ただし、ナレッジベースに正確な情報がある場合はそちらを最優先してください`
    : "";

  const systemPrompt = `あなたはショップカスタマーサポートの担当者です。AIであることは絶対に明かさず、自分の名前やシステム名・使用技術については答えないでください。
${geminiGemId ? `以下の知識ベース情報を優先的に参照して回答してください。` : ""}

## 重要なルール:
1. ${langInstruction}
2. ナレッジベースの情報を最優先で使用し、断定的に答えてください（「〜です」）
3. 注文情報がある場合は「〜となっております」の形式で答えてください
4. 価格・在庫・発送日は必ずナレッジベースまたは注文情報を参照してください
5. 返金・返品・補償の判断は行わないでください
6. 個人情報・法的判断・医療判断は行わないでください
7. 一般的な情報を使う場合も具体的に説明してください。答えられない・確信が持てない場合は、曖昧な返答や「確認します」などの言葉は使わず、confidence を低く設定してください（システムが自動でエスカレーション処理します）
${itemGuidance}

## 回答の最後に必ず以下のJSONを含めてください（本文の後、---区切りで）:
---JSON
{"confidence": 0.0-1.0, "source": "knowledge_base|order_api|general|combined"}
---END
${kbContext}${orderContext}${itemContext}

顧客からの問い合わせ: ${message}`;

  try {
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash"),
      prompt: systemPrompt,
      headers: geminiApiKey ? { "X-Custom-Gemini-Key": geminiApiKey } : undefined,
    });

    // Parse confidence and source from response
    let confidence = 0.75;
    let source = "gem";
    let reply = text;

    const jsonMatch = text.match(/---JSON\s*([\s\S]*?)\s*---END/);
    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]);
        confidence = meta.confidence ?? 0.75;
        source = meta.source ?? "gem";
        reply = text.replace(/---JSON[\s\S]*?---END/g, "").trim();
      } catch {
        // use defaults
      }
    }

    const shouldEscalate = confidence < confidenceThreshold;

    return {
      reply,
      confidence,
      language,
      source,
      shouldEscalate,
      escalationReason: shouldEscalate ? "low_confidence" : undefined,
    };
  } catch (err) {
    console.error("[AI Engine] Error:", err);
    return {
      reply: getEscalationAck(language),
      confidence: 0,
      language,
      source: "error",
      shouldEscalate: true,
      escalationReason: "ai_error",
    };
  }
}

export function getEscalationAck(language: string): string {
  const messages: Record<string, string> = {
    ja: "お問い合わせいただきありがとうございます。詳細を確認いたしますので、担当者より改めてご連絡いたします。",
    en: "Thank you for your inquiry. We are reviewing the details and will get back to you shortly.",
    zh: "感谢您的咨询。我们正在确认详情，相关负责人将尽快与您联系。",
    ko: "문의해 주셔서 감사합니다. 내용을 확인 후 담당자가 다시 연락드리겠습니다.",
    th: "ขอบคุณสำหรับการติดต่อ เราจะตรวจสอบรายละเอียดและติดต่อกลับในเร็วๆ นี้",
    vi: "Cảm ơn bạn đã liên hệ. Chúng tôi đang xem xét chi tiết và sẽ liên hệ lại với bạn sớm.",
  };
  return messages[language] ?? messages["en"];
}
