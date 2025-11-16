// src/app/components/DayView.tsx
"use client";

/**
 * DayView.tsx
 * -------------------------------------------------------------
 * 役割:
 *  - 指定された日付（YYYY-MM-DD）の TODO を一覧表示する日別ビュー。
 *  - 「前日」「翌日」ボタンで日付を移動できる。
 *  - 親（例: CalendarPage）から initialDate が変わったときも currentDate を同期する。
 *  - 親に onDateChange(newDate) を渡しておくと、
 *    日付をボタンで変更したタイミングでだけ親に通知する。
 *
 * 設計方針:
 *  - Firestore からは plans コレクションの全件を createdAt 降順で購読し、
 *    フロント側で currentDate にマッチするものだけをフィルタ。
 *  - 「レンダリング中には絶対に親コンポーネントの setState を呼ばない」:
 *    → onDateChange の呼び出しは前日/翌日ボタンなどのイベントハンドラ内のみ。
 */

import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import TodoDetailModal from "./TodoDetailModal";

/** Firestore plans コレクションから拾う最低限の型 */
type Todo = {
  id: string;
  title: string;
  date?: string | null; // "YYYY-MM-DD" 想定
  done?: boolean;
};

type DayViewProps = {
  /** 親から渡される初期日付（省略時は今日を使う） */
  initialDate?: string;
  /**
   * 親に日付変更を伝えるコールバック。
   * 注意: 「前日」「翌日」ボタンなどのユーザー操作時のみ呼び出す。
   * （レンダリング中には呼ばない → React 警告回避のため）
   */
  onDateChange?: (newDate: string) => void;
};

/** Date → "YYYY-MM-DD" への変換ユーティリティ */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" の文字列に日数を足し引きするユーティリティ */
function addDays(base: string, delta: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return formatDateYYYYMMDD(d);
}

export default function DayView({ initialDate, onDateChange }: DayViewProps) {
  // ------------------------------------------------------------
  // ① 表示中の日付 state
  //    - initialDate が来なければ「今日」で初期化。
  // ------------------------------------------------------------
  const todayStr = initialDate ?? formatDateYYYYMMDD(new Date());
  const [currentDate, setCurrentDate] = useState<string>(todayStr);

  // Firestore から取ってきた「currentDate の TODO 一覧」
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // ------------------------------------------------------------
  // ② 親から initialDate が変わったら currentDate を同期する
  //    ※ ここでは onDateChange は呼ばない（親の setState をレンダリング中に触らないため）
  // ------------------------------------------------------------
  useEffect(() => {
    if (initialDate && initialDate !== currentDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate, currentDate]);

  // ------------------------------------------------------------
  // ③ Firestore 購読（currentDate にマッチするものだけフロント側でフィルタ）
  // ------------------------------------------------------------
  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, "plans"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const all: Todo[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              title: data.title ?? "",
              date: data.date ?? null,
              done: data.done ?? false,
            };
          });

          // 表示中の日付だけに絞り込む
          const filtered = all.filter((t) => t.date === currentDate);
          setTodos(filtered);
          setLoading(false);
        } catch (err) {
          console.error("DayView onSnapshot processing error:", err);
          setTodos([]);
          setLoading(false);
        }
      },
      (err) => {
        console.error("DayView onSnapshot error:", err);
        setTodos([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentDate]);

  // ------------------------------------------------------------
  // ④ 前日 / 翌日ボタンのハンドラ
  //    - ここでのみ onDateChange を呼び、親に通知する。
  // ------------------------------------------------------------
  const goNext = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, 1);
      if (onDateChange) {
        onDateChange(next); // ← イベントハンドラ内なので安全
      }
      return next;
    });
  };

  const goPrev = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, -1);
      if (onDateChange) {
        onDateChange(next); // ← 同上
      }
      return next;
    });
  };

  // ------------------------------------------------------------
  // ⑤ レンダリング
  // ------------------------------------------------------------
  return (
    <section
      style={{
        border: "1px solid #eee",
        padding: 12,
        borderRadius: 8,
      }}
    >
      {/* 上部ナビゲーション（前日/翌日ボタン + 日付表示） */}
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

      {/* 本体リスト */}
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
