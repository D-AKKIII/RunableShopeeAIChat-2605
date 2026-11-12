import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Settings,
  LogOut,
  Zap,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { authClient, clearToken } from "../lib/auth";
import { api } from "../lib/api";

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  TH: { name: "タイ",           flag: "🇹🇭" },
  MY: { name: "マレーシア",     flag: "🇲🇾" },
  SG: { name: "シンガポール",   flag: "🇸🇬" },
  ID: { name: "インドネシア",   flag: "🇮🇩" },
  PH: { name: "フィリピン",     flag: "🇵🇭" },
  VN: { name: "ベトナム",       flag: "🇻🇳" },
  TW: { name: "台湾",           flag: "🇹🇼" },
  BR: { name: "ブラジル",       flag: "🇧🇷" },
  MX: { name: "メキシコ",       flag: "🇲🇽" },
};

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/logs",      label: "チャットログ",   icon: MessageSquare },
  { href: "/escalations", label: "エスカレーション", icon: AlertTriangle },
  { href: "/knowledge", label: "ナレッジベース", icon: BookOpen },
  { href: "/settings",  label: "設定",           icon: Settings },
  { href: "/pricing",   label: "プラン",          icon: CreditCard },
  { href: "/setup-guide", label: "設定マニュアル", icon: HelpCircle },
];

type ShopRow = { country: string; enabled: boolean };

export function Sidebar() {
  const [location] = useLocation();
  const { data: session } = authClient.useSession();

  const { data: shopsData } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await api.shops.$get();
      return res.json();
    },
    staleTime: 30_000,
  });

  const configuredShops = ((shopsData?.shops ?? []) as ShopRow[]).filter((s) => s.enabled);

  const handleSignOut = async () => {
    await authClient.signOut();
    clearToken();
    window.location.href = "/";
  };

  // Extract current country from URL like /dashboard/TH
  const urlCountry = location.split("/")[2]?.toUpperCase();

  return (
    <div className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-none">ShopeeAI</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">AutoChat</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          const isDashboard = item.href === "/dashboard";
          const dashActive = location.startsWith("/dashboard");

          return (
            <div key={item.href}>
              <Link to={item.href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    (isDashboard ? dashActive : active)
                      ? "bg-orange-50 text-orange-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={16} className={(isDashboard ? dashActive : active) ? "text-orange-500" : "text-gray-400"} />
                  {item.label}
                </a>
              </Link>

              {/* Country sub-items under Dashboard */}
              {isDashboard && dashActive && configuredShops.length > 0 && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  <Link to="/dashboard">
                    <a className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      location === "/dashboard"
                        ? "text-orange-600 font-semibold"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    }`}>
                      <ChevronRight size={10} className="flex-shrink-0" />
                      すべて
                    </a>
                  </Link>
                  {configuredShops.map((shop) => {
                    const info = COUNTRIES[shop.country];
                    if (!info) return null;
                    const isActive = urlCountry === shop.country;
                    return (
                      <Link key={shop.country} to={`/dashboard/${shop.country}`}>
                        <a className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          isActive
                            ? "text-orange-600 font-semibold bg-orange-50"
                            : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        }`}>
                          <span className="text-sm leading-none">{info.flag}</span>
                          {info.name}
                        </a>
                      </Link>
                    );
                  })}
                  <Link to="/settings">
                    <a className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                      <span className="text-sm leading-none">＋</span>
                      国を追加
                    </a>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-900 truncate">{session?.user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full transition-colors"
        >
          <LogOut size={16} />
          サインアウト
        </button>
      </div>
    </div>
  );
}
