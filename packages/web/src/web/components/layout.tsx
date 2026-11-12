import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { hc } from "hono/client";
import type { AppType } from "../../api";

const client = hc<AppType>("/");

type QuotaState = {
  allowed: boolean;
  unlimited: boolean;
  remaining: number;
  usage: number;
  granted: number;
  nextResetAt: number | null;
} | null;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [quota, setQuota] = useState<QuotaState>(null);

  useEffect(() => {
    (client.api.billing.quota.$get() as Promise<Response>)
      .then((r) => r.json())
      .then((data: any) => setQuota(data))
      .catch(() => {});
  }, []);

  const showBanner = quota && !quota.unlimited && !quota.allowed;

  const resetDate = quota?.nextResetAt
    ? new Date(quota.nextResetAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col">
        {showBanner && (
          <div className="bg-red-600 text-white text-sm font-medium px-6 py-3 flex items-center justify-between">
            <span>
              ⚠️ 今月の自動返信上限（{quota.usage}件使用）に達しました。新しいメッセージへの自動返信が停止しています。
              {resetDate && ` リセット日：${resetDate}`}
            </span>
            <a
              href="/pricing"
              className="ml-4 underline whitespace-nowrap hover:text-red-200 transition-colors"
            >
              プランをアップグレード →
            </a>
          </div>
        )}
        <main className="flex-1 p-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
