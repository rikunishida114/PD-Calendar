// src/app/calendar/page.tsx
// 月表示カレンダー + その日のざっくり TODO 一覧 + 下に DayView を出すページ
// Firestore の plans コレクションから date="YYYY-MM-DD" で集計します。

"use client";

/**
 * CalendarPage.tsx
 * -------------------------------------------------------------
 * 役割:
 *  - 月間カレンダーと、選択した日の TODO 概要 + 詳細（DayView）をまとめて表示するページ。
 *  - Firestore の plans コレクションから、当該月の TODO をまとめて購読し、日付ごとの件数/完了数などを集計する。
 *
 * 設計方針:
 *  - 「カレンダー ⇄ DayView」で日付を連動させる。
 *    - カレンダーで日付をクリック → selectedDate を更新 → DayView に渡る。
 *    - DayView の前日/翌日ボタン → onDateChange で親に通知 → selectedDate / year / month を更新。
 *  - ただし、onDateChange は DayView のイベントハンドラ内だけから呼ばれるようにし、
 *    「子のレンダリング中に親の setState が走る」状況は作らない。
 *
 * 関連コンポーネント:
 *  - DayView: 指定日付の TODO を一覧表示する日別ビュー。
 *  - Firestore (plans コレクション): 各タスクに date, done, title などが入っている前提。
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import DayView from "../components/DayView";

/** 1日のタスクざっくり情報 */
type DaySummary = {
  date: string; // "YYYY-MM-DD"
  total: number; // 件数
  done: number; // 完了数
  titles: string[]; // タイトル（先頭数件）
};

