import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DashboardLayout } from "../components/layout";
import { Plus, Trash2, Pencil, Check, X, BookOpen } from "lucide-react";

export default function KnowledgePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", category: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const res = await api.knowledge.$get();
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await api.knowledge.$post({ json: data });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      setForm({ question: "", answer: "", category: "" });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const res = await api.knowledge[":id"].$put({ param: { id }, json: data });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.knowledge[":id"].$delete({ param: { id } });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await api.knowledge[":id"].$put({ param: { id }, json: { active } });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ナレッジベース</h1>
            <p className="text-sm text-gray-500 mt-1">AIが参照するFAQ・店舗情報（{data?.items?.length ?? 0}件）</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={16} />
            追加
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-orange-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">新規追加</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">質問 / キーワード</label>
                <input
                  value={form.question}
                  onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="例: 発送はいつですか？"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">回答</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="例: ご注文確認後、2〜3営業日以内に発送いたします。"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">カテゴリ（任意）</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="例: 配送・発送"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.question || !form.answer || createMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Check size={14} />
                  {createMutation.isPending ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X size={14} />
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.items?.length ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <BookOpen size={20} className="text-orange-400" />
            </div>
            <p className="text-gray-500 text-sm mb-1">ナレッジベースが空です</p>
            <p className="text-xs text-gray-400">追加ボタンから商品情報・FAQを登録してください</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.items.map((item: Record<string, unknown>) => (
              <div
                key={String(item.id)}
                className={`bg-white rounded-xl border p-4 transition-colors ${item.active ? "border-gray-100" : "border-gray-100 opacity-50"}`}
              >
                {editId === String(item.id) ? (
                  <EditForm
                    item={item}
                    onSave={(d) => updateMutation.mutate({ id: String(item.id), data: d })}
                    onCancel={() => setEditId(null)}
                    saving={updateMutation.isPending}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {item.category && (
                        <span className="inline-block text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full mb-2">
                          {String(item.category)}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mb-1">{String(item.question)}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{String(item.answer)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: String(item.id), active: !item.active })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.active ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`}
                        title={item.active ? "無効化" : "有効化"}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => { setEditId(String(item.id)); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(String(item.id))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EditForm({
  item,
  onSave,
  onCancel,
  saving,
}: {
  item: Record<string, unknown>;
  onSave: (d: { question: string; answer: string; category: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    question: String(item.question ?? ""),
    answer: String(item.answer ?? ""),
    category: String(item.category ?? ""),
  });

  return (
    <div className="space-y-3">
      <input
        value={form.question}
        onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
      <textarea
        value={form.answer}
        onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))}
        rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
      />
      <input
        value={form.category}
        onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        placeholder="カテゴリ"
      />
      <div className="flex gap-2">
        <button onClick={() => onSave(form)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg disabled:opacity-50">
          <Check size={12} /> {saving ? "保存中..." : "保存"}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50">
          <X size={12} /> キャンセル
        </button>
      </div>
    </div>
  );
}
