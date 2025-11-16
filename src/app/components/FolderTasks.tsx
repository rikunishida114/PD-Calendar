// src/app/components/FolderTasks.tsx
"use client";

import React, { useEffect, useState } from "react";
import TodoDetailModal from "./TodoDetailModal";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

type TodoItem = {
  id: string;
  title?: string;
  description?: string;
  period?: string;
  done?: boolean;
  createdAt?: any;
  folder?: string;
};

export default function FolderTasks({ folderId }: { folderId: string }) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderId) {
      setTodos([]);
      return;
    }

    let unsub = () => {};
    try {
      // 「（未分類）」だけ特別扱い
      if (folderId === "（未分類）") {
        // folder が空 or 未定義のものをクライアント側でフィルタ
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
              // folder がない or 空文字 → 未分類扱い
              const f = (data.folder && typeof data.folder === "string") ? data.folder.trim() : "";
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
        // 通常フォルダ: folder === folderId のものだけ取得
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
      console.error("FolderTasks setup error:", e);
      setError("FolderTasks のセットアップに失敗しました");
    }

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [folderId]);

  const toggleDone = async (todo: TodoItem) => {
    try {
      const ref = doc(db, "plans", todo.id);
      await updateDoc(ref, { done: !todo.done });
    } catch (e) {
      console.error("toggleDone error", e);
    }
  };

  return (
    <div>
      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}

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
            <input
              type="checkbox"
              checked={!!t.done}
              onChange={() => toggleDone(t)}
              aria-label={`完了: ${t.title}`}
            />

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.title || "(タイトルなし)"}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {t.period || t.description || ""}
              </div>
            </div>

            <button
              onClick={() => setSelectedTodoId(t.id)}
              style={{ padding: "6px 10px" }}
            >
              詳細
            </button>
          </li>
        ))}
      </ul>

      {selectedTodoId && (
        <TodoDetailModal
          todoId={selectedTodoId}
          onClose={() => setSelectedTodoId(null)}
        />
      )}
    </div>
  );
}
