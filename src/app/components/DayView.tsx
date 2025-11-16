// src/app/components/DayView.tsx
"use client";

/**
 * DayView.tsx
 * - 指定した日付（YYYY-MM-DD）の TODO を表示する簡易ビュー
 * - 「前日」「翌日」ボタンで日付を移動
 * - 親（カレンダー）から initialDate が変わったときも反映
 * - onDateChange を受け取っていれば、前日/翌日ボタンで親に通知
 * - 各TODOの「詳細」から TodoDetailModal を開いて編集できる
 */

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import TodoDetailModal from "./TodoDetailModal";

type Todo = {
  id: string;
  title: string;
  date?: string | null;
  done?: boolean;
};

type DayViewProps = {
  initialDate?: string;
  onDateChange?: (newDate: string) => void; // ★ 追加
};

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: string, delta: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return formatDateYYYYMMDD(d);
}

export default function DayView({ initialDate, onDateChange }: DayViewProps) {
  // initialDate が無ければ今日
  const todayStr = initialDate ?? formatDateYYYYMMDD(new Date());

  const [currentDate, setCurrentDate] = useState<string>(todayStr);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // ★ 親から initialDate が変わったら currentDate を更新
  useEffect(() => {
    if (initialDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate]);

  // Firestore 購読
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Todo[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title ?? "",
            date: data.date ?? null,
            done: data.done ?? false,
          };
        });
        // 現在の日付だけに絞る
        const filtered = arr.filter((t) => t.date === currentDate);
        setTodos(filtered);
        setLoading(false);
      },
      (err) => {
        console.error("DayView onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentDate]);

  // ★ 前日・翌日で親にも通知する
  const goNext = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, 1);
      if (onDateChange) onDateChange(next);
      return next;
    });
  };

  const goPrev = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, -1);
      if (onDateChange) onDateChange(next);
      return next;
    });
  };

  return (
    <section
      style={{
        border: "1px solid #eee",
        padding: 12,
        borderRadius: 8,
      }}
    >
      {/* 上部のナビ（前日/翌日ボタン + 日付） */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <button onClick={goPrev} style={{ marginRight: 8 }}>
            前日
          </button>
          <button onClick={goNext}>翌日</button>
        </div>
        <h4 style={{ margin: 0 }}>{currentDate}</h4>
      </div>

      {/* 本体 */}
      {loading ? (
        <div>読み込み中…</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {todos.length === 0 && (
            <li style={{ color: "#666" }}>
              この日の TODO はありません
            </li>
          )}
          {todos.map((t) => (
            <li
              key={t.id}
              style={{
                padding: 8,
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <strong
                style={{
                  textDecoration: t.done ? "line-through" : "none",
                  flex: 1,
                }}
              >
                {t.title}
              </strong>
              <button
                onClick={() => setSelectedTodoId(t.id)}
                style={{ fontSize: 12 }}
              >
                詳細
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 詳細モーダル */}
      {selectedTodoId && (
        <TodoDetailModal
          todoId={selectedTodoId}
          onClose={() => setSelectedTodoId(null)}
        />
      )}
    </section>
  );
}
