import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const LANG_LABELS: Record<string, string> = {
  ja: "日本語", en: "英語", zh: "中国語", ko: "韓国語",
  th: "タイ語", vi: "ベトナム語", ar: "アラビア語",
};

type Log = {
  id: string;
  shopeeUserId: string;
  shopeeOrderId: string | null;
  userMessage: string;
  botReply: string | null;
  lang: string | null;
  confidence: number | null;
  escalated: boolean | null;
  createdAt: string | null;
};

export default function LogsScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data: rawData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-logs", page],
    queryFn: async () => {
      const res = await api.logs.$get({ query: { page: String(page), limit: "20" } });
      return res.json() as Promise<any>;
    },
  });
  const data: any = rawData;

  const logs: Log[] = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>チャットログ</Text>
        <Text style={styles.totalText}>{total}件</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EE4D2D" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, item.escalated && styles.cardEscalated]}>
              <View style={styles.cardHeader}>
                <Text style={styles.userId}>{item.shopeeUserId}</Text>
                <View style={styles.tags}>
                  {item.lang && (
                    <View style={styles.langTag}>
                      <Text style={styles.langTagText}>{LANG_LABELS[item.lang] ?? item.lang}</Text>
                    </View>
                  )}
                  {item.escalated && (
                    <View style={styles.escalateTag}>
                      <Text style={styles.escalateTagText}>⚠</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.userMsg} numberOfLines={2}>👤 {item.userMessage}</Text>
              {item.botReply && (
                <Text style={styles.botMsg} numberOfLines={2}>🤖 {item.botReply}</Text>
              )}
              {item.confidence != null && (
                <Text style={styles.confidence}>
                  信頼度 {Math.round(item.confidence * 100)}%
                </Text>
              )}
              <Text style={styles.date}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ja-JP") : ""}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#EE4D2D" />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>← 前</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <TouchableOpacity
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>次 →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

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
  },
  backBtn: { paddingRight: 12 },
  backText: { fontSize: 14, color: "#EE4D2D", fontWeight: "600" },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111" },
  totalText: { fontSize: 13, color: "#888" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardEscalated: { borderLeftWidth: 3, borderLeftColor: "#EE4D2D" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  userId: { fontSize: 12, fontWeight: "600", color: "#555" },
  tags: { flexDirection: "row", gap: 4 },
  langTag: { backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  langTagText: { fontSize: 10, color: "#666" },
  escalateTag: { backgroundColor: "#FEF2F2", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  escalateTagText: { fontSize: 10 },
  userMsg: { fontSize: 13, color: "#333", marginBottom: 4 },
  botMsg: { fontSize: 13, color: "#EE4D2D", marginBottom: 4 },
  confidence: { fontSize: 11, color: "#888", marginTop: 4 },
  date: { fontSize: 10, color: "#AAA", marginTop: 2, textAlign: "right" },
  pagination: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 16, gap: 20 },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EE4D2D",
    borderRadius: 8,
  },
  pageBtnDisabled: { backgroundColor: "#E5E7EB" },
  pageBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  pageInfo: { fontSize: 13, color: "#555" },
});
