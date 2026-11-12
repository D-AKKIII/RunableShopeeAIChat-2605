import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

type Escalation = {
  id: string;
  shopeeOrderId: string | null;
  shopeeUserId: string;
  reason: string | null;
  resolved: boolean | null;
  createdAt: string | null;
  originalMessage: string | null;
};

const REASON_LABELS: Record<string, string> = {
  low_confidence: "低信頼度",
  complaint: "クレーム",
  refund: "返金",
  complex: "複雑な問い合わせ",
};

function EscalationItem({
  item,
  onResolve,
  resolving,
}: {
  item: Escalation;
  onResolve: (id: string) => void;
  resolving: boolean;
}) {
  const formattedDate = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <View style={[styles.card, item.resolved ? styles.cardResolved : styles.cardPending]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, item.resolved ? styles.badgeResolved : styles.badgePending]}>
          <Text style={[styles.badgeText, item.resolved ? styles.badgeTextResolved : styles.badgeTextPending]}>
            {item.resolved ? "解決済み" : "対応待ち"}
          </Text>
        </View>
        <Text style={styles.dateText}>{formattedDate}</Text>
      </View>

      <View style={styles.cardBody}>
        {item.shopeeOrderId && (
          <Text style={styles.orderId}>注文 #{item.shopeeOrderId}</Text>
        )}
        <Text style={styles.userId}>ユーザー: {item.shopeeUserId}</Text>
        {item.reason && (
          <View style={styles.reasonTag}>
            <Text style={styles.reasonText}>{REASON_LABELS[item.reason] ?? item.reason}</Text>
          </View>
        )}
        {item.originalMessage && (
          <Text style={styles.message} numberOfLines={3}>
            「{item.originalMessage}」
          </Text>
        )}
      </View>

      {!item.resolved && (
        <TouchableOpacity
          style={[styles.resolveBtn, resolving && styles.resolveBtnDisabled]}
          onPress={() => onResolve(item.id)}
          disabled={resolving}
        >
          {resolving ? (
            <ActivityIndicator size="small" color="#22C55E" />
          ) : (
            <Text style={styles.resolveBtnText}>✓ 解決済みにする</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function EscalationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  const { data: rawData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-escalations"],
    queryFn: async () => {
      const res = await (api as any).escalations.$get({ query: { page: "1", limit: "50" } });
      return res.json() as Promise<{ escalations: Escalation[] }>;
    },
  });
  const data: any = rawData;

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await (api as any).escalations[id].resolve.$post();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-escalations"] });
    },
  });

  const handleResolve = (id: string) => {
    Alert.alert("確認", "このエスカレーションを解決済みにしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "解決済み",
        onPress: async () => {
          setResolvingId(id);
          await resolveMutation.mutateAsync(id);
          setResolvingId(null);
        },
      },
    ]);
  };

  const pending: Escalation[] = data?.escalations?.filter((e: Escalation) => !e.resolved) ?? [];
  const resolved: Escalation[] = data?.escalations?.filter((e: Escalation) => e.resolved) ?? [];
  const allItems: Escalation[] = [...pending, ...resolved];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>エスカレーション</Text>
        {pending.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{pending.length}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EE4D2D" />
        </View>
      ) : allItems.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>エスカレーションなし</Text>
          <Text style={styles.emptyText}>すべてのメッセージがAIで解決されています</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EscalationItem
              item={item}
              onResolve={handleResolve}
              resolving={resolvingId === item.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#EE4D2D" />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// Need React import for useState
import React from "react";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 8,
  },
  backBtn: { paddingRight: 8 },
  backText: { fontSize: 14, color: "#EE4D2D", fontWeight: "600" },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111" },
  countBadge: {
    backgroundColor: "#EE4D2D",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#111", marginBottom: 6 },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center" },
  listContent: { padding: 16 },
  separator: { height: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardResolved: { opacity: 0.7 },
  cardPending: { borderLeftWidth: 3, borderLeftColor: "#EE4D2D" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgePending: { backgroundColor: "#FEF2F2" },
  badgeResolved: { backgroundColor: "#F0FDF4" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  badgeTextPending: { color: "#EE4D2D" },
  badgeTextResolved: { color: "#22C55E" },
  dateText: { fontSize: 11, color: "#999" },
  cardBody: { gap: 4 },
  orderId: { fontSize: 13, fontWeight: "600", color: "#111" },
  userId: { fontSize: 12, color: "#666" },
  reasonTag: {
    backgroundColor: "#FFF7F0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  reasonText: { fontSize: 11, color: "#F97316", fontWeight: "600" },
  message: { fontSize: 13, color: "#555", fontStyle: "italic", marginTop: 6, lineHeight: 18 },
  resolveBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  resolveBtnDisabled: { opacity: 0.5 },
  resolveBtnText: { fontSize: 13, color: "#22C55E", fontWeight: "700" },
});