/** Date → "YYYY-MM-DD" 文字列への変換ユーティリティ */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 文字列 "YYYY-MM-DD" → Date への変換ユーティリティ（失敗したら null） */
function parseDateString(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** その月の日数を返す（month: 0-11 前提） */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarPage() {
  // ------------------------------------------------------------
  // ① 今日を基準とした年月・選択日 state
  // ------------------------------------------------------------
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth()); // 0-11
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // カレンダーで選択中の日付（下の DayView 用）
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateYYYYMMDD(today)
  );

  // ------------------------------------------------------------
  // ② DayView からの「日付変更通知」を受け取るハンドラ
  //    - 前日/翌日で選択日が変わったときなどに呼ばれる。
  //    - newDate に合わせて selectedDate / year / month を更新する。
  // ------------------------------------------------------------
  const handleDateChangeFromDayView = (newDate: string) => {
    setSelectedDate(newDate);

    const d = parseDateString(newDate);
    if (!d) return;

    const newYear = d.getFullYear();
    const newMonth = d.getMonth(); // 0-11

    // 年月が変わっていたら、カレンダーの表示も追従させる
    if (newYear !== year) setYear(newYear);
    if (newMonth !== month) setMonth(newMonth);
  };

  // ------------------------------------------------------------
  // ③ 月移動（前月/次月）
  // ------------------------------------------------------------
  const goPrevMonth = () => {
    setSummaries({});
    setLoading(true);
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setSummaries({});
    setLoading(true);
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  // ------------------------------------------------------------
  // ④ Firestore から「その月の TODO」をまとめて取得・集計
  // ------------------------------------------------------------
  useEffect(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month, getDaysInMonth(year, month));

    const startStr = formatDateYYYYMMDD(first); // >=
    const endStr = formatDateYYYYMMDD(last); // <=

    const q = query(
      collection(db, "plans"),
      where("date", ">=", startStr),
      where("date", "<=", endStr),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, DaySummary>();

        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const dateStr: string = d.date || ""; // "YYYY-MM-DD"
          if (!dateStr) return;

          if (!map.has(dateStr)) {
            map.set(dateStr, {
              date: dateStr,
              total: 0,
              done: 0,
              titles: [],
            });
          }
          const cur = map.get(dateStr)!;
          cur.total += 1;
          if (d.done) cur.done += 1;
          if (typeof d.title === "string" && d.title.trim()) {
            if (cur.titles.length < 3) {
              cur.titles.push(d.title.trim());
            }
          }
        });

        const obj: Record<string, DaySummary> = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });
        setSummaries(obj);
        setLoading(false);
      },
      (err) => {
        console.error("CalendarPage onSnapshot error:", err);
        setSummaries({});
        setLoading(false);
      }
    );

    return () => unsub();
  }, [year, month]);

  // ------------------------------------------------------------
  // ⑤ カレンダー表示用の 6週 x 7日 グリッドを作る
  // ------------------------------------------------------------
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay(); // 0:日〜6:土
    const daysInMonth = getDaysInMonth(year, month);

    const cells: { dateStr: string | null; dayNumber: number | null }[] = [];

    for (let i = 0; i < 42; i++) {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push({ dateStr: null, dayNumber: null });
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({
          dateStr: formatDateYYYYMMDD(d),
          dayNumber: dayNum,
        });
      }
    }

    const w: { dateStr: string | null; dayNumber: number | null }[][] = [];
    for (let i = 0; i < 6; i++) {
      w.push(cells.slice(i * 7, i * 7 + 7));
    }
    return w;
  }, [year, month]);

  const monthLabel = `${year}年 ${month + 1}月`;

  // ------------------------------------------------------------
  // ⑥ レンダリング
  // ------------------------------------------------------------
  return (
    <main style={{ padding: 16 }}>
      {/* カレンダーヘッダー（前月 / 月表示 / 次月） */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button onClick={goPrevMonth}>◀ 前の月</button>
        <h2 style={{ margin: 0 }}>{monthLabel}</h2>
        <button onClick={goNextMonth}>次の月 ▶</button>
      </section>

      {/* 月カレンダー */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          border: "1px solid #eee",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* 曜日ヘッダ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            background: "#f9fafb",
            borderBottom: "1px solid #eee",
            textAlign: "center",
            padding: "4px 0",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <div>日</div>
          <div>月</div>
          <div>火</div>
          <div>水</div>
          <div>木</div>
          <div>金</div>
          <div>土</div>
        </div>

        {/* 日付グリッド */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {weeks.map((week, wi) =>
            week.map((cell, ci) => {
              const key = `${wi}-${ci}`;
              const summary =
                cell.dateStr && summaries[cell.dateStr];

              const isSelected =
                cell.dateStr && cell.dateStr === selectedDate;

              return (
                <div
                  key={key}
                  style={{
                    borderRight:
                      (ci + 1) % 7 === 0 ? "none" : "1px solid #eee",
                    borderBottom:
                      wi === weeks.length - 1
                        ? "none"
                        : "1px solid #eee",
                    minHeight: 80,
                    padding: 4,
                    boxSizing: "border-box",
                    background: isSelected
                      ? "rgba(59,130,246,0.1)"
                      : "white",
                    cursor: cell.dateStr ? "pointer" : "default",
                    opacity: cell.dateStr ? 1 : 0.4,
                  }}
                  onClick={() => {
                    if (!cell.dateStr) return;
                    setSelectedDate(cell.dateStr);
                  }}
                >
                  {/* 日付数字 */}
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {cell.dayNumber ?? ""}
                  </div>

                  {/* その日のざっくり TODO 情報 */}
                  {summary && (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: "#111827",
                      }}
                    >
                      {summary.titles.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          ・{t}
                        </div>
                      ))}
                      {summary.total > summary.titles.length && (
                        <div style={{ color: "#6b7280" }}>
                          他 {summary.total - summary.titles.length} 件
                        </div>
                      )}
                      <div style={{ color: "#10b981" }}>
                        完了 {summary.done}/{summary.total}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 下に DayView を表示（選択した日） */}
      <section
        style={{
          maxWidth: 800,
          margin: "16px auto 0",
        }}
      >
        <h3 style={{ marginBottom: 8 }}>
          {selectedDate} の詳細 TODO
        </h3>
        {/* ★ DayView に onDateChange を渡すことで、前日/翌日ボタンからもカレンダーを動かす */}
        <DayView
          initialDate={selectedDate}
          onDateChange={handleDateChangeFromDayView}
        />
      </section>

      {/* カレンダーデータ読込中の簡易インジケータ */}
      {loading && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          カレンダーのデータ読み込み中…
        </div>
      )}
    </main>
  );
}
