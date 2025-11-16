// src/app/components/TodoList.tsx
"use client";

/**
 * TodoList (merged)
 * - Firestore をリアルタイム購読 (onSnapshot)
 * - createdAt 降順で取得 (limit 50)
 * - フロントで日付フィルタ・ソートして直近 10 件を表示 (v1 のロジック)
 * - 各 Todo の完了トグル (updateDoc) と更新中ロック (v2 のロジック)
 *
 * 保存先はプロジェクト構成に合わせてください。
 * import { db } from "@/lib/firebase"; //  ← tsconfig paths を使っている場合
 * import { db } from "../../lib/firebase"; // ← app/components からの相対パス例
 */

import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
// ← ここはあなたの実際のパスに合わせてください。
// 例: import { db } from "@/lib/firebase";
import { db } from "@/lib/firebase";

/** 型定義 */
type Todo = {
  id: string;
  title: string;
  estimatedMin?: number | null;
  date?: string | null; // 'YYYY-MM-DD' 想定
  done?: boolean;
  folder?: string | null;
  createdAt?: any;
};

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

  // today を 'YYYY-MM-DD' 形式で作成
  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    // Query: createdAt 降順で最新 50 件取得
    const colRef = collection(db, "plans");
    const q = query(colRef, orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          // snapshot を Todo[] に変換
          const items: Todo[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title ?? "（無題）",
              estimatedMin: data.estimatedMin ?? null,
              date: data.date ?? null,
              done: data.done ?? false,
              folder: data.folder ?? null,
              createdAt: data.createdAt ?? null,
            } as Todo;
          });

          // sort: date があれば日付で昇順、なければ createdAt の降順を使う
          const sorted = items.sort((a, b) => {
            if (a.date && b.date) {
              // 'YYYY-MM-DD' の文字列比較で日付順（昇順）
              return a.date.localeCompare(b.date);
            }
            const ta =
              a.createdAt && typeof a.createdAt.toDate === "function"
                ? a.createdAt.toDate().getTime()
                : 0;
            const tb =
              b.createdAt && typeof b.createdAt.toDate === "function"
                ? b.createdAt.toDate().getTime()
                : 0;
            // createdAt が新しい順（降順）
            return tb - ta;
          });

          // filter: today 以降のものを優先（ただし日付がないものは表示対象）
          const filtered = sorted.filter((t) => {
            if (!t.date) return true;
            return t.date >= todayStr;
          });

          setTodos(filtered.slice(0, 10)); // 直近 10 件を表示
          setLoading(false);
          setError(null);
        } catch (e) {
          console.error("snapshot processing error", e);
          setError("データ処理エラー（コンソールを確認）");
          setLoading(false);
        }
      },
      (err) => {
        console.error("onSnapshot error:", err);
        setError("データ取得エラー（ネットワークまたはルールを確認）");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [todayStr]);

  // 完了トグル
  async function toggleDone(todo: Todo) {
    if (!todo || !todo.id) return;
    if (updatingIds[todo.id]) return;

    setUpdatingIds((p) => ({ ...p, [todo.id]: true }));

    try {
      const docRef = doc(db, "plans", todo.id);
      await updateDoc(docRef, {
        done: !todo.done,
      });
      // 成功時は onSnapshot が UI を更新してくれる
    } catch (err) {
      console.error("toggleDone error", err);
      setError("完了状態の更新に失敗しました。");
    } finally {
      setUpdatingIds((prev) => {
        const copy = { ...prev };
        delete copy[todo.id];
        return copy;
      });
    }
  }

  // レンダリング
  if (loading) return <div>読み込み中…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (todos.length === 0)
    return <div>直近の TODO はありません。右下の + で追加してください。</div>;

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>直近の TODO</h3>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #eee",
              marginBottom: 8,
            }}
          >
            {/* チェックボックス */}
            <input
              type="checkbox"
              checked={!!t.done}
              disabled={!!updatingIds[t.id]}
              onChange={() => toggleDone(t)}
            />

            {/* タイトル */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, textDecoration: t.done ? "line-through" : "none" }}>
                {t.title}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                {t.folder && <span style={{ marginRight: 10 }}>📁 {t.folder}</span>}
                {t.date && <span style={{ marginRight: 10 }}>📅 {t.date}</span>}
                {t.estimatedMin !== undefined && <span>⏱ {t.estimatedMin}分</span>}
              </div>
            </div>

            {/* 状態表示 */}
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div>{t.done ? "完了" : "未完"}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
