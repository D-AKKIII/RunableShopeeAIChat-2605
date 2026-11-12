import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "../components/layout";
import {
  AlertTriangle, Slack, Globe, Package, Send, Loader2,
  ChevronDown, ChevronUp, Languages, CheckCircle2, Clock, RefreshCw,
} from "lucide-react";
import { useState, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  low_confidence:             { label: "AI信頼度不足",   color: "text-amber-700 bg-amber-50" },
  escalation_keyword_detected:{ label: "キーワード検知", color: "text-red-700 bg-red-50" },
  ai_error:                   { label: "AIエラー",       color: "text-red-700 bg-red-50" },
  refund_request:             { label: "返金リクエスト", color: "text-purple-700 bg-purple-50" },
  complaint:                  { label: "クレーム",       color: "text-red-700 bg-red-50" },
  angry_customer:             { label: "感情的な顧客",   color: "text-red-700 bg-red-50" },
  quota_exceeded:             { label: "クォータ超過",   color: "text-gray-700 bg-gray-100" },
  unknown:                    { label: "不明",           color: "text-gray-500 bg-gray-50" },
};

const STATUS_CONFIG = {
  open:        { label: "未対応",    color: "text-red-600 bg-red-50 border-red-200",       icon: Clock,         dot: "bg-red-400" },
  in_progress: { label: "対応中",    color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: RefreshCw,  dot: "bg-yellow-400" },
  resolved:    { label: "対応済み",  color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2,  dot: "bg-green-400" },
} as const;
type EscStatus = keyof typeof STATUS_CONFIG;

const COUNTRY_INFO: Record<string, { name: string; flag: string }> = {
  MY: { name: "マレーシア",     flag: "🇲🇾" },
  TH: { name: "タイ",           flag: "🇹🇭" },
  SG: { name: "シンガポール",   flag: "🇸🇬" },
  ID: { name: "インドネシア",   flag: "🇮🇩" },
  PH: { name: "フィリピン",     flag: "🇵🇭" },
  VN: { name: "ベトナム",       flag: "🇻🇳" },
  TW: { name: "台湾",           flag: "🇹🇼" },
  BR: { name: "ブラジル",       flag: "🇧🇷" },
  MX: { name: "メキシコ",       flag: "🇲🇽" },
  JP: { name: "日本",           flag: "🇯🇵" },
};

const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "英語", zh: "中国語", ko: "韓国語",
  th: "タイ語", vi: "ベトナム語", ar: "アラビア語", ms: "マレー語", id: "インドネシア語",
};

type EscalationItem = {
  escalation: Record<string, unknown>;
  log: Record<string, unknown> | null;
  country: string | null;
};

// ── Auth helper ────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem("bearer_token") ?? "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ── Translation hook ───────────────────────────────────────────────────────

function useTranslation(text: string | null, language: string | null) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!text || !language || language === "ja") { setTranslated(null); return; }
    setLoading(true);
    fetch("/api/logs/translate", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text, fromLanguage: language }),
    })
      .then((r) => r.json())
      .then((d: { translated?: string | null }) => setTranslated(d.translated ?? null))
      .catch(() => setTranslated(null))
      .finally(() => setLoading(false));
  }, [text, language]);

  return { translated, loading };
}

// ── Status dropdown component ──────────────────────────────────────────────

