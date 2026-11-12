import { useCustomer, useListPlans } from "autumn-js/react";
import { DashboardLayout } from "../components/layout";
import { Check, Zap } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "自動返信 20件/月",
    "AI信頼度評価",
    "Slack通知（エスカレーション）",
    "多言語対応",
    "チャットログ閲覧",
  ],
  starter: [
    "自動返信 100件/月",
    "Gemini Gem (NotebookLM) 連携",
    "Shopee Order API 連携",
    "ナレッジベース管理",
    "ダッシュボード分析",
    "Slack通知",
    "多言語対応",
  ],
  pro: [
    "自動返信 無制限",
    "すべてのStarterの機能",
    "優先サポート",
    "カスタム信頼度閾値",
    "エスカレーション詳細レポート",
  ],
};

export default function PricingPage() {
  const { data: customer, attach } = useCustomer();
  const { data: plans } = useListPlans();

  const activePlanId = customer?.subscriptions?.[0]?.planId ?? "free";
  const balance = customer?.balances?.["auto_replies"];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">プラン</h1>
          <p className="text-sm text-gray-500 mt-1">月額サブスクリプション</p>
        </div>

        {/* Current usage */}
        {balance && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">今月の自動返信数</p>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-orange-600">{balance.usage ?? 0}</span>
                {!balance.unlimited && <span className="text-gray-400"> / {balance.granted}</span>}
                {balance.unlimited && <span className="text-gray-400"> / 無制限</span>}
              </p>
            </div>
            {!balance.unlimited && (
              <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((balance.usage ?? 0) / (balance.granted ?? 1)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(plans ?? []).filter(p => ["free", "starter", "pro"].includes(p.id)).map((plan) => {
            const isActive = plan.id === activePlanId;
            const features = PLAN_FEATURES[plan.id] ?? [];
            const isPro = plan.id === "pro";

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border p-5 relative ${
                  isPro
                    ? "border-orange-300 shadow-md shadow-orange-50"
                    : "border-gray-100"
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                      <Zap size={11} /> おすすめ
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-1">
                    {plan.price ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">
                          ${plan.price.amount}
                        </span>
                        <span className="text-sm text-gray-400">/月</span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">無料</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isActive}
                  onClick={() =>
                    attach({ planId: plan.id, successUrl: window.location.origin + "/dashboard" })
                  }
                  className={`w-full py-2 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-400 cursor-default"
                      : isPro
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : "border border-orange-500 text-orange-600 hover:bg-orange-50"
                  }`}
                >
                  {isActive ? "現在のプラン" : plan.price ? "アップグレード" : "ダウングレード"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">
          クレジットカード決済（Stripe）。いつでもキャンセル可能。
        </p>
      </div>
    </DashboardLayout>
  );
}
