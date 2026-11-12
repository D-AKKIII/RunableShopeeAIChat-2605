import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout";
import {
  CheckCircle, AlertTriangle, Clock, ChevronLeft, ChevronRight,
  RefreshCw, Send, FlaskConical, Trash2, X,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  auto_replied: { label: "自動返信", color: "text-green-700 bg-green-100", dot: "bg-green-500" },
  escalated: { label: "エスカレーション", color: "text-amber-700 bg-amber-100", dot: "bg-amber-500" },
  pending: { label: "処理中", color: "text-blue-700 bg-blue-100", dot: "bg-blue-500" },
  error: { label: "エラー", color: "text-red-700 bg-red-100", dot: "bg-red-500" },
};

const LANG_FLAGS: Record<string, string> = {
  ja: "🇯🇵", en: "🇺🇸", zh: "🇨🇳", ko: "🇰🇷", th: "🇹🇭", vi: "🇻🇳", ar: "🇸🇦",
};

const SOURCE_LABELS: Record<string, string> = {
  knowledge_base: "ナレッジ",
  order_api: "注文API",
  gem: "Gemini",
  combined: "複合",
  general: "一般",
  error: "エラー",
  escalation_keyword: "KW検知",
};

/** Robustly format any createdAt value coming from the API.
 *
 * Root cause: Drizzle-orm + libsql with mode:"timestamp" stores Unix seconds
 * in the DB but calls new Date(seconds) — treating seconds as milliseconds —
 * so the resulting Date is in the year ~58358.
 * We detect this by checking year > 9999 and divide by 1000 to correct it.
 */