function StatusDropdown({ escalationId, current, onChanged }: {
  escalationId: string;
  current: EscStatus;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const cfg = STATUS_CONFIG[current] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;

  const handleSelect = async (newStatus: EscStatus) => {
    if (newStatus === current) { setOpen(false); return; }
    setUpdating(true);
    setOpen(false);
    await fetch(`/api/logs/escalations/${escalationId}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdating(false);
    onChanged();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={updating}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${cfg.color}`}
      >
        {updating
          ? <Loader2 size={11} className="animate-spin" />
          : <Icon size={11} />
        }
        {cfg.label}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
            {(Object.keys(STATUS_CONFIG) as EscStatus[]).map((s) => {
              const c = STATUS_CONFIG[s];
              const SIcon = c.icon;
              return (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${s === current ? "font-bold" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <SIcon size={11} className={
                    s === "open" ? "text-red-500" : s === "in_progress" ? "text-yellow-600" : "text-green-600"
                  } />
                  {c.label}
                  {s === current && <span className="ml-auto text-gray-300">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Single card ────────────────────────────────────────────────────────────

function EscalationCard({ item, onRefresh }: { item: EscalationItem; onRefresh: () => void }) {
  const { escalation, log, country } = item;
  const reason = REASON_LABELS[String(escalation.reason)] ?? REASON_LABELS.unknown;
  const language = String(log?.detectedLanguage ?? "en");
  const escStatus = (String(escalation.status ?? "open")) as EscStatus;
  const countryInfo = country ? (COUNTRY_INFO[country] ?? null) : null;

  const [showTranslation, setShowTranslation] = useState(false);
  const msgTranslation = useTranslation(
    showTranslation ? String(log?.messageContent ?? "") : null,
    showTranslation ? language : null
  );
  const aiTranslation = useTranslation(
    showTranslation && log?.aiResponse ? String(log.aiResponse) : null,
    showTranslation ? language : null
  );

  const [memo, setMemo] = useState("");
  const [replyResult, setReplyResult] = useState<{ sent: boolean; reply: string; language: string; error?: string; message?: string } | null>(null);

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/logs/escalations/${escalation.id}/reply`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ memo }),
      });
      return res.json() as Promise<{ ok: boolean; sent: boolean; reply: string; language: string; error?: string; message?: string }>;
    },
    onSuccess: (data) => {
      setReplyResult(data);
      if (data.sent) setMemo("");
      onRefresh();
    },
  });

  const isResolved = escStatus === "resolved";

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      isResolved ? "border-green-100" : escStatus === "in_progress" ? "border-yellow-100" : "border-red-100"
    } p-5`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <StatusDropdown
            escalationId={String(escalation.id)}
            current={escStatus}
            onChanged={onRefresh}
          />

          {/* Reason */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${reason.color}`}>
            <AlertTriangle size={11} />
            {reason.label}
          </span>

          {escalation.slackNotified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-[#4A154B] bg-purple-50">
              <Slack size={11} />
              Slack通知済み
            </span>
          )}

          {/* Country */}
          {countryInfo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-50 border border-gray-100">
              <Globe size={11} />
              {countryInfo.flag} {countryInfo.name}
            </span>
          )}

          {/* Language */}
          {language !== "ja" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-600 bg-blue-50">
              <Languages size={11} />
              {LANG_LABELS[language] ?? language}
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">
            {escalation.createdAt
              ? (() => {
                  const v = escalation.createdAt;
                  // Drizzle may return ISO string or Unix seconds integer
                  const d = typeof v === "string" ? new Date(v) : new Date(Number(v) * 1000);
                  return isNaN(d.getTime()) ? "—" : d.toLocaleString("ja-JP");
                })()
              : "—"}
          </p>
          {log?.confidenceScore != null && (
            <p className="text-xs text-gray-500 mt-0.5">
              信頼度 {(Number(log.confidenceScore) * 100).toFixed(0)}%
            </p>
          )}
        </div>
      </div>

      {log && (
        <div className="space-y-3">
          {/* ── Product ── */}
          {log.itemName ? (
            <div className="flex items-center gap-3 bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
              <Package size={14} className="text-orange-400 flex-shrink-0" />
              {log.itemImage && (
                <img
                  src={String(log.itemImage)}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover border border-orange-100 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <p className="text-xs text-orange-500 font-medium">問い合わせ商品</p>
                <p className="text-sm font-semibold text-gray-800">{String(log.itemName)}</p>
                {log.itemPrice != null && (
                  <p className="text-xs text-gray-500">
                    {countryInfo?.flag ?? ""} {Number(log.itemPrice).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Package size={13} className="text-gray-300" />
              <p className="text-xs text-gray-400">問い合わせ商品: 不明（商品ページ外からの問い合わせ）</p>
            </div>
          )}

          {/* ── Buyer ── */}
          <p className="text-xs text-gray-400">
            顧客: <span className="font-medium text-gray-700">{String(log.buyerUsername ?? "—")}</span>
          </p>

          {/* ── Message ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400 font-medium">問い合わせ内容</p>
              {language !== "ja" && (
                <button
                  onClick={() => setShowTranslation((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                >
                  <Languages size={11} />
                  {showTranslation ? "翻訳を隠す" : "日本語訳を表示"}
                  {showTranslation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-700">{String(log.messageContent)}</p>
              {showTranslation && language !== "ja" && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  {msgTranslation.loading
                    ? <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> 翻訳中...</div>
                    : msgTranslation.translated
                      ? <p className="text-xs text-blue-700 italic">🇯🇵 {msgTranslation.translated}</p>
                      : null}
                </div>
              )}
            </div>
          </div>

          {/* ── AI response ── */}
          {log.aiResponse && (
            <div>
              <p className={`text-xs font-medium mb-1 ${escalation.ackSent ? "text-green-500" : "text-red-400"}`}>
                AI一次対応（{escalation.ackSent ? "✓ 送信済み" : "✗ 未送信 — Shopeeポリシーによりバイヤーに届きません"}）
              </p>
              <div className="bg-orange-50 rounded-lg px-3 py-2">
                <p className="text-sm text-gray-600">{String(log.aiResponse)}</p>
                {showTranslation && language !== "ja" && (
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    {aiTranslation.loading
                      ? <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={11} className="animate-spin" /> 翻訳中...</div>
                      : aiTranslation.translated
                        ? <p className="text-xs text-orange-700 italic">🇯🇵 {aiTranslation.translated}</p>
                        : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Reply input ── */}
          {!isResolved && (
            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs text-gray-500 font-medium mb-2">
                📝 返信内容を日本語で入力 → AIが{LANG_LABELS[language] ?? language}に翻訳して送信
              </p>
              <div className="flex gap-2">
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="返答内容を日本語で入力（AIが自動翻訳・送信します）"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-gray-300"
                  rows={3}
                />
                <button
                  onClick={() => replyMutation.mutate()}
                  disabled={!memo.trim() || replyMutation.isPending}
                  className="flex-shrink-0 inline-flex flex-col items-center justify-center gap-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {replyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  送信
                </button>
              </div>

              {replyResult && (
                <div className={`mt-2 border rounded-lg px-3 py-2 ${
                  replyResult.error === "user_is_forbidden"
                    ? "bg-orange-50 border-orange-100"
                    : replyResult.sent
                      ? "bg-green-50 border-green-100"
                      : "bg-yellow-50 border-yellow-100"
                }`}>
                  <p className={`text-xs font-medium mb-1 ${
                    replyResult.error === "user_is_forbidden" ? "text-orange-600" :
                    replyResult.sent ? "text-green-600" : "text-yellow-600"
                  }`}>
                    {replyResult.error === "user_is_forbidden"
                      ? "⚠ Shopeeポリシーにより送信不可"
                      : replyResult.sent
                        ? "✓ 送信完了 — ステータスを「対応済み」に変更しました"
                        : "⚠ 送信失敗（返信文は生成済み）"}
                  </p>
                  {replyResult.error === "user_is_forbidden" && replyResult.message && (
                    <p className="text-xs text-orange-700 mb-1">{replyResult.message}</p>
                  )}
                  {replyResult.reply && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">生成テキスト ({LANG_LABELS[replyResult.language] ?? replyResult.language}): </span>
                      {replyResult.reply}
                    </p>
                  )}
                </div>
              )}
              {replyMutation.isError && (
                <p className="text-xs text-red-500 mt-1">エラーが発生しました。再試行してください。</p>
              )}
            </div>
          )}

          {/* Resolved notes */}
          {isResolved && escalation.notes && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-400">対応メモ: <span className="text-gray-600">{String(escalation.notes)}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────

type Tab = "all" | "open" | "resolved";
const TABS: { key: Tab; label: string; statusKey?: EscStatus }[] = [
  { key: "all",      label: "すべて" },
  { key: "open",     label: "未対応",   statusKey: "open" },
  { key: "resolved", label: "対応済み", statusKey: "resolved" },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function EscalationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => {
      const token = localStorage.getItem("bearer_token") ?? "";
      const res = await fetch("/api/logs/escalations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json() as Promise<{ escalations: EscalationItem[] }>;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["escalations"] });

  const all = data?.escalations ?? [];

  // Tab counts
  const counts = {
    all: all.length,
    open: all.filter((i) => {
      const s = String(i.escalation.status ?? "open");
      return s === "open" || s === "in_progress";
    }).length,
    resolved: all.filter((i) => String(i.escalation.status ?? "open") === "resolved").length,
  };

  const filtered = all.filter((i) => {
    const s = String(i.escalation.status ?? "open");
    if (activeTab === "all") return true;
    if (activeTab === "open") return s === "open" || s === "in_progress";
    if (activeTab === "resolved") return s === "resolved";
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── Page title ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">エスカレーション</h1>
          <p className="text-sm text-gray-500 mt-1">AIが対応できなかった問い合わせ — 内容確認・返信・ステータス管理ができます</p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  activeTab === key
                    ? key === "open"
                      ? "bg-red-100 text-red-600"
                      : key === "resolved"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-600"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={20} className="text-green-500" />
            </div>
            <p className="text-gray-500 text-sm">
              {activeTab === "all" ? "エスカレーションはありません" :
               activeTab === "open" ? "未対応の問い合わせはありません ✓" :
               "対応済みの問い合わせはありません"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <EscalationCard
                key={String(item.escalation.id)}
                item={item}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

