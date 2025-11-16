// src/app/components/DayView.tsx
"use client";

/**
 * DayView.tsx
 *
 * このファイルの役割
 * - 指定した日付（YYYY-MM-DD）の TODO を一覧表示する「1日ビュー」コンポーネント。
 * - 「前日」「翌日」ボタンで日付を移動できるナビゲーション付き。
 * - 親（例: カレンダーページ）から initialDate を受け取って初期日付を決め、
 *   subsequent な変更も反映する（＝親主導の変更にも追従）。
 * - onDateChange を渡しておくと、前日/翌日ボタンで日付が変わったときに親へ通知できる。
 * - 各 TODO の「詳細」ボタンから TodoDetailModal を開いて編集可能。
 *
 * 設計方針
 * - このコンポーネントは「日付 × plans コレクション」の一覧表示に責務を絞る。
 *   - タスクの編集・削除などは TodoDetailModal や他コンポーネント側に任せる。
 * - Firestore 購読は currentDate に依存しており、
 *   日付が変わるたびに購読先を切り替えて、常に最新のその日のタスクを表示する。
 *
 * 関連コンポーネント / モジュール
 * - TodoDetailModal
 * - カレンダーページ（例: src/app/calender/page.tsx）
 *   - DayView の initialDate / onDateChange を用いて、日付選択を同期する。
 */

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import TodoDetailModal from "./TodoDetailModal";

// ---- 型定義 -------------------------------------------------------------------

/**
 * Firestore の plans コレクションから読み取る TODO の型（必要なフィールドのみ）
 */
type Todo = {
  id: string;
  title: string;
  date?: string | null;
  done?: boolean;
};

/**
 * DayView コンポーネントの props
 * - initialDate: 初期表示の日付（未指定なら「今日」）。
 * - onDateChange: 前日/翌日ボタンで日付が変更されたときに親へ通知するためのコールバック。
 */
type DayViewProps = {
  initialDate?: string;
  onDateChange?: (newDate: string) => void;
};

// ---- 日付関連ユーティリティ --------------------------------------------------

/**
 * Date を "YYYY-MM-DD" 形式の文字列に変換するヘルパー。
 * - Firestore に保存している date 文字列と同じフォーマットに合わせる。
 */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * "YYYY-MM-DD" 形式の文字列に日数を加減した新しい日付文字列を返す。
 * - Base を Date にして setDate で日数を加算するシンプルな実装。
 */
function addDays(base: string, delta: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return formatDateYYYYMMDD(d);
}

// ---- メインコンポーネント ----------------------------------------------------

export default function DayView({ initialDate, onDateChange }: DayViewProps) {
  // ---- 初期日付の決定 --------------------------------------------------------

  // initialDate があればそれを使い、なければ「今日」を初期値とする。
  const todayStr = initialDate ?? formatDateYYYYMMDD(new Date());

  // 現在表示中の日付（前日/翌日ボタンで変わる）
  const [currentDate, setCurrentDate] = useState<string>(todayStr);

  // 現在の日付に紐づく TODO リスト
  const [todos, setTodos] = useState<Todo[]>([]);

  // Firestore 取得中かどうか
  const [loading, setLoading] = useState(true);

  // 詳細モーダル表示用に、選択中の TODO ID を保持
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  // ---- 親から initialDate が変わったときに currentDate を同期する ---------

  useEffect(() => {
    if (initialDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate]);

  // ---- Firestore 購読（currentDate の変更に追従） --------------------------

  useEffect(() => {
    setLoading(true);

    // createdAt 降順で全 plans を取得し、クライアント側で currentDate だけに絞り込む。
    // ※ where("date", "==", currentDate) + orderBy を組み合わせる実装もあり得るが、
    //   現時点ではインデックス要件を増やさないため、クライアントフィルタで実装している。
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

    // 日付が変わったとき / コンポーネント unmount 時に購読解除
    return () => unsub();
  }, [currentDate]);

  // ---- 日付ナビゲーション（前日 / 翌日） -----------------------------------

  /**
   * 翌日に移動する。
   * - currentDate を翌日に更新し、その値を onDateChange で親にも通知する。
   */
  const goNext = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, 1);
      if (onDateChange) onDateChange(next);
      return next;
    });
  };

  /**
   * 前日に移動する。
   * - goNext と同様に currentDate を更新し、親に通知する。
   */
  const goPrev = () => {
    setCurrentDate((prev) => {
      const next = addDays(prev, -1);
      if (onDateChange) onDateChange(next);
      return next;
    });
  };

  // ---- レンダリング ---------------------------------------------------------

  return (
    <section
      style={{
        border: "1px solid #eee",
        padding: 12,
        borderRadius: 8,
      }}
    >
      {/* 上部ナビ（前日/翌日ボタン + 日付表示） */}
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

      {/* TODO リスト本体 */}
      {loading ? (
        <div>読み込み中…</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {/* TODO が1件もない日の表示 */}
          {todos.length === 0 && (
            <li style={{ color: "#666" }}>この日の TODO はありません</li>
          )}

          {/* 各 TODO 行 */}
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

      {/* 詳細モーダル（TodoDetailModal） */}
      {selectedTodoId && (
        <TodoDetailModal
          todoId={selectedTodoId}
          onClose={() => setSelectedTodoId(null)}
        />
      )}
    </section>
  );
}
