import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Clipboard,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { clearToken } from "../lib/auth";

const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "英語", zh: "中国語", ko: "韓国語",
  th: "タイ語", vi: "ベトナム語", ar: "アラビア語",
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();

  const { data: analyticsRaw, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-analytics"],
    queryFn: async () => {
      const res = await api.logs.analytics.$get();
      return res.json() as Promise<any>;
    },
  });
  const analytics: any = analyticsRaw;

  const { data: webhookRaw } = useQuery({
    queryKey: ["mobile-webhook"],
    queryFn: async () => {
      const res = await api.tenants["webhook-url"].$get();
      return res.json() as Promise<any>;
    },
  });
  const webhookData: any = webhookRaw;

  const stats = analytics?.stats;

  const handleSignOut = async () => {
    await clearToken();
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#EE4D2D" />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>ShopeeAI</Text>
              <Text style={styles.logoSub}>AutoChat</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>サインアウト</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>ダッシュボード</Text>

        {/* KPI Cards */}
        <View style={styles.statsGrid}>
          <StatCard label="総メッセージ" value={stats?.totalMessages ?? 0} />
          <StatCard label="AI自動返信" value={stats?.autoReplied ?? 0} color="#EE4D2D" />
          <StatCard label="エスカレーション" value={stats?.escalated ?? 0} color="#F97316" />
          <StatCard
            label="解決率"
            value={stats ? `${Math.round((stats.autoReplied / Math.max(stats.totalMessages, 1)) * 100)}%` : "0%"}
            color="#22C55E"
          />
        </View>

        {/* Webhook URL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Webhook URL</Text>
          <View style={styles.webhookBox}>
            <Text style={styles.webhookUrl} numberOfLines={2} selectable>
              {webhookData?.webhookUrl ?? "読み込み中..."}
            </Text>
          </View>
          <Text style={styles.webhookHint}>
            このURLをShopeeのWebhook設定に貼り付けてください
          </Text>
        </View>

        {/* Language Breakdown */}
        {analytics?.langBreakdown && analytics.langBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>言語別内訳</Text>
            {analytics.langBreakdown.slice(0, 5).map((item: any) => (
              <View key={item.lang} style={styles.langRow}>
                <Text style={styles.langLabel}>{LANG_LABELS[item.lang] ?? item.lang}</Text>
                <View style={styles.langBarBg}>
                  <View
                    style={[
                      styles.langBar,
                      {
                        width: `${Math.round(
                          (item.count / Math.max(...analytics.langBreakdown.map((x: any) => x.count), 1)) * 100
                        )}%` as any,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.langCount}>{item.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Nav Shortcuts */}
        <View style={styles.navGrid}>
          <TouchableOpacity style={styles.navCard} onPress={() => router.push("/escalations")}>
            <Text style={styles.navIcon}>⚠️</Text>
            <Text style={styles.navLabel}>エスカレーション</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navCard} onPress={() => router.push("/logs")}>
            <Text style={styles.navIcon}>💬</Text>
            <Text style={styles.navLabel}>チャットログ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { paddingBottom: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: "#EE4D2D",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: { fontSize: 16 },
  logoTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  logoSub: { fontSize: 10, color: "#999" },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#FEF2F2", borderRadius: 8 },
  signOutText: { fontSize: 12, color: "#EE4D2D", fontWeight: "600" },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111", paddingHorizontal: 20, marginTop: 20, marginBottom: 16 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: "700", color: "#111" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 4, textAlign: "center" },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#111", marginBottom: 12 },
  webhookBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  webhookUrl: { fontSize: 12, color: "#555", fontFamily: "monospace" },
  webhookHint: { fontSize: 11, color: "#999", marginTop: 8 },
  langRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  langLabel: { width: 60, fontSize: 12, color: "#555" },
  langBarBg: { flex: 1, height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, marginHorizontal: 8, overflow: "hidden" },
  langBar: { height: 8, backgroundColor: "#EE4D2D", borderRadius: 4 },
  langCount: { width: 30, fontSize: 12, color: "#888", textAlign: "right" },
  navGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  navCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  navIcon: { fontSize: 28, marginBottom: 8 },
  navLabel: { fontSize: 12, fontWeight: "600", color: "#555", textAlign: "center" },
});
