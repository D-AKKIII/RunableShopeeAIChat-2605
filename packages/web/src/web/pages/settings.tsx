import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getToken } from "../lib/auth";
import { DashboardLayout } from "../components/layout";
import { Save, Info, ExternalLink, Plus, Trash2, ChevronDown, ChevronUp, Check, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";

const COUNTRIES = [
  { code: "TH", name: "タイ",           flag: "🇹🇭" },
  { code: "MY", name: "マレーシア",     flag: "🇲🇾" },
  { code: "SG", name: "シンガポール",   flag: "🇸🇬" },
  { code: "ID", name: "インドネシア",   flag: "🇮🇩" },
  { code: "PH", name: "フィリピン",     flag: "🇵🇭" },
  { code: "VN", name: "ベトナム",       flag: "🇻🇳" },
  { code: "TW", name: "台湾",           flag: "🇹🇼" },
  { code: "BR", name: "ブラジル",       flag: "🇧🇷" },
  { code: "MX", name: "メキシコ",       flag: "🇲🇽" },
];

type ShopRow = {
  id: string;
  country: string;
  shopId: string;
  shopName: string | null;
  accessToken: string | null;
  enabled: boolean;
};

type ShopForm = { id?: string; shopId: string; shopName: string; accessToken: string; enabled: boolean };

type ShopStatus = {
  id: string;
  country: string;
  shopId: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenValid: boolean;
  refreshValid: boolean;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  needsReauth: boolean;
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [expandedShop, setExpandedShop] = useState<string | null>(null); // row id or "new:CC"
  const [shopForms, setShopForms] = useState<Record<string, ShopForm>>({});

  const [form, setForm] = useState({
    shopeePartnerId: "",
    shopeePartnerKey: "",
    geminiApiKey: "",
    geminiGemId: "",
    slackWebhookUrl: "",
    slackChannel: "",
    confidenceThreshold: 0.7,
    autoReplyEnabled: true,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.tenants.settings.$get();
      return res.json();
    },
  });

  const { data: shopsData } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await api.shops.$get();
      return res.json();
    },
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setForm({
        shopeePartnerId: String(s.shopeePartnerId ?? ""),
        shopeePartnerKey: String(s.shopeePartnerKey ?? ""),
        geminiApiKey: String(s.geminiApiKey ?? ""),
        geminiGemId: String(s.geminiGemId ?? ""),
        slackWebhookUrl: String(s.slackWebhookUrl ?? ""),
        slackChannel: String(s.slackChannel ?? ""),
        confidenceThreshold: Number(s.confidenceThreshold ?? 0.7),
        autoReplyEnabled: Boolean(s.autoReplyEnabled ?? true),
      });
    }
  }, [settingsData]);

  useEffect(() => {
    if (shopsData?.shops) {
      const newForms: typeof shopForms = {};
      (shopsData.shops as ShopRow[]).forEach((s) => {
        newForms[s.id] = {
          id: s.id,
          shopId: s.shopId ?? "",
          shopName: s.shopName ?? "",
          accessToken: s.accessToken ?? "",
          enabled: s.enabled,
        };
      });
      // keep unsaved "new:" drafts
      setShopForms((prev) => {
        const drafts = Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith("new:")));
        return { ...newForms, ...drafts };
      });
    }
  }, [shopsData]);

  // OAuth token status
  const { data: oauthStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["shopee-oauth-status"],
    queryFn: async () => {
      const res = await fetch("/api/shopee-auth/status", {
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return res.json() as Promise<{ shops: ShopStatus[] }>;
    },
    staleTime: 60_000,
  });
  const statusMap = new Map((oauthStatus?.shops ?? []).map((s: ShopStatus) => [s.id, s]));

  // Start OAuth flow for a country
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const startOAuth = async (country: string) => {
    setOauthLoading(country);
    try {
      const res = await fetch(`/api/shopee-auth/url?country=${country}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const text = await res.text();
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { alert(`レスポンス解析エラー: ${text}`); return; }

      if (!res.ok || !data.url) {
        alert(data.error ?? `エラー (${res.status}): ${text}`);
        return;
      }

      window.open(data.url, "_blank", "width=600,height=700");
      // Poll for completion
      const interval = setInterval(async () => {
        await refetchStatus();
        qc.invalidateQueries({ queryKey: ["shops"] });
      }, 3000);
      setTimeout(() => clearInterval(interval), 120_000);
    } catch (e) {
      alert(`例外エラー: ${String(e)}`);
    } finally {
      setOauthLoading(null);
    }
  };

  // Manual token refresh
  const refreshMutation = useMutation({
    mutationFn: async (rowId: string) => {
      const res = await fetch(`/api/shopee-auth/refresh/${rowId}`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      return res.json() as Promise<{ success?: boolean; error?: string; expiresAt?: string }>;
    },
    onSuccess: () => {
      refetchStatus();
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.tenants.settings.$put({ json: form });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const saveShopMutation = useMutation({
    mutationFn: async ({ country, data }: { country: string; data: ShopForm }) => {
      const res = await api.shops[":country"].$put({
        param: { country },
        json: data,
      });
      return res.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      refetchStatus();
      if (!vars.data.id) {
        setShopForms((f) => { const n = { ...f }; delete n[`new:${vars.country}`]; return n; });
        setExpandedShop(null);
      }
    },
  });

  const deleteShopMutation = useMutation({
    mutationFn: async (rowId: string) => {
      const res = await api.shops.item[":id"].$delete({ param: { id: rowId } });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });

  const allShops = (shopsData?.shops as ShopRow[] | undefined) ?? [];
  const configuredCountries = new Set(allShops.map((s) => s.country));

  const Field = ({
    label, hint, type = "text", value, onChange, placeholder,
  }: {
    label: string; hint?: string; type?: string;
    value: string; onChange: (v: string) => void; placeholder?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
          <p className="text-sm text-gray-500 mt-1">APIキーと動作設定</p>
        </div>

        {/* ── 国別 Shop 設定 ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
              <span className="text-orange-500 text-xs font-bold">S</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Shop 設定（1国に複数店舗OK）</h2>
            <span className="ml-auto text-xs text-gray-400">{allShops.length} 店舗 / {configuredCountries.size} 国</span>
          </div>

          <div className="space-y-2">
            {COUNTRIES.map((country) => {
              const countryShops = allShops.filter((sh) => sh.country === country.code);
              const isConfigured = countryShops.length > 0;
              const isExpanded = expandedCountry === country.code;
              const newKey = `new:${country.code}`;

              const renderShop = (key: string, row: ShopRow | null) => {
                const shopForm: ShopForm = shopForms[key] ?? { shopId: "", shopName: "", accessToken: "", enabled: true };
                const setF = (patch: Partial<ShopForm>) => setShopForms((f) => ({ ...f, [key]: { ...shopForm, ...patch } }));
                const open = expandedShop === key;
                const st = row ? statusMap.get(row.id) : undefined;
                const title = row ? (row.shopName || `Shop ${row.shopId}`) : "新しい店舗を追加";
                return (
                  <div key={key} className="border border-gray-100 rounded-lg bg-white">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50/50"
                      onClick={() => setExpandedShop(open ? null : key)}
                    >
                      {row ? <Check size={12} className="text-orange-500" /> : <Plus size={12} className="text-gray-400" />}
                      <span className="text-sm text-gray-900 font-medium">{title}</span>
                      {row && <span className="text-xs text-gray-400 font-mono">ID: {row.shopId}</span>}
                      {row && st && (
                        <span className={`ml-auto text-xs ${st.needsReauth ? "text-orange-500" : "text-green-600"}`}>
                          {st.needsReauth ? "要再認証" : "認証済み"}
                        </span>
                      )}
                      {open ? <ChevronUp size={13} className="text-gray-400 ml-1" /> : <ChevronDown size={13} className="text-gray-400 ml-1" />}
                    </button>

                    {open && (
                      <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">店舗名（任意）</label>
                            <input
                              type="text"
                              value={shopForm.shopName}
                              onChange={(e) => setF({ shopName: e.target.value })}
                              placeholder="例: Made in Japan Store 2"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Shop ID</label>
                            <input
                              type="text"
                              value={shopForm.shopId}
                              onChange={(e) => setF({ shopId: e.target.value })}
                              placeholder="1234567"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                        </div>

                        {/* OAuth */}
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-gray-700">Shopee 認証状態</p>
                          {st ? (
                            <div className="space-y-1">
                              {st.tokenValid ? (
                                <div className="flex items-center gap-1.5 text-xs text-green-600">
                                  <ShieldCheck size={12} /> Access Token: 有効
                                  {st.tokenExpiresAt && <span className="text-gray-400 ml-1">({new Date(st.tokenExpiresAt).toLocaleString("ja-JP")} まで)</span>}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12} /> Access Token: 期限切れ</div>
                              )}
                              {st.refreshValid ? (
                                <div className="flex items-center gap-1.5 text-xs text-green-600">
                                  <ShieldCheck size={12} /> Refresh Token: 有効（自動更新ON）
                                  {st.refreshTokenExpiresAt && <span className="text-gray-400 ml-1">({new Date(st.refreshTokenExpiresAt).toLocaleDateString("ja-JP")} まで)</span>}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-orange-500">
                                  <AlertCircle size={12} /> Refresh Token: {st.hasRefreshToken ? "期限切れ" : "未取得"} — 再認証が必要
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">{row ? "未認証" : "下のボタンで認証すると、店舗IDは自動で登録されます"}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            ※ 別店舗を認証するときは、Shopeeの認証画面でその店舗のセラーアカウントにログインしてください（別の店舗にログイン済みのブラウザだと、その店舗が選ばれます。シークレットウィンドウ推奨）。
                          </p>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => startOAuth(country.code)}
                              disabled={oauthLoading === country.code}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              <ExternalLink size={11} />
                              {oauthLoading === country.code ? "認証画面を開いています..." : (st?.refreshValid ? "再認証" : "Shopeeで認証")}
                            </button>
                            {row && st?.hasRefreshToken && !st.needsReauth && (
                              <button
                                onClick={() => refreshMutation.mutate(row.id)}
                                disabled={refreshMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs rounded-lg transition-colors"
                              >
                                <RefreshCw size={11} className={refreshMutation.isPending ? "animate-spin" : ""} />
                                今すぐ更新
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Access Token（手動入力）</label>
                          <p className="text-xs text-gray-400 mb-1">上のOAuth認証を使う場合は不要です</p>
                          <input
                            type="password"
                            value={shopForm.accessToken}
                            onChange={(e) => setF({ accessToken: e.target.value })}
                            placeholder="入力すると上書き保存"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setF({ enabled: !shopForm.enabled })}
                            className={`relative w-8 h-4 rounded-full transition-colors ${shopForm.enabled ? "bg-orange-500" : "bg-gray-200"}`}
                          >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${shopForm.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                          <span className="text-xs text-gray-600">有効</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => saveShopMutation.mutate({ country: country.code, data: shopForm })}
                            disabled={saveShopMutation.isPending || !shopForm.shopId}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <Save size={12} />
                            保存
                          </button>
                          {row ? (
                            <button
                              onClick={() => {
                                if (!confirm(`${title} を削除しますか？`)) return;
                                deleteShopMutation.mutate(row.id);
                                setExpandedShop(null);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                            >
                              <Trash2 size={12} />
                              削除
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setShopForms((f) => { const n = { ...f }; delete n[key]; return n; });
                                setExpandedShop(null);
                              }}
                              className="px-3 py-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs rounded-lg"
                            >
                              キャンセル
                            </button>
                          )}
                        </div>
                        {saveShopMutation.isError && <p className="text-xs text-red-500">保存に失敗しました</p>}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div key={country.code} className={`border rounded-lg overflow-hidden transition-colors ${isConfigured ? "border-orange-200 bg-orange-50/30" : "border-gray-100"}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedCountry(isExpanded ? null : country.code)}
                  >
                    <span className="text-xl leading-none">{country.flag}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{country.name}</span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{country.code}</span>
                    </div>
                    {isConfigured ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-100 px-2 py-0.5 rounded-full">
                        <Check size={10} /> {countryShops.length}店舗
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Plus size={10} /> 追加
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400 ml-1" /> : <ChevronDown size={14} className="text-gray-400 ml-1" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-2">
                      {countryShops.map((row) => renderShop(row.id, row))}
                      {shopForms[newKey] ? (
                        renderShop(newKey, null)
                      ) : (
                        <button
                          onClick={() => {
                            setShopForms((f) => ({ ...f, [newKey]: { shopId: "", shopName: "", accessToken: "", enabled: true } }));
                            setExpandedShop(newKey);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Plus size={12} />
                          {isConfigured ? `${country.name}の別の店舗を追加` : `${country.name}の店舗を追加`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Shopee API（共通） ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
              <span className="text-orange-500 text-xs font-bold">P</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Shopee Partner 設定（全国共通）</h2>
            <a
              href="https://open.shopee.com/developer-guide/5"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-orange-500 hover:underline flex items-center gap-1"
            >
              ドキュメント <ExternalLink size={11} />
            </a>
          </div>
          <Field
            label="Partner ID"
            hint="Shopee Partner Portal で確認できます"
            value={form.shopeePartnerId}
            onChange={(v) => setForm((f) => ({ ...f, shopeePartnerId: v }))}
            placeholder="1234567"
          />
          <Field
            label="Partner Key"
            type="password"
            hint="秘密鍵（マスク表示）"
            value={form.shopeePartnerKey}
            onChange={(v) => setForm((f) => ({ ...f, shopeePartnerKey: v }))}
            placeholder="入力すると上書き保存"
          />
        </div>

        {/* ── Gemini AI ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
              <span className="text-blue-500 text-xs font-bold">G</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Gemini AI 設定</h2>
          </div>
          <Field
            label="Gemini API Key"
            type="password"
            hint="Google AI Studio から取得"
            value={form.geminiApiKey}
            onChange={(v) => setForm((f) => ({ ...f, geminiApiKey: v }))}
            placeholder="AIza..."
          />
          <Field
            label="Gemini Gem ID"
            hint="NotebookLMナレッジを参照するGemのID"
            value={form.geminiGemId}
            onChange={(v) => setForm((f) => ({ ...f, geminiGemId: v }))}
            placeholder="gem_xxxxxxxxxxxxxxxx"
          />
          <div className="bg-blue-50 rounded-lg p-3 flex gap-2">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Gemini Gem の設定方法</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                <li>NotebookLM でナレッジを蓄積し、共有リンクを作成</li>
                <li>Google AI Studio で新規 Gem を作成</li>
                <li>NotebookLM のリンクを Gem のナレッジソースに追加</li>
                <li>Gem IDをここに入力</li>
              </ol>
            </div>
          </div>
        </div>

        {/* ── Slack ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center">
              <span className="text-purple-500 text-xs font-bold">#</span>
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Slack 通知設定</h2>
          </div>
          <Field
            label="Slack Webhook URL"
            hint="Slack App の Incoming Webhook URL"
            value={form.slackWebhookUrl}
            onChange={(v) => setForm((f) => ({ ...f, slackWebhookUrl: v }))}
            placeholder="https://hooks.slack.com/services/..."
          />
          <Field
            label="通知チャンネル（任意）"
            value={form.slackChannel}
            onChange={(v) => setForm((f) => ({ ...f, slackChannel: v }))}
            placeholder="#shopee-escalation"
          />
        </div>

        {/* ── AI動作設定 ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">AI動作設定</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              信頼度スコア閾値: <span className="text-orange-500 font-semibold">{form.confidenceThreshold}</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">この値未満の場合はエスカレーション（推奨: 0.7）</p>
            <input
              type="range"
              min={0.5}
              max={0.95}
              step={0.05}
              value={form.confidenceThreshold}
              onChange={(e) => setForm((f) => ({ ...f, confidenceThreshold: Number(e.target.value) }))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.5（積極的自動返信）</span>
              <span>0.95（慎重）</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm((f) => ({ ...f, autoReplyEnabled: !f.autoReplyEnabled }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.autoReplyEnabled ? "bg-orange-500" : "bg-gray-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.autoReplyEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-900">自動返信を有効化</p>
              <p className="text-xs text-gray-400">OFFにするとすべてエスカレーション</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          <Save size={15} />
          {saveMutation.isPending ? "保存中..." : saved ? "保存しました ✓" : "共通設定を保存"}
        </button>
      </div>
    </DashboardLayout>
  );
}
