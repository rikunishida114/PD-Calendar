// app/components/AddTodoForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ★ 追加：AIタブ用のパネル
import TaskIdeasPanel from "./TaskIdeasPanel";

/** 単一タスク用のフォーム入力型 */
type SingleForm = {
  title: string;
  date: string; // YYYY-MM-DD
  estimatedMin?: number | "";
  folder?: string;
};

/** 複数タスク用のタスク型 */
type SubTask = {
  id: string; // UI 用の一意 ID
  title: string;
  date?: string; // オプション
  estimatedMin?: number | "";
};

export default function AddTodoForm() {
  const router = useRouter();

  // --- モード切替: single / multi / ai ---
  const [mode, setMode] = useState<"single" | "multi" | "ai">("single");

  // --- 単一タスクの state ---
  const [single, setSingle] = useState<SingleForm>({
    title: "",
    date: new Date().toISOString().slice(0, 10), // default: today
    estimatedMin: "",
    folder: "",
  });

  // --- 複数タスクの state ---
  const [purpose, setPurpose] = useState<string>(""); // folder / 目的
  const [subtasks, setSubtasks] = useState<SubTask[]>([
    {
      id: String(Date.now()),
      title: "",
      date: new Date().toISOString().slice(0, 10),
      estimatedMin: "",
    },
  ]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 単一タスク入力変更
  function onChangeSingle<K extends keyof SingleForm>(
    key: K,
    value: SingleForm[K]
  ) {
    setSingle((prev) => ({ ...prev, [key]: value }));
  }

  // サブタスクを追加
  function addSubtask() {
    setSubtasks((prev) => [
      ...prev,
      {
        id:
          String(Date.now()) +
          Math.random().toString(36).slice(2),
        title: "",
        date: new Date().toISOString().slice(0, 10),
        estimatedMin: "",
      },
    ]);
  }

  // サブタスク削除
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  // サブタスクフィールド更新
  function updateSubtask(id: string, field: keyof SubTask, value: any) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  // --- 単一タスクの送信 ---
  async function submitSingle(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!single.title.trim()) {
      setError("タイトルは必須です。");
      return;
    }
    setError(null);
    setSending(true);

    try {
      const col = collection(db, "plans");

      const estimated =
        typeof single.estimatedMin === "number"
          ? single.estimatedMin
          : single.estimatedMin === ""
          ? null
          : Number(single.estimatedMin);

      await addDoc(col, {
        title: single.title,
        date: single.date || null,
        estimatedMin: estimated,
        folder: single.folder || null,
        done: false,
        createdAt: serverTimestamp(),
      });

      router.push("/todo");
    } catch (err) {
      console.error("add single error", err);
      setError(
        "追加中にエラーが発生しました。コンソールを確認してください。"
      );
    } finally {
      setSending(false);
    }
  }

  // --- 複数タスクの送信 ---
  async function submitMulti(e?: React.FormEvent) {
    if (e) e.preventDefault();

    // 目的（フォルダ名）必須
    if (!purpose.trim()) {
      setError("目的（フォルダ名）は必須です。");
      return;
    }
    // 各サブタスクにタイトル必須
    for (const st of subtasks) {
      if (!st.title.trim()) {
        setError("サブタスクには全てタイトルが必要です。");
        return;
      }
    }

    setError(null);
    setSending(true);

    try {
      const plansCol = collection(db, "plans");

      // ★ 学習用に保存するタスク配列（taskPatterns 用）
      const patternTasks: {
        title: string;
        estimatedMin: number | null;
        date?: string | null;
      }[] = [];

      // 1. いつも通り、各サブタスクを plans コレクションに保存
      for (const st of subtasks) {
        const estimated =
          typeof st.estimatedMin === "number"
            ? st.estimatedMin
            : st.estimatedMin === ""
            ? null
            : Number(st.estimatedMin);

        await addDoc(plansCol, {
          title: st.title,
          date: st.date || null,
          estimatedMin: estimated,
          folder: purpose, // ← ここが「目的」として今後も使われる
          done: false,
          createdAt: serverTimestamp(),
        });

        // ★ 同時に、学習用配列にも情報を入れておく
        patternTasks.push({
          title: st.title,
          estimatedMin: estimated,
          date: st.date || null,
        });
      }

      // 2. ★ パターン（目的＋タスク群）を別コレクションに1件だけ保存
      const patternsCol = collection(db, "taskPatterns");
      await addDoc(patternsCol, {
        purpose, // 例: "修士論文の関連研究をまとめる"
        createdAt: serverTimestamp(),
        tasks: patternTasks, // タスク配列（タイトル・想定分・日付）
      });

      // 完了後に /todo へ
      router.push("/todo");
    } catch (err) {
      console.error("add multi error", err);
      setError(
        "追加中にエラーが発生しました。コンソールを確認してください。"
      );
    } finally {
      setSending(false);
    }
  }

  // ★ 追加：TaskIdeasPanel から複数タスクフォームに流し込む
  const handleApplyIdeasFromAI = (
    ideas: { title: string; date?: string; estimatedMin?: number | "" }[]
  ) => {
    setSubtasks((prev) => [
      ...prev,
      ...ideas.map((t, idx) => ({
        id:
          `${Date.now()}-${idx}-` +
          Math.random().toString(36).slice(2),
        title: t.title,
        date:
          t.date ??
          new Date().toISOString().slice(0, 10),
        // TaskIdeasPanel 側で number | "" にそろえているので、そのまま使ってOK
        estimatedMin: t.estimatedMin ?? "",
      })),
    ]);

    // AIで追加したあと、複数タスクタブに自動で切り替えてあげると UX 良い
    setMode("multi");
  };

  // ----- UI（レンダリング） -----
  return (
    <div style={{ padding: 8 }}>
      {/* モード切替ボタン群 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("single")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background:
              mode === "single" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          単一タスク
        </button>
        <button
          onClick={() => setMode("multi")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background:
              mode === "multi" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          複数タスク（目的＋タスク群）
        </button>
        {/* ★ 追加: AIで作成タブ */}
        <button
          onClick={() => setMode("ai")}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background:
              mode === "ai" ? "#0ea5a4" : "#e6fffa",
            border: "1px solid #0ea5a4",
          }}
        >
          AIで作成
        </button>
      </div>

      {error && (
        <div
          style={{ color: "red", marginBottom: 8 }}
        >
          {error}
        </div>
      )}

      {/* 単一タスクフォーム */}
      {mode === "single" && (
        <form
          onSubmit={submitSingle}
          style={{ display: "grid", gap: 8 }}
        >
          <label>
            <div style={{ fontSize: 13 }}>
              タイトル（必須）
            </div>
            <input
              value={single.title}
              onChange={(e) =>
                onChangeSingle("title", e.target.value)
              }
              placeholder="例: Related Work をまとめる"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
              disabled={sending}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>日付</div>
              <input
                type="date"
                value={single.date}
                onChange={(e) =>
                  onChangeSingle(
                    "date",
                    e.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                disabled={sending}
              />
            </label>

            <label style={{ width: 160 }}>
              <div style={{ fontSize: 13 }}>
                想定分数
              </div>
              <input
                type="number"
                value={single.estimatedMin as any}
                onChange={(e) =>
                  onChangeSingle(
                    "estimatedMin",
                    e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                  )
                }
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                disabled={sending}
              />
            </label>
          </div>

          <label>
            <div style={{ fontSize: 13 }}>
              フォルダ（任意）
            </div>
            <input
              value={single.folder}
              onChange={(e) =>
                onChangeSingle(
                  "folder",
                  e.target.value
                )
              }
              placeholder="例: 研究 / 授業 / 家事"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
              disabled={sending}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "#059669",
                color: "white",
                border: "none",
              }}
            >
              {sending ? "送信中..." : "追加する"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/todo")}
              disabled={sending}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
              }}
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* 複数タスクフォーム */}
      {mode === "multi" && (
        <form
          onSubmit={submitMulti}
          style={{ display: "grid", gap: 8 }}
        >
          <label>
            <div style={{ fontSize: 13 }}>
              目的（フォルダ名・必須）
            </div>
            <input
              value={purpose}
              onChange={(e) =>
                setPurpose(e.target.value)
              }
              placeholder="例: 修士論文の関連研究まとめ"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
              disabled={sending}
            />
          </label>

          {/* サブタスク一覧 */}
          <div>
            <div
              style={{
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              タスク（複数可）
            </div>
            {subtasks.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid #eee",
                  padding: 8,
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <input
                    value={s.title}
                    onChange={(e) =>
                      updateSubtask(
                        s.id,
                        "title",
                        e.target.value
                      )
                    }
                    placeholder={`タスク ${
                      idx + 1
                    } の内容`}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #ddd",
                    }}
                    disabled={sending}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      removeSubtask(s.id)
                    }
                    disabled={sending}
                    style={{
                      padding: "6px 8px",
                    }}
                  >
                    削除
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) =>
                      updateSubtask(
                        s.id,
                        "date",
                        e.target.value
                      )
                    }
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #ddd",
                    }}
                    disabled={sending}
                  />
                  <input
                    type="number"
                    value={s.estimatedMin as any}
                    onChange={(e) =>
                      updateSubtask(
                        s.id,
                        "estimatedMin",
                        e.target.value === ""
                          ? ""
                          : Number(
                              e.target.value
                            )
                      )
                    }
                    placeholder="想定分(分)"
                    style={{
                      width: 160,
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #ddd",
                    }}
                    disabled={sending}
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSubtask}
              disabled={sending}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
              }}
            >
              タスクを追加
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "#059669",
                color: "white",
                border: "none",
              }}
            >
              {sending ? "送信中..." : "一括追加する"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/todo")}
              disabled={sending}
              style={{
                padding: "10px 14px",
                borderRadius: 6,
              }}
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* AI モード：TaskIdeasPanel */}
      {mode === "ai" && (
        <div style={{ marginTop: 8 }}>
          <p
            style={{
              fontSize: 13,
              color: "#555",
              marginBottom: 8,
            }}
          >
            過去に登録した「目的＋タスク群」から似たパターンを探して、
            複数タスクフォームに流し込めます。
          </p>
          <TaskIdeasPanel
            onApplyIdeas={handleApplyIdeasFromAI}
          />
        </div>
      )}
    </div>
  );
}
