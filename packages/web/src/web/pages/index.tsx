import { Link } from "wouter";
import {
  Zap, CheckCircle, Check, MessageSquare, Globe, Shield, TrendingUp,
  ArrowRight, Bot, Slack
} from "lucide-react";

const FEATURES = [
  {
    icon: <Zap size={20} className="text-orange-500" />,
    title: "Shopee公式APIで正規返信",
    desc: "自動返信扱いにならない致命的な問題を解決。Shopee Chat APIを通じた正規の返信として認識されます。",
  },
  {
    icon: <Bot size={20} className="text-blue-500" />,
    title: "Gemini Gem × NotebookLM",
    desc: "NotebookLMに蓄積した店舗ナレッジをGemini Gemが参照。運用するほど賢くなる学習型AIです。",
  },
  {
    icon: <Globe size={20} className="text-green-500" />,
    title: "多言語自動対応",
    desc: "日本語・英語・中国語・韓国語など、問い合わせの言語を自動検出して同言語で返信します。",
  },
  {
    icon: <Shield size={20} className="text-purple-500" />,
    title: "信頼度評価 + エスカレーション",
    desc: "AI信頼度が低い場合や返金・クレームはSlackへ即通知。確実な一次対応で顧客満足を維持。",
  },
  {
    icon: <Slack size={20} className="text-[#4A154B]" />,
    title: "Slack連携でエスカレーション",
    desc: "対応困難な問い合わせは担当者のSlackへ詳細情報を自動送信。素早い対応が可能。",
  },
  {
    icon: <TrendingUp size={20} className="text-orange-500" />,
    title: "驚異的なコスト効率",
    desc: "Gemini APIの無料枠（1日1,500リクエスト）内ならほぼ無料。月100件でも$20で運用可能。",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "無料",
    per: "",
    desc: "小規模ショップ向け",
    features: ["自動返信 20件/月", "AI信頼度評価", "Slack通知", "多言語対応"],
    cta: "無料で始める",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$20",
    per: "/月",
    desc: "成長中のショップ向け",
    features: ["自動返信 100件/月", "Gemini Gem連携", "注文情報取得", "ナレッジベース管理", "分析ダッシュボード"],
    cta: "Starterで始める",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$55",
    per: "/月",
    desc: "高ボリューム・複数ショップ向け",
    features: ["自動返信 無制限", "すべてのStarter機能", "優先サポート", "カスタム閾値設定", "詳細レポート"],
    cta: "Proで始める",
    highlight: true,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-[Poppins,sans-serif]">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">ShopeeAI AutoChat</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in">
              <a className="text-sm text-gray-600 hover:text-gray-900 font-medium">ログイン</a>
            </Link>
            <Link to="/sign-in">
              <a className="text-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors">
                無料で始める
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Shopeeチャット自動化 × Gemini AI
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
          Shopeeチャットを、<br />
          <span className="text-orange-500">AIが自動で完結</span>させる
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          Shopee公式Chat APIによる正規自動返信でストア評価を守りながら、
          NotebookLM × Gemini Gemの高精度AIが多言語問い合わせを24時間対応します。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/sign-in">
            <a className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-orange-200">
              無料で始める <ArrowRight size={16} />
            </a>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-14 max-w-lg mx-auto">
          <div>
            <p className="text-2xl font-bold text-gray-900">27円</p>
            <p className="text-xs text-gray-500 mt-0.5">月額運用コスト目安</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">24h</p>
            <p className="text-xs text-gray-500 mt-0.5">365日自動対応</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">7+</p>
            <p className="text-xs text-gray-500 mt-0.5">対応言語数</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">なぜ ShopeeAI AutoChat？</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="py-16 max-w-5xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">処理フロー</h2>
        <div className="bg-gray-50 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {[
              { icon: <MessageSquare size={20} />, label: "Shopee\n問い合わせ", color: "bg-orange-100 text-orange-600" },
              { icon: <Bot size={20} />, label: "Gemini Gem\n(NotebookLM)", color: "bg-blue-100 text-blue-600" },
              { icon: <Shield size={20} />, label: "信頼度\n評価", color: "bg-purple-100 text-purple-600" },
              { icon: <CheckCircle size={20} />, label: "自動返信 or\nSlack通知", color: "bg-green-100 text-green-600" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${step.color}`}>
                    {step.icon}
                  </div>
                  <p className="text-xs text-gray-600 text-center whitespace-pre-line font-medium">{step.label}</p>
                </div>
                {i < 3 && <ArrowRight size={16} className="text-gray-300 flex-shrink-0 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 py-16" id="pricing">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">シンプルな料金プラン</h2>
          <p className="text-gray-500 text-sm text-center mb-10">いつでもキャンセル可能</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-xl p-6 relative ${
                  plan.highlight ? "border-2 border-orange-400 shadow-lg shadow-orange-50" : "border border-gray-100"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      おすすめ
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-400">{plan.per}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/sign-in">
                  <a
                    className={`block w-full py-2.5 text-sm font-semibold rounded-lg text-center transition-colors ${
                      plan.highlight
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "border border-orange-500 text-orange-600 hover:bg-orange-50"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">今すぐ無料で始めよう</h2>
        <p className="text-gray-500 text-sm mb-6">クレジットカード不要。20件/月まで永久無料。</p>
        <Link to="/sign-in">
          <a className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors">
            無料アカウントを作成 <ArrowRight size={16} />
          </a>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">ShopeeAI AutoChat</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 ShopeeAI AutoChat</p>
        </div>
      </footer>
    </div>
  );
}
