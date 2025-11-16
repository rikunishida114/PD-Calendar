// src/app/components/FolderTasks.tsx
"use client";

/**
 * FolderTasks.tsx
 *
 * このファイルの役割
 * - 指定された folderId に紐づく Todo（plans コレクション）を一覧表示するコンポーネント。
 * - 各 Todo の完了状態のトグル・詳細モーダル表示を行う。
 *
 * 設計方針
 * - 「フォルダごとのタスク一覧表示と簡易操作」に責務を限定する。
 *   - 詳細編集は TodoDetailModal に委ねる。
 * - folderId === "（未分類）" のときだけ例外的に、
 *   folder が空 or 未定義のタスクを「未分類」として扱う。
 *   （ルーティング側で decodeURIComponent した結果を渡している前提）
 * - Firestore との通信は useEffect 内で onSnapshot し、リアルタイムに反映する。
 *
 * 関連コンポーネント / ページ
 * - FolderSidebar.tsx
 *   - フォルダ一覧と完了状況を表示し、クリックでこの FolderTasks を使うページへ遷移する。
 * - TodoDetailModal
 */

import React, { useEffect, useState } from "react";
import TodoDetailModal from "./TodoDetailModal";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---- 型定義 -------------------------------------------------------------------

/**
 * plans コレクションから取得する TODO の型（必要なフィールドのみ）
 */
type TodoItem = {
  id: string;
  title?: string;
  description?: string;
  period?: string;
  done?: boolean;
  createdAt?: any;
  folder?: string;
};

// ---- 定数 --------------------------------------------------------------------

/**
 * 未分類フォルダとして扱う表示名。
 * - FolderSidebar 側が name として使っている想定。
 * - ルーティング側では encodeURIComponent / decodeURIComponent を挟むことが多い。
 */
const UNCLASSIFIED_LABEL = "（未分類）";

// ---- メインコンポーネント ----------------------------------------------------

export default function FolderTasks({ folderId }: { folderId: string }) {
  // 表示対象のフォルダの Todo 一覧
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // 詳細モーダル用の選択中 Todo ID
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // Firestore 読み取りやセットアップ時のエラー
  const [error, setError] = useState<string | null>(null);

  // ---- Firestore 購読（folderId の変更に追従） -----------------------------

  useEffect(() => {
    // folderId が不正（空）な場合は何も表示しない
    if (!folderId) {
      setTodos([]);
      return;
    }

    let unsub = () => {};
    try {
      // 「未分類」フォルダだけ特別扱い
      if (folderId === UNCLASSIFIED_LABEL) {
        // folder が存在しない or 空文字のものをクライアント側でフィルタする。
        const q = query(
          collection(db, "plans"),
          orderBy("createdAt", "desc")
        );
        unsub = onSnapshot(
          q,
          (snapshot) => {
            const items: TodoItem[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as any;
              const f =
                data.folder && typeof data.folder === "string"
                  ? data.folder.trim()
                  : "";
              // folder が空なら「未分類」とみなす
              if (!f) {
                items.push({ id: d.id, ...data });
              }
            });
            setTodos(items);
            setError(null);
          },
          (err) => {
            console.error("FolderTasks onSnapshot error (unclassified):", err);
            setError("Firestore 読み取りエラー（未分類）");
          }
        );
      } else {
        // 通常のフォルダ: folder === folderId のものだけ取得
        const q = query(
          collection(db, "plans"),
          where("folder", "==", folderId),
          orderBy("createdAt", "desc")
        );
        unsub = onSnapshot(
          q,
          (snapshot) => {
            const items: TodoItem[] = [];
            snapshot.forEach((d) => {
              items.push({ id: d.id, ...(d.data() as any) });
            });
            setTodos(items);
            setError(null);
          },
          (err) => {
            console.error("FolderTasks onSnapshot error:", err);
            setError("Firestore 読み取りエラー");
          }
        );
      }
    } catch (e) {
      // query 構築などで例外が起きた場合
      console.error("FolderTasks setup error:", e);
      setError("FolderTasks のセットアップに失敗しました");
    }

    // クリーンアップ：folderId が変わったとき / コンポーネント unmount 時に購読解除
    return () => {
      try {
        unsub();
      } catch {
        // ここでのエラーは無視（unsub が noop の可能性もあるため）
      }
    };
  }, [folderId]);

  // ---- 完了チェックのトグル --------------------------------------------------

  /**
   * Todo の done フラグをトグルする。
   * - Firestore 上の plans ドキュメントを updateDoc で更新。
   * - 成功すると onSnapshot によって一覧が自動更新される。
   */
  const toggleDone = async (todo: TodoItem) => {
    try {
      const ref = doc(db, "plans", todo.id);
      await updateDoc(ref, { done: !todo.done });
    } catch (e) {
      console.error("toggleDone error", e);
    }
  };

  // ---- レンダリング ---------------------------------------------------------

  return (
    <div>
      {/* エラーメッセージ表示（あれば） */}
      {error && (
        <div style={{ color: "red", marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Todo 一覧 */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {todos.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 8px",
              borderBottom: "1px solid #eee",
            }}
          >
            {/* 完了チェックボックス */}
            <input
              type="checkbox"
              checked={!!t.done}
              onChange={() => toggleDone(t)}
              aria-label={`完了: ${t.title}`}
            />

            {/* タスクのタイトル + 補足情報（period or description） */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {t.title || "(タイトルなし)"}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {t.period || t.description || ""}
              </div>
            </div>

            {/* 詳細モーダルを開くボタン */}
            <button
              onClick={() => setSelectedTodoId(t.id)}
              style={{ padding: "6px 10px" }}
            >
              詳細
            </button>
          </li>
        ))}
      </ul>

      {/* Todo 詳細モーダル */}
      {selectedTodoId && (
        <TodoDetailModal
          todoId={selectedTodoId}
          onClose={() => setSelectedTodoId(null)}
        />
      )}
    </div>
  );
}