function formatDate(v: unknown): string {
  if (v == null) return "—";

  let d: Date | null = null;

  if (typeof v === "string" && v.length > 0) {
    d = new Date(v);
    if (isNaN(d.getTime())) {
      // Maybe numeric string (raw unix seconds)
      const n = Number(v);
      if (!isNaN(n) && n > 0) {
        d = new Date(n > 1e12 ? n : n * 1000);
      } else {
        return v;
      }
    }
  } else if (typeof v === "number" && v > 0) {
    d = new Date(v > 1e12 ? v : v * 1000);
  } else if (v instanceof Date) {
    d = v;
  }

  if (!d || isNaN(d.getTime())) return "—";

  // Drizzle bug: stored unix seconds but new Date(seconds) treats them as ms
  // → year comes out as ~58358. Detect year > 9999 and divide by 1000.
  if (d.getFullYear() > 9999) {
    d = new Date(d.getTime() / 1000);
  }

  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<{
    reply: string; confidence: number; shouldEscalate: boolean; source: string;
  } | null>(null);
  const limit = 20;

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await (api.logs.$delete as any)({ json: { ids } });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () => { setCheckedIds(new Set()); refetch(); },
  });

  const testMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.logs["test-message"].$post({ json: { message, buyerUsername: "テストユーザー" } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data as { reply: string; confidence: number; shouldEscalate: boolean; source: string });
      refetch();
    },
  });

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = (data?.logs ?? []).map((l: Record<string, unknown>) => String(l.id));
    setCheckedIds(checkedIds.size === allIds.length ? new Set() : new Set(allIds));
  };

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["logs", page, statusFilter],
    queryFn: async () => {
      const res = await api.logs.$get({
        query: { page: String(page), limit: String(limit), ...(statusFilter ? { status: statusFilter } : {}) },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);
  const logs: Record<string, unknown>[] = data?.logs ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">チャットログ</h1>
            <p className="text-xs text-gray-500 mt-0.5">全 {data?.total ?? 0} 件</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setShowTestPanel(!showTestPanel); setTestResult(null); }}
              className="flex items-center gap-1.5 text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600 transition-colors"
            >
              <FlaskConical size={13} />AIテスト
            </button>
            {checkedIds.size > 0 && (
              <button
                onClick={() => { if (confirm(`${checkedIds.size}件削除しますか？`)) deleteMutation.mutate(Array.from(checkedIds)); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-xs bg-red-500 text-white rounded-lg px-3 py-1.5 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={13} />}
                {checkedIds.size}件削除
              </button>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />更新
            </button>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">すべて</option>
              <option value="auto_replied">自動返信</option>
              <option value="escalated">エスカレーション</option>
              <option value="pending">処理中</option>
              <option value="error">エラー</option>
            </select>
          </div>
        </div>

        {/* Test Panel */}
        {showTestPanel && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <FlaskConical size={14} />AIテスト — 顧客メッセージをシミュレート
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && testMessage.trim()) testMutation.mutate(testMessage.trim()); }}
                placeholder="例: 注文はいつ届きますか？"
                className="flex-1 text-sm border border-orange-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
              <button
                onClick={() => { if (testMessage.trim()) testMutation.mutate(testMessage.trim()); }}
                disabled={testMutation.isPending || !testMessage.trim()}
                className="flex items-center gap-1.5 text-sm bg-orange-500 text-white rounded-lg px-4 py-2 hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {testMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
                送信
              </button>
            </div>
            {testResult && (
              <div className="bg-white rounded-lg p-3 space-y-2 border border-orange-100">
                <div className="flex items-center gap-2">
                  {testResult.shouldEscalate
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">エスカレーション</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">自動返信</span>
                  }
                  <span className="text-xs text-gray-400">信頼度 {(testResult.confidence * 100).toFixed(0)}% / {testResult.source}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{testResult.reply}</p>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-400 text-sm">エラー: {String(error)}</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">ログがありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 960 }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 accent-orange-500"
                        checked={logs.length > 0 && checkedIds.size === logs.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">日時</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">顧客</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">商品</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">メッセージ</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">言語</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">信頼度</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">情報源</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => {
                    const statusKey = String(log.status);
                    const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
                    const isChecked = checkedIds.has(String(log.id));
                    return (
                      <tr
                        key={String(log.id)}
                        onClick={() => setSelected(log)}
                        className={`hover:bg-orange-50/40 cursor-pointer transition-colors ${isChecked ? "bg-red-50" : ""}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => toggleCheck(String(log.id), e)}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 accent-orange-500"
                            checked={isChecked}
                            onChange={() => {}}
                          />
                        </td>
                        {/* 日時 */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-500">{formatDate(log.createdAt)}</span>
                        </td>
                        {/* 顧客 */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs font-medium text-gray-800">{String(log.buyerUsername ?? "—")}</span>
                        </td>
                        {/* 商品 */}
                        <td className="px-3 py-2.5">
                          {log.itemName ? (
                            <div className="flex items-center gap-2" style={{ minWidth: 140, maxWidth: 200 }}>
                              {log.itemImage ? (
                                <img
                                  src={String(log.itemImage)}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-100"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
                              )}
                              <span className="text-xs text-gray-700 line-clamp-2 leading-tight">{String(log.itemName)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">不明</span>
                          )}
                        </td>
                        {/* メッセージ */}
                        <td className="px-3 py-2.5" style={{ maxWidth: 260 }}>
                          <span className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{String(log.messageContent ?? "")}</span>
                        </td>
                        {/* 言語 */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-600">
                            {LANG_FLAGS[String(log.detectedLanguage)] ?? "🌐"}{" "}
                            <span className="font-mono text-gray-400">{String(log.detectedLanguage ?? "").toUpperCase()}</span>
                          </span>
                        </td>
                        {/* 信頼度 */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {log.confidenceScore != null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.round(Number(log.confidenceScore) * 100)}%`,
                                    background: Number(log.confidenceScore) >= 0.7 ? "#22C55E" : "#F59E0B",
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 font-mono">
                                {Math.round(Number(log.confidenceScore) * 100)}%
                              </span>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        {/* 情報源 */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-500">{SOURCE_LABELS[String(log.informationSource)] ?? "—"}</span>
                        </td>
                        {/* ステータス */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {(page - 1) * limit + 1}〜{Math.min(page * limit, data?.total ?? 0)} / {data?.total ?? 0} 件
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="flex items-center px-2 text-xs text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">ログ詳細</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <DetailRow label="受信日時" value={formatDate(selected.createdAt)} />
              <DetailRow label="顧客" value={String(selected.buyerUsername ?? "—")} />

              {selected.itemName ? (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">商品</p>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    {selected.itemImage && (
                      <img
                        src={String(selected.itemImage)}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-snug">{String(selected.itemName)}</p>
                      {selected.itemPrice != null && (
                        <p className="text-xs text-gray-500 mt-0.5">RM {Number(selected.itemPrice).toFixed(2)}</p>
                      )}
                      {selected.itemId && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">ID: {String(selected.itemId)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <DetailRow label="商品" value="不明" />
              )}

              {selected.orderId && <DetailRow label="注文ID" value={String(selected.orderId)} />}

              <div>
                <p className="text-xs text-gray-400 mb-1.5">問い合わせ内容</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
                  {String(selected.messageContent ?? "")}
                </p>
              </div>

              {selected.aiResponse && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">AI返信</p>
                  <p className="text-sm text-gray-700 bg-orange-50 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
                    {String(selected.aiResponse)}
                  </p>
                </div>
              )}

              {selected.escalationReason && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">エスカレーション理由</p>
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{String(selected.escalationReason)}</p>
                </div>
              )}

              <div className="flex items-center gap-4 pt-1">
                {selected.detectedLanguage && (
                  <span className="text-xs text-gray-500">
                    {LANG_FLAGS[String(selected.detectedLanguage)] ?? "🌐"} {String(selected.detectedLanguage).toUpperCase()}
                  </span>
                )}
                {selected.confidenceScore != null && (
                  <span className="text-xs text-gray-500">信頼度 {Math.round(Number(selected.confidenceScore) * 100)}%</span>
                )}
                {selected.status && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${(STATUS_CONFIG[String(selected.status)] ?? STATUS_CONFIG.pending).color}`}>
                    {(STATUS_CONFIG[String(selected.status)] ?? STATUS_CONFIG.pending).label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <p className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</p>
      <p className="text-sm text-gray-700 flex-1 break-all">{value}</p>
    </div>
  );
}
