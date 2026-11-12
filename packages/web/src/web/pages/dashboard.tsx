import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout";
import { MessageSquare, CheckCircle, AlertTriangle, TrendingUp, Zap, Copy } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useState } from "react";
import { useParams, Link } from "wouter";

const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "英語", zh: "中国語", ko: "韓国語",
  th: "タイ語", vi: "ベトナム語", ar: "アラビア語",
  id: "インドネシア語", ms: "マレー語", tl: "タガログ語",
  pt: "ポルトガル語", es: "スペイン語",
};

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  TH: { name: "タイ",         flag: "🇹🇭" },
  MY: { name: "マレーシア",   flag: "🇲🇾" },
  SG: { name: "シンガポール", flag: "🇸🇬" },
  ID: { name: "インドネシア", flag: "🇮🇩" },
  PH: { name: "フィリピン",   flag: "🇵🇭" },
  VN: { name: "ベトナム",     flag: "🇻🇳" },
  TW: { name: "台湾",         flag: "🇹🇼" },
  BR: { name: "ブラジル",     flag: "🇧🇷" },
  MX: { name: "メキシコ",     flag: "🇲🇽" },
};

const PIE_COLORS = ["#EE4D2D", "#FF8C69", "#FFA07A", "#FFB347", "#FFD700", "#90EE90", "#87CEEB"];

type ShopRow = { country: string; enabled: boolean };

export default function DashboardPage() {
  const { country } = useParams<{ country?: string }>();
  const selectedCountry = country?.toUpperCase();
  const [copied, setCopied] = useState(false);

  const { data: shopsData } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await api.shops.$get();
      return res.json();
    },
  });

  const configuredShops = ((shopsData?.shops ?? []) as ShopRow[]).filter((s) => s.enabled);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", selectedCountry],
    queryFn: async () => {
      const res = await api.logs.analytics.$get();
      return res.json();
    },
  });

  const { data: webhookData } = useQuery({
    queryKey: ["webhook-url"],
    queryFn: async () => {
      const res = await api.tenants["webhook-url"].$get();
      return res.json();
    },
  });

  const stats = analytics?.stats;

  const copyWebhook = () => {
    if (webhookData?.webhookUrl) {
      navigator.clipboard.writeText(webhookData.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const countryInfo = selectedCountry ? COUNTRIES[selectedCountry] : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          {countryInfo ? (
            <>
              <span className="text-3xl">{countryInfo.flag}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{countryInfo.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">Shopeeチャット自動化の状況</p>
              </div>
            </>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
              <p className="text-sm text-gray-500 mt-1">Shopeeチャット自動化の状況 — 全国</p>
            </div>
          )}
        </div>

        {/* Country tabs (only shown when shops configured) */}
        {configuredShops.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link to="/dashboard">
              <a className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !selectedCountry
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
                すべて
              </a>
            </Link>
            {configuredShops.map((shop) => {
              const info = COUNTRIES[shop.country];
              if (!info) return null;
              const isActive = selectedCountry === shop.country;
              return (
                <Link key={shop.country} to={`/dashboard/${shop.country}`}>
                  <a className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                    <span>{info.flag}</span>
                    {info.name}
                  </a>
                </Link>
              );
            })}
            <Link to="/settings">
              <a className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors border border-dashed border-gray-200">
                ＋ 国を追加
              </a>
            </Link>
          </div>
        )}

        {/* No shops configured notice */}
        {configuredShops.length === 0 && !analyticsLoading && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-3">
            <Zap size={16} className="text-orange-500 flex-shrink-0" />
            <p className="text-sm text-gray-700">
              まだ国別Shop設定がありません。
              <Link to="/settings">
                <a className="text-orange-500 hover:underline ml-1 font-medium">設定画面</a>
              </Link>
              で国を追加してください。
            </p>
          </div>
        )}

        {/* Webhook URL */}
        {webhookData?.webhookUrl && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Shopee Webhook URL</p>
                <p className="text-xs text-gray-500 mt-0.5 mb-2">このURLをShopee Partner Portalに設定してください</p>
                <div className="flex items-center gap-2 bg-white rounded-lg border border-orange-200 px-3 py-2">
                  <code className="text-xs text-orange-600 flex-1 truncate">{webhookData.webhookUrl}</code>
                  <button onClick={copyWebhook} className="flex-shrink-0 text-gray-400 hover:text-orange-500 transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
                {copied && <p className="text-xs text-green-500 mt-1">コピーしました！</p>}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {analyticsLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={<MessageSquare size={18} className="text-blue-500" />}
              label="総問い合わせ"
              value={stats?.total ?? 0}
              bg="bg-blue-50"
            />
            <KPICard
              icon={<CheckCircle size={18} className="text-green-500" />}
              label="自動返信"
              value={stats?.autoReplied ?? 0}
              bg="bg-green-50"
              sub={`${stats?.autoReplyRate ?? 0}% 自動化率`}
            />
            <KPICard
              icon={<AlertTriangle size={18} className="text-amber-500" />}
              label="エスカレーション"
              value={stats?.escalated ?? 0}
              bg="bg-amber-50"
            />
            <KPICard
              icon={<TrendingUp size={18} className="text-orange-500" />}
              label="過去30日"
              value={stats?.last30Days ?? 0}
              bg="bg-orange-50"
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">過去7日間の対応数</h3>
            {analyticsLoading ? (
              <div className="h-48 animate-pulse bg-gray-50 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.dailyStats ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="autoReplied" fill="#EE4D2D" name="自動返信" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="escalated" fill="#F59E0B" name="エスカレーション" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">言語分布</h3>
            {analyticsLoading || !stats?.languageDist?.length ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">データなし</div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={stats.languageDist} dataKey="count" nameKey="language" cx="50%" cy="50%" outerRadius={60}>
                      {stats.languageDist.map((_: unknown, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, LANG_LABELS[String(n)] ?? n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {stats.languageDist.slice(0, 4).map((d: { language: string; count: number }, i: number) => (
                    <div key={d.language} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-600">{LANG_LABELS[d.language] ?? d.language}</span>
                      </div>
                      <span className="text-gray-900 font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KPICard({ icon, label, value, bg, sub }: {
  icon: React.ReactNode; label: string; value: number; bg: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-green-600 mt-1 font-medium">{sub}</p>}
    </div>
  );
}
