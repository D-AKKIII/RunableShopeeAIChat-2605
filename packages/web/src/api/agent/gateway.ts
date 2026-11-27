import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Runable AI Gateway は使わず、テナント設定（tenant_settings.gemini_api_key）の
// Google AI Studio キーで Gemini を直接呼ぶ。
// 旧: gateway("google/gemini-3-flash") と同じモデル（Google 側の ID は -preview 付き）。
export const GEMINI_MODEL_ID = "gemini-3-flash-preview";

export function getGeminiModel(apiKey?: string | null) {
  const key = (apiKey ?? "").trim();
  if (!key) {
    throw new Error("Gemini API Key が未設定です（設定画面の「Gemini API Key」に入力してください）");
  }
  return createGoogleGenerativeAI({ apiKey: key })(GEMINI_MODEL_ID);
}
