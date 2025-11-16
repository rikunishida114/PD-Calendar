// src/app/components/TodoList.tsx
"use client";

/**
 * TodoList.tsx
 *
 * このファイルの役割
 * - Firestore の plans コレクションから「直近の TODO」を集計して表示する一覧コンポーネント。
 * - createdAt 降順で最大 50 件をリアルタイム購読し、
 *   - 日付や createdAt でフロント側ソート
 *   - 今日以降のタスクを優先表示
 *   - 直近 10 件だけを画面に出す
 * - 各行のチェックボックスで done をトグルする。
 *
 * 設計方針
 * - Firestore からは「ざっくり最新 50 件」を持ってきて、
 *   フロント側で「日付の近さ」と「今日以降かどうか」を考慮した並びにする。
 * - 完了トグル中は updatingIds でロックし、二重クリックによる競合を防ぐ。
 * - estimatedMin は DB では number | null、UI はそのまま表示に使うだけなので、
 *   このコンポーネントでは number | null に統一して扱う。
 *
 * 関連コンポーネント
 * - TodoPage（/todo/page.tsx）から呼ばれ、DayView の下に「直近の TODO」として表示される。
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
import { db } from "@/lib/firebase";

// ---- 型定義 -------------------------------------------------------------------

type Todo = {
  id: string;
  title: string;
  estimatedMin: number | null; // Firestore 上は number | null として統一
  date: string | null; // "YYYY-MM-DD" 想定
  done: boolean;
  folder: string | null;
  createdAt?: any; // firestore.Timestamp など（ソート用）
};

// ---- メインコンポーネント ----------------------------------------------------

export default function TodoList() {
  // Firestore から取得した TODO 一覧
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * updatingIds:
   * - key: todo.id
   * - value: true のとき、その Todo の done 更新中としてチェックボックスをロックする。
   */
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

  // 今日の日付（"YYYY-MM-DD"）
  const todayStr = new Date().toISOString().slice(0, 10);

  // ========================================================================
  // ① Firestore から plans をリアルタイム購読
  // ========================================================================

  useEffect(() => {
    // Query: createdAt 降順で最新 50 件取得
    const colRef = collection(db, "plans");
    const q = query(colRef, orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        try {
          // snapshot -> Todo[] に変換（UI で扱いやすい形に補正）
          const items: Todo[] = snapshot.docs.map((d) => {
            const data = d.data();

            return {
              id: d.id,
              title:
                typeof data.title === "string" && data.title.trim()
                  ? data.title
                  : "（無題）",
              estimatedMin:
                typeof data.estimatedMin === "number"
                  ? data.estimatedMin
                  : null,
              date:
                typeof data.date === "string" && data.date.trim()
                  ? data.date
                  : null,
              done: !!data.done,
              folder:
                typeof data.folder === "string" && data.folder.trim()
                  ? data.folder
                  : null,
              createdAt: data.createdAt ?? null,
            };
          });

          // --- ソートロジック ------------------------------------------------
          // 1. date があれば "YYYY-MM-DD" 文字列の昇順（近い日付が先）
          // 2. date がない場合は createdAt の降順（新しいものが先）
          const sorted = items.sort((a, b) => {
            if (a.date && b.date) {
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

            return tb - ta;
          });

          // --- フィルタロジック ----------------------------------------------
          // - date がないものは「いつかやるタスク」とみなして常に表示対象
          // - date があるものは、today 以降（今日〜未来）を残す
          const filtered = sorted.filter((t) => {
            if (!t.date) return true;
            return t.date >= todayStr;
          });

          // 直近 10 件だけ表示
          setTodos(filtered.slice(0, 10));
          setLoading(false);
          setError(null);
        } catch (e) {
          console.error("TodoList snapshot processing error", e);
          setError("データ処理エラー（コンソールを確認してください）");
          setLoading(false);
        }
      },
      (err) => {
        console.error("TodoList onSnapshot error:", err);
        setError("データ取得エラー（ネットワークまたは Firestore ルールを確認）");
        setLoading(false);
      }
    );

    // cleanup: コンポーネントアンマウント時に購読解除
    return () => unsubscribe();
  }, [todayStr]);

  // ========================================================================
  // ② 完了トグル（done フラグの更新）
  // ========================================================================

  async function toggleDone(todo: Todo) {
    if (!todo || !todo.id) return;

    // 既に更新中なら無視（連打対策）
    if (updatingIds[todo.id]) return;

    // 更新中フラグON
    setUpdatingIds((prev) => ({ ...prev, [todo.id]: true }));

    try {
      const docRef = doc(db, "plans", todo.id);
      await updateDoc(docRef, {
        done: !todo.done,
      });
      // 成功時は onSnapshot のコールバックで UI 側の状態が自動更新される。
    } catch (err) {
      console.error("toggleDone error", err);
      setError("完了状態の更新に失敗しました。");
    } finally {
      // 更新完了後にロック解除
      setUpdatingIds((prev) => {
        const copy = { ...prev };
        delete copy[todo.id];
        return copy;
      });
    }
  }

  // ========================================================================
  // ③ レンダリング
  // ========================================================================

  if (loading) {
    return <div>読み込み中…</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  if (todos.length === 0) {
    return (
      <div>
        直近の TODO はありません。右下の「＋」ボタンから新しいタスクを追加してください。
      </div>
    );
  }

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
            {/* チェックボックス（完了トグル） */}
            <input
              type="checkbox"
              checked={t.done}
              disabled={!!updatingIds[t.id]}
              onChange={() => toggleDone(t)}
            />

            {/* タスク情報 */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  textDecoration: t.done ? "line-through" : "none",
                }}
              >
                {t.title}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                {t.folder && (
                  <span style={{ marginRight: 10 }}>📁 {t.folder}</span>
                )}
                {t.date && (
                  <span style={{ marginRight: 10 }}>📅 {t.date}</span>
                )}
                {t.estimatedMin != null && (
                  <span>⏱ {t.estimatedMin}分</span>
                )}
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
