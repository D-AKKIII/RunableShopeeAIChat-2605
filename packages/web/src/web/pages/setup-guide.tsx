import { DashboardLayout } from "../components/layout";
import { ExternalLink, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, Clock } from "lucide-react";

const Step = ({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-7 h-7 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
      {num}
    </div>
    <div className="flex-1 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  </div>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-gray-100 text-orange-600 text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>
);

const Note = ({ type = "info", children }: { type?: "info" | "warn" | "success"; children: React.ReactNode }) => {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-700",
    warn: "bg-amber-50 border-amber-200 text-amber-700",
    success: "bg-green-50 border-green-200 text-green-700",
  };
  const Icon = type === "success" ? CheckCircle : type === "warn" ? AlertCircle : ShieldCheck;
  return (
    <div className={`flex gap-2 p-3 rounded-lg border text-xs ${styles[type]}`}>
      <Icon size={14} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
};

export default function SetupGuide() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">設定マニュアル</h1>
          <p className="text-sm text-gray-500 mt-1">Shopee自動返信システムの初期設定手順</p>
        </div>

        {/* ── Section 1: Partner App ── */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center text-orange-600 text-xs font-bold">1</span>
            Shopee Partner Appの作成
          </h2>

          <div className="space-y-5">
            <Step num={1} title="Partner Centerにログイン">
              <p>
                <a href="https://open.shopee.com/developer" target="_blank" rel="noreferrer"
                  className="text-orange-500 hover:underline inline-flex items-center gap-1">
                  https://open.shopee.com/developer <ExternalLink size={11} />
                </a>
                にアクセスしてログインします。
              </p>
            </Step>

            <Step num={2} title="アプリを作成">
              <p><strong>My Apps → Create App</strong> を選択します。</p>
              <ul className="list-disc ml-4 space-y-1 text-xs">
                <li>App Type: <Code>Public App</Code>（複数ショップに提供する場合）</li>
                <li>App Name: 任意</li>
                <li>Redirect URI: <Code>https://あなたのドメイン/api/shopee-auth/callback</Code></li>
              </ul>
              <Note type="warn">
                審査中（Under Review）の間は本番APIが使えません。
                <strong>Test App（Sandbox）</strong>を別途作成して開発を進めてください。
              </Note>
            </Step>

            <Step num={3} title="Partner ID と Partner Key を確認">
              <p>作成したアプリの詳細画面で以下を確認します：</p>
              <ul className="list-disc ml-4 space-y-1 text-xs">
                <li><strong>Partner ID</strong>: 数字のID</li>
                <li><strong>Partner Key</strong>: 英数字の長い文字列（Secret Key）</li>
              </ul>
            </Step>

            <Step num={4} title="設定画面に入力">
              <p>
                <a href="/settings" className="text-orange-500 hover:underline">設定ページ</a>の
                「Shopee API（共通設定）」セクションに Partner ID と Partner Key を入力して保存します。
              </p>
            </Step>
          </div>
        </section>

        {/* ── Section 2: OAuth認証 ── */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center text-orange-600 text-xs font-bold">2</span>
            ショップ認証（OAuth）
          </h2>

          <Note type="success">
            <strong>Access Tokenは手動入力不要です。</strong><br />
            「Shopeeで認証」ボタンから認証することで、Access TokenとRefresh Tokenが自動取得・保存されます。
          </Note>

          <div className="space-y-5">
            <Step num={1} title="国別ショップ設定を開く">
              <p>
                <a href="/settings" className="text-orange-500 hover:underline">設定ページ</a>の
                「国別 Shop 設定」から対象の国を選択して展開します。
              </p>
            </Step>

            <Step num={2} title="Shop ID を入力">
              <p>Shopee Seller CenterのショップIDを入力します。</p>
              <p className="text-xs text-gray-400">Seller Center → ショップ情報 → Shop ID で確認できます。</p>
            </Step>

            <Step num={3} title="「Shopeeで認証」をクリック">
              <p>ボタンをクリックするとShopeeの認証画面がポップアップで開きます。</p>
              <p>ショップアカウントでログインして「Authorize」を押すと自動的に完了します。</p>
            </Step>

            <Step num={4} title="認証状態を確認">
              <p>展開フォームの「Shopee 認証状態」欄が以下になれば完了です：</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-green-600">
                  <ShieldCheck size={12} /> Access Token: 有効
                </div>
                <div className="flex items-center gap-1.5 text-green-600">
                  <ShieldCheck size={12} /> Refresh Token: 有効（自動更新ON）
                </div>
              </div>
            </Step>
          </div>
        </section>

        {/* ── Section 3: Token自動更新 ── */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center text-orange-600 text-xs font-bold">3</span>
            トークンの自動更新について
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <Clock size={12} /> Access Token
              </div>
              <p className="text-xs text-gray-500">有効期限: <strong>4時間</strong></p>
              <p className="text-xs text-gray-500 mt-0.5">API呼び出し時に自動更新</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                <RefreshCw size={12} /> Refresh Token
              </div>
              <p className="text-xs text-gray-500">有効期限: <strong>30日</strong></p>
              <p className="text-xs text-gray-500 mt-0.5">期限前に再認証が必要</p>
            </div>
          </div>

          <Note type="info">
            Refresh Tokenが有効な間は、Access Tokenが期限切れになっても<strong>自動的に更新</strong>されます。
            手動操作は不要です。Refresh Token（30日）が切れる前にシステムから通知します。
          </Note>

          <Note type="warn">
            Refresh Tokenが期限切れになった場合は、再度「Shopeeで認証」から認証し直してください。
          </Note>
        </section>

        {/* ── Section 4: Gemini & Slack ── */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center text-orange-600 text-xs font-bold">4</span>
            その他の設定
          </h2>

          <div className="space-y-5">
            <Step num={1} title="Gemini API Key">
              <p>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                  className="text-orange-500 hover:underline inline-flex items-center gap-1">
                  Google AI Studio <ExternalLink size={11} />
                </a>
                でAPIキーを取得して設定画面に入力します。
              </p>
            </Step>

            <Step num={2} title="Gemini Gem ID（オプション）">
              <p>Google Geminiのカスタムジェム（NotebookLM連携）のIDです。</p>
              <p className="text-xs text-gray-400">未設定の場合は汎用AIが使用されます。</p>
            </Step>

            <Step num={3} title="Slack Webhook URL（オプション）">
              <p>エスカレーション通知を受け取るSlackチャンネルのWebhook URLを設定します。</p>
              <p>
                <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer"
                  className="text-orange-500 hover:underline inline-flex items-center gap-1">
                  Slack Webhookの設定方法 <ExternalLink size={11} />
                </a>
              </p>
            </Step>
          </div>
        </section>

        {/* ── Sandbox note ── */}
        <section className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h2 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle size={14} /> Sandbox（テスト）環境について
          </h2>
          <div className="text-xs text-amber-700 space-y-1.5">
            <p>本番アプリが審査中の間は、<strong>Sandbox App</strong>で開発・テストができます。</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Partner Center → My Apps → <strong>Test App</strong> を作成</li>
              <li>Sandbox用のPartner ID / Partner Keyを使用</li>
              <li>サーバーの環境変数に <Code>SHOPEE_SANDBOX=true</Code> を設定</li>
            </ul>
            <p className="mt-2">審査通過後は本番のPartner ID / Partner Keyに差し替えるだけで動作します。</p>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
